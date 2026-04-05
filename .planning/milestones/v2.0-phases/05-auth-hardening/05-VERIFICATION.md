---
phase: 05-auth-hardening
verified: 2026-04-04T17:30:00Z
status: passed
score: 4/4 must-haves verified
gaps: []
human_verification:
  - test: "Sign in and inspect JWT for refresh_token field"
    expected: "refresh_token is non-null in the session JWT after sign-in (requires Google consent screen + real OAuth flow)"
    why_human: "Cannot trigger an OAuth flow programmatically; requires a real browser session with valid Google credentials"
  - test: "Wait for access token to expire (or mock expiresAt in the past) and make a protected request"
    expected: "Request succeeds with a new accessToken — user is not redirected to /login"
    why_human: "Requires live Google token endpoint and a real session older than 1 hour"
  - test: "Invoke a Gmail API call (Phase 6 endpoint) with a session older than 1 hour"
    expected: "Gmail API responds with data, not a 401"
    why_human: "Phase 6 endpoint not implemented yet; requires live tokens"
---

# Phase 05: Auth Hardening Verification Report

**Phase Goal:** OAuth sessions survive beyond the 1-hour access token expiry by storing and refreshing the Google refresh token
**Verified:** 2026-04-04T17:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A user who signs in receives a refresh token stored in their session JWT | VERIFIED | `src/auth.ts` Branch 1 assigns `refreshToken: account.refresh_token` on first sign-in (line 35) |
| 2 | After the 1-hour access token window elapses, the app automatically refreshes the token without prompting re-login | VERIFIED | Branch 4 in `src/auth.ts` POSTs to `https://oauth2.googleapis.com/token` and returns a new `accessToken` + updated `expiresAt` (lines 53-78) |
| 3 | If the refresh token is revoked or missing (legacy session), the user is signed out and redirected to /login | VERIFIED | Branch 2 sets `error: "RefreshTokenError"` (line 42); `src/app/(protected)/layout.tsx` line 15-17 calls `await signOut({ redirectTo: "/login" })` on that error |
| 4 | Route handlers continue to receive a valid accessToken via session without changes | VERIFIED | `session.accessToken = token.accessToken` in session callback (line 86) — existing consumers (`/api/generate`, `/api/followup`) read `session.accessToken` unchanged |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/types/next-auth.d.ts` | JWT and Session type augmentations for refreshToken, expiresAt, error fields | VERIFIED | All fields present: `expiresAt?: number`, `refreshToken?: string`, `error?: "RefreshTokenError"` on JWT; `error?: "RefreshTokenError"` on Session |
| `src/auth.ts` | JWT callback with 4-branch refresh token rotation logic | VERIFIED | All 4 branches implemented (account present / no refreshToken / token valid / token expired); `EXPIRY_BUFFER_SECONDS = 60` constant defined |
| `src/app/(protected)/layout.tsx` | RefreshTokenError detection and signOut redirect | VERIFIED | Imports `signOut` from `@/auth`, checks `session.error === "RefreshTokenError"`, calls `await signOut({ redirectTo: "/login" })` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/auth.ts` | `https://oauth2.googleapis.com/token` | `fetch` POST in jwt callback Branch 4 | WIRED | Pattern `fetch.*oauth2.googleapis.com/token` found at line 53 |
| `src/auth.ts` | `src/types/next-auth.d.ts` | JWT interface augmentation for refreshToken, expiresAt, error | WIRED | `token.refreshToken` referenced at lines 41, 59, 77; TypeScript compiled cleanly (`npx tsc --noEmit` exits 0) |
| `src/app/(protected)/layout.tsx` | `src/auth.ts` | session.error check triggers signOut | WIRED | `session.error === "RefreshTokenError"` at line 15; `signOut` imported from `@/auth` at line 1 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `src/auth.ts` | `token.refreshToken` | `account.refresh_token` from Google OAuth provider on first sign-in | Yes — OAuth `account` object is populated by Auth.js from Google's authorization response | FLOWING |
| `src/auth.ts` | `newTokens.access_token` | POST to `https://oauth2.googleapis.com/token` using stored `token.refreshToken` | Yes — live HTTP exchange with Google's token endpoint | FLOWING |
| `src/app/(protected)/layout.tsx` | `session.error` | Propagated from JWT via `session.error = token.error as "RefreshTokenError" \| undefined` in session callback | Yes — error field set in JWT callback Branches 2 and 4 catch block | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED (requires live OAuth flow and Google credentials — no runnable entry point for automated token testing)

