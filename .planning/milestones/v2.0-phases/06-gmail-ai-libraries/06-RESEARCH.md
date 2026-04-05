# Phase 6: Gmail & AI Libraries — Research

**Researched:** 2026-04-04
**Domain:** Gmail REST API (raw fetch), Anthropic SDK (`@anthropic-ai/sdk`), Tavily SDK (`@tavily/core`), HTML-to-text (regex, no deps)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Consolidate all AI calls to Claude (Anthropic SDK only). Remove GPT-4o-mini and GPT-4 dependencies. Single SDK (`@anthropic-ai/sdk`), single API key (`ANTHROPIC_API_KEY`).
- **D-02:** Claude Sonnet 4.6 (`claude-sonnet-4-6`) is locked for final LinkedIn post generation (Workflows 2 and 3). User has validated tone quality with this model.
- **D-03:** Lighter Claude models (e.g., Haiku) acceptable for email summarization (Workflow 1) and intermediate steps, but quality must not be cut — summarization must remain thorough with key themes, frameworks, and actionable takeaways.
- **D-04:** Existing n8n system prompts must be adapted for Claude. All prompt changes require user review and approval before implementation. Do not silently modify prompts.
- **D-05:** Prompt-based JSON output with validation. Include JSON schema in the system prompt, parse Claude's response, retry once on malformed JSON. No Zod dependency.
- **D-06:** `claude.ts` must return exact `Workflow1Data`, `Workflow2Data`, and `Workflow3Data` shapes from `src/types/workflow.ts`. Zero type changes.
- **D-07:** HTML-to-text conversion via regex stripping (strip tags, decode entities, collapse whitespace). Zero dependencies. Sufficient for newsletter email content.
- **D-08:** Sequential pagination following `nextPageToken` until exhausted.
- **D-09:** Gmail query uses `category:updates after:YYYY/MM/DD before:YYYY/MM/DD` to scope to the Updates tab within the user-specified date range.
- **D-10:** `gmail.ts` returns emails pre-grouped by sender address (`Map<senderEmail, emails[]>` or equivalent). Grouping happens in the Gmail module, not in the AI module or route handler.
- **D-11:** Two-step personal post flow: `generateQuestions(topic)` returning questions as a string, and `generatePersonalPost(topic, answers)` returning the final post.
- **D-12:** `/api/generate` returns `{stage: "questions", data: questions}` for the personal path. `/api/followup` calls `generatePersonalPost()`.
- **D-13:** Single `search(query, options?)` function in `search.ts`. 15-second timeout enforced internally.
- **D-14:** Use official Tavily SDK (`@tavily/core`) for search.

### Claude's Discretion

