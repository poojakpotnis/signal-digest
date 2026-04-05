# LinkedIn Content Generator

## What This Is

A Next.js web application hosted on Vercel that helps a Senior Product Manager generate high-quality LinkedIn content. The app authenticates the user via Google OAuth2, then provides three AI-powered workflows: summarizing newsletter emails, turning email insights into LinkedIn posts, and writing posts about any custom topic.

## Current Milestone: v2.0 Self-Contained AI Backend ✅

**Goal:** Remove n8n dependency by replacing webhook proxies with direct Gmail API + AI provider calls, making the app fully self-contained.

**Status:** All phases complete (5-7). Route handlers now dispatch directly to gmail.ts, claude.ts, and search.ts. No n8n references remain.

**Delivered features:**
- Gmail API client using existing OAuth token to fetch/search emails by date range
- AI provider integration (Claude API) for email summarization and LinkedIn post generation
- Web research capability for custom topic workflow via Tavily search API
- Interactive Q&A flow for personal posts handled in-app (direct Claude call, no n8n webhook)
- Refresh token rotation for sessions surviving beyond 1-hour access token expiry

## Core Value

A single authorized user can sign in with Google and generate publish-ready LinkedIn posts in under 60 seconds, without writing from scratch.

## Requirements

### Validated

- [x] User can sign in with Google OAuth2 and have their access token stored for the session — *Validated in Phase 01: foundation-auth*
- [x] Only poojakpotnis@gmail.com is granted access; all other Google accounts are immediately rejected with a clear error — *Validated in Phase 01: foundation-auth*

### Active

- [x] Authenticated user sees a dashboard with three workflow options: Email Summary, LinkedIn Post from Emails, Custom Topic Post — *Validated in Phase 02: dashboard-api-proxy*
- [x] User can select a date range (max 30 days) and generate a structured newsletter summary grouped by sender (Workflow 1) — *Validated in Phase 03: workflow-uis*
- [x] User can select a date range, optionally specify up to 3 influencers, and generate a LinkedIn post from email insights (Workflow 2) — *Validated in Phase 03: workflow-uis*
- [x] User can enter a custom topic and generate a LinkedIn post from AI-researched content, or share a personal experience through an interactive Q&A flow (Workflow 3) — *Validated in Phase 03: workflow-uis*
- [x] All workflows display meaningful loading states (e.g. "Fetching your emails...", "Summarizing content...", "Generating your post...") — *Validated in Phase 03: workflow-uis*
- [x] Generated LinkedIn posts are displayed with hashtags, key message summary, source URLs, and a copy-to-clipboard button — *Validated in Phase 03: workflow-uis*
- [x] OAuth sessions survive beyond the 1-hour access token expiry via refresh token rotation — *Validated in Phase 05: auth-hardening*
- [x] Error states are handled gracefully: expired auth, no emails found, AI failure, network timeout — *Validated in Phase 07: route-handler-rewrites*
- [x] App enforces influencer limit of 3 with a UI warning — *Validated in Phase 03: workflow-uis*

### Out of Scope

- Building or modifying n8n workflows — already built and documented in spec
- Building or modifying Supabase schema — already set up and loaded
- User-managed newsletter sender list — Supabase list is managed manually (future feature)
- Multi-user access control — hardcoded single authorized user for now
- Direct LinkedIn publishing — posts are generated for copy/paste only
- Public marketing/landing page — app opens directly to authentication

## Context

- **Backend**: v2.0 complete — route handlers dispatch directly to gmail.ts, claude.ts, search.ts (n8n fully removed)
- **Auth**: Google OAuth2 serves dual purpose — user identity verification AND Gmail read access for email-based workflows. Token is available in session.
- **Database**: Supabase stores the curated list of newsletter sender email addresses used in Workflows 1 and 2
- **AI stack**: Anthropic Claude API (via @anthropic-ai/sdk) for summarization and post generation, Tavily for web research
- **Access control**: Enforced at two layers — frontend rejects non-authorized emails before showing any UI; n8n independently rejects at webhook level
- **Performance**: Workflows take 15–60 seconds. Gmail search targets the "Updates" tab only.
- **Known limitation**: Searching more than 3-4 influencers simultaneously may hit Tavily rate limits — UI should cap at 3

## Constraints

- **Tech Stack**: Next.js + Vercel — specified by user; matches n8n webhook integration pattern
- **Auth**: Google OAuth2 only — required to access Gmail for email workflows
- **Single user**: poojakpotnis@gmail.com — hardcoded; no multi-user support in v1
- **Date range**: Cap at 30 days in UI — n8n performance degrades with longer ranges
- **Influencers**: Max 3 — Tavily rate limit constraint
- **Version control**: GitHub

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Two n8n webhooks — main + follow-up | Main webhook routes all 3 workflows; follow-up webhook handles the personal post interactive Q&A (separate webhook needed because n8n Wait node returns immediately) | Active |
| Google OAuth2 as both auth and Gmail access | Kills two birds with one stone — identity + data access in one flow | — Pending |
| Frontend access check before showing any UI | Unauthorized users should never see the app exists | — Pending |
| Max 30-day date range enforced in UI | Prevents slow n8n responses from large Gmail queries | — Pending |
| Copy-to-clipboard only (no direct publish) | Keeps scope focused; LinkedIn API adds OAuth complexity and isn't needed | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-05 — Phase 7 complete: route handler rewrites, n8n fully removed, v2.0 milestone complete*
