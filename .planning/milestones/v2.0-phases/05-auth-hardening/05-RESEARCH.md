# Phase 5: Auth Hardening - Research

**Researched:** 2026-04-04
**Domain:** Auth.js v5 JWT callback — refresh token storage and proactive rotation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Token Refresh Strategy**
- **D-01:** Store `refresh_token` and `expires_at` from `account` in the JWT callback (alongside the existing `access_token`).
- **D-02:** Proactive refresh in the JWT callback — check `expires_at` on every request. If the access token is expired, exchange the refresh token for a new access token via Google's token endpoint before the route handler runs. The user never sees a 401.
- **D-03:** If the refresh token itself is revoked (user removed app access in Google settings), clear the entire JWT/session and redirect to `/login` with a "Session expired, please sign in again" message.

**Re-authorization UX**
- **D-04:** Detect missing refresh token in the JWT callback. If a session exists but has no `refresh_token` (legacy sessions from before Phase 5), auto sign-out and redirect to login. The user re-authorizes once and receives a proper refresh token.
- **D-05:** No server-side session invalidation or secret rotation needed — the missing-token detection handles the transition cleanly.

**Error Handling**
- **D-06:** All refresh failures (revoked token, network error, Google API error) are treated identically — clear session, redirect to login. No retry logic for transient errors.
- **D-07:** Mid-workflow refresh failures return the existing `auth_expired` error code from Phase 4's `WorkflowState`. The frontend already handles this (shows "Session expired" with a sign-in button). Zero frontend changes required.

### Claude's Discretion
- Exact Google token endpoint URL and request format for refresh exchange
- Whether to use a helper function or inline the refresh logic in the JWT callback
- Token expiry buffer (e.g., refresh 5 minutes before actual expiry vs. at exact expiry)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User's Google OAuth refresh token is stored in the session so Gmail access survives beyond the 1-hour access token expiry | Auth.js v5 JWT callback pattern stores `refresh_token` + `expires_at` on first login; proactive expiry check + `https://oauth2.googleapis.com/token` refresh call handles rotation on subsequent requests |
</phase_requirements>

---

## Summary

Phase 5 is a surgical modification to `src/auth.ts` — specifically the `jwt` callback — with no new routes, no UI changes, and no new dependencies. The existing code already has `prompt: "consent"` and `access_type: "offline"` configured so Google will issue a `refresh_token`. The gap is that the JWT callback only captures `access_token` today; it never stores `refresh_token` or `expires_at`, so tokens expire after 1 hour and the user must sign in again.

The fix follows the official Auth.js v5 refresh token rotation guide exactly. On first sign-in (when `account` is populated), store `access_token`, `expires_at`, and `refresh_token` in the JWT. On all subsequent requests, check `Date.now() < token.expires_at * 1000`: if still valid, return unchanged; if expired, POST to `https://oauth2.googleapis.com/token` with the stored `refresh_token`. On refresh failure (revoked token, network error), mark the token with an error signal. The session callback propagates this error to the client, which the `use-workflow.ts` hook already handles via the `auth_expired` code path.

The TypeScript module augmentation in `src/types/next-auth.d.ts` needs updating to add `expires_at`, `refresh_token`, and `error` fields to the JWT interface, and `error` to the Session interface.

**Primary recommendation:** Implement per the official Auth.js v5 refresh token rotation guide. Use a 60-second proactive buffer (refresh when `expires_at - 60` has passed, not exactly at `expires_at`) to avoid race conditions with in-flight requests.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next-auth | 5.0.0-beta.30 (pinned) | Auth, JWT management, session | Already installed and configured; all refresh logic lives inside its callbacks |

No new npm dependencies required. This phase is purely a configuration change inside `src/auth.ts`.

### Supporting

No new packages.

**Version verification (2026-04-04):**
- `next-auth`: `^5.0.0-beta.30` pinned in `package.json` — confirmed matches the installed version.

---

## Architecture Patterns

### Pattern 1: Auth.js v5 JWT Callback with Refresh Token Rotation

**What:** On first login, capture `access_token`, `expires_at`, and `refresh_token` from the `account` parameter. On subsequent requests, check expiry and refresh if needed.

**When to use:** Always in the `jwt` callback — this is the single entry point for all session reads.

The `account` parameter is ONLY populated on initial sign-in; it is `null` on all subsequent JWT reads. This is why the `if (account)` guard is the correct branch for first-login capture.

