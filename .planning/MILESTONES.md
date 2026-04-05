# Milestones

## v2.0 Self-Contained AI Backend (Shipped: 2026-04-05)

**Phases completed:** 3 phases, 5 plans, 6 tasks

**Key accomplishments:**

- Google OAuth2 refresh token rotation via 4-branch jwt callback, with RefreshTokenError propagation through session to protected layout for forced re-authorization
- Raw Gmail REST API client with base64url decoding and sender grouping, plus Tavily search wrapper with 15-second AbortSignal timeout
- Five Claude AI functions wrapping @anthropic-ai/sdk — summarizeEmails (Haiku), generatePost/generateResearchPost/generateQuestions/generatePersonalPost (Sonnet) — with JSON retry mechanism and 6 prompts adapted from n8n and approved by user
- /api/generate rewritten with direct lib dispatch — switch on content_source routes to gmail.ts, claude.ts, and search.ts with zero n8n calls
- /api/followup rewritten with direct Claude dispatch, n8n webhook URLs removed from .env.example — app is fully self-contained

---
