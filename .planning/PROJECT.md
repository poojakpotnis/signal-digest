# LinkedIn Content Generator

## What This Is

A Next.js web application hosted on Vercel that helps a Senior Product Manager generate high-quality LinkedIn content. The app authenticates the user via Google OAuth2, then provides three AI-powered workflows: summarizing newsletter emails, turning email insights into LinkedIn posts, and writing posts about any custom topic. The backend automation (n8n) and database (Supabase) are already built; this project delivers the frontend and its integration with both.

## Core Value

A single authorized user can sign in with Google and generate publish-ready LinkedIn posts in under 60 seconds, without writing from scratch.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can sign in with Google OAuth2 and have their access token stored for the session
- [ ] Only poojakpotnis@gmail.com is granted access; all other Google accounts are immediately rejected with a clear error
- [ ] Authenticated user sees a dashboard with three workflow options: Email Summary, LinkedIn Post from Emails, Custom Topic Post
- [ ] User can select a date range (max 30 days) and generate a structured newsletter summary grouped by sender (Workflow 1)
- [ ] User can select a date range, optionally specify up to 3 influencers, and generate a LinkedIn post from email insights (Workflow 2)
- [ ] User can enter a custom topic and generate a LinkedIn post from AI-researched content (Workflow 3)
- [ ] All workflows display meaningful loading states (e.g. "Fetching your emails...", "Summarizing content...", "Generating your post...")
- [ ] Generated LinkedIn posts are displayed with hashtags, key message summary, source URLs, and a copy-to-clipboard button
- [ ] Error states are handled gracefully: expired auth, no emails found, AI failure, network timeout
- [ ] App enforces influencer limit of 3 with a UI warning

### Out of Scope

- Building or modifying n8n workflows — already built and documented in spec
- Building or modifying Supabase schema — already set up and loaded
- User-managed newsletter sender list — Supabase list is managed manually (future feature)
- Multi-user access control — hardcoded single authorized user for now
- Direct LinkedIn publishing — posts are generated for copy/paste only
- Public marketing/landing page — app opens directly to authentication

## Context

- **Backend**: n8n Cloud with a single webhook endpoint that routes to one of three workflows via `content_source` field (`email_summary`, `linkedin_post`, `custom_topic`)
- **Auth**: Google OAuth2 serves dual purpose — user identity verification AND Gmail read access for email-based workflows. Token is sent with every n8n request.
- **Database**: Supabase stores the curated list of newsletter sender email addresses used in Workflows 1 and 2
- **AI stack**: OpenAI gpt-4o-mini for summarization/research, Anthropic Claude Sonnet for LinkedIn post generation, Tavily for web search
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
| Single n8n webhook for all 3 workflows | Backend already built this way; frontend uses `content_source` field to route | — Pending |
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
*Last updated: 2026-03-27 after initialization*
