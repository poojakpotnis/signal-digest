import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const webhookUrl = process.env.N8N_FOLLOWUP_WEBHOOK_URL
  if (!webhookUrl) {
    return NextResponse.json(
      { error: "Follow-up webhook not configured" },
      { status: 500 }
    )
  }

  let response: Response
  try {
    response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    })
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return NextResponse.json({ error: "Request timed out" }, { status: 504 })
    }
    return NextResponse.json({ error: "Request timed out" }, { status: 504 })
  }

  const text = await response.text()
  if (!response.ok) {
    console.error("[api/followup] n8n error:", response.status, text.slice(0, 500))
    return NextResponse.json(
      { error: `n8n returned ${response.status}: ${text.slice(0, 200)}` },
      { status: response.status }
    )
  }
  try {
    const data = JSON.parse(text)
    return NextResponse.json(data)
  } catch {
    console.error("[api/followup] n8n non-JSON response:", text.slice(0, 500))
    return NextResponse.json(
      { error: "Received an invalid response from the server." },
      { status: 502 }
    )
  }
}
