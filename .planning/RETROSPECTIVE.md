# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v2.0 — Self-Contained AI Backend

**Shipped:** 2026-04-04
**Phases:** 3 | **Plans:** 5

### What Was Built
- JWT refresh token rotation so sessions survive beyond Google's 1-hour access token expiry
- Gmail REST API client with pagination, base64url decoding, HTML stripping, and sender grouping
- Claude AI library with 5 generation functions (Haiku for summarization, Sonnet for posts) and JSON retry
- Tavily search wrapper with 15-second timeout for web research workflows
- Route handler rewrites — /api/generate and /api/followup dispatch directly to lib modules
- Complete n8n removal — no external orchestration dependency

### What Worked
- Phased approach (auth → libraries → route handlers) gave clean dependency chain — each phase had exactly what it needed from the previous
- Keeping response shapes identical to n8n output meant zero frontend changes — true backend swap
- Library-first design (Phase 6) before route integration (Phase 7) made route handlers trivially simple
- v2.0 completed in a single day (5 plans across 3 phases)

### What Was Inefficient
- REQUIREMENTS.md checkboxes weren't updated as phases completed — had to reconcile at milestone close
- Some SUMMARY.md files missing one_liner field, causing CLI extraction to output "One-liner:" stubs
- STATE.md progress bar showed 0% despite all phases being complete — frontmatter was correct but display section was stale

### Patterns Established
- Raw fetch to Google APIs instead of heavy SDK packages — smaller bundle, simpler auth
- callWithJsonRetry pattern for Claude structured output — single retry on parse failure
- Model routing: Haiku for intermediate/summarization steps, Sonnet for final generation
- AbortSignal.timeout for all external API calls

### Key Lessons
1. Keep requirements tracking checkboxes updated during execution, not just at milestone close
2. Library modules should be fully testable in isolation before wiring into route handlers
3. Response shape preservation is the key constraint for backend swaps — validate shapes match before declaring complete

### Cost Observations
- Model mix: Primarily Sonnet for planning/execution agents, Haiku for summarization functions in claude.ts
- Notable: 5 plans completed in ~1 day — fastest milestone to date

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 MVP | 4 | 11 | Initial build — foundation through deployment |
| v2.0 Self-Contained | 3 | 5 | Backend swap — library-first architecture |

### Top Lessons (Verified Across Milestones)

1. Library-first design pays off — build reusable modules before integration
2. Response shape compatibility is the critical constraint for refactors
