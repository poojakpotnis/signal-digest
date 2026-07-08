"use client"

import { useState } from "react"
import { Copy, Check, PenSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { Workflow1Data, TrendSnapshot, PostWorthy } from "@/types/workflow"

interface Props {
  summaries: Workflow1Data
  trend?: TrendSnapshot
}

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; post: string }
  | { kind: "error"; message: string }

function ctaCopy(worthy: PostWorthy | undefined) {
  if (worthy === "high") {
    return {
      badge: "Strong signal",
      badgeClass:
        "bg-primary/15 text-primary",
      button: "Draft LinkedIn post",
    }
  }
  if (worthy === "medium") {
    return {
      badge: "Some signal",
      badgeClass:
        "bg-amber-500/15 text-amber-600 dark:text-amber-400",
      button: "Draft LinkedIn post",
    }
  }
  if (worthy === "low") {
    return {
      badge: "Thin signal",
      badgeClass: "bg-muted text-muted-foreground",
      button: "Draft anyway",
    }
  }
  return {
    badge: null as string | null,
    badgeClass: "",
    button: "Draft LinkedIn post",
  }
}

export function DraftPostAction({ summaries, trend }: Props) {
  const [status, setStatus] = useState<Status>({ kind: "idle" })
  const [copied, setCopied] = useState(false)

  if (summaries.length === 0) return null

  const cta = ctaCopy(trend?.postWorthy)

  async function draft() {
    setStatus({ kind: "loading" })
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content_source: "linkedin_post_from_summaries",
          summaries,
          trend,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setStatus({
          kind: "error",
          message: json.error ?? "Failed to draft post.",
        })
        return
      }
      const post = typeof json.data === "string" ? json.data : ""
      setStatus({ kind: "done", post })
    } catch {
      setStatus({
        kind: "error",
        message: "Something went wrong. Please try again in a moment.",
      })
    }
  }

  function copyPost() {
    if (status.kind !== "done") return
    navigator.clipboard.writeText(status.post).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <Card className="mt-6">
      <CardContent className="p-4">
        {status.kind === "idle" && (
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="text-sm font-medium flex items-center gap-2">
                <PenSquare className="size-4" aria-hidden="true" />
                Turn this into a LinkedIn post
                {cta.badge && (
                  <span
                    className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${cta.badgeClass}`}
                  >
                    {cta.badge}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {trend?.postWorthyReason ??
                  "Uses these summaries directly — no re-fetch, no re-summarize."}
              </div>
            </div>
            <Button size="sm" onClick={draft}>
              {cta.button}
            </Button>
          </div>
        )}

        {status.kind === "loading" && (
          <div className="text-sm text-muted-foreground">Drafting…</div>
        )}

        {status.kind === "done" && (
          <div className="space-y-3">
            <p className="whitespace-pre-wrap text-base">{status.post}</p>
            <div className="flex items-center justify-between">
              <Button size="sm" onClick={copyPost}>
                {copied ? (
                  <>
                    <Check className="mr-2 size-4" aria-hidden="true" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 size-4" aria-hidden="true" />
                    Copy Post
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStatus({ kind: "idle" })}
              >
                Redraft
              </Button>
            </div>
          </div>
        )}

        {status.kind === "error" && (
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-destructive" role="alert">
              {status.message}
            </div>
            <Button variant="outline" size="sm" onClick={draft}>
              Retry
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
