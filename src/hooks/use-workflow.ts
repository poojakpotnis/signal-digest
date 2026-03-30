"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import type { WorkflowState } from "@/types/workflow"

interface UseWorkflowOptions {
  stages: string[]           // default stages (used if no override at submit time)
  stageDuration?: number     // ms per stage, default 15000
}

export function useWorkflow<T>(options: UseWorkflowOptions) {
  const [state, setState] = useState<WorkflowState<T>>({ status: "idle" })
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const activeStagesRef = useRef<string[]>(options.stages)
  const lastCallRef = useRef<{
    endpoint: "generate"
    body: Record<string, unknown>
    stagesOverride?: string[]
  } | {
    endpoint: "followup"
    body: Record<string, unknown>
    loadingStages?: string[]
  } | null>(null)

  function startLoading(stages: string[]) {
    if (timerRef.current) clearInterval(timerRef.current)
    activeStagesRef.current = stages
    setState({ status: "loading", stage: 0, stageCount: stages.length })
    let currentStage = 0
    timerRef.current = setInterval(() => {
      currentStage = Math.min(currentStage + 1, stages.length - 1)
      setState({ status: "loading", stage: currentStage, stageCount: stages.length })
    }, options.stageDuration ?? 15000)
  }

  function handleResponse(json: Record<string, unknown>) {
    // n8n interactive flow: stage === "questions" means follow-up needed
    if (json.stage === "questions" && json.resumeUrl) {
      setState({
        status: "questions",
        questions: json.data as string,
        resumeUrl: json.resumeUrl as string,
      })
      return
    }
    // Resolve the data payload — try json.data first, then json.output, then json itself
    let result: unknown = json.data ?? json.output ?? json
    // Unwrap single-object .output wrapper (e.g. { output: "post text" })
    if (result && typeof result === "object" && !Array.isArray(result) && "output" in (result as Record<string, unknown>)) {
      result = (result as Record<string, unknown>).output
    }
    // Unwrap array items with .output wrapper
    if (Array.isArray(result) && result.length > 0 && (result[0] as Record<string, unknown>).output !== undefined) {
      result = (result as Record<string, unknown>[]).map((item) => item.output)
    }
    setState({ status: "result", data: result as T })
  }

  async function handleFetch(res: Response) {
    if (timerRef.current) clearInterval(timerRef.current)

    if (res.status === 401) {
      setState({ status: "error", message: "Your session has expired.", code: "auth_expired" })
      return
    }
    if (res.status === 504) {
      setState({ status: "error", message: "This is taking longer than expected. Try again or use a shorter date range.", code: "timeout" })
      return
    }
    if (!res.ok) {
      let msg = "Something went wrong. Please try again in a moment."
      try {
        const errJson = await res.json()
        if (errJson.error) msg = errJson.error
        else if (errJson.message) msg = errJson.message
      } catch { /* use default message */ }
      setState({ status: "error", message: msg, code: "generic" })
      return
    }

    const json = await res.json()
    handleResponse(json)
  }

  // submit accepts optional stagesOverride for Workflow 2 conditional messages
  const submit = useCallback(async (body: Record<string, unknown>, stagesOverride?: string[]) => {
    lastCallRef.current = { endpoint: "generate", body, stagesOverride }
    const stages = stagesOverride ?? options.stages
    startLoading(stages)

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      await handleFetch(res)
    } catch {
      if (timerRef.current) clearInterval(timerRef.current)
      setState({ status: "error", message: "Something went wrong. Please try again in a moment.", code: "generic" })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.stages, options.stageDuration])

  // followUp sends answers through the API proxy to the follow-up webhook
  const followUp = useCallback(async (body: Record<string, unknown>, loadingStages?: string[]) => {
    lastCallRef.current = { endpoint: "followup", body, loadingStages }
    startLoading(loadingStages ?? ["Processing your answers...", "Generating your post..."])

    try {
      const res = await fetch("/api/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      await handleFetch(res)
    } catch {
      if (timerRef.current) clearInterval(timerRef.current)
      setState({ status: "error", message: "Something went wrong. Please try again in a moment.", code: "generic" })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reset = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    setState({ status: "idle" })
  }, [])

  const retry = useCallback(() => {
    const last = lastCallRef.current
    if (!last) return
    if (last.endpoint === "generate") {
      submit(last.body, last.stagesOverride)
    } else {
      followUp(last.body, last.loadingStages)
    }
  }, [submit, followUp])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  return { state, stages: activeStagesRef.current, submit, followUp, reset, retry }
}
