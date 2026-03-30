import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect("/login")
  return (
    <div className="min-h-screen flex flex-col">
      <Header user={session.user ?? {}} />
      <main className="flex-1">{children}</main>
    </div>
  )
}
