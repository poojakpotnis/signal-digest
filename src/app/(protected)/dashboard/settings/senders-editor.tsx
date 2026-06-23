"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Trash2 } from "lucide-react"

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

interface Props {
  initial: string[]
}

type Notice = { kind: "error" | "info"; message: string }

export function SendersEditor({ initial }: Props) {
  const [senders, setSenders] = useState<string[]>(initial)
  const [newSender, setNewSender] = useState("")
  const [notice, setNotice] = useState<Notice | null>(null)
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle")

  const dirty = JSON.stringify(senders) !== JSON.stringify(initial)

  function addSender() {
    const value = newSender.trim().toLowerCase()
    if (!value) return
    if (!EMAIL_RE.test(value)) {
      setNotice({ kind: "error", message: `"${value}" is not a valid email address` })
      return
    }
    if (senders.includes(value)) {
      setNotice({ kind: "info", message: `${value} is already in the list` })
      return
    }
    setSenders([...senders, value].sort())
    setNewSender("")
    setNotice(null)
    setStatus("idle")
  }

  function removeSender(addr: string) {
    setSenders(senders.filter((s) => s !== addr))
    setNotice(null)
    setStatus("idle")
  }

  async function save() {
    setStatus("saving")
    setNotice(null)
    try {
      const res = await fetch("/api/settings/senders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senders }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to save")
      setStatus("saved")
    } catch (err) {
      setNotice({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to save",
      })
      setStatus("idle")
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="text-sm font-medium mb-3">
          {senders.length} sender{senders.length === 1 ? "" : "s"}
        </div>
        <ul className="divide-y divide-border">
          {senders.map((addr) => (
            <li
              key={addr}
              className="flex items-center justify-between py-2 text-sm"
            >
              <span className="font-mono">{addr}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeSender(addr)}
                aria-label={`Remove ${addr}`}
              >
                <Trash2 size={16} />
              </Button>
            </li>
          ))}
          {senders.length === 0 && (
            <li className="py-2 text-sm text-muted-foreground">
              No senders. Add at least one before saving.
            </li>
          )}
        </ul>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="newsletter@example.com"
          value={newSender}
          onChange={(e) => setNewSender(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              addSender()
            }
          }}
          className="flex-1"
        />
        <Button type="button" variant="outline" onClick={addSender}>
          Add
        </Button>
      </div>

      {notice && (
        <p
          className={
            notice.kind === "error"
              ? "text-sm text-destructive"
              : "text-sm text-muted-foreground"
          }
          role={notice.kind === "error" ? "alert" : "status"}
        >
          {notice.message}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={!dirty || status === "saving"}>
          {status === "saving" ? "Saving…" : "Save changes"}
        </Button>
        {status === "saved" && !dirty && (
          <span className="text-sm text-muted-foreground">Saved.</span>
        )}
      </div>
    </div>
  )
}
