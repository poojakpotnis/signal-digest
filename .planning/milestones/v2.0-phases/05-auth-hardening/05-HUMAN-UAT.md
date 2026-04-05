---
status: partial
phase: 05-auth-hardening
source: [05-VERIFICATION.md]
started: 2026-04-04T17:30:00Z
updated: 2026-04-04T17:30:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Sign in and inspect JWT for refresh_token field
expected: refresh_token is non-null in the session JWT after sign-in (requires Google consent screen + real OAuth flow)
result: [pending]

### 2. Wait for access token to expire and make a protected request
expected: Request succeeds with a new accessToken — user is not redirected to /login
result: [pending]

### 3. Invoke a Gmail API call with a session older than 1 hour
expected: Gmail API responds with data, not a 401 (Phase 6 endpoint not yet implemented)
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
