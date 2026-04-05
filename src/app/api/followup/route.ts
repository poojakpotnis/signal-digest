import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import { generatePersonalPost } from "@/lib/claude"

export async function POST(req: NextRequest) {
  // 1. Auth check (preserved from current handler)
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 2. Parse body (preserved from current handler)
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  // 3. Validate required fields (per D-03, D-05)
  if (!body.topic || typeof body.topic !== "string") {
    return NextResponse.json({ error: "topic is required" }, { status: 400 })
  }
  if (!body.answers || typeof body.answers !== "string") {
    return NextResponse.json({ error: "answers is required" }, { status: 400 })
  }

  // 4. Call Claude directly (per D-05, INT-01)
  try {
    const post = await generatePersonalPost(body.topic, body.answers)
    return NextResponse.json({ data: post })
  } catch (err: unknown) {
    console.error("[api/followup] error:", err)
    const message = err instanceof Error ? err.message : "Unknown error"

    // Claude JSON parse failure
    if (message.includes("JSON")) {
      return NextResponse.json(
        { error: "Received an invalid response from the server." },
        { status: 500 }
      )
    }
    // Generic fallback
    return NextResponse.json(
      { error: "Something went wrong. Please try again in a moment." },
      { status: 500 }
    )
  }
}