- Exact Claude model for summarization steps (Haiku vs Sonnet — choose based on quality testing)
- Gmail API authentication flow using `session.accessToken` (straightforward OAuth bearer token)
- Internal module function signatures beyond the key ones specified above
- Error handling patterns within lib modules (consistent with Phase 4's error codes)
- Token budget management for large email batches

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GMAIL-01 | Fetch emails from Gmail Updates tab within a user-specified date range, with pagination handling for >100 results | Gmail REST API `messages.list` with `q=category:updates after:YYYY/MM/DD before:YYYY/MM/DD`, `nextPageToken` loop, `messages.get` with `format=full` |
| GMAIL-02 | Email HTML bodies converted to plain text before processing | Regex-based HTML stripping: remove tags, decode HTML entities, collapse whitespace — zero deps per D-07 |
| AI-01 | Structured email summary grouped by sender using Claude API directly (Workflow 1) | `@anthropic-ai/sdk` `messages.create`, prompt-based JSON output, returns `Workflow1Data` (`EmailSummaryItem[]`) |
| AI-02 | LinkedIn post from email insights with optional influencer research (Workflow 2) | Claude `claude-sonnet-4-6`, Tavily search results piped in as optional context, returns `Workflow2Data` (string) |
| AI-03 | LinkedIn post on any custom topic using Tavily search + Claude (Workflow 3 research path) | `search.ts` → `claude.ts`, returns `Workflow3ResearchData` |
| AI-04 | Personal experience LinkedIn post through interactive Q&A (Workflow 3 personal path) | `generateQuestions()` + `generatePersonalPost()` in `claude.ts`, returns string (Workflow3Data) |
</phase_requirements>

---

## Summary

Phase 6 creates three pure server-side library modules: `lib/gmail.ts`, `lib/claude.ts`, and `lib/search.ts`. These modules have no route handler dependencies and are consumed by Phase 7. All three modules are new files — the `src/lib/` directory currently contains only `utils.ts`.

The Gmail module calls the Gmail REST API directly via `fetch` using the `session.accessToken` bearer token already provided by `src/auth.ts`. It does NOT use the `googleapis` npm package. It lists message IDs for the Updates tab date range, fetches each message body individually, decodes base64url content, strips HTML, and groups results by sender — all within the module.

The Claude module wraps `@anthropic-ai/sdk` and exposes four functions matching the three workflows plus question generation. It uses prompt-based JSON output (schema embedded in system prompt), parsing, and a single retry on parse failure — no Zod. The exact n8n system prompts from `n8n - System Pompts.md` are adapted for the SDK's `system` parameter format.

The search module wraps `@tavily/core` with an `AbortSignal.timeout(15_000)` enforced on the underlying fetch. Both Workflow 2 (influencer research) and Workflow 3 (custom topic research) call the same `search()` function with different query strings.

**Primary recommendation:** Use raw `fetch` to Gmail REST API (no `googleapis` library), `@anthropic-ai/sdk` with prompt-embedded JSON schema and one retry, and `@tavily/core` with `AbortSignal.timeout(15_000)`.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | 0.82.0 | Claude API client | Official SDK, handles auth, retries, TypeScript types |
| `@tavily/core` | 0.7.2 | Web search API client | Official Tavily SDK per D-14 |
| Native `fetch` (Node 18+) | built-in | Gmail REST API calls | No extra dependency; Node 22 is confirmed available |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None (regex) | N/A | HTML-to-text stripping | Zero-dep approach mandated by D-07 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw fetch for Gmail | `googleapis` npm package | `googleapis` v171 is huge; raw fetch is sufficient for two endpoints (list + get) and avoids a large dependency |
| Prompt-based JSON | Anthropic structured-outputs beta | Beta feature requires `anthropic-beta` header; D-05 mandates prompt-based approach |
| `AbortSignal.timeout` | `setTimeout`/`clearTimeout` | `AbortSignal.timeout` is built-in since Node 17.3, cleaner, already used in existing route handlers |

**Installation:**
```bash
npm install @anthropic-ai/sdk @tavily/core
```

**Version verification (confirmed 2026-04-04):**
```bash
npm view @anthropic-ai/sdk version   # 0.82.0
npm view @tavily/core version        # 0.7.2
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   ├── utils.ts          # existing — cn() utility
│   ├── gmail.ts          # NEW: fetchEmails(accessToken, startDate, endDate)
│   ├── claude.ts         # NEW: summarizeEmails(), generatePost(), generateResearchPost(), generateQuestions(), generatePersonalPost()
│   └── search.ts         # NEW: search(query, options?)
├── types/
│   └── workflow.ts       # LOCKED: Workflow1Data, Workflow2Data, Workflow3Data
└── app/
    └── api/
        ├── generate/route.ts   # Phase 7 wires this to lib modules
        └── followup/route.ts   # Phase 7 wires this to lib modules
```

### Pattern 1: Gmail Messages — List then Get

The Gmail REST API requires two-step fetch for each message: `messages.list` returns IDs only, then `messages.get?format=full` returns the full MIME payload.

**List endpoint:** `GET https://gmail.googleapis.com/gmail/v1/users/me/messages?q=category:updates after:YYYY/MM/DD before:YYYY/MM/DD&maxResults=500`

**Get endpoint:** `GET https://gmail.googleapis.com/gmail/v1/users/me/messages/{id}?format=full`

**Headers for both:** `Authorization: Bearer {accessToken}`

**Pagination:** Response includes `nextPageToken` if more pages exist. Loop until `nextPageToken` is absent.

```typescript
// Source: Gmail REST API reference + verified patterns
async function listMessageIds(
  accessToken: string,
  query: string
): Promise<string[]> {
  const ids: string[] = []
  let pageToken: string | undefined

  do {
    const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages")
    url.searchParams.set("q", query)
    url.searchParams.set("maxResults", "500")
    if (pageToken) url.searchParams.set("pageToken", pageToken)

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) throw new Error(`Gmail list error: ${res.status}`)

    const data = await res.json() as { messages?: { id: string }[]; nextPageToken?: string }
    for (const msg of data.messages ?? []) ids.push(msg.id)
    pageToken = data.nextPageToken
  } while (pageToken)

  return ids
}
```

### Pattern 2: Gmail MIME Part Traversal

Newsletter emails arrive as `multipart/alternative` or `multipart/mixed`. The HTML body is nested in `payload.parts` under `mimeType: "text/html"`. Parts can be nested recursively.

**Decoding:** `body.data` is base64url-encoded. In Node.js: `Buffer.from(part.body.data, "base64url").toString("utf-8")`.

```typescript
// Source: Gmail REST API docs + community-verified patterns
interface GmailPart {
  mimeType: string
  body?: { data?: string }
  parts?: GmailPart[]
}

function extractBody(part: GmailPart): string | null {
  // Prefer text/html; fall back to text/plain
  if (part.mimeType === "text/html" && part.body?.data) {
    return Buffer.from(part.body.data, "base64url").toString("utf-8")
  }
  if (part.parts) {
    for (const child of part.parts) {
      const result = extractBody(child)
      if (result) return result
    }
  }
  // text/plain fallback for the top-level body
  if (part.mimeType === "text/plain" && part.body?.data) {
    return Buffer.from(part.body.data, "base64url").toString("utf-8")
  }
  return null
}
```

### Pattern 3: HTML-to-Text (Regex, Zero Deps)

Per D-07, stripping is sufficient for newsletter content. Order matters: decode entities before collapsing whitespace.

```typescript
// Source: D-07 decision, standard regex approach
function htmlToText(html: string): string {
  return html
    // Remove script and style blocks entirely
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    // Strip all remaining tags
    .replace(/<[^>]+>/g, " ")
    // Decode common HTML entities
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-z]+;/gi, " ")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim()
}
```

### Pattern 4: Anthropic SDK — messages.create

The SDK reads `ANTHROPIC_API_KEY` from environment automatically. Instantiate once per module, not per call.

```typescript
// Source: @anthropic-ai/sdk README (official)
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic() // reads ANTHROPIC_API_KEY from env

const response = await anthropic.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 4096,
  system: "Your system prompt here.",
  messages: [{ role: "user", content: "User message here." }],
})

// Access text content
const text = response.content.find((b) => b.type === "text")?.text ?? ""
```

### Pattern 5: Prompt-Based JSON Output with Retry (D-05)

Embed the JSON schema in the system prompt. Parse the response. Retry once if parse fails by sending Claude's malformed output back with a correction instruction.

```typescript
// Source: D-05 decision pattern
async function callWithJsonRetry<T>(
  systemPrompt: string,
  userMessage: string,
  model: string
): Promise<T> {
  const response = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  })

  const text = response.content.find((b) => b.type === "text")?.text ?? ""

  // Extract JSON from possible markdown code fences
  const jsonStr = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim()

  try {
    return JSON.parse(jsonStr) as T
  } catch {
    // Single retry with correction
    const retryResponse = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        { role: "user", content: userMessage },
        { role: "assistant", content: text },
        { role: "user", content: "Your response was not valid JSON. Please respond with ONLY valid JSON matching the schema, no other text." },
      ],
    })
    const retryText = retryResponse.content.find((b) => b.type === "text")?.text ?? ""
    const retryJson = retryText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim()
    return JSON.parse(retryJson) as T
  }
}
```

### Pattern 6: Tavily Search with 15-Second Timeout

`@tavily/core` does not expose a native timeout parameter in its public API. Enforce the 15-second limit using `AbortSignal.timeout` via a wrapping Promise race.

```typescript
// Source: D-13 decision, AbortSignal.timeout pattern from existing route handlers
import { tavily } from "@tavily/core"

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY! })

export async function search(query: string, options?: { maxResults?: number }): Promise<TavilyResult[]> {
  const searchPromise = tvly.search(query, {
    searchDepth: "advanced",
    maxResults: options?.maxResults ?? 5,
  })

  const timeoutPromise = new Promise<never>((_, reject) =>
    AbortSignal.timeout(15_000).addEventListener("abort", () =>
      reject(new Error("Search timed out"))
    )
  )

  const result = await Promise.race([searchPromise, timeoutPromise])
  return result.results ?? []
}
```

### Exported Function Signatures for claude.ts

These are the key public functions Phase 7 will import:

```typescript
// Workflow 1 — Email summarization
export async function summarizeEmails(
  groupedEmails: Map<string, EmailMessage[]>
): Promise<Workflow1Data>

// Workflow 2 — LinkedIn post from emails + optional influencer research
export async function generatePost(
  emailBodies: string[],
  searchResults?: TavilyResult[]
): Promise<Workflow2Data>

// Workflow 3 — Research path
export async function generateResearchPost(
  searchResults: TavilyResult[]
): Promise<Workflow3ResearchData>

// Workflow 3 — Personal path, step 1
export async function generateQuestions(topic: string): Promise<string>

// Workflow 3 — Personal path, step 2
export async function generatePersonalPost(
  topic: string,
  answers: string
): Promise<string>
```

### Anti-Patterns to Avoid

- **Importing `googleapis` for Gmail:** Adds 170+ version package; raw fetch is sufficient for 2 endpoints and keeps the module dependency-free.
- **New Anthropic client per function call:** Instantiate `new Anthropic()` once at module scope to reuse connections.
- **Silently modifying n8n prompts:** D-04 requires user review of all adapted prompts. Present diff during execution.
- **Using `setTimeout` for search timeout:** Use `AbortSignal.timeout` (Node 17.3+, confirmed Node 22) and `Promise.race` — same pattern as existing route handlers.
- **Returning `resumeUrl` from generateQuestions:** The `useWorkflow` hook checks for `json.stage === "questions" && json.resumeUrl` — Phase 7 must include `resumeUrl` in the response shape even if empty, or the hook will fall through to the result handler. Confirm hook behavior before Phase 7 wiring.
- **Placing grouping logic in claude.ts:** D-10 mandates grouping happens in `gmail.ts`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Claude API HTTP client | Custom fetch wrapper with auth headers, retries | `@anthropic-ai/sdk` | SDK handles auth, automatic retries, TypeScript types, streaming |
| Tavily HTTP client | Custom search fetch | `@tavily/core` | Official SDK handles auth, response typing, retries |
| JWT token refresh | In-lib token refresh logic | `session.accessToken` from `auth()` | `src/auth.ts` already handles Branch 4 proactive refresh; lib modules just consume the token |

**Key insight:** The lib modules are consumers, not auth managers. They receive a ready-to-use `accessToken` and `ANTHROPIC_API_KEY`/`TAVILY_API_KEY` from environment. All credential lifecycle management is handled upstream.

---

## Common Pitfalls

### Pitfall 1: Gmail Category Label — `q` vs `labelIds`

**What goes wrong:** Using `labelIds: ["CATEGORY_UPDATES"]` in the list request works only for Gmail API library calls with label resolution. Using the `q` parameter with `category:updates` is more reliable and is consistent with the decision in D-09.

**Why it happens:** The Gmail API `labelIds` parameter requires the system label ID string. The `q` parameter accepts human-readable Gmail search syntax.

**How to avoid:** Use `q: "category:updates after:2024/01/01 before:2024/01/31"`. The `after:` and `before:` dates in Gmail query syntax use `YYYY/MM/DD` format (slashes, not dashes).

**Warning signs:** Empty result set when expecting emails — check date format in query.

### Pitfall 2: base64url vs base64

**What goes wrong:** Using `Buffer.from(data, "base64")` instead of `"base64url"` produces garbled or truncated text because Gmail uses the URL-safe variant (replaces `+` with `-` and `/` with `_`).

**How to avoid:** Always use `Buffer.from(part.body.data, "base64url").toString("utf-8")` in Node.js.

**Warning signs:** Output contains replacement characters (???) or throws a Buffer error.

### Pitfall 3: Missing `body.data` on Multipart Container Parts

**What goes wrong:** `payload.body.data` is absent or empty on `multipart/*` container parts. The actual text lives in `payload.parts[]` children, potentially nested multiple levels deep.

**How to avoid:** Recursive traversal function (Pattern 2 above). Never assume `payload.body.data` exists; always check `payload.parts` first for multipart types.

**Warning signs:** Empty email bodies despite the email having content.

### Pitfall 4: Claude Wraps JSON in Markdown Code Fences

**What goes wrong:** Claude frequently returns JSON wrapped in triple backticks (` ```json\n{...}\n``` `). `JSON.parse()` fails on the fenced string.

**How to avoid:** Strip markdown code fences before parsing (Pattern 5 above). Also strip leading/trailing whitespace.

**Warning signs:** `JSON.parse` throws `SyntaxError: Unexpected token` with the character `` ` ``.

### Pitfall 5: Workflow1Data Array Schema Reliability

**What goes wrong:** Workflow 1 requires Claude to return an array of `EmailSummaryItem` objects. Arrays are harder for LLMs to produce reliably than single objects, especially when wrapped in a root object.

**How to avoid:** Prompt the model to return `{ "summaries": [...] }` (wrapped object) and extract `result.summaries`. This is more reliable than asking for a bare array. The retry mechanism (D-05) covers occasional failures. Log all parse failures for monitoring.

**Warning signs:** JSON parses successfully but result is an object, not an array.

### Pitfall 6: Token Budget for Large Email Batches

**What goes wrong:** A date range with many newsletters can produce 50,000+ tokens of email text. Sending all text in one message risks exceeding context or producing poor summaries.

**Why it happens:** Newsletter emails can be verbose; 20-30 emails at 500-1000 tokens each fills a large chunk of context even for Haiku's 200k window.

**How to avoid:** Haiku has a 200k token context window — sufficient for newsletter batches. However, implement a character-level truncation guard per email body (e.g., 8,000 characters max per email body) to prevent runaway tokens from a single verbose email. Document this guard clearly so it can be tuned.

**Warning signs:** Claude responses become generic or miss key themes from specific senders.

### Pitfall 7: useWorkflow Hook — questions stage shape

**What goes wrong:** The `handleResponse` function in `use-workflow.ts` checks `json.stage === "questions" && json.resumeUrl`. If Phase 7 omits `resumeUrl` (even as an empty string), the hook falls through to `result` state with raw question text.

**How to avoid:** Phase 7 (not Phase 6) must return `{ stage: "questions", data: questions, resumeUrl: "" }` — include `resumeUrl` as an empty string. Phase 6 modules themselves don't return HTTP responses, so this is Phase 7's concern, but document the dependency here so the planner is aware.

---

## Code Examples

### Verified Patterns from Official Sources

#### Anthropic SDK — instantiate and call

```typescript
// Source: @anthropic-ai/sdk README (official GitHub)
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic()
// Reads ANTHROPIC_API_KEY from process.env automatically

const msg = await anthropic.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 4096,
  system: "You are a LinkedIn content strategist...",
  messages: [{ role: "user", content: "Generate a post about..." }],
})

