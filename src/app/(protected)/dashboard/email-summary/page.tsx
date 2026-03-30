"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { useWorkflow } from "@/hooks/use-workflow"
import { LoadingState } from "@/components/workflow/loading-state"
import { ResultDisplay } from "@/components/workflow/result-display"
import type { Workflow1Data } from "@/types/workflow"

const WORKFLOW1_STAGES = [
  "Fetching your emails...",
  "Summarizing content...",
  "Organizing by sender...",
]

function validateDateRange(start: string, end: string): string | null {
  if (!start || !end) return null
  const s = new Date(start)
  const e = new Date(end)
  if (e <= s) return "End date must be after start date."
  const diffDays = (e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)
  if (diffDays > 30) return "Date range cannot exceed 30 days. Please adjust your selection."
  return null
}

export default function EmailSummaryPage() {
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const { state, stages, submit, reset, retry } = useWorkflow<Workflow1Data>({ stages: WORKFLOW1_STAGES })

  const dateError = validateDateRange(startDate, endDate)

  function handleSubmit() {
    submit({
      content_source: "email_summary",
      start_date: startDate,
      end_date: endDate,
    })
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          Back to Dashboard
        </Link>

        <h1 className="text-2xl font-semibold mb-2">Email Summary</h1>
        <p className="text-base text-muted-foreground mb-8">
          Generate a structured summary of your newsletter emails, grouped by sender.
        </p>

        <div className="max-w-2xl">
          {(state.status === "idle" || state.status === "error") && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div>
                  <Label
                    htmlFor="start-date"
                    className="text-sm font-semibold mb-1 block"
                  >
                    Start Date
                  </Label>
                  <input
                    type="date"
                    id="start-date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>

                <div>
                  <Label
                    htmlFor="end-date"
                    className="text-sm font-semibold mb-1 block"
                  >
                    End Date
                  </Label>
                  <input
                    type="date"
                    id="end-date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                      dateError
                        ? "border-destructive ring-destructive focus-visible:ring-destructive"
                        : "border-input focus-visible:ring-ring"
                    }`}
                  />
                  {dateError && (
                    <p className="text-sm text-destructive mt-1" role="alert">
                      {dateError}
                    </p>
                  )}
                </div>

                <p className="text-sm text-muted-foreground">
                  Shorter date ranges (7–10 days) produce faster, more focused summaries.
                </p>

                {state.status === "error" && (
                  <div className="space-y-2">
                    <p className="text-sm text-destructive" role="alert">
                      {state.message}
                    </p>
                    {state.code === "auth_expired" ? (
                      <Link
                        href="/login"
                        className="text-sm text-primary underline underline-offset-4"
                      >
                        Sign in again
                      </Link>
                    ) : (
                      <Button variant="outline" size="sm" onClick={retry}>
                        Try Again
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
              <CardFooter className="px-6 pt-0 pb-6">
                <Button
                  className="w-full h-11"
                  disabled={!startDate || !endDate || !!dateError}
                  onClick={handleSubmit}
                >
                  Generate Summary
                </Button>
              </CardFooter>
            </Card>
          )}

          {state.status === "loading" && (
            <LoadingState stages={stages} currentStage={state.stage} />
          )}

          {state.status === "result" && (
            <>
              {state.data.length === 0 ? (
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm text-muted-foreground">
                      No emails found for this date range — try a wider range or different dates.
                    </p>
                    <Button variant="outline" size="sm" onClick={() => reset()} className="mt-4">
                      Try Again
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <ResultDisplay
                  workflowType="email_summary"
                  data={state.data}
                  onReset={() => reset()}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
