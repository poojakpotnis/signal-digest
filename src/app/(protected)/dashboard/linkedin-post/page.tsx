"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronLeft, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useWorkflow } from "@/hooks/use-workflow"
import { LoadingState } from "@/components/workflow/loading-state"
import { ResultDisplay } from "@/components/workflow/result-display"
import type { Workflow2Data } from "@/types/workflow"

const WORKFLOW2_STAGES_WITH_INFLUENCERS = [
  "Fetching your emails...",
  "Researching influencers...",
  "Drafting your LinkedIn post...",
]

const WORKFLOW2_STAGES_WITHOUT_INFLUENCERS = [
  "Fetching your emails...",
  "Analyzing insights...",
  "Drafting your LinkedIn post...",
]

function validateDateRange(start: string, end: string): string | null {
  if (!start || !end) return null
  const startDate = new Date(start)
  const endDate = new Date(end)
  if (endDate <= startDate) return "End date must be after start date."
  const diffDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  if (diffDays > 30) return "Date range cannot exceed 30 days. Please adjust your selection."
  return null
}

export default function LinkedInPostPage() {
  const { state, submit, reset, retry } = useWorkflow<Workflow2Data>({
    stages: WORKFLOW2_STAGES_WITHOUT_INFLUENCERS,
  })

  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [influencers, setInfluencers] = useState<string[]>([])
  const [influencerInput, setInfluencerInput] = useState("")

  const dateError = validateDateRange(startDate, endDate)
  const isFormValid = startDate && endDate && !dateError
  const atLimit = influencers.length >= 3

  function addInfluencer() {
    const name = influencerInput.trim()
    if (!name || atLimit) return
    setInfluencers(prev => [...prev, name])
    setInfluencerInput("")
  }

  function removeInfluencer(name: string) {
    setInfluencers(prev => prev.filter(i => i !== name))
  }

  function handleSubmit() {
    const stages = influencers.length > 0
      ? WORKFLOW2_STAGES_WITH_INFLUENCERS
      : WORKFLOW2_STAGES_WITHOUT_INFLUENCERS
    submit(
      {
        content_source: "linkedin_post",
        start_date: startDate,
        end_date: endDate,
        influencers: influencers.length > 0 ? influencers : undefined,
      },
      stages
    )
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm hover:bg-accent hover:text-accent-foreground px-3 py-2 rounded-md transition-colors mb-6"
        >
          <ChevronLeft size={16} aria-hidden="true" className="mr-1" />
          Back to Dashboard
        </Link>

        <h1 className="text-2xl font-semibold mb-2">LinkedIn Post from Emails</h1>
        <p className="text-base text-muted-foreground mb-8">
          Turn your email insights into a publish-ready LinkedIn post.
        </p>

        {(state.status === "idle" || state.status === "error") && (
          <Card>
            <CardContent className="pt-6 space-y-6">
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

              {/* Date Range section */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="start-date" className="text-sm font-semibold mb-1 block">
                    Start Date
                  </Label>
                  <input
                    type="date"
                    id="start-date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>

                <div>
                  <Label htmlFor="end-date" className="text-sm font-semibold mb-1 block">
                    End Date
                  </Label>
                  <input
                    type="date"
                    id="end-date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                      dateError ? "border-destructive ring-destructive" : "border-input"
                    }`}
                  />
                  {dateError && (
                    <p className="text-sm text-destructive mt-1" role="alert">{dateError}</p>
                  )}
                </div>
              </div>

              {/* Influencer section */}
              <div className="pt-6">
                <Label htmlFor="influencer-input" className="text-sm font-semibold mb-1 block">
                  Influencers (optional)
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="influencer-input"
                    placeholder="Add an influencer name"
                    value={influencerInput}
                    onChange={e => setInfluencerInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addInfluencer()
                      }
                    }}
                    disabled={atLimit}
                  />
                  <Button
                    variant="default"
                    className="h-10"
                    onClick={addInfluencer}
                    disabled={atLimit}
                  >
                    Add
                  </Button>
                </div>

                {influencers.length > 0 && (
                  <>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {influencers.map(name => (
                        <span
                          key={name}
                          className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground rounded-full px-3 py-1 text-sm"
                        >
                          {name}
                          <button
                            onClick={() => removeInfluencer(name)}
                            className="ml-1 rounded-full hover:bg-accent p-0.5"
                            aria-label={`Remove ${name}`}
                          >
                            <X size={14} aria-hidden="true" />
                          </button>
                        </span>
                      ))}
                    </div>

                    {atLimit ? (
                      <p className="text-sm text-destructive mt-1">Maximum 3 influencers reached</p>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">{3 - influencers.length} more allowed</p>
                    )}
                  </>
                )}
              </div>
            </CardContent>

            <CardFooter>
              <Button
                className="w-full h-11"
                onClick={handleSubmit}
                disabled={!isFormValid}
              >
                Generate Post
              </Button>
            </CardFooter>
          </Card>
        )}

        {state.status === "loading" && (
          <LoadingState
            stages={
              influencers.length > 0
                ? WORKFLOW2_STAGES_WITH_INFLUENCERS
                : WORKFLOW2_STAGES_WITHOUT_INFLUENCERS
            }
            currentStage={state.stage}
          />
        )}

        {state.status === "result" && (
          state.data == null || (typeof state.data === "string" && state.data.trim() === "") ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">
                  Unable to generate a post — try a different date range or fewer influencers.
                </p>
                <Button variant="outline" size="sm" onClick={() => reset()} className="mt-4">
                  Try Again
                </Button>
              </CardContent>
            </Card>
          ) : (
            <ResultDisplay
              workflowType="linkedin_post"
              data={state.data}
              onReset={reset}
            />
          )
        )}
      </div>
    </div>
  )
}
