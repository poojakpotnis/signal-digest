# Phase 6: Gmail & AI Libraries - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-04-04
**Phase:** 06-gmail-ai-libraries
**Areas discussed:** Prompt strategy, Gmail fetch design, Personal post Q&A flow, Search integration

---

## Prompt Strategy

### AI Provider & Model Choice

| Option | Description | Selected |
|--------|-------------|----------|
| Keep same models (GPT + Claude mix) | Add both @anthropic-ai/sdk and openai packages. Match n8n setup exactly. | |
| Consolidate to Claude only | Replace GPT calls with Claude equivalents. One SDK, one API key. | ✓ |
| Consolidate to OpenAI only | Replace Claude calls with GPT. One SDK, one API key. | |

**User's choice:** Consolidate to Claude only
**Notes:** User confirmed Sonnet 4.6 locked for final LinkedIn post generation (proven tone quality). Lighter models acceptable for summarization but must not cut corners on quality. All prompt changes require user review before implementation.

### Structured Output

| Option | Description | Selected |
|--------|-------------|----------|
| Prompt-based JSON + validation | Include JSON schema in prompt, parse, retry once on failure | ✓ |
| Zod schema with retry | Zod validation with error-fed retry loop | |
| Claude's discretion | | |

**User's choice:** Prompt-based JSON + validation
**Notes:** Simple approach matching n8n pattern. No Zod dependency.

---

## Gmail Fetch Design

### HTML to Text Conversion

| Option | Description | Selected |
|--------|-------------|----------|
| Regex stripping | Strip tags, decode entities, collapse whitespace. Zero dependencies. | ✓ |
| html-to-text library | npm package for proper conversion. Adds dependency. | |
| Claude's discretion | | |

**User's choice:** Regex stripping

### Pagination Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Fetch all pages sequentially | Follow nextPageToken until exhausted. 2-3 pages expected. | ✓ |
| Fetch first page only with warning | 100 results max, warn if more exist. | |
| Claude's discretion | | |

**User's choice:** Fetch all pages sequentially

### Gmail Query Filtering

| Option | Description | Selected |
|--------|-------------|----------|
| category:updates + date range | Gmail search query scoped to Updates tab | ✓ |
| Label-based filtering | Filter by Gmail labels | |
| Claude's discretion | | |

**User's choice:** category:updates + date range

### Email Grouping

| Option | Description | Selected |
|--------|-------------|----------|
| Group in gmail.ts, send grouped | gmail.ts returns emails grouped by sender address | ✓ |
| Send flat, Claude groups them | Flat array, prompt asks Claude to group | |
| Group in route handler | gmail.ts returns flat, route handler groups | |

**User's choice:** Group in gmail.ts
**Notes:** User specifically asked about this -- confirmed grouping by sender is critical to the workflow. Clean separation: gmail handles data, claude handles AI.

---

## Personal Post Q&A Flow

| Option | Description | Selected |
|--------|-------------|----------|
| claude.ts generates questions, route returns them | Two-step: generateQuestions() + generatePersonalPost(). No resumeUrl. | ✓ |
| Single-step with inline prompting | Skip Q&A, generate directly from topic. Loses personalization. | |
| Claude's discretion | | |

**User's choice:** Two-step Q&A flow
**Notes:** Frontend already handles status:"questions" flow. resumeUrl becomes unnecessary.

---

## Search Integration

### Search Module Design

| Option | Description | Selected |
|--------|-------------|----------|
| Single search function with options | One search(query, options?) for both use cases. 15s timeout. | ✓ |
| Separate functions per use case | searchInfluencer() and searchTopic(). Duplicates core logic. | |
| Claude's discretion | | |

**User's choice:** Single search function with options

### Tavily Client

| Option | Description | Selected |
|--------|-------------|----------|
| Official Tavily SDK | @tavily/core npm package. Handles auth, retries, typing. | ✓ |
| Direct fetch calls | Call REST API directly. No extra dependency. | |
| Claude's discretion | | |

**User's choice:** Official Tavily SDK

---

## Claude's Discretion

- Exact Claude model for summarization steps
- Gmail API authentication flow details
- Internal module function signatures
- Error handling patterns within lib modules
- Token budget management for large email batches

## Deferred Ideas

None -- discussion stayed within phase scope.
