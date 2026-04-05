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
} from "@/types/workflow"

// ─── Model constants ──────────────────────────────────────────────────────────

/** Per D-03: lighter model for email summarization and intermediate steps */
const MODEL_SUMMARIZE = "claude-haiku-4-5"

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
