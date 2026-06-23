import { promises as fs } from "fs"
import path from "path"
import { kv } from "@vercel/kv"

const DEFAULT_SENDERS: readonly string[] = [
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

// Strict email pattern — no spaces, parens, or operators that could break out
// of the Gmail `from:(a OR b)` clause via injection.
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

const KV_KEY = "senders:allowlist"
const FILE_STORE_PATH = path.join(process.cwd(), ".data", "senders.json")

// KV is available when its REST env vars are set (Vercel deploy, or local after
// `vercel env pull`). Otherwise we fall back to a local JSON file for dev.
const useKV = !!process.env.KV_REST_API_URL

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value)
}

function sanitize(senders: unknown): string[] {
  if (!Array.isArray(senders)) return []
  return senders.filter(
    (v): v is string => typeof v === "string" && isValidEmail(v)
  )
}

async function readFromKV(): Promise<string[] | null> {
  try {
    const stored = await kv.get<string[]>(KV_KEY)
    const valid = sanitize(stored)
    return valid.length > 0 ? valid : null
  } catch (err) {
    console.warn("[allowlist] KV read failed, falling back to defaults:", err)
    return null
  }
}

async function readFromFile(): Promise<string[] | null> {
  try {
    const raw = await fs.readFile(FILE_STORE_PATH, "utf-8")
    const valid = sanitize(JSON.parse(raw))
    return valid.length > 0 ? valid : null
  } catch {
    return null
  }
}

export async function getAllowedSenders(): Promise<string[]> {
  const stored = useKV ? await readFromKV() : await readFromFile()
  return stored ?? [...DEFAULT_SENDERS]
}

export async function setAllowedSenders(senders: string[]): Promise<string[]> {
  const cleaned = Array.from(
    new Set(senders.map((s) => s.trim().toLowerCase()).filter(Boolean))
  )
  const invalid = cleaned.filter((s) => !isValidEmail(s))
  if (invalid.length > 0) {
    throw new Error(`Invalid email address(es): ${invalid.join(", ")}`)
  }
  if (cleaned.length === 0) {
    throw new Error("Allowlist cannot be empty")
  }

  if (useKV) {
    await kv.set(KV_KEY, cleaned)
  } else if (process.env.VERCEL) {
    // Vercel serverless filesystem is read-only — the file fallback can never
    // succeed here. Surface a clear setup hint instead of an ENOENT.
    throw new Error(
      "Allowlist storage is not configured. Connect Upstash Redis from the Vercel Marketplace and redeploy."
    )
  } else {
    await fs.mkdir(path.dirname(FILE_STORE_PATH), { recursive: true })
    await fs.writeFile(FILE_STORE_PATH, JSON.stringify(cleaned, null, 2), "utf-8")
  }

  return cleaned
}
