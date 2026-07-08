/**
 * Claude AI library module
 * Wraps @anthropic-ai/sdk with all five exported functions for Workflows 1-3
 * plus the personal post Q&A flow.
 *
 * Security (T-01): ANTHROPIC_API_KEY is read by the SDK from env automatically.
 * It is never logged or included in error messages.
 *
 * Security (T-02): Email content is placed in user messages only.
 * System prompts are hardcoded string literals — never interpolated from user input.
 *
 * Security (T-03): callWithJsonRetry throws on second parse failure rather than
 * returning unvalidated data. Callers (Phase 7 route handlers) catch and return errors.
 */

import Anthropic from "@anthropic-ai/sdk"
import type { EmailMessage, GroupedEmails } from "./gmail"
import type { TavilyResult } from "./search"
import type {
  Workflow1Data,
  EmailSummaryItem,
  Workflow2Data,
  Workflow3ResearchData,
  TrendSnapshot,
} from "@/types/workflow"
import { logger } from "./braintrust"

// ─── Model constants ──────────────────────────────────────────────────────────

/** Per D-03: lighter model for email summarization and intermediate steps */
const MODEL_SUMMARIZE = "claude-haiku-4-5-20251001"

/** Per D-02: locked for final LinkedIn post generation (user has validated tone) */
const MODEL_GENERATE = "claude-sonnet-4-6"

// ─── SDK instantiation (module scope — reuses connections) ────────────────────

/** SDK reads ANTHROPIC_API_KEY from environment automatically. Never log the key. */
const anthropic = new Anthropic()

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Calls Claude and parses a JSON response, with a single retry on parse failure.
 * Per D-05: prompt-based JSON with retry. No Zod.
 *
 * On first parse failure, sends the malformed response back with a correction
 * instruction. Throws if the retry also fails (T-03: never return unvalidated data).
 */
async function callWithJsonRetry<T>(
  systemPrompt: string,
  userMessage: string,
  model: string,
  maxTokens: number = 16384
): Promise<T> {
  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  })

  const text = response.content.find((b) => b.type === "text")?.text ?? ""

  // Strip markdown code fences Claude sometimes wraps JSON in (Pitfall 4)
  const jsonStr = text
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "")
    .trim()

  try {
    return JSON.parse(jsonStr) as T
  } catch {
    // Single retry with correction instruction
    const retryResponse = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [
        { role: "user", content: userMessage },
        { role: "assistant", content: text },
        {
          role: "user",
          content:
            "Your response was not valid JSON. Please respond with ONLY valid JSON matching the schema, no other text.",
        },
      ],
    })
    const retryText =
      retryResponse.content.find((b) => b.type === "text")?.text ?? ""
    const retryJson = retryText
      .replace(/^```(?:json)?\n?/, "")
      .replace(/\n?```$/, "")
      .trim()
    // T-03: throw rather than silently returning malformed data
    return JSON.parse(retryJson) as T
  }
}

/**
 * Calls Claude and returns the plain text response.
 * Used for functions that return strings (no JSON parsing needed).
 */
async function callForText(
  systemPrompt: string,
  userMessage: string,
  model: string,
  maxTokens: number = 4096
): Promise<string> {
  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  })
  return response.content.find((b) => b.type === "text")?.text ?? ""
}

/**
 * Serializes a GroupedEmails Map into a readable string for use in Claude prompts.
 * Format: labeled sections per sender, emails listed with subject and date headers.
 * Per Open Question 3 in RESEARCH.md: readable labeled sections are more reliable
 * for Claude than raw JSON.
 */
function serializeGroupedEmails(grouped: GroupedEmails): string {
  const sections: string[] = []

  for (const [senderEmail, emails] of Array.from(grouped.entries())) {
    const senderName = emails[0]?.senderName ?? senderEmail
    const senderHeader = `## Sender: ${senderEmail} (${senderName})`
    const emailSections = emails.map((email: EmailMessage) => {
      return `### Email: ${email.subject} (${email.date})\n${email.body}`
    })
    sections.push([senderHeader, ...emailSections].join("\n"))
  }

  return sections.join("\n\n")
}

