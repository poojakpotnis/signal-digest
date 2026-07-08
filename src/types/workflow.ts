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

// Trends (attached to Email Summary result)
export type TrendTheme = {
  theme: string
  senderCount: number
  senders: string[]
  description: string
}

export type LeaderVoice = {
  name: string
  url: string
  snippet: string
}

export type PostWorthy = "high" | "medium" | "low"

// sessionStorage key used to hand off Workflow1Data + dateRange from
// the Email Summary page to the Trends page. Kept here (types module,
// no runtime side effects) so both pages can import it — Next.js pages
// can't export named constants themselves.
export const TRENDS_HANDOFF_KEY = "trends-handoff"

export type TrendSnapshot = {
  timestamp: string        // ISO 8601, set server-side
  dateRange: string        // human-readable, e.g. "May 5–12, 2026"
  themes: TrendTheme[]
  aiDirection: string      // 2–3 sentences on where AI is heading
  srPmTakeaways: string[]  // 3–5 aspirational Sr PM bullets
  leaderVoices: LeaderVoice[]
  postWorthy: PostWorthy   // signal for whether this batch merits a LinkedIn post
  postWorthyReason: string // one sentence explaining the signal
}
