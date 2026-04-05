# Phase 7: Route Handler Rewrites - Research

**Researched:** 2026-04-04
**Domain:** Next.js App Router route handlers, direct lib module dispatch, response shape contracts
**Confidence:** HIGH

## Summary

Phase 7 is a surgical rewrite of two Next.js App Router route handlers: `/api/generate` and `/api/followup`. Both currently proxy all requests to external n8n webhooks. After this phase they will dispatch directly to the Phase 6 lib modules (`gmail.ts`, `claude.ts`, `search.ts`), routing based on `body.content_source` and `body.topic_type`. Zero UI modifications are required — the frontend hook `useWorkflow` already handles response shapes from the new routes without change.

The scope is narrow and the risk is low because all callable lib functions are already written and typed. The rewrite is essentially: remove n8n fetch calls, add a switch/dispatch, map errors to the existing error code vocabulary, and clean up removed env vars. The most precise requirement is that `/api/generate` must return `{ stage: "questions", data: questions, resumeUrl: "/api/followup" }` for the personal path — `useWorkflow.handleResponse()` checks `json.stage === "questions" && json.resumeUrl` (line 38 of use-workflow.ts) as the gate before entering Q&A state.

The `handleResponse()` unwrapping logic resolves the data payload through `json.data ?? json.output ?? json`. Route handlers should wrap results in `{ data: result }` to take the fast path and avoid any accidental unwrapping.

**Primary recommendation:** Rewrite both handlers as direct lib dispatchers, preserving existing auth, error logging, and influencer validation patterns verbatim. Return all successful payloads wrapped in `{ data: ... }`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `/api/generate` switches on `body.content_source` to route to the correct workflow: `"email_summary"` → Workflow 1, `"linkedin_post"` → Workflow 2, `"custom_topic"` → Workflow 3.
- **D-02:** For `content_source: "custom_topic"`, sub-route on `body.topic_type`: `"research"` calls Tavily search + `generateResearchPost()`, `"personal"` calls `generateQuestions()` and returns Q&A stage response.
- **D-03:** Route handler validates required fields per workflow before calling lib functions. Missing fields return 400 early with a clear error message. Prevents unnecessary Gmail/Claude/Tavily calls on bad input.
- **D-04:** Route handler returns `{ stage: "questions", data: questions, resumeUrl: "/api/followup" }` for the personal path. The `resumeUrl` value is a sentinel — `useWorkflow` checks `json.resumeUrl` as a truthy gate (line 38), so it must be present. The `followUp()` function already hardcodes `/api/followup` as the endpoint, so the value is technically unused but satisfies INT-02 (zero frontend changes).
- **D-05:** `/api/followup` extracts `body.topic` and `body.answers` (string), calls `generatePersonalPost(topic, answers)`, and returns the result. Matches the exact shape the frontend already sends.
- **D-06:** Lib module errors map to existing frontend error codes:
  - Gmail 401/403 (token revoked/insufficient scopes) → `auth_expired` (HTTP 401)
  - Tavily timeout / Claude timeout → `timeout` (HTTP 504)
  - Empty email results (no emails in date range) → `empty_result` (HTTP 200 with empty data or specific message)
  - Claude JSON parse failure, unknown errors → `generic` (HTTP 500)
- **D-07:** Route handlers log detailed errors server-side with `console.error` using `[api/generate]` and `[api/followup]` prefixes (matching existing pattern). Sanitized messages returned to frontend.
- **D-08:** Full n8n removal: remove `N8N_WEBHOOK_URL` and `N8N_FOLLOWUP_WEBHOOK_URL` from `.env.example`. Remove all n8n references from route handler code (comments, env checks, fetch calls). Clean break with no dead code.
- **D-09:** Remove the outer 90-second `AbortSignal.timeout` from route handlers. Each lib module manages its own timeouts (Tavily: 15s, Claude: SDK defaults). No artificial wrapper timeout needed for direct function calls.

### Claude's Discretion