// ─── Exported functions ───────────────────────────────────────────────────────

/**
 * Summarizes emails grouped by sender into structured EmailSummaryItem objects.
 * Implements AI-01 (Workflow 1).
 *
 * Model: claude-haiku-4-5 (per D-03 — lighter model for summarization)
 *
 * Prompt adapted from n8n "Workflow — Email Summarization":
 * - Core instructions preserved (key themes, frameworks, PM takeaways, date range)
 * - Special treatment for hamel_husain@parlance-labs.com and avi@dailydoseofds.com preserved
 * - Cross-Sender Patterns section preserved (mapped to senderEmail: "cross-sender-patterns")
 * - JSON schema added per D-05 to get structured Workflow1Data output
 * - Pitfall 5 mitigation: wrapped in { summaries: [...] } object for reliability
 */
export async function summarizeEmails(
  groupedEmails: GroupedEmails
): Promise<Workflow1Data> {
  return logger.traced(
    async (span) => {
      const senders = Array.from(groupedEmails.keys())
      const emailCount = Array.from(groupedEmails.values()).reduce(
        (sum, list) => sum + list.length,
        0
      )

      const result = await summarizeEmailsImpl(groupedEmails)

      span.log({
        input: {
          emails: Object.fromEntries(groupedEmails),
          dateRange: null,
        },
        output: result,
        metadata: {
          branch: "summary",
          model: MODEL_SUMMARIZE,
          emailCount,
          senders,
        },
      })

      return result
    },
    { name: "summarize-newsletters" }
  )
}

async function summarizeEmailsImpl(
  groupedEmails: GroupedEmails
): Promise<Workflow1Data> {
  const systemPrompt = `You are an AI assistant helping a Product Manager analyze newsletter content. You will receive emails grouped by sender. For each sender, produce one consolidated summary — do not repeat the same point more than once even if it appears across multiple emails from that sender.

For each sender, analyze:
- Key themes (about 5, no duplicates)
- Frameworks or mental models introduced
- Actionable PM takeaways
- Date range covered

For emails from hamel_husain@parlance-labs.com and avi@dailydoseofds.com, provide an Extended Insights section with deeper analysis in the summary field.

After all sender summaries, include a Cross-Sender Patterns entry (use senderEmail: "cross-sender-patterns") that captures themes appearing across multiple senders — do not repeat these themes inside the individual summaries.

Avoid restating the same insight in different words. If a theme recurs, consolidate it into one point.

You MUST respond with ONLY valid JSON in this exact format:
{
  "summaries": [
    {
      "senderEmail": "sender@example.com",
      "dateRange": "human-readable date range e.g. Jan 1–Jan 15, 2025",
      "summary": "2-4 sentence prose summary of key themes. For hamel_husain@parlance-labs.com and avi@dailydoseofds.com, include extended deeper analysis here.",
      "keyTopics": ["framework or mental model 1", "framework 2"],
      "actionableInsights": ["Actionable PM takeaway 1", "Takeaway 2"]
    }
  ]
}
Do not include any text outside the JSON. Do not wrap in markdown code fences.`

  const userMessage = serializeGroupedEmails(groupedEmails)

  // Per Pitfall 5: wrap array in object for reliability, then extract .summaries
  const result = await callWithJsonRetry<{ summaries: EmailSummaryItem[] }>(
    systemPrompt,
    userMessage,
    MODEL_SUMMARIZE
  )

  return result.summaries
}

/**
 * Generates a LinkedIn post from email bodies with optional influencer search results.
 * Implements AI-02 (Workflow 2).
 *
 * Two-step process mirroring the n8n workflow:
 * 1. Summarize email bodies (internal step, Haiku)
 * 2. Generate LinkedIn post from summary + optional research (Sonnet per D-02)
 *
 * Model step 1: claude-haiku-4-5 (intermediate summarization)
 * Model step 2: claude-sonnet-4-6 (final post generation, locked per D-02)
 */