```typescript
// Source: https://authjs.dev/guides/refresh-token-rotation
// src/auth.ts — complete jwt callback replacement
async jwt({ token, account }) {
  // Branch 1: First sign-in — account is populated
  if (account) {
    return {
      ...token,
      access_token: account.access_token,
      expires_at: account.expires_at,       // Unix seconds from Google
      refresh_token: account.refresh_token,
    }
  }

  // Branch 2: No refresh token present — legacy session (pre-Phase 5)
  // Force re-authorization (D-04)
  if (!token.refresh_token) {
    return { ...token, error: "RefreshTokenError" as const }
  }

  // Branch 3: Access token still valid (with 60s buffer)
  if (Date.now() < (token.expires_at - 60) * 1000) {
    return token
  }

  // Branch 4: Access token expired — refresh it (D-02)
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: process.env.AUTH_GOOGLE_ID!,
        client_secret: process.env.AUTH_GOOGLE_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refresh_token,
      }),
    })

    const tokensOrError = await response.json()
    if (!response.ok) throw tokensOrError

    const newTokens = tokensOrError as {
      access_token: string
      expires_in: number
      refresh_token?: string
    }

    return {
      ...token,
      access_token: newTokens.access_token,
      expires_at: Math.floor(Date.now() / 1000 + newTokens.expires_in),
      // Google may or may not return a new refresh_token; keep the old one if absent
      refresh_token: newTokens.refresh_token ?? token.refresh_token,
    }
  } catch (error) {
    console.error("[auth] Error refreshing access token:", error)
    // D-06: All refresh failures treated identically — signal error to session
    return { ...token, error: "RefreshTokenError" as const }
  }
}
```

### Pattern 2: Session Callback — Expose Refreshed Token and Error

**What:** The session callback maps JWT fields to the session object. Route handlers consume `session.accessToken`. The `error` field is propagated so middleware/layouts can detect broken sessions.

```typescript
// Source: https://authjs.dev/guides/refresh-token-rotation
async session({ session, token }) {
  session.accessToken = token.access_token
  session.error = token.error
  return session
}
```

**Critical integration note:** The existing code uses `token.accessToken` (camelCase). The Auth.js guide uses `token.access_token` (snake_case) for the JWT-stored field. These are DIFFERENT keys. The implementation must be consistent: either rename all internal JWT fields to snake_case (matching the guide) or keep camelCase (matching the existing code). Given the existing route handlers read `session.accessToken`, the `session` object property name must remain `accessToken`. The internal JWT field name can be either — choose one and be consistent throughout.

### Pattern 3: TypeScript Module Augmentation Update

**What:** `src/types/next-auth.d.ts` must be expanded to include new fields on `JWT` and the `error` field on `Session`.

```typescript
// src/types/next-auth.d.ts — updated for Phase 5
import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session extends DefaultSession {
    accessToken?: string
    error?: "RefreshTokenError"
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string       // or access_token — must match auth.ts
    expiresAt?: number         // Unix seconds
    refreshToken?: string      // or refresh_token — must match auth.ts
    error?: "RefreshTokenError"
  }
}
```

### Pattern 4: Handling RefreshTokenError in Protected Layout

**What:** When `session.error === "RefreshTokenError"`, the user's refresh token is revoked or the session is invalid. The protected layout should sign the user out and redirect to login. This is the server-side enforcement of D-03 and D-04.

```typescript
// src/app/(protected)/layout.tsx — update to handle RefreshTokenError
import { auth, signOut } from "@/auth"
import { redirect } from "next/navigation"

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")
  if (session.error === "RefreshTokenError") {
    // Clears the session cookie and redirects to login
    await signOut({ redirectTo: "/login" })
  }
  return <>{children}</>
}
```

**Alternative for route handlers:** Route handlers that call `auth()` and receive `session.error === "RefreshTokenError"` should return `{ status: 401 }`, which the `use-workflow.ts` hook already maps to `code: "auth_expired"` (D-07).

### Anti-Patterns to Avoid

- **Refreshing in the session callback:** The `session` callback runs on every `auth()` call from route handlers but does NOT persist changes back to the JWT. Token refresh MUST happen in the `jwt` callback, which is the only place that can mutate the stored token.
- **Using `account.expires_in` directly:** `account.expires_at` (Unix seconds) is more reliable than computing `Date.now()/1000 + account.expires_in`. Both come from the `account` object; `expires_at` is pre-calculated by Auth.js.
- **Forgetting the `access_type: "offline"` check:** The project already has this configured. Do not remove it. Without `access_type: "offline"`, Google will not issue a `refresh_token` on subsequent sign-ins.
- **Storing `refresh_token` in the Session object:** The `refresh_token` should only live in the JWT (httpOnly cookie). Never expose it via the session callback to client-side code.
- **Using `token.accessToken` after renaming to `token.access_token`:** If field names change during this phase, both `auth.ts` and `next-auth.d.ts` must be updated atomically. Mismatched names produce TypeScript errors and silent runtime failures.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth token refresh HTTP call | Custom fetch wrapper with retry/backoff | The `fetch` call directly in the JWT callback (per Auth.js guide) | Simple enough inline; retry logic is explicitly out of scope per D-06 |
| Session invalidation on refresh failure | Custom session store or blacklist | `error: "RefreshTokenError"` pattern + signOut in protected layout | Auth.js cookie is already encrypted; setting the error and calling signOut clears it cleanly |
| Token expiry tracking | Custom in-memory or Redis cache | `expires_at` stored in the JWT itself | JWT is stateless; `expires_at` travels with the token, no external store needed |

