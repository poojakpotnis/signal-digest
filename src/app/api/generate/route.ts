import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  // 1. Session validation (per D-10)
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 2. Parse and validate request body
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  // 3. Enforce max 3 influencers (per D-12)
  if (Array.isArray(body.influencers) && body.influencers.length > 3) {
    return NextResponse.json(
      { error: "Maximum 3 influencers allowed" },
      { status: 400 }
    )
  }

  // 4. Proxy to n8n (per D-11, D-13, D-14)
  const n8nUrl = process.env.N8N_WEBHOOK_URL
  if (!n8nUrl) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    )
  }

  let response: Response
  try {
    response = await fetch(n8nUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    })
  } catch (err: unknown) {
    // AbortSignal.timeout throws DOMException with name "TimeoutError" (per Pitfall 4)
    if (err instanceof Error && err.name === "TimeoutError") {
      return NextResponse.json({ error: "Request timed out" }, { status: 504 })
    }
    // Any other fetch error (network failure, DNS, etc.)
    return NextResponse.json({ error: "Request timed out" }, { status: 504 })
  }

  // 5. Return n8n response directly (per D-14)
  const text = await response.text()
  if (!response.ok) {
    console.error("[api/generate] n8n error:", response.status, text.slice(0, 500))
    return NextResponse.json(
      { error: `n8n returned ${response.status}: ${text.slice(0, 200)}` },
      { status: response.status }
    )
  }
  try {
    const data = JSON.parse(text)
    return NextResponse.json(data)
  } catch {
    console.error("[api/generate] n8n non-JSON response:", text.slice(0, 500))
    return NextResponse.json(
      { error: "Received an invalid response from the server." },
      { status: 502 }
    )
  }
}
