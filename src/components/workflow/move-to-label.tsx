"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

interface Props {
  messageIds: string[]
  labelName: string
}

type Status =
  | { kind: "idle" }
  | { kind: "confirm" }
  | { kind: "moving" }
  | { kind: "done"; moved: number }
  | { kind: "error"; message: string }

export function MoveToLabelAction({ messageIds, labelName }: Props) {
  const [status, setStatus] = useState<Status>({ kind: "idle" })

  if (messageIds.length === 0) return null

  async function performMove() {
    setStatus({ kind: "moving" })
    try {
      const res = await fetch("/api/messages/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageIds, labelName }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Move failed")
      setStatus({ kind: "done", moved: json.moved ?? messageIds.length })
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Move failed",
      })
    }
  }

  const count = messageIds.length

  return (
    <div className="mt-6 rounded-lg border border-border bg-card p-4">
      {status.kind === "idle" && (
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium">Done with these emails?</div>
            <div className="text-xs text-muted-foreground">
              Move {count} source email{count === 1 ? "" : "s"} to the{" "}
              <span className="font-mono">{labelName}</span> label.
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStatus({ kind: "confirm" })}
          >
            Move to {labelName}
          </Button>
        </div>
      )}

      {status.kind === "confirm" && (
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm">
            Move <strong>{count}</strong> email{count === 1 ? "" : "s"} to{" "}
            <span className="font-mono">{labelName}</span>? They&apos;ll be removed
            from your inbox.
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStatus({ kind: "idle" })}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={performMove}>
              Confirm
            </Button>
          </div>
        </div>
      )}

      {status.kind === "moving" && (
        <div className="text-sm text-muted-foreground">Moving…</div>
      )}

      {status.kind === "done" && (
        <div className="text-sm">
          Moved {status.moved} email{status.moved === 1 ? "" : "s"} to{" "}
          <span className="font-mono">{labelName}</span>.
        </div>
      )}

      {status.kind === "error" && (
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-destructive" role="alert">
            {status.message}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStatus({ kind: "idle" })}
          >
            Retry
          </Button>
        </div>
      )}
    </div>
  )
}
