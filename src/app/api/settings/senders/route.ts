import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import { getAllowedSenders, setAllowedSenders } from "@/lib/sender-allowlist"

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const senders = await getAllowedSenders()
  return NextResponse.json({ senders })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const incoming = (body as { senders?: unknown })?.senders
  if (!Array.isArray(incoming) || !incoming.every((v) => typeof v === "string")) {
    return NextResponse.json(
      { error: "Expected { senders: string[] }" },
      { status: 400 }
    )
  }

  try {
    const saved = await setAllowedSenders(incoming as string[])
    return NextResponse.json({ senders: saved })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