- Exact validation logic per workflow (which fields required, type checks)
- How to structure the switch/case or if/else dispatch in the route handler
- Whether to extract shared auth/parse logic into a helper or keep inline
- HTTP status codes for edge cases not explicitly mapped above

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INT-01 | Route handlers `/api/generate` and `/api/followup` call Gmail/Claude/Tavily directly instead of proxying to n8n webhooks | Lib modules are ready: `fetchEmails()`, `summarizeEmails()`, `generatePost()`, `generateResearchPost()`, `generateQuestions()`, `generatePersonalPost()`, `search()` — all typed and exported |
| INT-02 | All existing frontend components, hooks, and response shapes remain unchanged — zero UI modifications required | `useWorkflow.handleResponse()` at line 36-57 of use-workflow.ts already handles the new shapes; the `{ data: result }` wrapper takes the `json.data` fast path; Q&A sentinel `{ stage: "questions", data, resumeUrl }` satisfies line 38 check |
| INT-03 | New environment variables `ANTHROPIC_API_KEY` and `TAVILY_API_KEY` replace `N8N_WEBHOOK_URL` and `N8N_FOLLOWUP_WEBHOOK_URL` | `.env.example` currently has all four vars — n8n vars must be removed, AI vars are already present |
</phase_requirements>

## Standard Stack

This phase uses no new libraries. All dependencies were installed in Phase 6.

### Core (already installed)
| Library | Purpose | Consumed By |
|---------|---------|-------------|
| `next` (App Router) | Route handler framework | Both route handlers |
| `@anthropic-ai/sdk` | Claude AI calls | `src/lib/claude.ts` (already wraps it) |
| `@tavily/core` | Tavily web search | `src/lib/search.ts` (already wraps it) |
| `next-auth` | Session/auth via `auth()` | Both route handlers |

### No New Installations Required

All libs are present. Phase 7 is a code-edit-only phase — no `npm install` needed.

## Architecture Patterns

### Route Handler Structure (current vs target)

**Current (n8n proxy):**
1. Auth check
2. Parse body
3. Validate influencers (generate only)
4. Check env var for webhook URL
5. `fetch(n8nUrl, ...)` with 90s AbortSignal timeout
6. Proxy raw n8n response back

**Target (direct dispatch):**
1. Auth check (identical to current — preserve verbatim)
2. Parse body (identical to current — preserve verbatim)
3. Validate required fields per workflow (NEW — D-03)
4. Switch on `content_source` → call appropriate lib functions
5. Map errors to HTTP codes (D-06)
6. Return `{ data: result }` (consistent wrapper for handleResponse fast path)

### `/api/generate` Dispatch Tree

```
POST /api/generate
├── auth check → 401 if no session
├── parse body → 400 on malformed JSON
├── switch(body.content_source):
│   ├── "email_summary":
│   │   ├── validate: start_date, end_date required → 400 if missing
│   │   ├── fetchEmails(session.accessToken, startDate, endDate)
│   │   ├── summarizeEmails(groupedEmails)
│   │   └── return { data: summaries }
│   ├── "linkedin_post":
│   │   ├── validate: start_date, end_date required → 400 if missing
│   │   ├── validate: influencers.length <= 3 → 400 if exceeded (preserve existing check)
│   │   ├── fetchEmails(session.accessToken, startDate, endDate)
│   │   ├── if influencers: forEach → search(influencer) → collect TavilyResult[]
│   │   ├── generatePost(emailBodies, searchResults?)
│   │   └── return { data: post }
│   ├── "custom_topic":
│   │   ├── validate: topic required → 400 if missing
│   │   ├── switch(body.topic_type):
│   │   │   ├── "research":
│   │   │   │   ├── search(topic)
│   │   │   │   ├── generateResearchPost(searchResults)
│   │   │   │   └── return { data: researchData }
│   │   │   └── "personal":
│   │   │       ├── generateQuestions(topic)
│   │   │       └── return { stage: "questions", data: questions, resumeUrl: "/api/followup" }
│   └── default: return 400 "Unknown content_source"
└── catch: map error → HTTP code per D-06
```

