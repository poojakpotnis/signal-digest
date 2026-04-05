# Phase 6: Gmail & AI Libraries - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Three new server-side lib modules exist -- `lib/gmail.ts`, `lib/claude.ts`, `lib/search.ts` -- that implement all email fetching, HTML-to-text conversion, AI generation, and web search logic independently of any route handler. Phase 7 wires these into the route handlers.

</domain>

<decisions>
## Implementation Decisions

### AI Provider & Model Strategy
- **D-01:** Consolidate all AI calls to Claude (Anthropic SDK only). Remove GPT-4o-mini and GPT-4 dependencies. Single SDK (`@anthropic-ai/sdk`), single API key (`ANTHROPIC_API_KEY`).
- **D-02:** Claude Sonnet 4.6 is locked for final LinkedIn post generation (Workflows 2 and 3). User has validated tone quality with this model.
- **D-03:** Lighter Claude models (e.g., Haiku) acceptable for email summarization (Workflow 1) and intermediate steps, but quality must not be cut -- summarization must remain thorough with key themes, frameworks, and actionable takeaways.
- **D-04:** Existing n8n system prompts must be adapted for Claude. All prompt changes require user review and approval before implementation. Do not silently modify prompts.

### Structured Output
- **D-05:** Prompt-based JSON output with validation. Include JSON schema in the system prompt, parse Claude's response, retry once on malformed JSON. No Zod dependency.
- **D-06:** `claude.ts` must return exact `Workflow1Data`, `Workflow2Data`, and `Workflow3Data` shapes from `src/types/workflow.ts`. Zero type changes.

### Gmail Fetch Design
- **D-07:** HTML-to-text conversion via regex stripping (strip tags, decode entities, collapse whitespace). Zero dependencies. Sufficient for newsletter email content.
- **D-08:** Sequential pagination following `nextPageToken` until exhausted. For a single-user newsletter app, expect 2-3 pages max.
- **D-09:** Gmail query uses `category:updates after:YYYY/MM/DD before:YYYY/MM/DD` to scope to the Updates tab within the user-specified date range.
- **D-10:** `gmail.ts` returns emails pre-grouped by sender address (`Map<senderEmail, emails[]>` or equivalent). Grouping happens in the Gmail module, not in the AI module or route handler.

### Personal Post Q&A Flow
- **D-11:** Two-step flow: `claude.ts` exposes `generateQuestions(topic)` returning questions as a string, and `generatePersonalPost(topic, answers)` returning the final post. No `resumeUrl` needed.
- **D-12:** `/api/generate` returns `{stage: "questions", data: questions}` for the personal path (same shape the frontend already handles). `/api/followup` calls `generatePersonalPost()` with the user's answers.

### Search Integration
- **D-13:** Single `search(query, options?)` function in `search.ts`. Both influencer research (Workflow 2) and custom topic research (Workflow 3) call the same function with different queries. 15-second timeout enforced internally.
- **D-14:** Use official Tavily SDK (`@tavily/core`) for search. Handles auth, retries, and response typing.

### Claude's Discretion
- Exact Claude model for summarization steps (Haiku vs Sonnet -- choose based on quality testing)
- Gmail API authentication flow using `session.accessToken` (straightforward OAuth bearer token)
- Internal module function signatures beyond the key ones specified above
- Error handling patterns within lib modules (consistent with Phase 4's error codes)
- Token budget management for large email batches

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### AI Prompts (Source of Truth)
- `n8n - System Pompts.md` -- All existing system prompts for Workflows 1-3 with model annotations. These define the current AI behavior to port. Prompt changes require user approval.

### Workflow Types (Locked Contracts)
- `src/types/workflow.ts` -- `Workflow1Data`, `Workflow2Data`, `Workflow3Data`, `WorkflowState` type definitions. Output shapes are locked.

### Existing Route Handlers (Integration Target for Phase 7)
- `src/app/api/generate/route.ts` -- Current n8n proxy; Phase 7 rewires to use lib modules
- `src/app/api/followup/route.ts` -- Current n8n follow-up proxy; Phase 7 rewires for personal post Q&A

### Auth (Gmail Access Token Source)
- `src/auth.ts` -- JWT callback with refresh token rotation. `session.accessToken` is the Gmail API bearer token.

### Frontend Hook (Must Not Break)
- `src/hooks/use-workflow.ts` -- `useWorkflow` hook handles `status: "questions"` with `resumeUrl` for personal post path. Phase 6 modules must produce compatible response shapes.

### Requirements
- `.planning/REQUIREMENTS.md` -- GMAIL-01, GMAIL-02, AI-01 through AI-04

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/types/workflow.ts` -- Locked type definitions for all workflow outputs. `claude.ts` functions return these exact types.
- `src/auth.ts` -- Provides `session.accessToken` for Gmail API authentication via `auth()` call.
- `AbortSignal.timeout(90_000)` pattern from route handlers -- reusable for search timeout (15s for Tavily).

### Established Patterns
- Route handlers use `await auth()` then `session.accessToken` for authenticated API calls
- Error responses use `{ error: string }` shape with HTTP status codes
- `useWorkflow` hook expects `{ stage: "questions", data: string, resumeUrl: string }` for Q&A flow -- `resumeUrl` field exists but won't be used in Phase 7 rewrite

### Integration Points
- `lib/gmail.ts` consumes `accessToken: string` from session
- `lib/claude.ts` consumes `ANTHROPIC_API_KEY` from environment
- `lib/search.ts` consumes `TAVILY_API_KEY` from environment
- All three modules are consumed by route handlers in Phase 7

</code_context>

<specifics>
## Specific Ideas

- User has validated Claude Sonnet 4.6 for LinkedIn post tone/quality -- do not downgrade final post generation
- Summarization quality matters ("do not cut corners") -- if Haiku produces noticeably worse summaries, use Sonnet
- User wants to review all prompt adaptations before they are implemented -- present diffs of n8n prompts vs Claude-adapted versions during execution

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 06-gmail-ai-libraries*
*Context gathered: 2026-04-04*
