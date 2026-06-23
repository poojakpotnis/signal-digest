import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"
import { getOrCreateLabel, moveMessagesToLabel } from "@/lib/gmail"

const LABEL_NAME_RE = /^[A-Za-z0-9 _\-/]{1,64}$/

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { messageIds, labelName } = (body ?? {}) as {
    messageIds?: unknown
    labelName?: unknown
  }

  if (
    !Array.isArray(messageIds) ||
    messageIds.length === 0 ||
    !messageIds.every((id) => typeof id === "string" && /^[A-Za-z0-9_-]+$/.test(id))
  ) {
    return NextResponse.json(
      { error: "messageIds must be a non-empty array of valid Gmail message IDs" },
      { status: 400 }
    )
  }

  if (typeof labelName !== "string" || !LABEL_NAME_RE.test(labelName)) {
    return NextResponse.json(
      { error: "labelName is required and must be 1–64 chars of letters, digits, spaces, _ - /" },
      { status: 400 }
    )
  }

  try {
    const labelId = await getOrCreateLabel(session.accessToken, labelName)
    await moveMessagesToLabel(session.accessToken, messageIds as string[], labelId)
    return NextResponse.json({ moved: messageIds.length, labelName })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to move messages"
    console.error("[api/messages/move] error:", err)
    if (message.includes("401") || message.includes("403")) {
      return NextResponse.json(
        { error: "Your session has expired. Please sign in again." },
        { status: 401 }
      )
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
