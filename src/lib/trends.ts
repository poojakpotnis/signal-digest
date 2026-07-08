import { promises as fs } from "fs"
import path from "path"
import { kv } from "@vercel/kv"
import type { TrendSnapshot } from "@/types/workflow"

const KV_KEY = "trends:snapshots"
const FILE_STORE_PATH = path.join(process.cwd(), ".data", "trends.json")
const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6

const useKV = !!process.env.KV_REST_API_URL

function isValidSnapshot(v: unknown): v is TrendSnapshot {
  if (!v || typeof v !== "object") return false
  const s = v as Record<string, unknown>
  return (
    typeof s.timestamp === "string" &&
    typeof s.dateRange === "string" &&
    Array.isArray(s.themes) &&
    typeof s.aiDirection === "string" &&
    Array.isArray(s.srPmTakeaways) &&
    Array.isArray(s.leaderVoices)
  )
}

function withinWindow(snapshots: TrendSnapshot[], now: number): TrendSnapshot[] {
  const cutoff = now - SIX_MONTHS_MS
  return snapshots.filter((s) => {
    const t = Date.parse(s.timestamp)
    return Number.isFinite(t) && t >= cutoff
  })
}

async function readAll(): Promise<TrendSnapshot[]> {
  if (useKV) {
    try {
      const stored = await kv.get<TrendSnapshot[]>(KV_KEY)
      if (!Array.isArray(stored)) return []
      return stored.filter(isValidSnapshot)
    } catch (err) {
      console.warn("[trends] KV read failed:", err)
      return []
    }
  }
  try {
    const raw = await fs.readFile(FILE_STORE_PATH, "utf-8")
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidSnapshot)
  } catch {
    return []
  }
}

async function writeAll(snapshots: TrendSnapshot[]): Promise<void> {
  if (useKV) {
    await kv.set(KV_KEY, snapshots)
    return
  }
  if (process.env.VERCEL) return  // read-only FS on Vercel without KV — skip persist
  await fs.mkdir(path.dirname(FILE_STORE_PATH), { recursive: true })
  await fs.writeFile(FILE_STORE_PATH, JSON.stringify(snapshots, null, 2), "utf-8")
}

export async function getRecentTrends(now: number = Date.now()): Promise<TrendSnapshot[]> {
  const all = await readAll()
  return withinWindow(all, now).sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}

export async function saveTrendSnapshot(snapshot: TrendSnapshot): Promise<void> {
  const all = await readAll()
  const now = Date.parse(snapshot.timestamp)
  const kept = withinWindow(all, Number.isFinite(now) ? now : Date.now())
  kept.push(snapshot)
  await writeAll(kept)
}