### `/api/followup` Dispatch

```
POST /api/followup
├── auth check → 401 if no session
├── parse body → 400 on malformed JSON
├── validate: topic and answers required → 400 if missing
├── generatePersonalPost(body.topic as string, body.answers as string)
├── return { data: post }
└── catch: map error → HTTP code per D-06
```

### Error Mapping Pattern (D-06)

```typescript
// Source: D-06 locked decisions
try {
  // lib function calls
} catch (err: unknown) {
  console.error("[api/generate] error:", err)
  const message = err instanceof Error ? err.message : "Unknown error"

  // Gmail auth failure
  if (message.includes("Gmail list error: 401") || message.includes("Gmail list error: 403") ||
      message.includes("Gmail get error: 401") || message.includes("Gmail get error: 403")) {
    return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 })
  }
  // Tavily / Claude timeout
  if (message === "Search timed out") {
    return NextResponse.json({ error: "Request timed out" }, { status: 504 })
  }
  // Claude JSON parse failure (thrown by callWithJsonRetry on second failure)
  if (message.includes("JSON")) {
    return NextResponse.json({ error: "Received an invalid response from the server." }, { status: 500 })
  }
  // Generic fallback
  return NextResponse.json({ error: "Something went wrong. Please try again in a moment." }, { status: 500 })
}
```

### Workflow 2 — Email Bodies for generatePost()

`generatePost()` signature: `generatePost(emailBodies: string[], searchResults?: TavilyResult[])`

`fetchEmails()` returns `GroupedEmails` (a `Map<string, EmailMessage[]>`). To extract `emailBodies: string[]`:

```typescript
// Source: claude.ts generatePost() signature, gmail.ts GroupedEmails type
const emailBodies: string[] = []
for (const emails of Array.from(groupedEmails.values())) {
  for (const email of emails) {
    emailBodies.push(email.body)
  }
}
```

### Workflow 2 — Influencer Search

When `influencers` is present (array of strings), run one Tavily search per influencer name and collect all results. The search query format should be the influencer name as-is (matches what n8n was doing before).

```typescript
let searchResults: TavilyResult[] | undefined
if (Array.isArray(body.influencers) && body.influencers.length > 0) {
  const influencerNames = body.influencers as string[]
  const allResults = await Promise.all(
    influencerNames.map(name => search(name, { maxResults: 5 }))
  )
  searchResults = allResults.flat()
}
```

### Response Wrapping — Critical for INT-02

`useWorkflow.handleResponse()` (use-workflow.ts line 47):
```typescript
let result: unknown = json.data ?? json.output ?? json
```

Route handlers MUST return `{ data: result }` for non-Q&A paths. This ensures:
- `json.data` resolves immediately (fast path)
- No accidental unwrapping through the `output` branch (n8n legacy format)
- `setState({ status: "result", data: result })` receives the correct typed payload

The only exception is the personal post Q&A response which uses the sentinel shape:
```typescript
return NextResponse.json({ stage: "questions", data: questions, resumeUrl: "/api/followup" })
```
This triggers the `json.stage === "questions" && json.resumeUrl` check at line 38 of use-workflow.ts.

### Anti-Patterns to Avoid