export async function generatePost(
  emailBodies: string[],
  searchResults?: TavilyResult[]
): Promise<Workflow2Data> {
  return logger.traced(
    async (span) => {
      const result = await generatePostImpl(emailBodies, searchResults)

      span.log({
        input: { emails: emailBodies, searchResults: searchResults ?? [] },
        output: result,
        metadata: {
          branch: "linkedin_newsletter",
          model: MODEL_GENERATE,
          intermediateModel: MODEL_SUMMARIZE,
          emailCount: emailBodies.length,
          influencerResultCount: searchResults?.length ?? 0,
        },
      })

      return result
    },
    { name: "generate-linkedin-newsletter" }
  )
}

async function generatePostImpl(
  emailBodies: string[],
  searchResults?: TavilyResult[]
): Promise<Workflow2Data> {
  // Step 1 — Summarize emails (internal, adapted from n8n "Workflow 2 — Summarize Emails")
  const summarizeSystemPrompt = `You are an AI assistant helping a Product Manager analyze newsletter content. Analyze the provided emails and create a comprehensive summary highlighting key PM insights, trends, frameworks, and actionable takeaways. Focus on content relevant to Senior PM roles.

Always extract and include source information (email sender, subject) so users can reference the original content.

You MUST respond with valid JSON only, in exactly this format:
{
  "summary": "your summary here",
  "keyTopics": ["topic1", "topic2", "topic3"]
}
Do not include any text outside the JSON.`

  const emailContent = emailBodies.join("\n\n---\n\n")

  const step1Result = await callWithJsonRetry<{
    summary: string
    keyTopics: string[]
  }>(summarizeSystemPrompt, emailContent, MODEL_SUMMARIZE)

  // Step 2 — Generate LinkedIn post (adapted from n8n "Workflow 2 — Generate LinkedIn Post")
  const generateSystemPrompt = `You are a LinkedIn content strategist helping a Product Manager create compelling posts. Create a LinkedIn post that positions the user as a Senior PM thought leader. The post should:

1. Synthesize insights from email newsletters
2. Demonstrate strategic thinking and PM expertise
3. No bullet points
4. No em dashes ever
5. Max 2 emojis
6. Under 150 words
7. Do not promote courses, tools, or offers
8. Focus only on PM insights, trends, and frameworks
9. Never mention specific company names, product names, or brand names.
10. Speak in general terms about trends and patterns instead.
For example, instead of "DeepSeek partnering with Huawei", say "AI firms trading independence for infrastructure reach".

If a specific format is requested, follow it exactly. Otherwise, use the following sample post:

Context Engineering in AI-Driven Product Development using OpenAI's Agent Builder.

I explored how designing prompts, workflows, and integrations can elevate the process of creating PRDs. Using multi-agent flows, I aligned AI outputs with research insights for better transparency.

One challenge: the orchestrator agent couldn't handle smart routing on its own, so I relied on if/then blocks as a bridge between agents.

The real power came from precise prompts that generate user stories, technical specs, and feature mappings automatically — all grounded in research content.`

  // Build user message with email summary and optional search results
  let userMessage = `## Email Insights Summary
${step1Result.summary}

## Key Topics
${step1Result.keyTopics.join(", ")}`

  if (searchResults && searchResults.length > 0) {
    const researchSection = searchResults
      .map((r) => `- ${r.title}: ${r.content} (Source: ${r.url})`)
      .join("\n")
    userMessage += `\n\n## Additional Research (from thought leaders)\n${researchSection}`
  }

  const post = await callForText(
    generateSystemPrompt,
    userMessage,
    MODEL_GENERATE
  )

  return post.trim()
}

/**
 * Generates a LinkedIn post directly from already-computed per-sender summaries
 * plus an optional trend snapshot for framing. Skips the fetch + intermediate
 * summarize step of generatePost() — the Workflow 1 output is a better foundation
 * than a fresh one-shot summary of raw email bodies.
 *
 * Model: claude-sonnet-4-6 (per D-02, locked for post generation)
 */
