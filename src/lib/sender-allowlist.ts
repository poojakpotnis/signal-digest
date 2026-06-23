import { promises as fs } from "fs"
import path from "path"

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

const STORE_PATH = path.join(process.cwd(), ".data", "senders.json")

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value)
}

export async function getAllowedSenders(): Promise<string[]> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf-8")
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return [...DEFAULT_SENDERS]
    const valid = parsed.filter((v): v is string => typeof v === "string" && isValidEmail(v))
    return valid.length > 0 ? valid : [...DEFAULT_SENDERS]
  } catch {
    return [...DEFAULT_SENDERS]
  }
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
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true })
  await fs.writeFile(STORE_PATH, JSON.stringify(cleaned, null, 2), "utf-8")
  return cleaned
}
