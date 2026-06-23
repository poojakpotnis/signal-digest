import Link from "next/link"
import { signOut } from "@/auth"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { Settings } from "lucide-react"

interface HeaderProps {
  user: { name?: string | null; email?: string | null }
}

export function Header({ user }: HeaderProps) {
  return (
    <header className="h-14 bg-card border-b border-border flex items-center justify-between px-6">
      <Link href="/dashboard" className="text-base font-semibold hover:underline">
        Signal Digest
      </Link>
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">{user.name ?? user.email}</span>
        <Link
          href="/dashboard/settings"
          aria-label="Settings"
          className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Settings size={18} />
        </Link>
        <ThemeToggle />
        <form
          action={async () => {
            "use server"
            await signOut({ redirectTo: "/login" })
          }}
        >
          <Button type="submit" variant="outline" className="min-h-[44px]">
            Sign Out
          </Button>
        </form>
      </div>
    </header>
  )
}
