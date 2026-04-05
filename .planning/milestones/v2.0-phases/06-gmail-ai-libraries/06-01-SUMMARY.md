---
phase: 06-gmail-ai-libraries
plan: 01
subsystem: api
tags: [gmail, tavily, anthropic, fetch, base64url, html-to-text, oauth]

# Dependency graph
requires:
  - phase: 05-auth-hardening
    provides: "session.accessToken (Google OAuth2 bearer token) available for Gmail API calls"
provides:
  - "src/lib/gmail.ts — fetchEmails() with pagination, HTML stripping, sender grouping"
  - "src/lib/search.ts — search() with 15-second AbortSignal timeout"
  - "@anthropic-ai/sdk and @tavily/core installed and importable"
  - ".env.example documented with ANTHROPIC_API_KEY and TAVILY_API_KEY"
affects:
  - "06-02 (claude.ts will import GroupedEmails from gmail.ts and TavilyResult from search.ts)"
  - "Phase 7 route handlers (consume all three lib modules)"

# Tech tracking
tech-stack:
  added:
    - "@anthropic-ai/sdk ^0.82.0 — Claude API client"
    - "@tavily/core ^0.7.2 — Tavily web search SDK"
  patterns:
    - "Raw fetch to Gmail REST API (no googleapis package)"
    - "base64url decoding via Buffer.from(data, 'base64url') for Gmail MIME parts"
    - "Recursive MIME part traversal for multipart email bodies"
    - "Regex-only HTML-to-text stripping (zero deps, per D-07)"
    - "AbortSignal.timeout(15_000) + Promise.race for search timeout enforcement"
    - "Module-scope SDK instantiation (once per module, not per call)"

key-files:
  created:
    - "src/lib/gmail.ts"
    - "src/lib/search.ts"
  modified:
    - "package.json (added @anthropic-ai/sdk, @tavily/core)"
    - "package-lock.json"
    - ".env.example (added ANTHROPIC_API_KEY, TAVILY_API_KEY)"

key-decisions:
  - "Use raw fetch to Gmail REST API (not googleapis package) — 2 endpoints only, avoids 170+ version dependency"
  - "base64url decoding (not base64) for Gmail body.data fields — Gmail uses URL-safe base64 variant"
  - "category:updates after:YYYY/MM/DD before:YYYY/MM/DD query with slashes (not dashes) per Gmail query syntax"
  - "8,000 character per-email body truncation as token budget guard (configurable)"
  - "AbortSignal.timeout + Promise.race for Tavily timeout — consistent with existing route handler pattern"
  - "Prefer text/html over text/plain in MIME part extraction; recursive traversal handles multipart nesting"

patterns-established:
  - "Pattern: Gmail list-then-get — messages.list returns IDs, messages.get?format=full returns full payload"
  - "Pattern: Sequential pagination — do/while loop on nextPageToken until absent"
  - "Pattern: Sender grouping in gmail.ts (not in claude.ts or route handler) per D-10"
  - "Pattern: Internal helpers unexported, only fetchEmails and GroupedEmails/EmailMessage exported"

requirements-completed: [GMAIL-01, GMAIL-02, AI-02, AI-03]

# Metrics
duration: 5min
completed: 2026-04-04
---

# Phase 06 Plan 01: Gmail and Search Library Modules Summary

**Raw Gmail REST API client with base64url decoding and sender grouping, plus Tavily search wrapper with 15-second AbortSignal timeout**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-04T23:17:00Z
- **Completed:** 2026-04-04T23:21:24Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Installed `@anthropic-ai/sdk` and `@tavily/core` SDKs with correct versions (0.82.0, 0.7.2)
- Created `src/lib/gmail.ts` — full Gmail Updates tab fetcher with pagination, recursive MIME traversal, base64url decoding, regex HTML stripping, per-email 8k char truncation, and sender grouping
- Created `src/lib/search.ts` — Tavily search wrapper with 15-second AbortSignal.timeout + Promise.race, typed TavilyResult return
- No access tokens or API keys appear in any log path (T-01, T-02 mitigated)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install SDKs and update env config** - `2734c64` (chore)
2. **Task 2: Create gmail.ts and search.ts library modules** - `6b95129` (feat)

## Files Created/Modified

- `src/lib/gmail.ts` — fetchEmails(accessToken, startDate, endDate): GroupedEmails; EmailMessage and GroupedEmails types exported
- `src/lib/search.ts` — search(query, options?): TavilyResult[]; TavilyResult type exported
- `package.json` — Added @anthropic-ai/sdk ^0.82.0 and @tavily/core ^0.7.2
- `package-lock.json` — Updated lockfile
- `.env.example` — Added ANTHROPIC_API_KEY and TAVILY_API_KEY placeholders (N8N lines preserved for Phase 7 cleanup)

## Decisions Made

- **Raw fetch vs googleapis:** Used raw `fetch` to two Gmail endpoints. The `googleapis` package is 170+ versions and unnecessary for just `messages.list` and `messages.get`.
- **base64url:** Gmail encodes message body data with URL-safe base64 (replaces `+` with `-`, `/` with `_`). Using `"base64"` would produce garbled output. Used `Buffer.from(data, "base64url")`.
- **MIME traversal order:** Prefer `text/html` over `text/plain` (newsletters have richer HTML content), fall back to `text/plain` for plain-text senders. Recursive traversal handles `multipart/alternative` and `multipart/mixed` nesting.
- **8,000 char truncation:** Implemented as a configurable guard. Large newsletter batches could otherwise produce 50k+ tokens for a single email.
- **AbortSignal.timeout pattern:** Consistent with existing `AbortSignal.timeout(90_000)` used in existing route handlers (Phase 2 decision).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

Before Plan 02 (claude.ts) or any route handler can make live API calls, the following env vars must be added to `.env.local`:

- `ANTHROPIC_API_KEY` — from console.anthropic.com -> API Keys -> Create Key
- `TAVILY_API_KEY` — from app.tavily.com -> API Keys

These keys are documented in `.env.example`. The lib modules will fail at runtime (not compile time) if keys are absent.

## Next Phase Readiness

- `src/lib/gmail.ts` ready for import by `claude.ts` (Plan 02) — exports `fetchEmails`, `EmailMessage`, `GroupedEmails`
- `src/lib/search.ts` ready for import by `claude.ts` (Plan 02) — exports `search`, `TavilyResult`
- TypeScript compiles cleanly (`npx tsc --noEmit` passes)
- Plan 02 (`claude.ts`) can now import both modules and build summarizeEmails(), generatePost(), generateResearchPost(), generateQuestions(), generatePersonalPost()

---
*Phase: 06-gmail-ai-libraries*
*Completed: 2026-04-04*

## Self-Check: PASSED

- FOUND: src/lib/gmail.ts
- FOUND: src/lib/search.ts
- FOUND: 06-01-SUMMARY.md
- FOUND: commit 2734c64 (Task 1 — chore: install SDKs)
- FOUND: commit 6b95129 (Task 2 — feat: gmail.ts and search.ts)
