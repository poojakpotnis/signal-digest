import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import { fetchEmails } from "@/lib/gmail"
import { summarizeEmails, generatePost, generateResearchPost, generateQuestions } from "@/lib/claude"
import { search } from "@/lib/search"
import type { TavilyResult } from "@/lib/search"

export async function POST(req: NextRequest) {
  // 1. Auth check
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 2. Parse request body
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  // 3. Enforce max 3 influencers (preserve existing check)
  if (Array.isArray(body.influencers) && body.influencers.length > 3) {
    return NextResponse.json(
      { error: "Maximum 3 influencers allowed" },
      { status: 400 }
    )
  }

  // 4. Dispatch to lib modules based on content_source
  try {
    switch (body.content_source) {
      case "email_summary": {
        // Validate required date fields
        if (!body.start_date || !body.end_date) {
          return NextResponse.json(
            { error: "start_date and end_date are required" },
            { status: 400 }
          )
        }
        const startDate = new Date(body.start_date as string)
        const endDate = new Date(body.end_date as string)
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          return NextResponse.json(
            { error: "Invalid date format" },
            { status: 400 }
          )
        }

        const groupedEmails = await fetchEmails(session.accessToken, startDate, endDate)

        // Short-circuit empty results (D-06 empty_result path)
        if (groupedEmails.size === 0) {
          return NextResponse.json({ data: [], sourceMessageIds: [] })
        }

        const sourceMessageIds: string[] = []
        for (const emails of Array.from(groupedEmails.values())) {
          for (const email of emails) sourceMessageIds.push(email.id)
        }

        const summaries = await summarizeEmails(groupedEmails)
        return NextResponse.json({ data: summaries, sourceMessageIds })
      }

      case "linkedin_post": {
        // Validate required date fields
        if (!body.start_date || !body.end_date) {
          return NextResponse.json(
            { error: "start_date and end_date are required" },
            { status: 400 }
          )
        }
        const startDate = new Date(body.start_date as string)
        const endDate = new Date(body.end_date as string)
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          return NextResponse.json(
            { error: "Invalid date format" },
            { status: 400 }
          )
        }

        const groupedEmails = await fetchEmails(session.accessToken, startDate, endDate)

        // Extract email bodies from GroupedEmails
        const emailBodies: string[] = []
        for (const emails of Array.from(groupedEmails.values())) {
          for (const email of emails) {
            emailBodies.push(email.body)
          }
        }

        // Short-circuit empty results
        if (emailBodies.length === 0) {
          return NextResponse.json({ data: "" })
        }

        // Influencer search (if present)
        let searchResults: TavilyResult[] | undefined
        if (Array.isArray(body.influencers) && body.influencers.length > 0) {
          const allResults = await Promise.all(
            (body.influencers as string[]).map(name => search(name, { maxResults: 5 }))
          )
          searchResults = allResults.flat()
        }

        const post = await generatePost(emailBodies, searchResults)
        return NextResponse.json({ data: post })
      }

      case "custom_topic": {
        // Validate required topic field
        if (!body.topic) {
          return NextResponse.json(
            { error: "topic is required" },
            { status: 400 }
          )
        }

        // Default topic_type to "research" if absent (per research open question 1 recommendation)
        const topicType = (body.topic_type as string) || "research"

        switch (topicType) {
          case "research": {
            const results = await search(body.topic as string)
            const researchData = await generateResearchPost(results)
            return NextResponse.json({ data: researchData })
          }

          case "personal": {
            const questions = await generateQuestions(body.topic as string)
            // resumeUrl is a sentinel for useWorkflow Q&A gate (line 38 of use-workflow.ts)
            return NextResponse.json({
              stage: "questions",
              data: questions,
              resumeUrl: "/api/followup",
            })
          }

          default:
            return NextResponse.json(
              { error: "Unknown topic_type" },
              { status: 400 }
            )
        }
      }

      default:
        return NextResponse.json(
          { error: "Unknown content_source" },
          { status: 400 }
        )
    }
  } catch (err: unknown) {
    console.error("[api/generate] error:", err)
    const message = err instanceof Error ? err.message : "Unknown error"

    // Gmail auth failure (D-06)
    if (message.includes("401") || message.includes("403")) {
      return NextResponse.json(
        { error: "Your session has expired. Please sign in again." },
        { status: 401 }
      )
    }
    // Tavily timeout (D-06)
    if (message === "Search timed out") {
      return NextResponse.json({ error: "Request timed out" }, { status: 504 })
    }
    // Claude JSON parse failure (D-06)
    if (message.includes("JSON")) {
      return NextResponse.json(
        { error: "Received an invalid response from the server." },
        { status: 500 }
      )
    }
    // Generic fallback (D-06)
    return NextResponse.json(
      { error: "Something went wrong. Please try again in a moment." },
      { status: 500 }
    )
  }
}
