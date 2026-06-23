// Workflow state machine (used by useWorkflow hook)
export type WorkflowState<T> =
  | { status: "idle" }
  | { status: "loading"; stage: number; stageCount: number }
  | { status: "questions"; questions: string; resumeUrl: string }
  | { status: "result"; data: T; meta?: Record<string, unknown> }
  | { status: "error"; message: string; code?: "auth_expired" | "timeout" | "empty_result" | "generic" }

// Workflow 1 — Email Summary
export type EmailSummaryItem = {
  senderEmail: string
  dateRange: string
  summary: string
  keyTopics?: string[]
  actionableInsights?: string[]
}
export type Workflow1Data = EmailSummaryItem[]

// Workflow 2 — LinkedIn Post from Emails
export type Workflow2Data = string

// Workflow 3 — Custom Topic Post
// Research path: structured object from output parser
export type Workflow3ResearchData = {
  summary: string
  keyTopics?: string[]
  insights?: Array<{ topic: string; insight: string; sourceUrl: string }>
  sources?: Array<{ title: string; url: string }>
}
// Personal path: raw post string
// Combined: either structured research or raw string
export type Workflow3Data = Workflow3ResearchData | string