TypeScript compilation verified as a proxy behavioral check:

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Zero type errors across the project | `npx tsc --noEmit` | Exit 0, no output | PASS |
| Both task commits exist in git history | `git log --oneline 817baf7 2c01f58` | Both commits found | PASS |
| Snake_case `token.access_token` anti-pattern absent | grep on `src/auth.ts` | NOT FOUND | PASS |
| `next-auth/react` import absent from layout | grep on `layout.tsx` | NOT FOUND | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AUTH-01 | `05-01-PLAN.md` | User's Google OAuth refresh token is stored in the session so Gmail access survives beyond the 1-hour access token expiry | SATISFIED | Branch 1 stores `refreshToken: account.refresh_token`; Branch 3/4 logic keeps token alive past 1-hour expiry; session callback propagates `accessToken` to all route handlers |

No orphaned requirements: REQUIREMENTS.md maps only AUTH-01 to Phase 5, and 05-01-PLAN.md claims AUTH-01. Coverage is complete.

### Anti-Patterns Found

No blockers or warnings found.

| File | Pattern Checked | Result |
|------|-----------------|--------|
| `src/auth.ts` | TODO/FIXME/PLACEHOLDER | None found |
| `src/auth.ts` | `return null` / empty returns | None found |
| `src/auth.ts` | `token.access_token` (snake_case) | None found — camelCase used throughout |
| `src/types/next-auth.d.ts` | Missing type fields | All fields present |
| `src/app/(protected)/layout.tsx` | `import from "next-auth/react"` | Not found — correct `@/auth` used |
| `src/app/(protected)/layout.tsx` | TODO/FIXME | None found |

### Human Verification Required

#### 1. Refresh Token Stored on Sign-In

**Test:** Sign in with Google using a real browser session. Inspect the session JWT server-side (e.g., add a temporary debug log or use Auth.js debug mode) to confirm `refreshToken` is non-null.
**Expected:** JWT contains a non-null `refreshToken` field after the Google consent screen completes.
**Why human:** Cannot trigger the OAuth authorization code flow programmatically; requires a browser, real Google credentials, and the consent screen granting offline access.

#### 2. Automatic Token Refresh After 1 Hour

**Test:** Obtain a valid session, then either wait for the access token to expire or temporarily set `expiresAt` to a past value in the session cookie. Make a protected request (e.g., navigate to `/`).
**Expected:** The request succeeds and the user is NOT redirected to `/login`. The session callback silently refreshes the access token.
**Why human:** Requires a live Google token endpoint with a real refresh token. Cannot simulate without real credentials.

#### 3. Phase 6 Gmail API Call with Session Older Than 1 Hour

**Test:** After Phase 6 is implemented, invoke the Gmail fetch endpoint with a session older than 1 hour.
**Expected:** Gmail API responds with email data (not a 401 Unauthorized), confirming the access token was refreshed transparently.
**Why human:** Phase 6 endpoint not yet implemented; requires live tokens and Gmail API access.

### Gaps Summary

No gaps. All 4 observable truths are verified at all artifact levels (exists, substantive, wired, data-flowing). AUTH-01 is fully satisfied in code. TypeScript compiles without errors. The only unverifiable items are end-to-end OAuth flows requiring live Google credentials and a browser — these are appropriately flagged for human verification and do not block Phase 6 planning.

---

_Verified: 2026-04-04T17:30:00Z_
_Verifier: Claude (gsd-verifier)_
