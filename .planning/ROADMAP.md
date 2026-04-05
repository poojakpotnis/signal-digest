# Roadmap: LinkedIn Content Generator

## Milestones

- ✅ **v1.0 MVP** - Phases 1-4 (shipped 2026-03-30)
- 🚧 **v2.0 Self-Contained AI Backend** - Phases 5-7 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) - SHIPPED 2026-03-30</summary>

### Phase 1: Foundation & Auth
**Goal**: A running Next.js app where only poojakpotnis@gmail.com can sign in with Google
**Depends on**: Nothing (first phase)
**Requirements**: REQ-01, REQ-02
**Success Criteria** (what must be TRUE):
  1. Visiting the app root redirects an unauthenticated user to a login page with a "Sign in with Google" button
  2. Clicking sign-in with the authorized email completes OAuth and lands the user on the dashboard route
  3. Clicking sign-in with any other Google account immediately redirects back to login with a clear "access denied" message
  4. The Google access token is stored in the session and available server-side (not in localStorage)
**Plans**: 2 plans

Plans:
- [x] 01-01: Scaffold Next.js 14 App Router project with TypeScript, Tailwind, shadcn/ui, and environment config
- [x] 01-02: Implement NextAuth.js with Google OAuth2 provider, email allowlist, and session/JWT callbacks

### Phase 2: Dashboard & API Proxy
**Goal**: Authenticated users see a dashboard with three workflow entry points, and the server-side n8n proxy is wired up
**Depends on**: Phase 1
**Requirements**: REQ-03
**Success Criteria** (what must be TRUE):
  1. An authenticated user sees a dashboard with three distinct workflow cards (Email Summary, LinkedIn Post from Emails, Custom Topic Post)
  2. The `/api/generate` Route Handler accepts a POST, validates the session, and forwards the request to n8n with the access token attached
  3. Unauthenticated requests to `/api/generate` return a 401 without reaching n8n
  4. The n8n webhook URL is never visible in browser network requests
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md -- Build protected layout header and dashboard page with three workflow cards plus stub pages
- [x] 02-02-PLAN.md -- Implement /api/generate Route Handler as n8n proxy with session validation, 90s timeout, and influencer cap
**UI hint**: yes

### Phase 3: Workflow UIs
**Goal**: All three workflows are fully operable — users can submit inputs, watch staged loading, and receive a formatted result with copy-to-clipboard
**Depends on**: Phase 2
**Requirements**: REQ-04, REQ-05, REQ-06, REQ-07, REQ-08, REQ-10
**Success Criteria** (what must be TRUE):
  1. User can pick a start and end date (max 30-day span enforced in the UI) and generate an email newsletter summary grouped by sender
  2. User can pick a date range, add up to 3 influencers (UI blocks a fourth with an inline warning), and generate a LinkedIn post from email insights
  3. User can type a custom topic and generate a LinkedIn post from AI-researched content
  4. While any workflow is running, the user sees contextual loading messages that cycle through workflow-appropriate stages
  5. A completed result shows the post text, hashtags, key message summary, source URLs, and a copy-to-clipboard button that briefly confirms "Copied!"
**Plans**: 5 plans

Plans:
- [x] 03-01-PLAN.md -- Install shadcn components, define workflow types, build useWorkflow hook
- [x] 03-02-PLAN.md -- Build LoadingState and ResultDisplay shared components
- [x] 03-03-PLAN.md -- Build Email Summary workflow page (Workflow 1) with date range picker and 30-day cap
- [x] 03-04-PLAN.md -- Build LinkedIn Post from Emails workflow page (Workflow 2) with date range and influencer chips (max 3)
- [x] 03-05-PLAN.md -- Build Custom Topic workflow page (Workflow 3) with topic input
**UI hint**: yes

### Phase 4: Error Handling & Deploy
**Goal**: The app handles every failure mode gracefully and is live on Vercel
**Depends on**: Phase 3
**Requirements**: REQ-09
**Success Criteria** (what must be TRUE):
  1. When a workflow returns no results (empty email set, AI failure), the user sees a meaningful message rather than a blank or broken UI
  2. When the session expires mid-session, the user is redirected to login with a clear explanation rather than a silent 401
  3. When the n8n request times out, the user sees a "This is taking longer than expected" message with a retry option
  4. The app is accessible at a public Vercel URL and sign-in works end-to-end in production
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md -- Harden error states: add retry() to useWorkflow, typed error codes, per-page error actions and empty-state guards
- [x] 04-02-PLAN.md -- Verify production build, update .env.example, deploy to Vercel with OAuth configuration

