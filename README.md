# LinkedIn Content Generator

A single-user web app that turns Gmail newsletter emails and custom topics into polished LinkedIn posts using Claude AI and Tavily web research.

## What it does

- **Email Summary** — Select a date range and get a structured summary of your newsletter emails, grouped by sender
- **LinkedIn Post from Emails** — Generate a LinkedIn post from email insights, optionally enriched with research on up to 3 thought leaders
- **Custom Topic Post** — Enter any topic and get an AI-researched LinkedIn post, or answer guided questions for a personal experience post

All workflows return formatted results with hashtags, key message summaries, source URLs, and copy-to-clipboard support.

## Tech Stack

- **Next.js 14** (App Router, TypeScript)
- **Auth.js v5** with Google OAuth (single authorized email + Gmail read access)
- **Claude AI** — Haiku for summarization, Sonnet for post generation
- **Tavily** — Web research for custom topics and influencer insights
- **Tailwind CSS** + **shadcn/ui**
- **Supabase** — Curated newsletter sender list

## Setup

1. Clone the repo and install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in your values:
   ```bash
   cp .env.example .env.local
   ```

3. Set up Google Cloud:
   - Create a project and enable the **Gmail API**
   - Configure OAuth consent screen (External, add `gmail.readonly` scope)
   - Create OAuth credentials with redirect URI: `http://localhost:3000/api/auth/callback/google`
   - Add the authorized user as a test user

4. Run the dev server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |
| `AUTH_SECRET` | Auth.js session encryption key (`npx auth secret`) |
| `ALLOWED_EMAIL` | The single email address allowed to sign in |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude AI |
| `TAVILY_API_KEY` | Tavily API key for web research |

## Deployment

Deploy to [Vercel](https://vercel.com) — import the repo, add environment variables, and add your Vercel domain's callback URL (`https://your-app.vercel.app/api/auth/callback/google`) to Google OAuth redirect URIs.
