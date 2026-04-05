---
phase: 05-auth-hardening
plan: 01
subsystem: auth
tags: [next-auth, jwt, google-oauth, refresh-token, session]

# Dependency graph
requires:
  - phase: 01-foundation-auth
    provides: Google OAuth2 sign-in with accessToken stored in session JWT
provides:
  - JWT refresh token rotation with 4-branch callback in src/auth.ts
  - Augmented next-auth types with expiresAt, refreshToken, error fields
  - Protected layout with RefreshTokenError detection and auto sign-out
affects: [06-gmail-api, 07-ai-backend]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "4-branch jwt callback: account present / no refreshToken / token valid / token expired"
    - "RefreshTokenError literal type signals revoked/missing refresh tokens to layout"
    - "60-second proactive expiry buffer avoids race conditions on token expiry"

key-files:
  created: []
  modified:
    - src/auth.ts
    - src/types/next-auth.d.ts
    - src/app/(protected)/layout.tsx

key-decisions:
  - "Use (token.expiresAt as number) cast instead of ! non-null assertion for TypeScript arithmetic compatibility"
  - "Use token.refreshToken as string cast in URLSearchParams — JWT type augmentation yields {} inferred type without explicit assertion"
  - "session.error cast to RefreshTokenError | undefined to satisfy session type assignment"

patterns-established:
  - "Branch 2 (legacy session): return RefreshTokenError when refreshToken absent — forces re-authorization for pre-Phase-5 sessions"
  - "Branch 4 (expired): preserve existing refresh_token via newTokens.refresh_token ?? token.refreshToken in case Google omits it"
  - "Layout error detection: check session.error === RefreshTokenError after null-session check, before rendering children"

requirements-completed: [AUTH-01]

# Metrics
duration: 2min
completed: 2026-04-04
---

# Phase 05 Plan 01: Auth Hardening — Refresh Token Rotation Summary

**Google OAuth2 refresh token rotation via 4-branch jwt callback, with RefreshTokenError propagation through session to protected layout for forced re-authorization**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-04T17:11:58Z
- **Completed:** 2026-04-04T17:13:28Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Implemented 4-branch JWT callback: first sign-in captures refresh token, legacy sessions signal RefreshTokenError, valid tokens pass through, expired tokens fetch new ones from Google's token endpoint
- Extended next-auth type augmentations with expiresAt, refreshToken, and error fields on both JWT and Session interfaces
- Protected layout now detects RefreshTokenError and calls server-side signOut to clear the session cookie and redirect to /login

## Task Commits

Each task was committed atomically:

1. **Task 1: Update type augmentations and implement JWT refresh token rotation in auth.ts** - `817baf7` (feat)
2. **Task 2: Add RefreshTokenError handling to protected layout** - `2c01f58` (feat)

## Files Created/Modified
- `src/auth.ts` - 4-branch JWT callback with refresh token rotation and EXPIRY_BUFFER_SECONDS constant
- `src/types/next-auth.d.ts` - Added expiresAt, refreshToken, error to JWT; added error to Session
- `src/app/(protected)/layout.tsx` - Added signOut import and RefreshTokenError detection before rendering children

## Decisions Made
- Type casts needed for TypeScript arithmetic compatibility: `(token.expiresAt as number)` instead of `!` non-null assertion
- `token.refreshToken as string` required in URLSearchParams because JWT augmentation type resolves as `{}` without explicit assertion
- `session.error` assignment required explicit cast `as "RefreshTokenError" | undefined` to satisfy the Session type

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript type errors in jwt callback**
- **Found during:** Task 1 (auth.ts implementation)
- **Issue:** Three type errors: (1) `token.expiresAt!` not valid in arithmetic expression per TS2362; (2) `token.refreshToken` inferred as `{}` not assignable to `string` in URLSearchParams per TS2345; (3) `token.accessToken` and `token.error` type `unknown` not assignable to session fields per TS2322
- **Fix:** Added explicit type casts `(token.expiresAt as number)`, `token.refreshToken as string`, `token.accessToken as string | undefined`, `token.error as "RefreshTokenError" | undefined`
- **Files modified:** src/auth.ts
- **Verification:** `npx tsc --noEmit` exits with code 0
- **Committed in:** 817baf7 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 TypeScript type error fix)
**Impact on plan:** Required for TypeScript compilation correctness. No behavioral changes — casts are safe given the runtime values are always of the correct types.

## Issues Encountered
- TypeScript's handling of JWT interface augmentations yields `unknown` for dynamically typed fields. Explicit casts in the session callback were needed to satisfy the compiler. The logic is correct; the casts are type annotations only.

## User Setup Required
None — no new external service configuration required. Users will need to re-authorize once after this phase ships (new scopes + refresh token requires fresh Google consent), but this is expected behavior documented in STATE.md blockers.

## Next Phase Readiness
- Phase 6 (Gmail API) can proceed: `session.accessToken` is now guaranteed valid (or user is signed out)
- `/api/generate` and `/api/followup` route handlers read `session.accessToken` unchanged — no modifications needed
- Users with pre-Phase-5 sessions will be automatically signed out and prompted to re-authorize on next visit

---
*Phase: 05-auth-hardening*
*Completed: 2026-04-04*

## Self-Check: PASSED

- FOUND: src/auth.ts
- FOUND: src/types/next-auth.d.ts
- FOUND: src/app/(protected)/layout.tsx
- FOUND: .planning/phases/05-auth-hardening/05-01-SUMMARY.md
- FOUND commit: 817baf7 (feat: JWT refresh token rotation)
- FOUND commit: 2c01f58 (feat: RefreshTokenError in protected layout)