export async function generatePostFromSummaries(
  summaries: Workflow1Data,
  trend?: TrendSnapshot
): Promise<Workflow2Data> {
  return logger.traced(
    async (span) => {
      const result = await generatePostFromSummariesImpl(summaries, trend)
      span.log({
        input: { summaries, trend: trend ?? null },
        output: result,
        metadata: {
          branch: "linkedin_newsletter_from_summaries",
          model: MODEL_GENERATE,
          senderCount: summaries.length,
          usedTrend: !!trend,
        },
      })
      return result
    },
    { name: "generate-linkedin-newsletter-from-summaries" }
  )
}

async function generatePostFromSummariesImpl(
  summaries: Workflow1Data,
  trend?: TrendSnapshot
): Promise<Workflow2Data> {
  const systemPrompt = `You are helping a senior Product Manager write a LinkedIn post. You will receive structured per-sender newsletter summaries (each with key topics and actionable insights), and optionally a trend snapshot that already identified cross-sender themes and where AI is heading. Use them to craft ONE post.

VOICE

The writer is already a strategic operator. Position them by what they think about (roadmap decisions, where their team invests, how they read the industry), not by naming their level. Never write anything that positions them as aspiring, learning-on-the-job, catching up, or newly realizing something. Do not use phrases like "aspiring Senior PM", "as a PM aspiring to senior", "I finally realized", "it clicked for me", "I used to be wrong", "it took me a while", "it has taken me a while to see", or any variant that suggests slowness or being late to an insight.

Never make the post sound like a directive to a team or coworkers. Their coworkers may see this post. Do not include lines like "That is what I want my team focused on this year" or anything that reads as an internal memo.

Never open with a meta reveal about the source. Do not start with "I have been reading through newsletters", "This week I noticed in my inbox", or anything that names how the insight was gathered.

Do not use stock aphorisms or crafted parallel constructions. Lines like "Capability I can borrow. Presence I have to earn." feel too written. Prefer flowing complete sentences that a reader can follow on one pass.

READABILITY

Plain, everyday language. Explain ideas fully. If a phrase is a metaphor, spell out what it means concretely. For example, instead of "borrowed access can be taken back", write "we are relying on someone else's platform to reach our users, and that access can be pulled back the moment their terms, their pricing, or their own roadmap changes."

There is no hard length limit. Clarity beats brevity. If a paragraph is not adding a new beat, cut it. If a sentence is compressed to the point of being cryptic, expand it.

STRUCTURE

Aim for three distinct beats and do NOT repeat the same idea across paragraphs. A typical shape:
1. The observation. A shift, pattern, or claim about the industry.
2. The implication. How this changes how the writer thinks about their own work (roadmap, prioritization, evaluation).
3. The closer. Where the durable value or the strategic edge actually lives.

Each beat must add something new. If a later paragraph mostly restates the thesis in different words, cut it.

MECHANICS

- No bullet points.
- No em dashes ever. If you need a break in a sentence, use a comma or a period.
- Max 2 emojis. Zero is fine.
- Do not promote courses, tools, or offers.
- Never name specific companies, products, or brands. Speak in general terms about the pattern. For example, instead of "DeepSeek partnering with Huawei", say "AI firms trading independence for infrastructure reach".
- Do not restate sender names, source newsletters, or trend labels literally. Synthesize a POV, do not report a digest.
- Do not end with a question aimed at the reader.

REFERENCE VOICE

Match the tone and phrasing pattern of the following example. This is the writer's approved voice. Read it before drafting.

---
For a long time, the assumption was that the products coming out on top would be the ones with the smartest models. Better reasoning, better outputs, more capability. That is not what is actually happening. The products pulling ahead are the ones that are already sitting inside a workflow their users use every day. The intelligence matters, but the placement is what makes it stick. 📍

The instinct is to look at a model, get excited about what it can do, and then look for a good place to plug it in. That order is backwards. The better question is where my users are already spending most of their time, and whether we have any control over that surface. If we do not, then our reach depends on a platform someone else owns. Any change they make to their terms, their pricing, or their own product direction can cut us off from our users.

Anyone can access the underlying AI capability today. You can license it from a vendor, build on top of a partner's model, or plug into an API. That part is available to anyone willing to spend on it. What is much harder is owning the surface where the work already gets done, and that is where the durable value is being created right now.
---

Return ONLY the post text. No preamble, no markdown, no title.`

  const summarySection = summaries
    .map(
      (s) =>
        `### ${s.senderEmail} (${s.dateRange})\n${s.summary}${
          s.keyTopics && s.keyTopics.length > 0
            ? `\nKey topics: ${s.keyTopics.join(", ")}`
            : ""
        }${
          s.actionableInsights && s.actionableInsights.length > 0
            ? `\nActionable insights: ${s.actionableInsights.join("; ")}`
            : ""
        }`
    )
    .join("\n\n")

  const trendSection = trend
    ? `\n\n## Trend Snapshot
Themes: ${trend.themes.map((t) => `${t.theme} (${t.senderCount} senders)`).join("; ")}
Where AI is heading: ${trend.aiDirection}
Sr PM takeaways to weave in when relevant: ${trend.srPmTakeaways.join("; ")}`
    : ""

  const userMessage = `## Per-Sender Summaries
${summarySection}${trendSection}`

  const post = await callForText(systemPrompt, userMessage, MODEL_GENERATE)
  return post.trim()
}

