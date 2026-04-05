# LinkedIn Content Generator

## What This Is

A fully self-contained Next.js web application hosted on Vercel that helps a Senior Product Manager generate high-quality LinkedIn content. The app authenticates via Google OAuth2, fetches emails directly from Gmail API, and uses Claude AI + Tavily search to power three workflows: summarizing newsletter emails, turning email insights into LinkedIn posts, and writing posts about any custom topic.

## Core Value

A single authorized user can sign in with Google and generate publish-ready LinkedIn posts in under 60 seconds, without writing from scratch.

## Requirements

### Validated

- ✓ User can sign in with Google OAuth2 and have their access token stored for the session — v1.0
- ✓ Only poojakpotnis@gmail.com is granted access; all other Google accounts are immediately rejected — v1.0
- ✓ Authenticated user sees a dashboard with three workflow options — v1.0
- ✓ User can generate a structured newsletter summary grouped by sender (Workflow 1) — v1.0
- ✓ User can generate a LinkedIn post from email insights with optional influencer research (Workflow 2) — v1.0
- ✓ User can generate a LinkedIn post from custom topic or personal experience Q&A (Workflow 3) — v1.0
- ✓ All workflows display meaningful loading states — v1.0
- ✓ Generated posts displayed with hashtags, key message summary, source URLs, and copy-to-clipboard — v1.0
- ✓ Error states handled gracefully: expired auth, no emails, AI failure, timeout — v1.0
- ✓ OAuth sessions survive beyond 1-hour access token expiry via refresh token rotation — v2.0
- ✓ Gmail API fetches emails directly with pagination and HTML-to-text conversion — v2.0
- ✓ Claude API generates all workflow outputs directly (no n8n) — v2.0
- ✓ Tavily search provides web research for custom topic and influencer workflows — v2.0
- ✓ Route handlers dispatch to lib modules directly, n8n fully removed — v2.0

### Active

(No active requirements — next milestone not yet planned)

### Out of Scope

- User-managed newsletter sender list — Supabase list is managed manually (future feature)
- Multi-user access control — hardcoded single authorized user for now
- Direct LinkedIn publishing — posts are generated for copy/paste only
- Public marketing/landing page — app opens directly to authentication
- Mobile app — web-first approach, PWA works well enough
- Offline mode — real-time AI generation is core value

## Context

- **Shipped:** v1.0 MVP (2026-03-30) + v2.0 Self-Contained AI Backend (2026-04-04)
- **Tech stack:** Next.js 14 App Router, TypeScript, Tailwind, shadcn/ui, Vercel
- **AI stack:** Anthropic Claude API (Haiku for summarization, Sonnet for generation), Tavily for web research
- **Auth:** Google OAuth2 — dual purpose: user identity + Gmail read access. Refresh token rotation in JWT.
- **Database:** Supabase stores curated newsletter sender email list
- **Architecture:** Fully self-contained — route handlers dispatch to gmail.ts, claude.ts, search.ts. No external orchestration.
- **Codebase:** ~2,000 LOC TypeScript across 16 source files

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Google OAuth2 as both auth and Gmail access | Identity + data access in one flow | ✓ Good |
| Frontend access check before showing any UI | Unauthorized users never see the app | ✓ Good |
| Max 30-day date range enforced in UI | Prevents slow responses from large Gmail queries | ✓ Good |
| Copy-to-clipboard only (no direct publish) | Keeps scope focused; LinkedIn API adds complexity | ✓ Good |
| Raw Gmail REST API (no googleapis package) | Smaller bundle, simpler auth (just bearer token) | ✓ Good |
| Haiku for summarization, Sonnet for generation | Cost/quality tradeoff — intermediate steps don't need top model | ✓ Good |
| JSON retry mechanism in claude.ts | Single retry on parse failure — handles occasional malformed JSON | ✓ Good |
| n8n fully removed in v2.0 | Direct API calls simpler, faster, no external dependency | ✓ Good |

## Constraints

- **Tech Stack**: Next.js + Vercel
- **Auth**: Google OAuth2 only — required for Gmail access
- **Single user**: poojakpotnis@gmail.com — hardcoded
- **Date range**: Cap at 30 days in UI
- **Influencers**: Max 3 — Tavily rate limit constraint
- **Version control**: GitHub

## Evolution

This document evolves at phase transitions and milestone boundaries.

---
*Last updated: 2026-04-04 after v2.0 milestone completion*
