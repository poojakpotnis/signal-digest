# Phase 7: Route Handler Rewrites - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

`/api/generate` and `/api/followup` dispatch to the new lib modules directly, n8n env vars are removed, and all three workflows return the same JSON shapes the existing frontend already consumes. Zero UI modifications.

</domain>

<decisions>
## Implementation Decisions

### Workflow Dispatch
- **D-01:** `/api/generate` switches on `body.content_source` to route to the correct workflow: `"email_summary"` → Workflow 1, `"linkedin_post"` → Workflow 2, `"custom_topic"` → Workflow 3.
- **D-02:** For `content_source: "custom_topic"`, sub-route on `body.topic_type`: `"research"` calls Tavily search + `generateResearchPost()`, `"personal"` calls `generateQuestions()` and returns Q&A stage response.
- **D-03:** Route handler validates required fields per workflow before calling lib functions. Missing fields return 400 early with a clear error message. Prevents unnecessary Gmail/Claude/Tavily calls on bad input.

### Personal Post Q&A Flow
- **D-04:** Route handler returns `{ stage: "questions", data: questions, resumeUrl: "/api/followup" }` for the personal path. The `resumeUrl` value is a sentinel — `useWorkflow` checks `json.resumeUrl` as a truthy gate (line 38), so it must be present. The `followUp()` function already hardcodes `/api/followup` as the endpoint, so the value is technically unused but satisfies INT-02 (zero frontend changes).
- **D-05:** `/api/followup` extracts `body.topic` and `body.answers` (string), calls `generatePersonalPost(topic, answers)`, and returns the result. Matches the exact shape the frontend already sends.

### Error Mapping
- **D-06:** Lib module errors map to existing frontend error codes:
  - Gmail 401/403 (token revoked/insufficient scopes) → `auth_expired` (HTTP 401)
  - Tavily timeout / Claude timeout → `timeout` (HTTP 504)
  - Empty email results (no emails in date range) → `empty_result` (HTTP 200 with empty data or specific message)
  - Claude JSON parse failure, unknown errors → `generic` (HTTP 500)
- **D-07:** Route handlers log detailed errors server-side with `console.error` using `[api/generate]` and `[api/followup]` prefixes (matching existing pattern). Sanitized messages returned to frontend.

### n8n Cleanup
- **D-08:** Full n8n removal: remove `N8N_WEBHOOK_URL` and `N8N_FOLLOWUP_WEBHOOK_URL` from `.env.example`. Remove all n8n references from route handler code (comments, env checks, fetch calls). Clean break with no dead code.
- **D-09:** Remove the outer 90-second `AbortSignal.timeout` from route handlers. Each lib module manages its own timeouts (Tavily: 15s, Claude: SDK defaults). No artificial wrapper timeout needed for direct function calls.

### Claude's Discretion
- Exact validation logic per workflow (which fields required, type checks)
- How to structure the switch/case or if/else dispatch in the route handler
- Whether to extract shared auth/parse logic into a helper or keep inline
- HTTP status codes for edge cases not explicitly mapped above

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Route Handlers (Rewrite Targets)
- `src/app/api/generate/route.ts` — Current n8n proxy to be fully rewritten with workflow dispatch logic
- `src/app/api/followup/route.ts` — Current n8n follow-up proxy to be rewritten for personal post Q&A

### Lib Modules (Phase 6 Outputs — Call Targets)
- `src/lib/gmail.ts` — `fetchEmails(accessToken, startDate, endDate)` returning `GroupedEmails`
- `src/lib/claude.ts` — `summarizeEmails()`, `generatePost()`, `generateResearchPost()`, `generateQuestions()`, `generatePersonalPost()`
- `src/lib/search.ts` — `search(query, options?)` returning `TavilyResult[]`

### Frontend Contracts (Must Not Break)
- `src/types/workflow.ts` — `Workflow1Data`, `Workflow2Data`, `Workflow3Data`, `WorkflowState` type definitions. Output shapes are locked.
- `src/hooks/use-workflow.ts` — `handleResponse()` (line 36-57) resolves data payload; checks `json.stage === "questions" && json.resumeUrl` for Q&A flow (line 38)

### Frontend Pages (Body Shape Reference)
- `src/app/(protected)/dashboard/email-summary/page.tsx` — Sends `{ content_source: "email_summary", start_date, end_date }`
- `src/app/(protected)/dashboard/linkedin-post/page.tsx` — Sends `{ content_source: "linkedin_post", start_date, end_date, influencers }`
- `src/app/(protected)/dashboard/custom-topic/page.tsx` — Sends `{ content_source: "custom_topic", topic, topic_type }` and followUp sends `{ topic, answers }`

### Auth
- `src/auth.ts` — `session.accessToken` is the Gmail API bearer token (refreshed via Phase 5 rotation)

### Environment
- `.env.example` — Remove n8n vars, ensure `ANTHROPIC_API_KEY` and `TAVILY_API_KEY` present

### Requirements
- `.planning/REQUIREMENTS.md` — INT-01, INT-02, INT-03

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/gmail.ts` — `fetchEmails()` returns `GroupedEmails` (Map<string, EmailMessage[]>), ready for direct use
- `src/lib/claude.ts` — All 5 exported functions return exact workflow type shapes, ready for direct use
- `src/lib/search.ts` — `search()` with built-in 15s timeout, ready for direct use
- `src/auth.ts` — `auth()` returns session with `accessToken` for Gmail API calls

### Established Patterns
- Route handlers use `await auth()` then check `session?.accessToken` for auth gate (both handlers identical)
- Error responses use `{ error: string }` JSON shape with appropriate HTTP status codes
- `console.error` with `[api/generate]` prefix for server-side logging
- Max 3 influencers validation already exists in `/api/generate` route handler — preserve this check

### Integration Points
- `/api/generate` route handler calls gmail.ts, claude.ts, and search.ts based on content_source
- `/api/followup` route handler calls claude.ts `generatePersonalPost()` only
- `useWorkflow` hook consumes response from both endpoints — response shapes must match exactly
- `handleResponse()` in useWorkflow tries `json.data`, then `json.output`, then `json` itself — route handler should return data in `data` field for consistency

</code_context>

<specifics>
## Specific Ideas

- The `resumeUrl: "/api/followup"` sentinel is a pragmatic INT-02 compliance trick — the value happens to be the real endpoint, but `followUp()` doesn't actually use it (it hardcodes the URL)
- `useWorkflow.handleResponse()` has unwrapping logic for `output` wrappers (lines 49-55) — this was for n8n response format. With direct lib returns, route handler should return `{ data: result }` to skip the unwrapping and keep things clean

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-route-handler-rewrites*
*Context gathered: 2026-04-04*