/**
 * Analyzes a batch of sender summaries + light PM-leader web context to produce
 * a Trend Snapshot: consolidated themes with sender counts, a short narrative on
 * where AI is heading, and Sr PM-focused takeaways.
 *
 * Model: claude-haiku-4-5 (per D-03 — light synthesis over already-summarized text)
 *
 * Prior snapshots are passed in for continuity context so the model can note
 * whether a theme is rising/steady/new relative to the recent history, but the
 * evolution rendering itself is handled client-side.
 */
export async function generateTrends(
  summaries: Workflow1Data,
  leaderResults: TavilyResult[],
  priorSnapshots: TrendSnapshot[],
  dateRange: string
): Promise<Omit<TrendSnapshot, "timestamp">> {
  return logger.traced(
    async (span) => {
      const result = await generateTrendsImpl(
        summaries,
        leaderResults,
        priorSnapshots,
        dateRange
      )
      span.log({
        input: { summaries, leaderResults, priorSnapshots, dateRange },
        output: result,
        metadata: {
          branch: "trends",
          model: MODEL_SUMMARIZE,
          senderCount: summaries.length,
          leaderResultCount: leaderResults.length,
          priorRunCount: priorSnapshots.length,
        },
      })
      return result
    },
    { name: "generate-trends" }
  )
}