const text = msg.content.find((b) => b.type === "text")?.text ?? ""
```

#### Tavily — basic search

```typescript
// Source: @tavily/core README (official GitHub)
import { tavily } from "@tavily/core"

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY! })
const response = await tvly.search("PM frameworks for product strategy", {
  searchDepth: "advanced",
  maxResults: 5,
})
// response.results: Array<{ url, title, content, score }>
```

#### Gmail — date format for query

```
// Gmail query syntax (verified: category:updates uses YYYY/MM/DD)
q: "category:updates after:2024/01/01 before:2024/01/31"

// NOT:
q: "category:updates after:2024-01-01 before:2024-01-31"   // wrong format
```

---

## n8n System Prompts — Adaptation Map

All six prompts from `n8n - System Pompts.md` map to `claude.ts` functions. Per D-04, these must be reviewed by user before implementation. The planner should include a task to present the diff.

| n8n Prompt | Target Function | Model Change | Key Adaptation Needed |
|------------|-----------------|--------------|----------------------|
| Workflow — Email Summarization | `summarizeEmails()` | GPT-4o-mini → `claude-haiku-4-5` (or Sonnet if quality test fails) | Add JSON schema to system prompt; prose format was fine for n8n but Claude needs structured output instruction |
| Workflow 2 — Summarize Emails | Internal step in `generatePost()` | GPT-4o-mini → `claude-haiku-4-5` | Already JSON-formatted; adapt `{"summary", "keyTopics"}` schema |
| Workflow 2 — Search Influencer | Calls `search.ts` directly | GPT-4 + Tavily → `search.ts` | No AI call for search step; Tavily results fed into generate post prompt |
| Workflow 2 — Generate LinkedIn Post | `generatePost()` | Claude Sonnet 4.6 → `claude-sonnet-4-6` | Model name aligned; no change needed |
| Workflow 3 — Research Custom Topic | `generateResearchPost()` | Claude Sonnet 4.6 → `claude-sonnet-4-6` | Add `Workflow3ResearchData` JSON schema to system prompt |
| Workflow 3 — Ask Clarifying Questions | `generateQuestions()` | Claude Sonnet 4.6 → `claude-sonnet-4-6` | Returns numbered list as plain text (no JSON needed) |
| Workflow 3 — Generate Personal Post | `generatePersonalPost()` | Claude Sonnet 4.6 → `claude-sonnet-4-6` | Plain text output (string); no JSON parsing needed |

---

## Model Decisions (Claude's Discretion)

Current confirmed model IDs (verified from official docs, 2026-04-04):

| Model | API ID | Max Output | Context | Price (input/output per MTok) |
|-------|--------|-----------|---------|-------------------------------|
| Claude Sonnet 4.6 (locked for posts) | `claude-sonnet-4-6` | 64k tokens | 1M tokens | $3 / $15 |
| Claude Haiku 4.5 (candidate for summarization) | `claude-haiku-4-5` | 64k tokens | 200k tokens | $1 / $5 |

**Recommendation:** Start with `claude-haiku-4-5` for `summarizeEmails()` (Workflow 1) and the intermediate email summary step in `generatePost()`. The 200k context window is sufficient for newsletter batches. If summarization quality is noticeably worse than the n8n GPT-4o-mini output, escalate to `claude-sonnet-4-6`. This decision can be made during implementation without user approval per D-03/discretion.

**Note:** `claude-3-haiku-20240307` is deprecated and retires 2026-04-19. Do NOT use it.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All modules | Yes | v22.9.0 | — |
| `@anthropic-ai/sdk` | `lib/claude.ts` | No (not installed) | — | Install: `npm install @anthropic-ai/sdk` |
| `@tavily/core` | `lib/search.ts` | No (not installed) | — | Install: `npm install @tavily/core` |
| `ANTHROPIC_API_KEY` env var | `lib/claude.ts` | Unknown — not in repo | — | Must be added to `.env.local` |
| `TAVILY_API_KEY` env var | `lib/search.ts` | Unknown — not in repo | — | Must be added to `.env.local` |
| Gmail REST API | `lib/gmail.ts` | Yes (via session.accessToken from Phase 5) | N/A | — |

**Missing dependencies with no fallback:**
- `ANTHROPIC_API_KEY`: Must be set in `.env.local` before `claude.ts` can be tested. Wave 0 task should verify and document.
- `TAVILY_API_KEY`: Must be set in `.env.local` before `search.ts` can be tested.

**Missing dependencies with install step:**
- `@anthropic-ai/sdk` and `@tavily/core`: Not in current `package.json`. Wave 0 or first task must run `npm install @anthropic-ai/sdk @tavily/core`.

---

## State of the Art

| Old Approach (n8n) | Current Approach | When Changed | Impact |
|--------------------|-----------------|--------------|--------|
| GPT-4o-mini for summarization | Claude Haiku 4.5 | Phase 6 (D-01) | Single SDK, single API key |
| GPT-4 for search-augmented generation | Claude Sonnet 4.6 | Phase 6 (D-01/D-02) | Same model tier, better alignment with post generation |
| n8n webhook proxy | Direct SDK calls in lib modules | Phase 6 | Eliminates n8n dependency, reduces latency |
| Tavily via n8n node | `@tavily/core` SDK directly | Phase 6 (D-14) | Same underlying API, now first-class typed |

**Deprecated/outdated:**
- `claude-3-haiku-20240307`: Deprecated, retires 2026-04-19. Use `claude-haiku-4-5` instead.
- `N8N_WEBHOOK_URL` / `N8N_FOLLOWUP_WEBHOOK_URL`: Replaced by `ANTHROPIC_API_KEY` + `TAVILY_API_KEY` in Phase 7.

---

## Open Questions

1. **Tavily SDK native timeout parameter**
   - What we know: `@tavily/core` README mentions `timeout` as a parameter but provides no type signature
   - What's unclear: Whether `tvly.search()` accepts a `timeout` option that internally aborts the fetch
   - Recommendation: Use `Promise.race` with `AbortSignal.timeout(15_000)` as the safe pattern regardless, consistent with existing route handler code

2. **useWorkflow hook `resumeUrl` requirement**
   - What we know: `handleResponse` in `use-workflow.ts` requires `json.resumeUrl` to be truthy to enter `questions` state
   - What's unclear: Whether Phase 7 should pass `resumeUrl: ""` (falsy — would bypass questions state) or `resumeUrl: "/"` (truthy placeholder)
   - Recommendation: Phase 6 doesn't return HTTP responses, but document this as a Phase 7 pre-condition. The planner should add a verification step to confirm hook behavior before wiring.

3. **Workflow 1 grouping structure for AI prompt**
   - What we know: D-10 mandates `gmail.ts` groups by sender. `claude.ts` receives `Map<senderEmail, emails[]>`.
   - What's unclear: How to serialize the grouped emails into the prompt (flat array with sender labels vs JSON object). The n8n prompt says "emails grouped by sender" without specifying format.
   - Recommendation: Serialize as labeled sections in the user message: `## Sender: hamel@example.com\n[email bodies]\n\n## Sender: ...`. More readable for Claude than JSON.