---

## Common Pitfalls

### Pitfall 1: `account.expires_at` may be `undefined` on older sessions

**What goes wrong:** If the user has an existing session cookie from before Phase 5, `token.expires_at` will be `undefined`. The check `Date.now() < token.expires_at * 1000` evaluates to `NaN < number`, which is `false`, so the code falls through to the refresh branch every request — causing an infinite loop of failed refreshes.

**Why it happens:** Pre-Phase 5 JWT tokens were written with only `accessToken`; they have no `expires_at` or `refresh_token` fields.

**How to avoid:** The `!token.refresh_token` guard (Branch 2 in the pattern above) catches this case first. Legacy sessions without a `refresh_token` are immediately marked as `RefreshTokenError`, which triggers re-auth. This is exactly D-04.

**Warning signs:** After deploying Phase 5, existing logged-in users are immediately redirected to `/login`. This is EXPECTED behavior — they sign in once and receive a proper Phase 5 session.

### Pitfall 2: Field name inconsistency between jwt callback and session callback

**What goes wrong:** `token.access_token` is set in the JWT callback but `token.accessToken` is read in the session callback (or vice versa), so `session.accessToken` is always `undefined`.

**Why it happens:** The official Auth.js guide uses `access_token` (snake_case) for JWT-internal storage, but the existing `src/auth.ts` uses `accessToken` (camelCase). Phase 5 modifies auth.ts — easy to mix conventions.

**How to avoid:** Choose one naming convention for JWT-internal fields and apply it consistently in both `jwt` and `session` callbacks AND in `next-auth.d.ts`. The simplest approach: keep camelCase (`accessToken`, `expiresAt`, `refreshToken`) to match the existing codebase style, even though the official guide uses snake_case.

**Warning signs:** TypeScript reports no error (both names are valid strings), but `session.accessToken` is `undefined` at runtime and all API calls return 401.

### Pitfall 3: Google does not always return a new `refresh_token` on refresh

**What goes wrong:** After the first token refresh, `newTokens.refresh_token` is `undefined`. If the code unconditionally overwrites `token.refreshToken` with `newTokens.refresh_token`, the stored refresh token is lost. The next expiry triggers another refresh attempt with an undefined token, which fails.

**Why it happens:** Google's OAuth2 token endpoint returns a new `refresh_token` only if the original authorization included `prompt=consent` AND the token was long-lived. For standard online refreshes, no new refresh token is returned.

**How to avoid:** Use `newTokens.refresh_token ?? token.refreshToken` — keep the stored refresh token if the response doesn't include a new one.

**Warning signs:** First refresh works; second refresh fails with "invalid_grant" because `token.refreshToken` is `undefined`.

### Pitfall 4: `signOut` in a Server Component requires careful import

**What goes wrong:** Calling `signOut()` from `src/auth.ts` in a layout Server Component may throw if the import is from the wrong package.

**Why it happens:** Auth.js v5 exports `signOut` from both `next-auth/react` (client-side) and `@/auth` (server-side). Server Components MUST use the export from `@/auth`.

**How to avoid:** In `(protected)/layout.tsx`, import `signOut` from `"@/auth"`, not from `"next-auth/react"`.

**Warning signs:** "Cannot call signOut from a Server Component" error, or the signOut call has no effect (session persists).

### Pitfall 5: Race condition — token refresh mid-flight on concurrent requests

**What goes wrong:** Two concurrent requests hit the JWT callback at the same moment when the token is just expired. Both attempt a refresh. The first succeeds; the second may also succeed but with a different token, causing one request to receive a stale access token.

**Why it happens:** Next.js Route Handlers can run concurrently. The JWT callback has no distributed lock.

**How to avoid:** For this single-user app, this is low-risk. The 60-second proactive buffer (refresh when `expires_at - 60` has passed) reduces the window significantly. No additional mitigation needed per D-06 (no retry logic required).

**Warning signs:** Occasional 401s from the Gmail API immediately after a token refresh during heavy concurrent usage. (Unlikely for a single-user app.)

---

## Code Examples

### Complete Updated `src/auth.ts` (Phase 5 target state)

