import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

const EXPIRY_BUFFER_SECONDS = 60

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
      // Branch 1: First sign-in — account is populated by Auth.js
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          expiresAt: account.expires_at ?? Math.floor(Date.now() / 1000 + 3600),
          refreshToken: account.refresh_token,
        }
      }

      // Branch 2: Legacy session (pre-Phase 5) — no refresh token stored
      // Per D-04: force re-authorization
      if (!token.refreshToken) {
        return { ...token, error: "RefreshTokenError" as const }
      }

      // Branch 3: Access token still valid (with 60s proactive buffer)
      if (Date.now() < ((token.expiresAt as number) - EXPIRY_BUFFER_SECONDS) * 1000) {
        return token
      }

      // Branch 4: Access token expired — exchange refresh token
      // Per D-02: proactive refresh before route handler runs
      try {
        const response = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          body: new URLSearchParams({
            client_id: process.env.AUTH_GOOGLE_ID!,
            client_secret: process.env.AUTH_GOOGLE_SECRET!,
            grant_type: "refresh_token",
            refresh_token: token.refreshToken as string,
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
          // Google may not return a new refresh_token; keep the existing one
          refreshToken: newTokens.refresh_token ?? token.refreshToken,
        }
      } catch (error) {
        console.error("[auth] Error refreshing access token:", error)
        // Per D-06: all refresh failures treated identically — signal error
        return { ...token, error: "RefreshTokenError" as const }
      }
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string | undefined
      session.error = token.error as "RefreshTokenError" | undefined
      return session
    },
  },
})
