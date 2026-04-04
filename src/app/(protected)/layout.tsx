import { auth, signOut } from "@/auth"
import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect("/login")

  // Per D-03 and D-04: revoked refresh token or legacy session
  // triggers sign-out and redirect to login for re-authorization
  if (session.error === "RefreshTokenError") {
    await signOut({ redirectTo: "/login" })
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={session.user ?? {}} />
      <main className="flex-1">{children}</main>
    </div>
  )
}