```typescript
// Source: https://authjs.dev/guides/refresh-token-rotation (adapted to project conventions)
// src/auth.ts
import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope:
            "openid email profile https://www.googleapis.com/auth/gmail.readonly",
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ profile }) {
      return profile?.email === process.env.ALLOWED_EMAIL
    },
    async jwt({ token, account }) {
      // Branch 1: First sign-in — capture all tokens
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          expiresAt: account.expires_at,         // Unix seconds
          refreshToken: account.refresh_token,
        }
      }

      // Branch 2: Legacy session — no refresh token stored (pre-Phase 5)
      if (!token.refreshToken) {
        return { ...token, error: "RefreshTokenError" as const }
      }

      // Branch 3: Access token still valid (60s proactive buffer)
      if (Date.now() < (token.expiresAt! - 60) * 1000) {
        return token
      }

      // Branch 4: Access token expired — exchange refresh token
      try {
        const response = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          body: new URLSearchParams({
            client_id: process.env.AUTH_GOOGLE_ID!,
            client_secret: process.env.AUTH_GOOGLE_SECRET!,
            grant_type: "refresh_token",
            refresh_token: token.refreshToken,
          }),
        })

        const tokensOrError = await response.json()
        if (!response.ok) throw tokensOrError

        const newTokens = tokensOrError as {
          access_token: string
          expires_in: number
          refresh_token?: string
        }

        return {
          ...token,
          accessToken: newTokens.access_token,
          expiresAt: Math.floor(Date.now() / 1000 + newTokens.expires_in),
          refreshToken: newTokens.refresh_token ?? token.refreshToken,
        }
      } catch (error) {
        console.error("[auth] Error refreshing access token:", error)
        return { ...token, error: "RefreshTokenError" as const }
      }
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken
      session.error = token.error
      return session
    },
  },
})
```

### Updated TypeScript Module Augmentation

```typescript
// src/types/next-auth.d.ts
import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session extends DefaultSession {
    accessToken?: string
    error?: "RefreshTokenError"
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string
    expiresAt?: number
    refreshToken?: string
    error?: "RefreshTokenError"
  }
}
```

### Protected Layout with RefreshTokenError Handling

```typescript
// src/app/(protected)/layout.tsx — updated
import { auth, signOut } from "@/auth"
import { redirect } from "next/navigation"

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect("/login")
  if (session.error === "RefreshTokenError") {
    await signOut({ redirectTo: "/login" })
  }
  return <>{children}</>
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Store only `access_token` in JWT | Store `access_token` + `refresh_token` + `expires_at` in JWT | Phase 5 | Sessions survive indefinitely (until user revokes app access) |
| User re-signs in after 1-hour access token expiry | JWT callback silently refreshes access token before route handlers run | Phase 5 | Zero UX interruption for expired tokens |
| No error signaling for bad sessions | `error: "RefreshTokenError"` propagated through session | Phase 5 | Protected layout and route handlers can detect and clear broken sessions |

---

## Open Questions

1. **Does `account.expires_at` need null-checking?**
   - What we know: Auth.js populates `account.expires_at` from Google's `expires_in` field automatically. It should always be present for Google OAuth.
   - What's unclear: Whether any edge case (offline auth code exchange failure, network retry) could produce a valid `account` object without `expires_at`.
   - Recommendation: Use `account.expires_at ?? Math.floor(Date.now() / 1000 + 3600)` as a safe fallback. The 3600-second (1-hour) fallback matches Google's standard access token lifetime.

2. **Should the expiry buffer be configurable or hardcoded?**
   - What we know: 60 seconds is a widely-used convention; it prevents expiry during a request that started just before the deadline.
   - What's unclear: Nothing — this is Claude's discretion per the CONTEXT.md.
   - Recommendation: Hardcode 60 seconds as a named constant `const EXPIRY_BUFFER_SECONDS = 60` at the top of `auth.ts`. No need for env var configurability in a single-user app.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies beyond already-configured `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` env vars, which were required in Phase 1 and are verified present)

---

## Sources

### Primary (HIGH confidence)
- https://authjs.dev/guides/refresh-token-rotation — Official Auth.js v5 refresh token rotation guide; complete TypeScript code examples fetched directly, confirmed against implementation

### Secondary (MEDIUM confidence)
- `src/auth.ts` — Existing implementation read directly; confirmed `access_type: "offline"` and `prompt: "consent"` are already set
- `src/types/next-auth.d.ts` — Existing type declarations read directly; confirms augmentation pattern in use
- `package.json` — Confirmed `next-auth: "^5.0.0-beta.30"` installed

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; Auth.js v5 is already installed and the refresh rotation pattern comes directly from official docs
- Architecture: HIGH — four-branch JWT callback pattern sourced from official authjs.dev guide; field naming conventions verified against existing codebase
- Pitfalls: HIGH (Pitfalls 1-4) / MEDIUM (Pitfall 5) — field naming and legacy session pitfalls are deterministic; race condition pitfall is theoretical for single-user app

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (stable; re-verify if Auth.js v5 releases beta.31+ with breaking JWT callback changes)
