# Phase 5: Auth Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-04
**Phase:** 05-auth-hardening
**Areas discussed:** Token refresh strategy, Re-authorization UX, Error handling for auth failures

---

## Token Refresh Strategy

### Q1: When should the app refresh an expired access token?

| Option | Description | Selected |
|--------|-------------|----------|
| Proactive in JWT callback | Check expires_at on every request in the JWT callback. If expired, refresh silently before the route handler runs. User never sees a failure. | ✓ |
| Reactive on API failure | Let the Gmail/Tavily call fail with 401, then catch it, refresh the token, and retry. Simpler code but adds latency on first failure after expiry. | |
| Hybrid | Proactive check in JWT callback, plus a reactive retry in API calls as a safety net for race conditions. | |

**User's choice:** Proactive in JWT callback
**Notes:** None

### Q2: If the refresh token itself is revoked, what should happen?

| Option | Description | Selected |
|--------|-------------|----------|
| Clear session and redirect to login | Destroy the JWT, redirect to /login with an error like "Session expired, please sign in again." Clean and simple. | ✓ |
| Show inline error on dashboard | Keep the user on the dashboard but show a persistent banner explaining they need to re-authenticate. Avoids jarring redirect. | |

**User's choice:** Clear session and redirect to login
**Notes:** None

---

## Re-authorization UX

### Q1: How should existing users (without a refresh token) be handled after Phase 5 deploys?

| Option | Description | Selected |
|--------|-------------|----------|
| Detect missing refresh token, auto sign-out | In the JWT callback, if refresh_token is missing from the token, sign the user out and redirect to login. They re-authorize once and get a proper refresh token. Simple and predictable. | ✓ |
| Let it fail naturally | Old sessions will eventually hit the 1-hour expiry, fail to refresh (no refresh token), and redirect to login via the revoked-token error path. No special detection needed, but users see an error first. | |
| Force sign-out on deploy | Clear all sessions server-side at deploy time (e.g., rotate the NextAuth secret). Everyone re-signs-in immediately. Cleanest but more disruptive. | |

**User's choice:** Detect missing refresh token, auto sign-out
**Notes:** None

---

## Error Handling for Auth Failures

### Q1: When a token refresh fails during a workflow request, what should happen?

| Option | Description | Selected |
|--------|-------------|----------|
| Return auth_expired error code | Use the existing auth_expired error code from Phase 4. The frontend already handles this — it shows "Session expired" with a sign-in button. Zero frontend changes needed. | ✓ |
| Redirect immediately to login | Skip the error display and redirect straight to /login. Faster path to re-auth but user loses their workflow input. | |
| You decide | Claude picks the best approach based on what the existing error handling already supports. | |

**User's choice:** Return auth_expired error code
**Notes:** Reuses Phase 4 error infrastructure

### Q2: Should the JWT callback distinguish between 'refresh token revoked' and 'temporary Google API error'?

| Option | Description | Selected |
|--------|-------------|----------|
| No, treat all refresh failures the same | Any refresh failure = clear session, redirect to login. Simple. Google API errors are rare enough that re-signing-in is acceptable. | ✓ |
| Yes, retry on transient errors | Catch network/5xx errors and retry once before clearing the session. More resilient but adds complexity for an edge case. | |

**User's choice:** No, treat all refresh failures the same
**Notes:** None

---

## Claude's Discretion

- Token expiry buffer timing (e.g., refresh 5 min before actual expiry)
- Helper function vs inline refresh logic
- Exact Google token endpoint request format

## Deferred Ideas

None — discussion stayed within phase scope.