async function generateTrendsImpl(
  summaries: Workflow1Data,
  leaderResults: TavilyResult[],
  priorSnapshots: TrendSnapshot[],
  dateRange: string
): Promise<Omit<TrendSnapshot, "timestamp">> {
  const systemPrompt = `You are a strategic analyst helping a Product Manager who is aspiring to become a Senior PM stay ahead of AI industry trends.

You will receive:
- Per-sender newsletter summaries covering a specific date range
- Recent commentary from industry PM leaders (Lenny Rachitsky, Shreyas Doshi, Marty Cagan, and similar)
- Prior trend snapshots from the past 6 months for continuity

Your job:
1. Identify the 3–6 most important cross-sender themes for this date range. For each theme, list the sender emails that discussed it. Consolidate near-duplicates.
2. Write a 2–3 sentence narrative on where AI is heading based on this batch, calibrated against prior snapshots when relevant.
3. Produce 3–5 aspirational takeaways for a PM aspiring to a Sr PM role — concrete skills, framings, or moves they should invest in, NOT generic advice.
4. Surface 2–4 leader voices from the provided web context that reinforce the themes. Each must include the leader's name, source URL, and a one-sentence snippet.
5. Score how post-worthy this batch is for a PM's LinkedIn audience: "high" (a genuinely fresh angle or a strong pattern worth a public POV), "medium" (usable but nothing especially novel), "low" (mostly restating well-known ideas). Include a one-sentence reason.

Rules:
- Aspirational Sr PM takeaways should be specific and actionable ("Practice framing feature bets as evaluated experiments with clear success signals" NOT "Get better at experimentation").
- If prior snapshots exist, note in the narrative whether the batch's core themes are rising, steady, or new.
- Never fabricate leader URLs — only use URLs from the provided results.
- Never fabricate senders — only reference senderEmails that appear in the summaries input.
- Default postWorthy to "low" if you are unsure.

Respond with ONLY valid JSON in this exact format, no markdown fences:
{
  "dateRange": "human-readable date range",
  "themes": [
    {
      "theme": "short label (2-5 words)",
      "senderCount": 3,
      "senders": ["a@x.com", "b@x.com", "c@x.com"],
      "description": "1-2 sentence description"
    }
  ],
  "aiDirection": "2-3 sentence narrative",
  "srPmTakeaways": ["takeaway 1", "takeaway 2", "takeaway 3"],
  "leaderVoices": [
    { "name": "Leader Name", "url": "https://...", "snippet": "one sentence" }
  ],
  "postWorthy": "high",
  "postWorthyReason": "one sentence"
}`

  const summarySection = summaries
    .map(
      (s) =>
        `### ${s.senderEmail} (${s.dateRange})\n${s.summary}${
          s.keyTopics && s.keyTopics.length > 0
            ? `\nKey topics: ${s.keyTopics.join(", ")}`
            : ""
        }${
          s.actionableInsights && s.actionableInsights.length > 0
            ? `\nActionable insights: ${s.actionableInsights.join("; ")}`
            : ""
        }`
    )
    .join("\n\n")

  const leaderSection =
    leaderResults.length > 0
      ? leaderResults
          .map((r) => `- ${r.title} — ${r.content} (Source: ${r.url})`)
          .join("\n")
      : "(none returned)"

  const priorSection =
    priorSnapshots.length > 0
      ? priorSnapshots
          .slice(-6) // last 6 for prompt budget
          .map(
            (p) =>
              `- ${p.dateRange} (${p.timestamp.slice(0, 10)}): themes = ${p.themes
                .map((t) => t.theme)
                .join(", ")}`
          )
          .join("\n")
      : "(no prior snapshots yet)"

  const userMessage = `## Date Range
${dateRange}

## Per-Sender Summaries
${summarySection}

## Recent PM Leader Commentary
${leaderSection}

## Prior Trend Snapshots (last 6 months)
${priorSection}`

  return callWithJsonRetry<Omit<TrendSnapshot, "timestamp">>(
    systemPrompt,
    userMessage,
    MODEL_SUMMARIZE
  )
}

/**
 * Generates a structured LinkedIn post from Tavily search results on a custom topic.
 * Implements AI-03 (Workflow 3 — research path).
 *
 * Model: claude-sonnet-4-6 (per D-02, locked for post generation)
 *
 * Prompt adapted from n8n "Workflow 3 — Research Custom Topic":
 * - Core research assistant role preserved
 * - JSON schema added per D-05 to return Workflow3ResearchData shape
 */
export async function generateResearchPost(
  searchResults: TavilyResult[]
): Promise<Workflow3ResearchData> {
  return logger.traced(
    async (span) => {
      const result = await generateResearchPostImpl(searchResults)

      span.log({
        input: { tavilyContext: searchResults },
        output: result,
        metadata: {
          branch: "linkedin_custom",
          subBranch: "research",
          model: MODEL_GENERATE,
          tavilyResultCount: searchResults.length,
        },
      })

      return result
    },
    { name: "generate-linkedin-custom" }
  )
}

async function generateResearchPostImpl(
  searchResults: TavilyResult[]
): Promise<Workflow3ResearchData> {
  const systemPrompt = `You are a research assistant helping a Product Manager create a LinkedIn post from research findings. Analyze the provided research results and create a compelling LinkedIn post with supporting insights.

You MUST respond with ONLY valid JSON in this exact format:
{
  "summary": "The LinkedIn post text. Plain prose, no markdown, no preamble like 'Here is your post'. Under 150 words. No bullet points. No em dashes. Max 2 emojis.",
  "keyTopics": ["topic1", "topic2"],
  "insights": [
    {"topic": "insight topic", "insight": "the insight text", "sourceUrl": "https://..."}
  ],
  "sources": [
    {"title": "Source Title", "url": "https://..."}
  ]
}
Do not include any text outside the JSON.`

  const userMessage =
    `## Research Results\n` +
    searchResults
      .map((r) => `### ${r.title}\n${r.content}\nSource: ${r.url}\n`)
      .join("\n")

  return callWithJsonRetry<Workflow3ResearchData>(
    systemPrompt,
    userMessage,
    MODEL_GENERATE
  )
}

