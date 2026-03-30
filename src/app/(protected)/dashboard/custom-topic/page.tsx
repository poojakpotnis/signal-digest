"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useWorkflow } from "@/hooks/use-workflow"
import { LoadingState } from "@/components/workflow/loading-state"
import { ResultDisplay } from "@/components/workflow/result-display"
import type { Workflow3Data } from "@/types/workflow"

const RESEARCH_STAGES = [
  "Researching your topic...",
  "Gathering sources...",
  "Drafting your LinkedIn post...",
]

const PERSONAL_STAGES = [
  "Analyzing your experience...",
  "Crafting your story...",
]

const FOLLOWUP_STAGES = [
  "Processing your answers...",
  "Crafting your story...",
  "Drafting your LinkedIn post...",
]

type TopicType = "research" | "personal"

function isEmptyResult(data: Workflow3Data): boolean {
  if (data == null) return true
  if (typeof data === "string") return data.trim() === ""
  return !data.summary || data.summary.trim() === ""
}

export default function CustomTopicPage() {
  const { state, stages, submit, followUp, reset, retry } = useWorkflow<Workflow3Data>({
    stages: RESEARCH_STAGES,
  })
  const [topic, setTopic] = useState("")
  const [topicType, setTopicType] = useState<TopicType>("research")
  const [showError, setShowError] = useState(false)
  const [answers, setAnswers] = useState<Record<number, string>>({})

  function parseQuestions(text: string): string[] {
    // Split on numbered patterns like "1.", "2.", etc.
    const lines = text.split(/\n/).filter(l => l.trim())
    const questions: string[] = []
    let current = ""
    for (const line of lines) {
      if (/^\d+[\.\)]/.test(line.trim())) {
        if (current) questions.push(current.trim())
        current = line.trim().replace(/^\d+[\.\)]\s*/, "")
      } else if (current) {
        current += " " + line.trim()
      }
    }
    if (current) questions.push(current.trim())
    // Fallback: if no numbered questions found, treat the whole text as one question
    if (questions.length === 0) questions.push(text.trim())
    return questions
  }

  function updateAnswer(idx: number, value: string) {
    setAnswers(prev => ({ ...prev, [idx]: value }))
  }

  function buildAnswersText(): string {
    if (state.status !== "questions") return ""
    const questions = parseQuestions(state.questions)
    return questions
      .map((q, i) => `${i + 1}. ${q}\nAnswer: ${answers[i] || "(no answer)"}`)
      .join("\n\n")
  }

  function handleSubmit() {
    if (!topic.trim()) {
      setShowError(true)
      return
    }
    submit(
      {
        content_source: "custom_topic",
        topic: topic.trim(),
        topic_type: topicType,
      },
      topicType === "personal" ? PERSONAL_STAGES : undefined
    )
  }

  function handleFollowUp() {
    if (state.status !== "questions") return
    const hasAnyAnswer = Object.values(answers).some(a => a.trim())
    if (!hasAnyAnswer) return
    followUp(
      {
        topic: topic.trim(),
        answers: buildAnswersText(),
      },
      FOLLOWUP_STAGES
    )
  }

  function handleTopicChange(e: React.ChangeEvent<HTMLInputElement>) {
    setTopic(e.target.value)
    if (showError && e.target.value.trim()) {
      setShowError(false)
    }
  }

  const isIdle = state.status === "idle" || state.status === "error"

  return (
    <div className="min-h-screen bg-muted/40">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm hover:bg-accent hover:text-accent-foreground px-3 py-2 rounded-md transition-colors mb-6"
        >
          <ChevronLeft size={16} aria-hidden="true" className="mr-1" />
          Back to Dashboard
        </Link>

        <h1 className="text-2xl font-semibold mb-2">Custom Topic Post</h1>
        <p className="text-base text-muted-foreground mb-8">
          Write a LinkedIn post about any topic using AI-researched content or share a personal experience.
        </p>

        {isIdle && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <Label className="text-sm font-semibold mb-2 block">Post Type</Label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setTopicType("research")}
                    className={`flex-1 rounded-md border px-4 py-3 text-sm text-left transition-colors ${
                      topicType === "research"
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    <span className="font-semibold block mb-0.5">Research a Topic</span>
                    <span className="text-xs">AI researches the web and drafts a post with sources</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTopicType("personal")}
                    className={`flex-1 rounded-md border px-4 py-3 text-sm text-left transition-colors ${
                      topicType === "personal"
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    <span className="font-semibold block mb-0.5">Share an Experience</span>
                    <span className="text-xs">AI crafts a post from your personal story or project</span>
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="topic" className="text-sm font-semibold mb-1 block">
                  {topicType === "research" ? "Topic" : "Your Experience"}
                </Label>
                <Input
                  id="topic"
                  placeholder={
                    topicType === "research"
                      ? "e.g. AI in product management"
                      : "e.g. I built a multi-agent workflow for PRD generation"
                  }
                  value={topic}
                  onChange={handleTopicChange}
                />
                {showError && (
                  <p className="text-sm text-destructive mt-1" role="alert">
                    {topicType === "research"
                      ? "Please enter a topic to continue."
                      : "Please describe your experience to continue."}
                  </p>
                )}
              </div>

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
            <CardFooter>
              <Button onClick={handleSubmit} className="w-full h-11">
                Generate Post
              </Button>
            </CardFooter>
          </Card>
        )}

        {state.status === "loading" && (
          <LoadingState stages={stages} currentStage={state.stage} />
        )}

        {state.status === "questions" && (() => {
          const questions = parseQuestions(state.questions)
          const hasAnyAnswer = Object.values(answers).some(a => a.trim())
          return (
            <Card>
              <CardHeader>
                <CardTitle>A few questions first</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Answer the questions below to help craft a more authentic post.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {questions.map((question, idx) => (
                  <div key={idx} className="space-y-2">
                    <Label htmlFor={`answer-${idx}`} className="text-sm font-medium block">
                      {idx + 1}. {question}
                    </Label>
                    <textarea
                      id={`answer-${idx}`}
                      rows={3}
                      value={answers[idx] || ""}
                      onChange={(e) => updateAnswer(idx, e.target.value)}
                      placeholder="Your answer..."
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  </div>
                ))}
              </CardContent>
              <CardFooter className="flex items-center justify-between">
                <Button onClick={handleFollowUp} disabled={!hasAnyAnswer} className="flex-1 h-11">
                  Generate Post
                </Button>
                <Button variant="outline" onClick={reset} className="ml-3">
                  Start Over
                </Button>
              </CardFooter>
            </Card>
          )
        })()}

        {state.status === "result" && (
          isEmptyResult(state.data) ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">
                  {topicType === "research"
                    ? "No results found for this topic — try a broader or different topic."
                    : "Unable to generate a post — try providing more detail."}
                </p>
                <Button variant="outline" size="sm" onClick={() => { setAnswers({}); reset() }} className="mt-4">
                  Try Again
                </Button>
              </CardContent>
            </Card>
          ) : (
            <ResultDisplay
              workflowType="custom_topic"
              data={state.data}
              onReset={() => { setAnswers({}); reset() }}
            />
          )
        )}
      </div>
    </div>
  )
}
