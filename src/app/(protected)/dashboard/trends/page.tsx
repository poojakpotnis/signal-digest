"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { LoadingState } from "@/components/workflow/loading-state"
import { TrendsPanel } from "@/components/workflow/trends-panel"
import { DraftPostAction } from "@/components/workflow/draft-post-action"
import {
  TRENDS_HANDOFF_KEY,
  type Workflow1Data,
  type TrendSnapshot,
} from "@/types/workflow"

const TRENDS_STAGES = [
  "Reading your summaries...",
  "Searching for PM leader voices...",
  "Synthesizing trends...",
]

type State =
  | { status: "no-summary" }
  | { status: "loading"; stage: number }
  | { status: "error"; message: string }
  | {
      status: "result"
      summaries: Workflow1Data
      trends: TrendSnapshot
      priorTrends: TrendSnapshot[]
    }

export default function TrendsPage() {
  const [state, setState] = useState<State>({ status: "loading", stage: 0 })
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    let handoff: { summaries: Workflow1Data; dateRange: string } | null = null
    try {
      const raw = sessionStorage.getItem(TRENDS_HANDOFF_KEY)
      if (raw) handoff = JSON.parse(raw)
    } catch { /* fall through to no-summary */ }

    if (!handoff || !Array.isArray(handoff.summaries) || handoff.summaries.length === 0) {
      setState({ status: "no-summary" })
      return
    }

    const summaries = handoff.summaries
    const dateRange = handoff.dateRange

    // Advance the loading stage every 15s (matches useWorkflow cadence)
    let stage = 0
    setState({ status: "loading", stage: 0 })
    timerRef.current = setInterval(() => {
      stage = Math.min(stage + 1, TRENDS_STAGES.length - 1)
      setState({ status: "loading", stage })
    }, 15000)

    ;(async () => {
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content_source: "trends",
            summaries,
            dateRange,
          }),
        })
        if (timerRef.current) clearInterval(timerRef.current)
        if (res.status === 401) {
          setState({ status: "error", message: "Your session has expired." })
          return
        }
        if (!res.ok) {
          let msg = "Something went wrong. Please try again in a moment."
          try {
            const j = await res.json()
            if (j.error) msg = j.error
          } catch { /* keep default */ }
          setState({ status: "error", message: msg })
          return
        }
        const json = await res.json()
        setState({
          status: "result",
          summaries,
          trends: json.data as TrendSnapshot,
          priorTrends: (json.priorTrends as TrendSnapshot[] | undefined) ?? [],
        })
      } catch {
        if (timerRef.current) clearInterval(timerRef.current)
        setState({
          status: "error",
          message: "Something went wrong. Please try again in a moment.",
        })
      }
    })()

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  return (
    <div className="min-h-screen bg-muted/40">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <Link
          href="/dashboard/email-summary"
          className="mb-6 inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          Back to Email Summary
        </Link>

        <h1 className="text-2xl font-semibold mb-2">Trends &amp; LinkedIn Draft</h1>
        <p className="text-base text-muted-foreground mb-8">
          Cross-sender themes, where AI is heading, and a one-click draft.
        </p>

        <div className="max-w-2xl">
          {state.status === "no-summary" && (
            <Card>
              <CardContent className="p-6 space-y-3">
                <p className="text-sm">
                  No summary in this session. Generate one first, then click
                  &ldquo;Analyze trends &amp; draft post&rdquo; from the summary
                  results.
                </p>
                <Link
                  href="/dashboard/email-summary"
                  className={buttonVariants({ size: "sm" })}
                >
                  Go to Email Summary
                </Link>
              </CardContent>
            </Card>
          )}

          {state.status === "loading" && (
            <LoadingState stages={TRENDS_STAGES} currentStage={state.stage} />
          )}

          {state.status === "error" && (
            <Card>
              <CardContent className="p-6 space-y-3">
                <p className="text-sm text-destructive" role="alert">
                  {state.message}
                </p>
                <Link
                  href="/dashboard/email-summary"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Back to Email Summary
                </Link>
              </CardContent>
            </Card>
          )}

          {state.status === "result" && (
            <>
              <TrendsPanel current={state.trends} prior={state.priorTrends} />
              <DraftPostAction summaries={state.summaries} trend={state.trends} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