- **Returning raw lib output without `{ data: ... }` wrapper:** The hook tries `json.data` first. Returning a bare string or object bypasses this and falls through to `json.output ?? json`, which may produce incorrect results for typed payloads like `Workflow1Data[]`.
- **Keeping `AbortSignal.timeout(90_000)` wrapper:** D-09 explicitly removes this. Each lib module manages its own timeouts. The outer timeout would interfere with Gmail's sequential fetch loop (no fixed time).
- **Checking `N8N_WEBHOOK_URL` env var existence:** Must be removed entirely per D-08. If left in as a dead branch, TypeScript still compiles but creates confusing dead code.
- **Returning `resumeUrl` without `stage: "questions"`:** The hook gate is the combination of both fields (line 38). Either alone does not trigger Q&A state.
- **Parallel Gmail message fetches inside route handler:** gmail.ts already fetches sequentially. Don't add parallelism here — PERF-01 is a deferred future requirement.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email HTML → plain text | Custom HTML stripper in route handler | `fetchEmails()` returns pre-stripped `body` field | Already done in gmail.ts `htmlToText()` |
| Tavily search with timeout | `fetch()` + `AbortSignal` in route handler | `search()` from search.ts | 15s timeout already handled via Promise.race |
| Claude JSON retry | Manual retry loop in route handler | `callWithJsonRetry()` inside claude.ts | Two-attempt retry with correction prompt already in place |
| Gmail pagination | Manual `nextPageToken` loop in route handler | `fetchEmails()` | Full pagination loop already in gmail.ts `listMessageIds()` |
| base64url decode | Manual Buffer.from + decode | Already inside gmail.ts `extractBody()` | Not needed in route handler |

**Key insight:** All complex async operations with error handling, pagination, retries, and timeouts are encapsulated in the Phase 6 lib modules. Route handlers are dispatch/validation/error-mapping layers only.

## Common Pitfalls

### Pitfall 1: Missing `resumeUrl` in Q&A Sentinel Response

**What goes wrong:** Personal post questions are returned but the frontend stays in loading state, never showing the Q&A form.

**Why it happens:** `useWorkflow.handleResponse()` line 38 checks BOTH `json.stage === "questions"` AND `json.resumeUrl`. If `resumeUrl` is absent (even though `followUp()` hardcodes the URL), the check fails silently and `handleResponse()` falls through to `setState({ status: "result" })` with the questions string as the result data.

**How to avoid:** Always return exactly `{ stage: "questions", data: questions, resumeUrl: "/api/followup" }` — no deviations.

**Warning signs:** Frontend shows result display with a numbered list of questions as plain text instead of the Q&A form.

### Pitfall 2: Workflow 1 Returns Array, Not Object

**What goes wrong:** `handleResponse()` tries `json.data ?? json.output ?? json`. If you return `{ data: summaries }` where `summaries` is an `EmailSummaryItem[]`, the `json.data` path gets an array — correct. But if you accidentally return `{ summaries: [...] }` (the internal shape from `callWithJsonRetry`), `json.data` is undefined and `json` itself (the full response object) becomes the result — incorrect shape.

**Why it happens:** `summarizeEmails()` internally wraps in `{ summaries: [...] }` for reliability and returns `result.summaries`. The function already unwraps it — don't re-wrap in `{ summaries }` at the route handler level.

**How to avoid:** Route handler receives `Workflow1Data` (an array) from `summarizeEmails()` and returns `NextResponse.json({ data: summaries })`.

### Pitfall 3: Date String → Date Object Conversion

**What goes wrong:** `fetchEmails(accessToken, startDate, endDate)` expects `Date` objects, not strings. The frontend sends ISO date strings like `"2026-03-01"`.

**Why it happens:** The page sends `start_date: startDate` where `startDate` is a string from an `<input type="date">`. Route handler must parse these before passing to `fetchEmails()`.

**How to avoid:**
```typescript
const startDate = new Date(body.start_date as string)
const endDate = new Date(body.end_date as string)
```
Also validate they are valid dates (not `NaN`) before calling fetchEmails.

**Warning signs:** `Invalid time value` error from `formatDateForGmail()` inside gmail.ts.

### Pitfall 4: Gmail Error Messages in catch()

**What goes wrong:** Error mapping (D-06) tries to match Gmail error messages like `"Gmail list error: 401"`. If the message format changes or is wrapped in a different error, the auth_expired mapping misses and falls through to generic 500.

**Why it happens:** gmail.ts throws `new Error(\`Gmail list error: ${res.status}\`)` and `new Error(\`Gmail get error: ${res.status}\`)`. These are the only formats it throws.

