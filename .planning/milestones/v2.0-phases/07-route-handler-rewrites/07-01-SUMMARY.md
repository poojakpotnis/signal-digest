---
phase: 07-route-handler-rewrites
plan: "01"
subsystem: api-route-handlers
tags: [route-handler, gmail, claude, tavily, n8n-removal, dispatch]
dependency_graph:
  requires:
    - 06-02: claude.ts with all 5 AI generation functions
    - 06-01: gmail.ts and search.ts library modules
  provides:
    - /api/generate route handler dispatching directly to lib modules
  affects:
    - src/hooks/use-workflow.ts (response shapes consumed unchanged)
    - src/app/(protected)/dashboard/*/page.tsx (body shapes sent unchanged)
tech_stack:
  added: []
  patterns:
    - Switch dispatch on body.content_source in route handler
    - Short-circuit empty email results before Claude calls (D-06 empty_result)
    - Promise.all for parallel influencer Tavily searches
    - resumeUrl sentinel for useWorkflow Q&A gate
key_files:
  created: []
  modified:
    - src/app/api/generate/route.ts
    - .env.example
decisions:
  - Defaulted topic_type to "research" when absent — matches page default UI state (research open question 1)
  - Included .env.example n8n var removal in this commit per D-08 (vars were already staged from prior session)
metrics:
  duration: "~8 minutes"
  completed_date: "2026-04-05"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 2
---

# Phase 07 Plan 01: /api/generate Route Handler Rewrite Summary

**One-liner:** Replaced n8n webhook proxy in /api/generate with direct switch-dispatch to gmail.ts, claude.ts, and search.ts, preserving all frontend response contracts and error codes.

## What Was Built

Fully rewrote `src/app/api/generate/route.ts` (44 lines proxy → 178 lines dispatch handler). The handler now:

1. Authenticates via `auth()` and gates on `session.accessToken` (preserved verbatim)
2. Parses the request body and enforces the max-3 influencer limit (preserved verbatim)
3. Switches on `body.content_source` to route to one of three workflows:
   - `"email_summary"` — validates dates, calls `fetchEmails()` + `summarizeEmails()`, returns `{ data: summaries }`
   - `"linkedin_post"` — validates dates, calls `fetchEmails()`, extracts email bodies, optionally runs parallel Tavily influencer searches, calls `generatePost()`, returns `{ data: post }`
   - `"custom_topic"` — validates topic, sub-dispatches on `topic_type`: research path calls `search()` + `generateResearchPost()` returning `{ data: researchData }`; personal path calls `generateQuestions()` and returns `{ stage: "questions", data: questions, resumeUrl: "/api/followup" }` sentinel
4. Maps lib errors to HTTP codes: Gmail 401/403 → 401 auth_expired, Search timed out → 504 timeout, JSON parse failures → 500 generic, unknown → 500 generic

Also removed `N8N_WEBHOOK_URL` and `N8N_FOLLOWUP_WEBHOOK_URL` from `.env.example` per D-08.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rewrite /api/generate with workflow dispatch and error mapping | b023313 | src/app/api/generate/route.ts, .env.example |

## Verification Results

- `npx tsc --noEmit` — PASSED (zero errors)
- `grep -c "n8n\|N8N" src/app/api/generate/route.ts` — 0 (clean)
- All 5 lib functions imported and used: fetchEmails, summarizeEmails, generatePost, generateResearchPost, generateQuestions, search
- Q&A sentinel `{ stage: "questions", data: questions, resumeUrl: "/api/followup" }` present
- `groupedEmails.size === 0` empty guard present for Workflow 1
- `Array.from(groupedEmails.values())` used for Workflow 2 email body extraction
- No `N8N_WEBHOOK_URL`, `AbortSignal.timeout`, or `fetch(` external call remaining

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all three workflow paths are fully wired to lib modules. No placeholder data.

## Self-Check: PASSED

- [x] `src/app/api/generate/route.ts` exists (178 lines, > 80 line minimum)
- [x] Commit b023313 exists: `git log --oneline | grep b023313` confirms
- [x] `npx tsc --noEmit` exits 0
- [x] Zero n8n references in rewritten file