/**
 * Generates clarifying questions for the personal post Q&A flow.
 * Implements AI-04, step 1 (Workflow 3 — personal path).
 *
 * Model: claude-sonnet-4-6 (per D-02)
 *
 * Prompt adapted from n8n "Ask Clarifying Questions":
 * - Preserved verbatim — prompt already matched the D-11 two-step design
 * - Returns plain numbered list string (no JSON needed per D-11)
 */
export async function generateQuestions(topic: string): Promise<string> {
  return logger.traced(
    async (span) => {
      const result = await generateQuestionsImpl(topic)

      span.log({
        input: { topic },
        output: result,
        metadata: {
          branch: "linkedin_custom_personal",
          subBranch: "clarifying-questions",
          model: MODEL_GENERATE,
          topic,
        },
      })

      return result
    },
    { name: "generate-clarifying-questions" }
  )
}

async function generateQuestionsImpl(topic: string): Promise<string> {
  const systemPrompt = `You are a LinkedIn content strategist helping a Senior Product Manager share their personal experiences and achievements.

The user has shared a brief topic. Your job right now is NOT to write the post yet. Ask 3-4 specific clarifying questions that will help you write a much better post. Ask about the specific problem solved, biggest challenge or learning, outcome achieved, and who their LinkedIn audience is.

Return ONLY the questions as a numbered list. Nothing else.`

  return callForText(systemPrompt, topic, MODEL_GENERATE)
}

/**
 * Generates the final personal LinkedIn post from topic + Q&A answers.
 * Implements AI-04, step 2 (Workflow 3 — personal path).
 *
 * Model: claude-sonnet-4-6 (per D-02, locked for post generation)
 *
 * Prompt adapted from n8n "Generate Personal Post":
 * - All 10 instructions preserved verbatim
 * - Sample post preserved verbatim
 * - Returns plain string (no JSON needed per D-11)
 */
export async function generatePersonalPost(
  topic: string,
  answers: string
): Promise<string> {
  return logger.traced(
    async (span) => {
      const result = await generatePersonalPostImpl(topic, answers)

      span.log({
        input: { topic, answers },
        output: result,
        metadata: {
          branch: "linkedin_custom_personal",
          subBranch: "final-post",
          model: MODEL_GENERATE,
          topic,
        },
      })

      return result
    },
    { name: "generate-personal-post" }
  )
}

async function generatePersonalPostImpl(
  topic: string,
  answers: string
): Promise<string> {
  const systemPrompt = `You are a LinkedIn content strategist helping a Senior Product Manager share their personal experiences and achievements. The user has shared a personal experience or project. Write a compelling LinkedIn post that:

1. Tells the story authentically in first person
2. Demonstrate strategic thinking and PM expertise
3. No bullet points
4. No em dashes ever
5. Max 2 emojis
6. Under 150 words
7. Highlights the technical achievement and lessons learned
8. Focus only on PM insights, trends, and frameworks
9. Positions the author as an innovative, builder-minded PM
10. Is conversational and sounds genuinely human
11. Never end with asking the reader a question.

Use the following sample post:

I built an automated pipeline that summarizes and segments my incoming newsletter content using Claude Code. I went from 60+ weekly emails to a single structured digest. Same signal, a fraction of the noise. The real unlock was a scoping framework that forced me to map every workflow exhaustively before writing a single line of logic. That upfront clarity meant less iteration, fewer surprises and a tool that worked closer to right the first time. 🎯

The lesson, for me as a PM: scoping is not slowing down. It is the actual work. Understanding what you are building deeply enough before building it streamlines execution. That is what AI tooling actually unlocks right now, not just speed, but the clarity to make that speed count.`

  const userMessage = `Topic: ${topic}

My answers to your questions:
${answers}`

  const post = await callForText(systemPrompt, userMessage, MODEL_GENERATE)
  return post.trim()
}