**How to avoid:** Check `message.includes("401")` or `message.includes("403")` with broad match rather than exact string equality, since both `listMessageIds` and `getMessage` throw different but similar messages.

### Pitfall 5: `body.influencers` is `undefined` vs empty array

**What goes wrong:** `generatePost(emailBodies, undefined)` vs `generatePost(emailBodies, [])` behave identically (both skip the research section). But the existing max-3 influencer check crashes if you do `body.influencers.length > 3` when `body.influencers` is `undefined`.

**Why it happens:** The linkedin-post page sends `influencers: undefined` when there are no influencers (not an empty array).

**How to avoid:** Keep the existing guard `if (Array.isArray(body.influencers) && body.influencers.length > 3)` — this is already in the current route handler and must be preserved verbatim per the code context notes.

## Code Examples

### Workflow 1 — Email Summary Dispatch

```typescript
// Source: gmail.ts fetchEmails() + claude.ts summarizeEmails() signatures
// content_source: "email_summary"
const startDate = new Date(body.start_date as string)
const endDate = new Date(body.end_date as string)

const groupedEmails = await fetchEmails(session.accessToken, startDate, endDate)
const summaries = await summarizeEmails(groupedEmails)
return NextResponse.json({ data: summaries })
```

### Workflow 2 — LinkedIn Post Dispatch

```typescript
// Source: gmail.ts GroupedEmails type, claude.ts generatePost() signature
// content_source: "linkedin_post"
const startDate = new Date(body.start_date as string)
const endDate = new Date(body.end_date as string)

const groupedEmails = await fetchEmails(session.accessToken, startDate, endDate)
const emailBodies: string[] = []
for (const emails of Array.from(groupedEmails.values())) {
  for (const email of emails) {
    emailBodies.push(email.body)
  }
}

let searchResults: TavilyResult[] | undefined
if (Array.isArray(body.influencers) && body.influencers.length > 0) {
  const allResults = await Promise.all(
    (body.influencers as string[]).map(name => search(name, { maxResults: 5 }))
  )
  searchResults = allResults.flat()
}

const post = await generatePost(emailBodies, searchResults)
return NextResponse.json({ data: post })
```

### Workflow 3 — Research Path

```typescript
// Source: search.ts search() + claude.ts generateResearchPost() signatures
// content_source: "custom_topic", topic_type: "research"
const results = await search(body.topic as string)
const researchData = await generateResearchPost(results)
return NextResponse.json({ data: researchData })
```

### Workflow 3 — Personal Path (Q&A Sentinel)

```typescript
// Source: claude.ts generateQuestions() + use-workflow.ts handleResponse() line 38
// content_source: "custom_topic", topic_type: "personal"
const questions = await generateQuestions(body.topic as string)
// resumeUrl is a sentinel for useWorkflow's Q&A gate — must be present
return NextResponse.json({ stage: "questions", data: questions, resumeUrl: "/api/followup" })
```

### `/api/followup` Body Shape

```typescript
// Source: custom-topic/page.tsx handleFollowUp() — sends { topic, answers }
// body.answers is already formatted as numbered Q&A text by buildAnswersText()
const post = await generatePersonalPost(
  body.topic as string,
  body.answers as string
)
return NextResponse.json({ data: post })
```

### `.env.example` Final State

Remove (D-08, INT-03):
```
N8N_WEBHOOK_URL=...
N8N_FOLLOWUP_WEBHOOK_URL=...
```

Keep / ensure present:
```
ANTHROPIC_API_KEY=your-anthropic-api-key
TAVILY_API_KEY=your-tavily-api-key
```

Both `ANTHROPIC_API_KEY` and `TAVILY_API_KEY` are already in the current `.env.example` — the edit is additive removal of n8n vars only.

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| n8n webhook proxy — route handlers are thin fetch wrappers | Direct lib dispatch — route handlers own the workflow logic | All AI/search calls are now in-process; no external dependency at runtime |
| n8n manages timeout (90s webhook limit) | Each lib manages its own timeout (Tavily: 15s, Claude: SDK default) | D-09 removes outer timeout wrapper |
| n8n webhook URL env vars required | ANTHROPIC_API_KEY + TAVILY_API_KEY only | INT-03 — env config simplification |

