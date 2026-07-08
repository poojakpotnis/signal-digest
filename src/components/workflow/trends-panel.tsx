"use client"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { TrendingUp, Sparkles, Target, Users } from "lucide-react"
import type { TrendSnapshot } from "@/types/workflow"

interface Props {
  current: TrendSnapshot
  prior: TrendSnapshot[]
}

function classifyTheme(
  theme: string,
  prior: TrendSnapshot[]
): "new" | "steady" | "rising" {
  if (prior.length === 0) return "new"
  const normalized = theme.toLowerCase().trim()
  const priorHits = prior.filter((p) =>
    p.themes.some((t) => t.theme.toLowerCase().trim() === normalized)
  ).length
  if (priorHits === 0) return "new"
  if (priorHits >= Math.ceil(prior.length / 2)) return "steady"
  return "rising"
}

function tagStyles(kind: "new" | "steady" | "rising") {
  if (kind === "new") return "bg-primary/15 text-primary"
  if (kind === "rising") return "bg-amber-500/15 text-amber-600 dark:text-amber-400"
  return "bg-muted text-muted-foreground"
}

export function TrendsPanel({ current, prior }: Props) {
  const evolution = current.themes.map((t) => ({
    ...t,
    trend: classifyTheme(t.theme, prior),
  }))

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="size-5 text-primary" aria-hidden="true" />
          Trends — {current.dateRange}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Themes */}
        <section aria-labelledby="trends-themes">
          <h3
            id="trends-themes"
            className="text-sm font-semibold flex items-center gap-1.5 mb-3"
          >
            <Users className="size-4" aria-hidden="true" />
            Cross-sender themes
          </h3>
          {evolution.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No cross-sender themes surfaced for this range.
            </p>
          ) : (
            <ul className="space-y-3">
              {evolution.map((t) => (
                <li key={t.theme}>
                  <div className="flex items-baseline gap-2 flex-wrap mb-1">
                    <span className="text-sm font-medium">{t.theme}</span>
                    <span
                      className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${tagStyles(t.trend)}`}
                    >
                      {t.trend}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t.senderCount} sender{t.senderCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t.description}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Separator />

        {/* AI Direction */}
        <section aria-labelledby="trends-direction">
          <h3
            id="trends-direction"
            className="text-sm font-semibold flex items-center gap-1.5 mb-2"
          >
            <Sparkles className="size-4" aria-hidden="true" />
            Where AI is heading
          </h3>
          <p className="text-sm leading-relaxed">{current.aiDirection}</p>
        </section>

        <Separator />

        {/* Sr PM Takeaways */}
        <section aria-labelledby="trends-takeaways">
          <h3
            id="trends-takeaways"
            className="text-sm font-semibold flex items-center gap-1.5 mb-2"
          >
            <Target className="size-4" aria-hidden="true" />
            What to care about as an aspiring Sr PM
          </h3>
          <ul className="list-disc pl-5 space-y-1.5 text-sm">
            {current.srPmTakeaways.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </section>

        {/* Leader Voices */}
        {current.leaderVoices.length > 0 && (
          <>
            <Separator />
            <section aria-labelledby="trends-leaders">
              <h3
                id="trends-leaders"
                className="text-sm font-semibold mb-2"
              >
                Reinforcing voices
              </h3>
              <ul className="space-y-2">
                {current.leaderVoices.map((v, i) => (
                  <li key={i} className="text-sm">
                    <a
                      href={v.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {v.name}
                    </a>
                    <span className="text-muted-foreground"> — {v.snippet}</span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        {/* Prior snapshots timeline */}
        {prior.length > 0 && (
          <>
            <Separator />
            <section aria-labelledby="trends-history">
              <h3
                id="trends-history"
                className="text-sm font-semibold mb-2"
              >
                Last 6 months ({prior.length} snapshot{prior.length === 1 ? "" : "s"})
              </h3>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {prior.slice(-6).map((p) => (
                  <li key={p.timestamp}>
                    <span className="font-mono">{p.timestamp.slice(0, 10)}</span>
                    {" — "}
                    {p.themes.slice(0, 4).map((t) => t.theme).join(", ")}
                    {p.themes.length > 4 ? "…" : ""}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </CardContent>
    </Card>
  )
}
