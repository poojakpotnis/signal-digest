# Phase 7: Route Handler Rewrites - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-04
**Phase:** 07-route-handler-rewrites
**Areas discussed:** Workflow dispatch, Personal post Q&A flow, Error mapping, n8n cleanup scope

---

## Workflow Dispatch

### How should /api/generate route to the correct workflow?

| Option | Description | Selected |
|--------|-------------|----------|
| Switch on content_source | Use existing content_source field as discriminator. For custom_topic, sub-route on topic_type. | ✓ |
| Separate route per workflow | Split into /api/generate/email-summary, etc. Requires frontend changes (violates INT-02). | |
| You decide | Let Claude pick. | |

**User's choice:** Switch on content_source
**Notes:** Clean approach that matches what the frontend already sends. No frontend changes needed.

### Should the route handler validate required fields per workflow?

| Option | Description | Selected |
|--------|-------------|----------|
| Validate in route handler | Check required fields, return 400 early. Prevents unnecessary API calls. | ✓ |
| Let lib modules handle it | Pass through, lib functions throw, route handler catches. | |
| You decide | Let Claude pick. | |

**User's choice:** Validate in route handler
**Notes:** Early validation prevents wasted API calls on bad input.

---

## Personal Post Q&A Flow

### How to handle resumeUrl requirement in useWorkflow?

| Option | Description | Selected |
|--------|-------------|----------|
| Return sentinel resumeUrl | Return {stage: "questions", data: questions, resumeUrl: "/api/followup"}. Satisfies truthy check. Zero frontend changes. | ✓ |
| Minimal frontend tweak | Remove && json.resumeUrl check. Cleaner but violates INT-02. | |
| You decide | Let Claude pick. | |

**User's choice:** Return sentinel resumeUrl
**Notes:** Pragmatic solution that maintains INT-02 compliance. The value `/api/followup` happens to be the real endpoint.

### What should /api/followup request body look like?

| Option | Description | Selected |
|--------|-------------|----------|
| Match current shape | Frontend sends {topic, answers}. Route handler extracts and calls generatePersonalPost(). | ✓ |
| You decide | Let Claude inspect and wire up. | |

**User's choice:** Match current shape
**Notes:** Frontend already sends the right shape. Direct mapping to lib function.

---

## Error Mapping

### How should lib module errors map to existing error codes?

| Option | Description | Selected |
|--------|-------------|----------|
| Map by error type | Gmail 401→auth_expired, timeouts→timeout, empty→empty_result, rest→generic. | ✓ |
| Add new error codes | More granular codes. Requires UI changes. | |
| You decide | Let Claude design mapping. | |

**User's choice:** Map by error type
**Notes:** Preserves existing frontend error UX exactly. No UI changes.

### Should route handler log detailed errors server-side?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, console.error with context | Log actual error with [api/generate] prefix. Return sanitized message to frontend. | ✓ |
| Minimal logging | Only unexpected errors. Expected failures silent. | |
| You decide | Let Claude follow existing patterns. | |

**User's choice:** Yes, console.error with context
**Notes:** Matches existing logging pattern. Helps debug production issues.

---

## n8n Cleanup Scope

### How thorough should the n8n removal be?

| Option | Description | Selected |
|--------|-------------|----------|
| Full removal | Remove env vars, comments, fetch calls. Clean break. | ✓ |
| Env vars only | Just .env.example. Leave comments as history. | |
| You decide | Let Claude judge. | |

**User's choice:** Full removal
**Notes:** No dead code left behind.

### Should we remove the 90-second timeout from route handlers?

| Option | Description | Selected |
|--------|-------------|----------|
| Remove outer timeout | Lib modules manage their own timeouts. No wrapper needed. | ✓ |
| Keep safety timeout | 90s catch-all even with individual timeouts. | |
| You decide | Let Claude evaluate. | |

**User's choice:** Remove outer timeout
**Notes:** Individual lib timeouts (Tavily 15s, Claude SDK default) are sufficient.

---

## Claude's Discretion

- Exact validation logic per workflow
- Dispatch structure (switch/case vs if/else)
- Whether to extract shared auth/parse into a helper
- Edge case HTTP status codes

## Deferred Ideas

None — discussion stayed within phase scope.