---

## Sources

### Primary (HIGH confidence)
- `platform.claude.com/docs/en/about-claude/models/overview` — Model IDs, max output, context windows, pricing (verified 2026-04-04)
- `platform.claude.com/docs/en/api/messages` — messages.create parameters, system prompt format, ContentBlock response shape
- `github.com/anthropics/anthropic-sdk-typescript` README — Instantiation, error handling, API key env var pattern
- `developers.google.com/workspace/gmail/api/guides/list-messages` — messages.list q parameter, maxResults, nextPageToken pagination
- `n8n - System Pompts.md` (in-repo) — Source of truth for all system prompts to adapt
- `src/types/workflow.ts` (in-repo) — Locked type definitions, Workflow1Data/2Data/3Data shapes
- `src/hooks/use-workflow.ts` (in-repo) — handleResponse logic, questions state requirements

### Secondary (MEDIUM confidence)
- `github.com/tavily-ai/tavily-js` README — tavily() instantiation, search() method signature, timeout parameter existence
- Gmail community threads + gmass.co blog — MIME part traversal pattern, base64url decoding confirmed with `Buffer.from(data, "base64url")`

### Tertiary (LOW confidence)
- WebSearch results on Tavily timeout parameter — timeout option existence confirmed but type signature not verified from official docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified via npm view and official docs
- Model IDs: HIGH — verified from official Anthropic model overview page (2026-04-04)
- Architecture patterns: HIGH — derived from locked decisions (CONTEXT.md) and official SDK docs
- Gmail MIME traversal: MEDIUM — pattern widely documented in community; official docs confirm structure but don't provide TypeScript code
- Tavily timeout: MEDIUM — parameter existence confirmed, implementation pattern uses AbortSignal.timeout as safe fallback
- Pitfalls: MEDIUM-HIGH — confirmed from official docs and existing codebase patterns

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (stable libraries; Anthropic model IDs may change if new releases drop)
