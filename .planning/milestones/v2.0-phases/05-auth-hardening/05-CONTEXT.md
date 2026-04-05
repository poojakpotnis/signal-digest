# Phase 5: Auth Hardening - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

OAuth sessions survive beyond the 1-hour access token expiry by storing and automatically refreshing the Google refresh token. No new UI, no new routes, no new scopes — purely server-side JWT/session changes in `src/auth.ts`.

</domain>

<decisions>
## Implementation Decisions

### Token Refresh Strategy
- **D-01:** Store `refresh_token` and `expires_at` from `account` in the JWT callback (alongside the existing `access_token`).
- **D-02:** Proactive refresh in the JWT callback — check `expires_at` on every request. If the access token is expired, exchange the refresh token for a new access token via Google's token endpoint before the route handler runs. The user never sees a 401.
- **D-03:** If the refresh token itself is revoked (user removed app access in Google settings), clear the entire JWT/session and redirect to `/login` with a "Session expired, please sign in again" message.

### Re-authorization UX
- **D-04:** Detect missing refresh token in the JWT callback. If a session exists but has no `refresh_token` (legacy sessions from before Phase 5), auto sign-out and redirect to login. The user re-authorizes once and receives a proper refresh token.
- **D-05:** No server-side session invalidation or secret rotation needed — the missing-token detection handles the transition cleanly.

### Error Handling
- **D-06:** All refresh failures (revoked token, network error, Google API error) are treated identically — clear session, redirect to login. No retry logic for transient errors.
- **D-07:** Mid-workflow refresh failures return the existing `auth_expired` error code from Phase 4's `WorkflowState`. The frontend already handles this (shows "Session expired" with a sign-in button). Zero frontend changes required.

### Claude's Discretion
- Exact Google token endpoint URL and request format for refresh exchange
- Whether to use a helper function or inline the refresh logic in the JWT callback
- Token expiry buffer (e.g., refresh 5 minutes before actual expiry vs. at exact expiry)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Auth Implementation
- `src/auth.ts` — Current NextAuth config with JWT/session callbacks (the file being modified)
- `.planning/phases/01-foundation-auth/01-CONTEXT.md` — Phase 1 auth decisions (D-04 through D-06)
- `.planning/phases/01-foundation-auth/01-RESEARCH.md` — Auth.js v5 patterns and pitfalls

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — AUTH-01 requirement
- `.planning/ROADMAP.md` — Phase 5 success criteria (3 must-be-true statements)

### Error Handling Patterns
- `src/app/api/generate/route.ts` — Existing error response format with `auth_expired` code
- `src/hooks/useWorkflow.ts` — Frontend error handling that Phase 5 must not break

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/auth.ts` — Already has `prompt: "consent"` and `access_type: "offline"` configured, so Google will issue a refresh token. The JWT callback just needs to capture and use it.

### Established Patterns
- JWT callback pattern: `if (account?.provider === "google")` guard for initial sign-in data capture
- Session callback exposes token fields to server-side `auth()` calls
- Error codes: `auth_expired | timeout | empty_result | generic` in WorkflowState (Phase 4)

### Integration Points
- `src/auth.ts` JWT callback — primary modification target
- `src/auth.ts` session callback — must expose refreshed `accessToken` to route handlers
- Route handlers (`/api/generate`, `/api/followup`) consume `session.accessToken` — no changes needed if JWT callback keeps it fresh

</code_context>

<specifics>
## Specific Ideas

- The v1.0 Phase 1 implementation already requests `access_type: "offline"` but never stores the refresh token — the gap is only in the JWT callback, not in the OAuth config.
- Single-user app (poojakpotnis@gmail.com) means the re-authorization on deploy affects exactly one person — no need for migration tooling or batch invalidation.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-auth-hardening*
*Context gathered: 2026-04-04*
