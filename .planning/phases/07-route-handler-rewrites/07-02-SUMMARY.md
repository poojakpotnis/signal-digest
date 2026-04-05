---
phase: 07-route-handler-rewrites
plan: 02
subsystem: api-route-handlers
tags: [n8n-removal, route-handler, claude-direct, env-cleanup]
dependency_graph:
  requires: [06-02]
  provides: [followup-direct-dispatch, clean-env-config]
  affects: [src/app/api/followup/route.ts, .env.example]
tech_stack:
  added: []
  patterns: [direct-lib-dispatch, input-validation, error-mapping]
key_files:
  created: []
  modified:
    - src/app/api/followup/route.ts
    - .env.example
decisions:
  - "D-05: /api/followup calls generatePersonalPost(topic, answers) directly, returns { data: post }"
  - "D-07: console.error with [api/followup] prefix for server-side error logging"
  - "D-08: N8N_WEBHOOK_URL and N8N_FOLLOWUP_WEBHOOK_URL removed from .env.example"
  - "D-09: AbortSignal.timeout wrapper removed; each lib module manages its own timeouts"
metrics:
  duration: ~5 min
  completed: 2026-04-04
  tasks: 2
  files: 2
---

# Phase 07 Plan 02: Followup Route Rewrite and Env Cleanup Summary

**One-liner:** Direct Claude dispatch for /api/followup replacing n8n proxy, with n8n vars removed from .env.example.

## What Was Built

Rewrote `src/app/api/followup/route.ts` to call `generatePersonalPost(topic, answers)` from `src/lib/claude.ts` directly, eliminating the n8n webhook proxy. Cleaned `.env.example` to remove `N8N_WEBHOOK_URL` and `N8N_FOLLOWUP_WEBHOOK_URL`, leaving only the AI keys (`ANTHROPIC_API_KEY`, `TAVILY_API_KEY`) alongside the existing auth vars.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rewrite /api/followup with direct Claude dispatch | aad1011 | src/app/api/followup/route.ts |
| 2 | Clean up .env.example — remove n8n vars | 51837fd | .env.example |

## Decisions Made

- **D-05 applied:** `/api/followup` extracts `body.topic` and `body.answers` (both validated as strings with 400 on missing/wrong type), calls `generatePersonalPost(topic, answers)`, returns `{ data: post }` for `useWorkflow.handleResponse()` fast path via `json.data`.
- **D-07 applied:** `console.error("[api/followup] error:", err)` prefix for server-side logging; sanitized message returned to client.
- **D-08 applied:** `N8N_FOLLOWUP_WEBHOOK_URL` removed from route handler and `.env.example`; `N8N_WEBHOOK_URL` removed from `.env.example`.
- **D-09 applied:** `AbortSignal.timeout(90_000)` wrapper removed; `generatePersonalPost()` in claude.ts uses Anthropic SDK defaults.

## Verification Results

- `npx tsc --noEmit`: PASS (zero errors)
- `grep -ci "n8n\|N8N" src/app/api/followup/route.ts`: 0 — no n8n references
- `grep -ci "n8n\|N8N" .env.example`: 0 — no n8n vars
- `grep "generatePersonalPost" src/app/api/followup/route.ts`: import + call both confirmed
- `grep "ANTHROPIC_API_KEY\|TAVILY_API_KEY" .env.example`: both AI keys present
- `grep "AUTH_GOOGLE_ID\|AUTH_SECRET\|ALLOWED_EMAIL" .env.example`: all preserved

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — the followup route wires directly to `generatePersonalPost()` which is fully implemented in claude.ts.

## Self-Check: PASSED

- [x] `src/app/api/followup/route.ts` exists and contains `generatePersonalPost`
- [x] `.env.example` exists and contains `ANTHROPIC_API_KEY`, `TAVILY_API_KEY`; no `N8N` vars
- [x] Commit `aad1011` exists (Task 1)
- [x] Commit `51837fd` exists (Task 2)
- [x] TypeScript compiles cleanly
