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

## Fork for Yourself

Want your own inbox summarized and turned into LinkedIn posts? Here's how to set it up end to end.

### 1. Fork and clone

Fork this repo on GitHub, then:

```bash
git clone https://github.com/YOUR_USERNAME/linkedin-post-project.git
cd linkedin-post-project
npm install
cp .env.example .env.local
```

### 2. Google Cloud project

1. Go to [Google Cloud Console](https://console.cloud.google.com) and create a new project
2. Go to **APIs & Services → Library** → search **Gmail API** → click **Enable**
3. Go to **Google Auth Platform → Overview** → click **Get Started**
   - App name: whatever you like
   - Audience: **External**
4. Go to **Data Access** → **Add or Remove Scopes** → add `https://www.googleapis.com/auth/gmail.readonly` → Save
5. Go to **Audience** → **Add Users** → add the Gmail address you want to use
6. Go to **Clients** → **Create OAuth Client** → **Web application**
   - Add redirect URI: `http://localhost:3000/api/auth/callback/google`
   - Copy the **Client ID** and **Client Secret**

### 3. Get API keys

- **Anthropic:** Sign up at [console.anthropic.com](https://console.anthropic.com) and create an API key
- **Tavily:** Sign up at [tavily.com](https://tavily.com) and get an API key (free tier available)

### 4. Configure environment

Edit `.env.local`:

```
AUTH_GOOGLE_ID=your-google-client-id
AUTH_GOOGLE_SECRET=your-google-client-secret
AUTH_SECRET=run-npx-auth-secret-to-generate
ALLOWED_EMAIL=your-email@gmail.com
ANTHROPIC_API_KEY=your-anthropic-key
TAVILY_API_KEY=your-tavily-key
```

Generate `AUTH_SECRET` by running:

```bash
npx auth secret
```

Set `ALLOWED_EMAIL` to your Gmail address — this is the only account that can sign in.

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with Google, and try the workflows.

### 6. Deploy to Vercel

1. Push your fork to GitHub
2. Go to [vercel.com](https://vercel.com) → **Import Project** → select your repo
3. Add all environment variables from `.env.local`
4. Deploy
5. Add your Vercel URL's callback to Google Cloud OAuth redirect URIs:
   ```
   https://your-app.vercel.app/api/auth/callback/google
   ```

### Cost notes

- **Claude API:** Haiku is used for summarization (~ $0.001/request), Sonnet for post generation (~ $0.01/request)
- **Tavily:** Free tier includes 1,000 searches/month
- **Google Cloud:** Gmail API is free
- **Vercel:** Hobby plan is free
