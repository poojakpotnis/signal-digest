import { signOut } from "@/auth"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"

interface HeaderProps {
  user: { name?: string | null; email?: string | null }
}

export function Header({ user }: HeaderProps) {
  return (
    <header className="h-14 bg-card border-b border-border flex items-center justify-between px-6">
      <span className="text-base font-semibold">LinkedIn Content Generator</span>
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">{user.name ?? user.email}</span>
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