## Open Questions

1. **`topic_type` missing from body (custom_topic without topic_type)**
   - What we know: The custom-topic page always sends `topic_type` (`"research"` or `"personal"`). There is no UI path that omits it.
   - What's unclear: Whether the planner should add a defensive default or just return 400.
   - Recommendation: Default to `"research"` if `topic_type` is absent — matches the page's default UI state and is the safer fallback.

2. **Empty email results (no emails in date range)**
   - What we know: `fetchEmails()` returns an empty Map when no messages match. `summarizeEmails()` would then receive an empty GroupedEmails and call Claude with an empty user message.
   - What's unclear: Whether the route handler should short-circuit before calling Claude when emails are empty.
   - Recommendation: Check `groupedEmails.size === 0` after `fetchEmails()` and return `{ data: [] }` (HTTP 200) for Workflow 1. For Workflow 2, return `{ data: "" }`. This matches the D-06 `empty_result` code path and avoids a wasted Claude call.

3. **Influencer search parallel vs sequential**
   - What we know: Workflow 2 may have 1-3 influencer names. Each triggers a Tavily search.
   - What's unclear: Parallel with `Promise.all` vs sequential.
   - Recommendation: Use `Promise.all` — Tavily calls are independent, and the 15s timeout in search.ts applies per call. Three parallel calls are all within the 15s window.

## Environment Availability

| Dependency | Required By | Available | Notes |
|------------|------------|-----------|-------|
| `ANTHROPIC_API_KEY` | claude.ts Anthropic SDK | Must be set in env | Already in .env.example |
| `TAVILY_API_KEY` | search.ts Tavily SDK | Must be set in env | Already in .env.example |
| `session.accessToken` | fetchEmails() Gmail API | Provided by auth() | Phase 5 ensures rotation |
| `N8N_WEBHOOK_URL` | Current route handler | Remove | D-08 — eliminate entirely |
| `N8N_FOLLOWUP_WEBHOOK_URL` | Current followup handler | Remove | D-08 — eliminate entirely |

**Missing dependencies with no fallback:** None — all required env vars are present in .env.example.

**Step 2.6: Environment Availability** — No new external CLI tools or services beyond what Phase 6 already established. This phase is code-edit only.

## Sources

### Primary (HIGH confidence)

- Direct source read: `src/app/api/generate/route.ts` — current n8n proxy implementation
- Direct source read: `src/app/api/followup/route.ts` — current followup proxy implementation
- Direct source read: `src/lib/claude.ts` — all 5 exported function signatures and return types
- Direct source read: `src/lib/gmail.ts` — `fetchEmails()` signature, `GroupedEmails` type, error message formats
- Direct source read: `src/lib/search.ts` — `search()` signature, `TavilyResult` type
- Direct source read: `src/hooks/use-workflow.ts` — `handleResponse()` logic lines 36-57
- Direct source read: `src/types/workflow.ts` — `Workflow1Data`, `Workflow2Data`, `Workflow3Data`, `WorkflowState` types
- Direct source read: `src/app/(protected)/dashboard/*/page.tsx` — exact body shapes sent to `/api/generate` and `/api/followup`
- Direct source read: `.env.example` — current env var state
- Direct source read: `.planning/phases/07-route-handler-rewrites/07-CONTEXT.md` — all locked decisions

### Secondary (MEDIUM confidence)

- None needed — all contracts verified directly from source

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all Phase 6 libs verified by source read
- Architecture: HIGH — dispatch tree derived directly from locked decisions + hook source
- Pitfalls: HIGH — derived from direct inspection of use-workflow.ts handleResponse(), gmail.ts error throws, and page.tsx body shapes

**Research date:** 2026-04-04
**Valid until:** Stable indefinitely — no external dependency research; all findings from project source
