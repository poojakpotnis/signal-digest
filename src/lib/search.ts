/**
 * Search library module
 * Wraps Tavily search SDK with a 15-second timeout via Promise.race.
 * TAVILY_API_KEY is read from process.env — never logged (T-02).
 */

import { tavily } from "@tavily/core"

// Instantiate once at module scope (reuses connections)
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY! })

// ─── Exported types ───────────────────────────────────────────────────────────

export interface TavilyResult {
  url: string
  title: string
  content: string
  score: number
}

// ─── Exported function ────────────────────────────────────────────────────────

/**
 * Performs a Tavily web search with a 15-second timeout.
 * Uses AbortSignal.timeout + Promise.race to enforce the deadline.
 *
 * @param query - Search query string
 * @param options.maxResults - Maximum number of results (default: 5)
 * @throws Error("Search timed out") if the search exceeds 15 seconds
 */
export async function search(
  query: string,
  options?: { maxResults?: number }
): Promise<TavilyResult[]> {
  const searchPromise = tvly.search(query, {
    searchDepth: "advanced",
    maxResults: options?.maxResults ?? 5,
  })

  const timeoutPromise = new Promise<never>((_, reject) => {
    const signal = AbortSignal.timeout(15_000)
    signal.addEventListener("abort", () =>
      reject(new Error("Search timed out"))
    )
  })

  const result = await Promise.race([searchPromise, timeoutPromise])

  return (result.results ?? []).map((r) => ({
    url: r.url,
    title: r.title,
    content: r.content,
    score: r.score,
  }))
}
