"use client"

import { useState, useRef, useEffect } from "react"
import { Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { Workflow1Data, Workflow2Data, Workflow3Data } from "@/types/workflow"

type ResultDisplayProps =
  | { workflowType: "email_summary"; data: Workflow1Data; onReset: () => void }
  | { workflowType: "linkedin_post"; data: Workflow2Data; onReset: () => void }
  | { workflowType: "custom_topic"; data: Workflow3Data; onReset: () => void }

export function ResultDisplay(props: ResultDisplayProps) {
  const [copied, setCopied] = useState(false)
  const titleRef = useRef<HTMLHeadingElement>(null)

  // Focus result card heading on mount for keyboard/screen reader users
  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  function getCopyText(): string {
    if (props.workflowType === "email_summary") {
      return props.data
        .map(
          (item) =>
            `${item.senderEmail}\n${item.summary}${item.actionableInsights ? "\n" + item.actionableInsights.join("\n") : ""}`
        )
        .join("\n\n")
    }
    if (props.workflowType === "linkedin_post") {
      return props.data
    }
    // custom_topic
    if (typeof props.data === "string") return props.data
    return props.data.summary
  }

  function handleCopy() {
    const text = getCopyText()
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const copyLabel =
    props.workflowType === "email_summary" ? "Copy All Summaries" : "Copy Post"
  const resetLabel =
    props.workflowType === "email_summary" ? "New Summary" : "New Post"

  return (
    <Card>
      {props.workflowType === "email_summary" && (
        <>
          <CardHeader>
            <CardTitle
              ref={titleRef}
              tabIndex={-1}
            >
              Email Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {props.data.map((item, idx) => (
              <div key={item.senderEmail + idx}>
                {idx > 0 && <Separator className="mb-6" />}
                <p className="text-sm font-semibold">{item.senderEmail}</p>
                <p className="text-sm text-muted-foreground mb-2">{item.dateRange}</p>
                <p className="text-base mb-3">{item.summary}</p>
                {item.keyTopics && item.keyTopics.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {item.keyTopics.map((topic) => (
                      <span
                        key={topic}
                        className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                )}
                {item.actionableInsights && item.actionableInsights.length > 0 && (
                  <>
                    <Separator className="my-3" />
                    <p className="text-sm font-semibold mb-2">Actionable Insights</p>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      {item.actionableInsights.map((insight, i) => (
                        <li key={i}>{insight}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            ))}
          </CardContent>
        </>
      )}

      {props.workflowType === "linkedin_post" && (
        <>
          <CardHeader>
            <CardTitle
              ref={titleRef}
              tabIndex={-1}
            >
              Your LinkedIn Post
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-base">{props.data}</p>
          </CardContent>
        </>
      )}

      {props.workflowType === "custom_topic" && (
        <>
          <CardHeader>
            <CardTitle
              ref={titleRef}
              tabIndex={-1}
            >
              Your LinkedIn Post
            </CardTitle>
          </CardHeader>
          {typeof props.data === "string" ? (
            <CardContent>
              <p className="whitespace-pre-wrap text-base">{props.data}</p>
            </CardContent>
          ) : (
            <CardContent className="space-y-4">
              <p className="whitespace-pre-wrap text-base">{props.data.summary}</p>
              {props.data.keyTopics && props.data.keyTopics.length > 0 && (
                <>
                  <Separator />
                  <p className="text-sm font-semibold">Key Topics</p>
                  <div className="flex flex-wrap gap-1.5">
                    {props.data.keyTopics.map((topic) => (
                      <span
                        key={topic}
                        className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </>
              )}
              {props.data.sources && props.data.sources.length > 0 && (
                <>
                  <Separator />
                  <p className="text-sm font-semibold">Sources</p>
                  <div className="space-y-1">
                    {props.data.sources.map((source) => (
                      <a
                        key={source.url}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-primary underline-offset-4 hover:underline text-sm"
                      >
                        {source.title}
                      </a>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          )}
        </>
      )}

      <CardFooter className="flex items-center justify-between">
        <Button
          onClick={handleCopy}
          aria-label={copied ? "Copied to clipboard" : copyLabel}
        >
          {copied ? (
            <>
              <Check className="mr-2 size-4" aria-hidden="true" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="mr-2 size-4" aria-hidden="true" />
              {copyLabel}
            </>
          )}
        </Button>
        <Button variant="outline" onClick={props.onReset}>
          {resetLabel}
        </Button>
      </CardFooter>
    </Card>
  )
}