</details>

### v2.0 Self-Contained AI Backend (In Progress)

**Milestone Goal:** Replace n8n webhooks with direct Gmail API + Claude + Tavily calls inside Next.js route handlers, making the app fully self-contained with no external orchestration dependency.

#### Phase 5: Auth Hardening
**Goal**: OAuth sessions survive beyond the 1-hour access token expiry by storing and refreshing the Google refresh token
**Depends on**: Phase 4
**Requirements**: AUTH-01
**Success Criteria** (what must be TRUE):
  1. A user who signs in receives a refresh token stored in their session JWT (confirmed via server-side session inspection)
  2. After the 1-hour access token window elapses, the app automatically exchanges the refresh token for a new access token without prompting the user to sign in again
  3. The Gmail API call in Phase 6 succeeds when invoked with a session token older than 1 hour
**Plans**: 1 plan

Plans:
- [x] 05-01-PLAN.md -- Implement JWT refresh token rotation in auth.ts with 4-branch callback, type augmentations, and protected layout error handling

#### Phase 6: Gmail & AI Libraries
**Goal**: Three new server-side lib modules exist — gmail.ts, claude.ts, search.ts — that implement all email fetching, HTML-to-text conversion, and AI generation logic independently of any route handler
**Depends on**: Phase 5
**Requirements**: GMAIL-01, GMAIL-02, AI-01, AI-02, AI-03, AI-04
**Success Criteria** (what must be TRUE):
  1. `lib/gmail.ts` fetches emails from the Gmail Updates tab for a given date range, handles pagination beyond 100 results, and returns plain-text bodies (HTML stripped)
  2. `lib/claude.ts` produces a valid `Workflow1Data`-shaped response from a set of email plain-text bodies
  3. `lib/claude.ts` produces a valid `Workflow2Data`-shaped LinkedIn post given email bodies and optional Tavily search results
  4. `lib/claude.ts` produces valid `Workflow3Data`-shaped output for both the research path (given search results) and the personal path (given Q&A answers)
  5. `lib/search.ts` returns typed Tavily search results for a given query string without hanging (15-second timeout enforced)
**Plans**: 2 plans

Plans:
- [x] 06-01-PLAN.md -- Install SDKs, create gmail.ts (fetch, decode, HTML strip, sender grouping) and search.ts (Tavily with 15s timeout)
- [x] 06-02-PLAN.md -- Create claude.ts with 5 AI generation functions for all workflows, prompt review checkpoint

#### Phase 7: Route Handler Rewrites
**Goal**: `/api/generate` and `/api/followup` dispatch to the new lib modules directly, n8n env vars are removed, and all three workflows return the same JSON shapes the existing frontend already consumes
**Depends on**: Phase 6
**Requirements**: INT-01, INT-02, INT-03
**Success Criteria** (what must be TRUE):
  1. Workflow 1 (Email Summary) completes end-to-end in the browser — date range submitted, emails fetched via Gmail API, summary returned — with no n8n call made
  2. Workflow 2 (LinkedIn Post from Emails) completes end-to-end — optional influencer research via Tavily injected into Claude context, post returned matching existing `Workflow2Data` shape
  3. Workflow 3 research path completes end-to-end — Tavily search + Claude post with source URLs returned
  4. Workflow 3 personal path completes end-to-end — `/api/generate` returns questions, user answers submitted to `/api/followup`, final post returned — all without a `resumeUrl` round-trip to n8n
  5. `N8N_WEBHOOK_URL` and `N8N_FOLLOWUP_WEBHOOK_URL` are absent from `.env.example`; `ANTHROPIC_API_KEY` and `TAVILY_API_KEY` are present
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 5 -> 6 -> 7

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation & Auth | v1.0 | 2/2 | Complete | 2026-03-28 |
| 2. Dashboard & API Proxy | v1.0 | 2/2 | Complete | - |
| 3. Workflow UIs | v1.0 | 5/5 | Complete | - |
| 4. Error Handling & Deploy | v1.0 | 2/2 | Complete | 2026-03-30 |
| 5. Auth Hardening | v2.0 | 1/1 | Complete | - |
| 6. Gmail & AI Libraries | v2.0 | 0/2 | Planning | - |
| 7. Route Handler Rewrites | v2.0 | 0/? | Not started | - |
