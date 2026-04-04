---
phase: 06-gmail-ai-libraries
plan: 02
subsystem: api
tags: [anthropic, claude, ai, sdk, prompts, json-retry, haiku, sonnet]

# Dependency graph
requires:
  - phase: 06-gmail-ai-libraries
    plan: 01
    provides: "EmailMessage, GroupedEmails from gmail.ts; TavilyResult from search.ts; @anthropic-ai/sdk installed"
provides:
  - "src/lib/claude.ts — 5 exported AI generation functions for Workflows 1-3 and personal post Q&A"
  - "summarizeEmails(groupedEmails) — Workflow 1 email summarization returning Workflow1Data"
  - "generatePost(emailBodies, searchResults?) — Workflow 2 two-step post generation returning Workflow2Data"
  - "generateResearchPost(searchResults) — Workflow 3 research path returning Workflow3ResearchData"
  - "generateQuestions(topic) — Workflow 3 personal path step 1, returns clarifying questions string"
  - "generatePersonalPost(topic, answers) — Workflow 3 personal path step 2, returns post string"
affects:
  - "Phase 7 route handlers (consume all 5 functions from claude.ts)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "callWithJsonRetry<T>() — JSON parse with single retry pass (D-05 pattern)"
    - "callForText() — plain text response for string-returning functions"
    - "Module-scope Anthropic() instantiation — one SDK instance per module, reuses connections"
    - "MODEL_SUMMARIZE = claude-haiku-4-5 for intermediate steps (D-03)"
    - "MODEL_GENERATE = claude-sonnet-4-6 for final post generation (D-02)"
    - "serializeGroupedEmails() — Map to readable labeled sections for reliable Claude input"
    - "Pitfall 5 mitigation: wrap array in { summaries: [...] } object for JSON reliability"
    - "Markdown code fence stripping on API responses"
    - "Security T-01/T-02: API key never logged, email content in user messages only"

key-files:
  created:
    - "src/lib/claude.ts"
  modified: []

key-decisions:
  - "claude-sonnet-4-6 locked for all final post generation (D-02) — user has validated tone on this model"
  - "claude-haiku-4-5 for summarization and intermediate steps (D-03) — faster/cheaper for non-creative tasks"
  - "JSON retry mechanism: single retry with correction instruction on parse failure (D-05)"
  - "Prompt-based JSON output with explicit schema in system prompt (D-05 — no Zod)"
  - "6 prompts adapted from n8n workflows and reviewed/approved by user per D-04"
  - "serializeGroupedEmails uses labeled Markdown sections not raw JSON — per RESEARCH.md finding that labeled sections are more reliable for Claude"
  - "generatePost is a two-step function (summarize with Haiku, generate with Sonnet) mirroring n8n two-node Workflow 2"
  - "generateQuestions and generatePersonalPost return plain strings (no JSON per D-11)"

patterns-established:
  - "Pattern: callWithJsonRetry<T> for all JSON-returning functions — consistent retry handling"
  - "Pattern: callForText for plain-string functions — no JSON overhead"
  - "Pattern: System prompt contains JSON schema inline — no external schema files"
  - "Pattern: Strip markdown code fences before JSON.parse — defensive against Claude output variation"
  - "Pattern: T-03 — throw on second parse failure, never return unvalidated data"

requirements-completed: [AI-01, AI-02, AI-03, AI-04]

# Metrics
duration: 15min
completed: 2026-04-04
---

# Phase 06 Plan 02: Claude AI Library Module Summary

**Five Claude AI functions wrapping @anthropic-ai/sdk — summarizeEmails (Haiku), generatePost/generateResearchPost/generateQuestions/generatePersonalPost (Sonnet) — with JSON retry mechanism and 6 prompts adapted from n8n and approved by user**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-04T23:26:00Z
- **Completed:** 2026-04-04T23:41:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Created `src/lib/claude.ts` (384 lines) implementing all 5 AI functions for Workflows 1-3 and personal post Q&A
- Implemented `callWithJsonRetry<T>` helper with single retry on JSON parse failure, markdown code fence stripping, and T-03 throw-on-second-failure safety
- Implemented `callForText` helper for string-returning functions (generateQuestions, generatePersonalPost)
- All 6 prompts adapted from n8n workflows and reviewed/approved by user per D-04 checkpoint
- Model selection enforced at module level: claude-haiku-4-5 for summarization (D-03), claude-sonnet-4-6 for final post generation (D-02)
- Security properties maintained: API key never logged (T-01), email content only in user messages (T-02), unvalidated data never returned (T-03)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create claude.ts with all 5 AI generation functions** - `e4651f8` (feat)
2. **Task 2: User reviews adapted prompts (D-04)** - No commit (checkpoint — user approval, no code change)

## Files Created/Modified

- `src/lib/claude.ts` — All 5 exported AI generation functions with helpers, type imports from gmail.ts/search.ts/workflow.ts

## Decisions Made

- **Model locking (D-02):** claude-sonnet-4-6 is a named constant `MODEL_GENERATE` used for all final post generation. User validated tone/style on this model; changing it would require re-validation.
- **Haiku for intermediate steps (D-03):** `MODEL_SUMMARIZE = "claude-haiku-4-5"` is used for `summarizeEmails` step and Workflow 2 internal summarization step — same quality outcome at lower latency/cost.
- **JSON retry (D-05):** `callWithJsonRetry<T>` makes one retry with a multi-turn correction message. Code fences are stripped before parsing. Second failure throws — callers (Phase 7 route handlers) catch and surface as API errors.
- **Prompt preservation (D-04):** All 6 prompts were adapted from n8n workflow JSON. Core instructions, tone constraints, and sample posts were preserved verbatim. JSON schema output instructions were added. User approved all 6 in this plan's checkpoint.
- **serializeGroupedEmails:** Groups emails into labeled Markdown sections per sender. RESEARCH.md finding: Claude produces more reliable JSON when email data is in human-readable sections rather than raw JSON input.
- **generatePost two-step:** Mirrors the n8n Workflow 2 design (separate summarize node → generate node). Internal summarization uses Haiku; final LinkedIn post generation uses Sonnet.
- **D-11 plain strings:** `generateQuestions` and `generatePersonalPost` return plain strings, not JSON. No JSON schema in their prompts. Callers use the string directly.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

No additional setup beyond what was documented in Plan 01. `ANTHROPIC_API_KEY` is required in `.env.local` (documented in `.env.example`).

## Next Phase Readiness

- `src/lib/claude.ts` ready for import by Phase 7 route handlers
- All 5 functions exported with correct TypeScript signatures matching workflow.ts types
- Imports cleanly from gmail.ts, search.ts, and @/types/workflow
- TypeScript compiles cleanly (no new type errors introduced)
- Phase 7 route handlers can import and call all 5 functions immediately

---
*Phase: 06-gmail-ai-libraries*
*Completed: 2026-04-04*

## Self-Check: PASSED

- FOUND: src/lib/claude.ts
- FOUND: commit e4651f8 (Task 1 — feat: create claude.ts with all 5 AI generation functions)
- FOUND: .planning/phases/06-gmail-ai-libraries/06-02-SUMMARY.md
