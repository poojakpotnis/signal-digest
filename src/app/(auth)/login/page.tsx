"use client"

import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const errorMessages: Record<string, string> = {
  AccessDenied: "Access denied. Only authorized accounts may sign in.",
  OAuthSignin: "An error occurred starting the sign-in flow. Please try again.",
  OAuthCallback: "An error occurred during the OAuth callback. Please try again.",
  Default: "An error occurred during sign in. Please try again.",
}

function LoginContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Signal Digest</CardTitle>
          <CardDescription>Sign in to generate AI-powered LinkedIn posts</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-4 py-2 w-full text-center" role="alert">
              {errorMessages[error] ?? errorMessages.Default}
            </p>
          )}
          <Button
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            className="w-full"
            size="lg"
          >
            Sign in with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <p>Loading...</p>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
