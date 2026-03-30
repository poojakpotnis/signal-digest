import { auth } from "@/auth"
import Link from "next/link"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Mail, FileText, PenSquare } from "lucide-react"

const workflows = [
  {
    title: "Email Summary",
    description:
      "Generate a structured newsletter summary from your recent emails, grouped by sender.",
    icon: Mail,
    href: "/dashboard/email-summary",
  },
  {
    title: "LinkedIn Post from Emails",
    description:
      "Turn your email insights into a publish-ready LinkedIn post, with optional influencer research.",
    icon: FileText,
    href: "/dashboard/linkedin-post",
  },
  {
    title: "Custom Topic Post",
    description:
      "Write a LinkedIn post about any topic using AI-researched content.",
    icon: PenSquare,
    href: "/dashboard/custom-topic",
  },
]

export default async function DashboardPage() {
  const session = await auth()
  const firstName =
    session?.user?.name?.split(" ")[0] ?? session?.user?.name ?? "there"

  return (
    <div className="min-h-screen bg-muted/40">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold mb-8">Welcome, {firstName}</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {workflows.map((w) => (
            <Link key={w.href} href={w.href} className="group focus:outline-none">
              <Card className="h-full cursor-pointer shadow-sm hover:shadow-md hover:border-primary/50 transition-shadow focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                <CardHeader className="p-6">
                  <w.icon size={32} className="text-primary mb-2" aria-hidden="true" />
                  <CardTitle className="text-xl font-semibold">{w.title}</CardTitle>
                  <CardDescription>{w.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
