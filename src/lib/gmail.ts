/**
 * Gmail library module
 * Fetches emails from Gmail Updates tab, strips HTML, and groups by sender.
 * Receives accessToken as a plain string parameter from the caller (session.accessToken).
 */

// ─── Exported types ───────────────────────────────────────────────────────────

export interface EmailMessage {
  id: string
  sender: string      // email address extracted from "From" header
  senderName: string  // display name from "From" header (e.g., "Hamel Husain")
  subject: string
  date: string        // from "Date" header
  body: string        // plain text, HTML stripped
}

export type GroupedEmails = Map<string, EmailMessage[]>

// ─── Sender allowlist ─────────────────────────────────────────────────────────

/**
 * Gmail fetches are restricted to mail from these senders.
 * Edit this list to adjust which newsletter sources the app processes.
 */
const ALLOWED_SENDERS: readonly string[] = [
  "aakashgupta@substack.com",
  "amankhan1@substack.com",
  "avi@dailydoseofds.com",
  "hamel_husain@parlance-labs.com",
  "hello@faveeo.com",
  "info@theinformation.com",
  "lenny@substack.com",
  "mahesh-yadav@courses.maven.com",
  "natesnewsletter@substack.com",
  "superhuman@mail.joinsuperhuman.ai",
  "talraviv@substack.com",
  "theaibreak@substack.com",
  "thebatch@deeplearning.ai",
]

// ─── Internal Gmail API response types ───────────────────────────────────────

interface GmailPart {
  mimeType: string
  body?: { data?: string }
  parts?: GmailPart[]
}

interface GmailMessage {
  id: string
  payload: {
    headers: Array<{ name: string; value: string }>
    mimeType: string
    body?: { data?: string }
    parts?: GmailPart[]
  }
}

interface GmailListResponse {
  messages?: Array<{ id: string }>
  nextPageToken?: string
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Converts a Date to YYYY/MM/DD format required by Gmail query syntax.
 * Uses slashes (NOT dashes) per Gmail API query syntax requirements.
 */
function formatDateForGmail(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}/${month}/${day}`
}

/**
 * Lists all message IDs matching the given query, handling pagination.
 * Never logs the accessToken value (T-01).
 */
async function listMessageIds(
  accessToken: string,
  query: string
): Promise<string[]> {
  const ids: string[] = []
  let pageToken: string | undefined

  do {
    const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages")
    url.searchParams.set("q", query)
    url.searchParams.set("maxResults", "500")
    if (pageToken) url.searchParams.set("pageToken", pageToken)

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!res.ok) {
      throw new Error(`Gmail list error: ${res.status}`)
    }

    const data = (await res.json()) as GmailListResponse
    for (const msg of data.messages ?? []) {
      ids.push(msg.id)
    }
    pageToken = data.nextPageToken
  } while (pageToken)

  return ids
}

/**
 * Fetches a single Gmail message by ID with full MIME payload.
 * Never logs the accessToken value (T-01).
 */
async function getMessage(
  accessToken: string,
  id: string
): Promise<GmailMessage> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  if (!res.ok) {
    throw new Error(`Gmail get error: ${res.status}`)
  }

  return (await res.json()) as GmailMessage
}

/**
 * Recursively extracts the body from a MIME part tree.
 * Prefers text/html; falls back to text/plain.
 * Uses base64url decoding (NOT base64) per Gmail API specification.
 */
function extractBody(part: GmailPart): string | null {
  // Prefer text/html
  if (part.mimeType === "text/html" && part.body?.data) {
    return Buffer.from(part.body.data, "base64url").toString("utf-8")
  }
  // Recurse into child parts (multipart/alternative, multipart/mixed, etc.)
  if (part.parts) {
    for (const child of part.parts) {
      const result = extractBody(child)
      if (result) return result
    }
  }
  // text/plain fallback
  if (part.mimeType === "text/plain" && part.body?.data) {
    return Buffer.from(part.body.data, "base64url").toString("utf-8")
  }
  return null
}

/**
 * Strips HTML tags and decodes entities to produce plain text.
 * Zero external dependencies — regex-only per D-07.
 */
function htmlToText(html: string): string {
  return html
    // Remove script and style blocks entirely
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    // Strip all remaining tags
    .replace(/<[^>]+>/g, " ")
    // Decode common HTML entities
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-z]+;/gi, " ")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Finds a header value by name (case-insensitive).
 * Returns empty string if not found.
 */
function parseEmailHeader(
  headers: Array<{ name: string; value: string }>,
  name: string
): string {
  const header = headers.find(
    (h) => h.name.toLowerCase() === name.toLowerCase()
  )
  return header?.value ?? ""
}

/**
 * Parses the "From" header into email and display name components.
 * Supports both "Display Name <email@example.com>" and bare "email@example.com" formats.
 */
function parseSender(fromHeader: string): { email: string; name: string } {
  const angleMatch = fromHeader.match(/<([^>]+)>/)
  if (angleMatch) {
    const email = angleMatch[1].trim()
    const name = fromHeader.replace(/<[^>]+>/, "").replace(/"/g, "").trim()
    return { email, name }
  }
  // No angle brackets — treat entire string as email
  return { email: fromHeader.trim(), name: fromHeader.trim() }
}

// ─── Exported function ────────────────────────────────────────────────────────

/**
 * Fetches emails from Gmail Updates tab within the given date range.
 * Returns emails grouped by sender email address.
 *
 * - Handles pagination beyond 100 results via nextPageToken loop
 * - Returns plain-text bodies with HTML stripped
 * - Groups results by sender email address (Map key = sender email)
 * - Truncates each email body to 8,000 characters max (token budget guard)
 *
 * @param accessToken - Google OAuth2 access token from session
 * @param startDate - Start of date range (inclusive)
 * @param endDate - End of date range (inclusive)
 */
export async function fetchEmails(
  accessToken: string,
  startDate: Date,
  endDate: Date
): Promise<GroupedEmails> {
  const senderClause = `from:(${ALLOWED_SENDERS.join(" OR ")})`
  const query = `category:updates ${senderClause} after:${formatDateForGmail(startDate)} before:${formatDateForGmail(endDate)}`

  const messageIds = await listMessageIds(accessToken, query)

  const grouped: GroupedEmails = new Map()

  for (const id of messageIds) {
    const message = await getMessage(accessToken, id)

    const headers = message.payload.headers
    const fromHeader = parseEmailHeader(headers, "From")
    const subject = parseEmailHeader(headers, "Subject")
    const date = parseEmailHeader(headers, "Date")

    const { email: senderEmail, name: senderName } = parseSender(fromHeader)

    const rawBody = extractBody(message.payload) ?? ""
    const plainText = htmlToText(rawBody)
    // Token budget guard: truncate to 8,000 characters per email body
    const body = plainText.slice(0, 8000)

    const emailMessage: EmailMessage = {
      id,
      sender: senderEmail,
      senderName,
      subject,
      date,
      body,
    }

    const existing = grouped.get(senderEmail) ?? []
    existing.push(emailMessage)
    grouped.set(senderEmail, existing)
  }

  return grouped
}
