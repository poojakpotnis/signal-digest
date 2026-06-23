import { getAllowedSenders } from "@/lib/sender-allowlist"
import { SendersEditor } from "./senders-editor"

export default async function SettingsPage() {
  const initialSenders = await getAllowedSenders()

  return (
    <div className="min-h-screen bg-muted/40">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold mb-2">Newsletter senders</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Gmail fetches are restricted to these sender addresses. Add or remove
          senders below.
        </p>
        <SendersEditor initial={initialSenders} />
      </div>
    </div>
  )
}
