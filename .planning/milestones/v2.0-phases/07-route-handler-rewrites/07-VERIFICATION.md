---
phase: 07-route-handler-rewrites
verified: 2026-04-04T00:00:00Z
status: passed
score: 11/11 must-haves verified
re_verification: false
---

# Phase 07: Route Handler Rewrites Verification Report

**Phase Goal:** /api/generate and /api/followup dispatch to the new lib modules directly, n8n env vars are removed, and all three workflows return the same JSON shapes the existing frontend already consumes
**Verified:** 2026-04-04
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Workflow 1 (email_summary) fetches emails via Gmail API and returns summarized data wrapped in `{ data: Workflow1Data }` | VERIFIED | route.ts line 51-59: `fetchEmails()` + `summarizeEmails()` called; returns `NextResponse.json({ data: summaries })` |
| 2 | Workflow 2 (linkedin_post) fetches emails, optionally searches influencers via Tavily, and returns post wrapped in `{ data: Workflow2Data }` | VERIFIED | route.ts lines 79-104: `fetchEmails()`, email body extraction, `Promise.all` Tavily search, `generatePost()`, returns `{ data: post }` |
| 3 | Workflow 3 research path searches via Tavily and returns research post wrapped in `{ data: Workflow3ResearchData }` | VERIFIED | route.ts lines 120-123: `search()` + `generateResearchPost()`, returns `NextResponse.json({ data: researchData })` |
| 4 | Workflow 3 personal path returns `{ stage: 'questions', data: questions, resumeUrl: '/api/followup' }` sentinel | VERIFIED | route.ts lines 126-134: `generateQuestions()` called; returns exact sentinel shape matching `useWorkflow.handleResponse()` line 38 check |
| 5 | No n8n references remain in generate route handler | VERIFIED | `grep -i "n8n\|N8N" src/app/api/generate/route.ts` returns zero matches |
| 6 | Error mapping produces auth_expired (401), timeout (504), and generic (500) HTTP responses | VERIFIED | route.ts lines 155-176: Gmail 401/403 → HTTP 401, "Search timed out" → HTTP 504, JSON parse failure → HTTP 500, generic → HTTP 500 |
| 7 | /api/followup calls generatePersonalPost(topic, answers) directly and returns `{ data: post }` | VERIFIED | followup/route.ts line 30-31: `await generatePersonalPost(body.topic, body.answers)`, returns `{ data: post }` |
| 8 | No n8n references remain in followup route handler | VERIFIED | `grep -i "n8n\|N8N" src/app/api/followup/route.ts` returns zero matches |
| 9 | .env.example contains ANTHROPIC_API_KEY and TAVILY_API_KEY | VERIFIED | .env.example lines 9-11: both keys present with placeholder values |
| 10 | .env.example does NOT contain N8N_WEBHOOK_URL or N8N_FOLLOWUP_WEBHOOK_URL | VERIFIED | .env.example is 12 lines total; no N8N string anywhere in file |
| 11 | Error mapping produces consistent HTTP responses matching D-06 vocabulary | VERIFIED | followup/route.ts lines 37-48: JSON parse failure → 500, generic → 500; auth expired → 401 at top-level gate |

**Score:** 11/11 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/api/generate/route.ts` | Direct lib dispatch for all 3 workflows; min 80 lines; contains `fetchEmails` | VERIFIED | 178 lines; imports `fetchEmails`, `summarizeEmails`, `generatePost`, `generateResearchPost`, `generateQuestions`, `search`; switch dispatch on `content_source` |
| `src/app/api/followup/route.ts` | Direct Claude dispatch for personal post Q&A; min 30 lines; contains `generatePersonalPost` | VERIFIED | 49 lines; imports and calls `generatePersonalPost(body.topic, body.answers)` |
| `.env.example` | Clean environment config with AI keys, no n8n vars; contains `ANTHROPIC_API_KEY` | VERIFIED | Contains exactly 7 environment variables: 3 auth vars, ALLOWED_EMAIL, ANTHROPIC_API_KEY, TAVILY_API_KEY — no n8n vars |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/app/api/generate/route.ts` | `src/lib/gmail.ts` | `import fetchEmails` | WIRED | Line 3: `import { fetchEmails } from "@/lib/gmail"`; called at lines 51, 79 |
| `src/app/api/generate/route.ts` | `src/lib/claude.ts` | `import summarizeEmails, generatePost, generateResearchPost, generateQuestions` | WIRED | Line 4: all 4 functions imported; each used in its respective workflow case |
| `src/app/api/generate/route.ts` | `src/lib/search.ts` | `import search` | WIRED | Line 5: `import { search } from "@/lib/search"` + line 6 for `TavilyResult` type; `search()` called at lines 98, 121 |
| `src/app/api/followup/route.ts` | `src/lib/claude.ts` | `import generatePersonalPost` | WIRED | Line 3: `import { generatePersonalPost } from "@/lib/claude"`; called at line 30 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `generate/route.ts` — Workflow 1 | `summaries` | `summarizeEmails(groupedEmails)` → Anthropic SDK | Yes — claude.ts line 153 calls `callWithJsonRetry` against live Anthropic API | FLOWING |
| `generate/route.ts` — Workflow 2 | `post` | `generatePost(emailBodies, searchResults)` → Anthropic SDK | Yes — claude.ts line 207 calls `callWithJsonRetry` returning `Workflow2Data` string | FLOWING |
| `generate/route.ts` — Workflow 3 research | `researchData` | `generateResearchPost(results)` → Anthropic SDK | Yes — claude.ts line 288 calls `callWithJsonRetry` returning `Workflow3ResearchData` | FLOWING |
| `generate/route.ts` — Workflow 3 personal | `questions` | `generateQuestions(topic)` → Anthropic SDK | Yes — claude.ts line 329 calls plain text Anthropic API | FLOWING |
| `followup/route.ts` | `post` | `generatePersonalPost(topic, answers)` → Anthropic SDK | Yes — claude.ts line 350 calls plain text Anthropic API | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — route handlers require a running Next.js server and live API keys (Anthropic, Tavily, Google OAuth). Cannot invoke without external services.

