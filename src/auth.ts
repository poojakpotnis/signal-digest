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
            "openid email profile https://www.googleapis.com/auth/gmail.modify",
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
      // Initial sign-in: store access token, refresh token, and expiry
      if (account?.provider === "google") {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.accessTokenExpires = account.expires_at
          ? account.expires_at * 1000
          : Date.now() + 3600 * 1000
        return token
      }

      // No refresh token stored (old session) — return as-is, may fail downstream
      if (!token.refreshToken) {
        return token
      }

      // Token still valid — return as-is
      if (token.accessTokenExpires && Date.now() < (token.accessTokenExpires as number)) {
        return token
      }

      // Token expired — refresh it
      try {
        const response = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.AUTH_GOOGLE_ID!,
            client_secret: process.env.AUTH_GOOGLE_SECRET!,
            grant_type: "refresh_token",
            refresh_token: token.refreshToken as string,
          }),
        })

        const refreshed = await response.json()

        if (!response.ok) throw refreshed

        token.accessToken = refreshed.access_token
        token.accessTokenExpires = Date.now() + refreshed.expires_in * 1000
        // Google may rotate the refresh token
        if (refreshed.refresh_token) {
          token.refreshToken = refreshed.refresh_token
        }
        return token
      } catch (error) {
        console.error("[auth] refresh token error:", error)
        token.error = "RefreshTokenError"
        return token
      }
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string
      return session
    },
  },
})
