"use client"

import { Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface LoadingStateProps {
  stages: string[]
  currentStage: number
}

export function LoadingState({ stages, currentStage }: LoadingStateProps) {
  return (
    <Card>
      <CardContent
        className="flex flex-col items-center justify-center gap-4 py-12 min-h-[200px]"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
        <p className="text-base">{stages[currentStage]}</p>
        <p className="text-sm text-muted-foreground">
          Step {currentStage + 1} of {stages.length}
        </p>
      </CardContent>
    </Card>
  )
}
