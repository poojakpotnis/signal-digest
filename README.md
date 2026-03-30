# LinkedIn Content Generator

A single-user web app that turns Gmail emails and custom topics into polished LinkedIn posts using AI workflows powered by n8n.

## What it does

- **Email Summary** — Select a date range and get a newsletter-style summary of your emails, grouped by sender
- **LinkedIn Post from Emails** — Generate a LinkedIn post from email insights, optionally influenced by up to 3 thought leaders
- **Custom Topic Post** — Enter any topic and get an AI-researched LinkedIn post with hashtags and source URLs

All workflows return formatted results with copy-to-clipboard support.

## Tech Stack

- **Next.js 14** (App Router, TypeScript)
- **Auth.js v5** with Google OAuth (single authorized email)
- **Tailwind CSS** + **shadcn/ui**
- **n8n** for AI workflow orchestration (external)

## Setup

1. Clone the repo and install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in your values:
   ```bash
   cp .env.example .env.local
   ```

3. Run the dev server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |
| `AUTH_SECRET` | Auth.js session encryption key (`npx auth secret`) |
| `ALLOWED_EMAIL` | The single email address allowed to sign in |
| `N8N_WEBHOOK_URL` | n8n webhook for content generation |
| `N8N_FOLLOWUP_WEBHOOK_URL` | n8n webhook for follow-up Q&A flow |

## Deployment

Deploy to [Vercel](https://vercel.com) — import the repo, add environment variables, and update your Google OAuth redirect URI to include the Vercel domain.