TypeScript compilation check (static proxy for correctness):

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles cleanly | `npx tsc --noEmit` | Exit 0, zero errors | PASS |
| No n8n references in generate route | `grep -i "n8n" src/app/api/generate/route.ts` | 0 matches | PASS |
| No n8n references in followup route | `grep -i "n8n" src/app/api/followup/route.ts` | 0 matches | PASS |
| No n8n references in .env.example | `grep -i "n8n" .env.example` | 0 matches | PASS |
| Commit b023313 exists | `git log --oneline` | confirmed | PASS |
| Commit aad1011 exists | `git log --oneline` | confirmed | PASS |
| Commit 51837fd exists | `git log --oneline` | confirmed | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| INT-01 | 07-01, 07-02 | Route handlers `/api/generate` and `/api/followup` call Gmail/Claude/Tavily directly instead of proxying to n8n webhooks | SATISFIED | Both route handlers import lib modules directly; no `fetch()` to external webhook URLs; no `N8N_*` env reads |
| INT-02 | 07-01, 07-02 | All existing frontend components, hooks, and response shapes remain unchanged — zero UI modifications required | SATISFIED | `use-workflow.ts` untouched; response shapes `{ data: ... }` and `{ stage: "questions", data: ..., resumeUrl: ... }` match `handleResponse()` contract at lines 38-56; `{ status: 401 }`, `{ status: 504 }` error shapes match `handleFetch()` at lines 62-69 |
| INT-03 | 07-02 | New environment variables `ANTHROPIC_API_KEY` and `TAVILY_API_KEY` replace `N8N_WEBHOOK_URL` and `N8N_FOLLOWUP_WEBHOOK_URL` | SATISFIED | `.env.example` contains ANTHROPIC_API_KEY and TAVILY_API_KEY; N8N_WEBHOOK_URL and N8N_FOLLOWUP_WEBHOOK_URL are absent |

**Orphaned requirements check:** REQUIREMENTS.md maps INT-01, INT-02, INT-03 to Phase 7. All three appear in plan frontmatter. No orphaned requirements.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | No anti-patterns found |

Scanned for: TODO/FIXME/PLACEHOLDER, `return null`, empty returns, hardcoded empty data, `console.log`-only handlers, external `fetch()` calls, n8n references. None detected in the two route handlers or `.env.example`.

One observation (informational, not a blocker): The PLAN's interface spec documents `EmailMessage.from` (string) but the actual `gmail.ts` exports `EmailMessage.sender` and `EmailMessage.senderName`. The generate route handler does not access `EmailMessage` fields directly — it only reads `.body` (line 85), which exists in both the PLAN spec and the actual implementation. TypeScript compilation passes cleanly (exit 0), confirming no type mismatch at the call sites.

---

### Human Verification Required

#### 1. End-to-End Workflow 1 (Email Summary)

**Test:** Sign in with Google, navigate to Email Summary, select a date range with known emails, click Generate.
**Expected:** Grouped email summary renders in the UI — no error state, data is not empty.
**Why human:** Requires live Gmail OAuth token, ANTHROPIC_API_KEY in environment, and actual email data in the selected date range.

#### 2. End-to-End Workflow 3 Personal Path (Q&A Gate)

**Test:** Navigate to Custom Topic, select "Personal Experience", enter a topic, submit. Verify the Q&A form appears (questions rendered). Then submit answers and verify the final post renders.
**Expected:** First response triggers `status: "questions"` state in useWorkflow; second response (via /api/followup) renders a LinkedIn post string.
**Why human:** Requires live session with `session.accessToken`, ANTHROPIC_API_KEY, and interactive two-step flow that cannot be mocked with static commands.

#### 3. Auth Expiry Error Path

**Test:** With an expired/revoked Google token, submit any workflow.
**Expected:** UI shows "Your session has expired" error state (auth_expired code).
**Why human:** Requires deliberately expired OAuth token — cannot be simulated programmatically without live auth infrastructure.

---

### Gaps Summary

No gaps. All 11 truths verified. All 3 required artifacts exist, are substantive, and are wired. All 4 key links confirmed. All 3 requirement IDs (INT-01, INT-02, INT-03) satisfied. TypeScript compiles cleanly. No n8n references remain in any file.

The phase goal is fully achieved: `/api/generate` and `/api/followup` dispatch directly to `gmail.ts`, `claude.ts`, and `search.ts`; n8n env vars are removed from `.env.example`; all three workflow response shapes (`{ data: summaries }`, `{ data: post }`, `{ data: researchData }`, `{ stage: "questions", ... }`) match the contracts `useWorkflow.handleResponse()` already consumes.

---

_Verified: 2026-04-04_
_Verifier: Claude (gsd-verifier)_
