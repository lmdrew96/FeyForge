/**
 * Seed script: uploads all MP3s from assets/audio/ to R2 and inserts
 * records into Convex. Run with: pnpm seed
 *
 * Requires in .env.local:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *   R2_BUCKET_NAME, R2_PUBLIC_URL,
 *   NEXT_PUBLIC_CONVEX_URL,
 *   SEED_SECRET
 */

import * as dotenv from "dotenv"
import * as fs from "fs"
import * as path from "path"
import { execSync } from "child_process"
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3"

dotenv.config({ path: ".env.local" })

// ── Config ──────────────────────────────────────────────────────────────────

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID!
const BUCKET = process.env.R2_BUCKET_NAME!
const PUBLIC_URL = process.env.R2_PUBLIC_URL!
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL!
const SEED_SECRET = process.env.SEED_SECRET!

if (!ACCOUNT_ID || !BUCKET || !PUBLIC_URL || !CONVEX_URL || !SEED_SECRET) {
  console.error("Missing required env vars. Check .env.local for R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_PUBLIC_URL, NEXT_PUBLIC_CONVEX_URL, SEED_SECRET.")
  process.exit(1)
}

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function getR2Url(key: string): string {
  return `${PUBLIC_URL}/${key}`
}

function getDuration(filepath: string): number {
  try {
    const out = execSync(
      `ffprobe -v error -show_entries format=duration -of csv=p=0 "${filepath}" 2>/dev/null`,
      { timeout: 10000 }
    ).toString().trim()
    const parsed = parseFloat(out)
    return isNaN(parsed) ? 0 : Math.round(parsed)
  } catch {
    return 0
  }
}

function fileNameToTrackName(filename: string): string {
  return filename
    .replace(".mp3", "")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

function detectIntensityTier(filename: string): "explore" | "combat" | null {
  const name = filename.toLowerCase()
  if (name.includes("intense") || name.includes("combative")) return "combat"
  return "explore"
}

async function fileExistsInR2(key: string): Promise<boolean> {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
    return true
  } catch {
    return false
  }
}

async function uploadToR2(key: string, filepath: string): Promise<void> {
  const body = fs.readFileSync(filepath)
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: "audio/mpeg",
    })
  )
}

async function insertConvexTrack(data: {
  name: string
  type: "ambience" | "music" | "sfx"
  intensityTier: "explore" | "combat" | null
  sceneTag?: string
  r2Key: string
  r2Url: string
  duration: number
}): Promise<void> {
  const res = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "audio:insertAudioTrackSeed",
      args: { seedSecret: SEED_SECRET, ...data },
      format: "json",
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Convex mutation failed: ${text}`)
  }
}

// ── Directory scan ────────────────────────────────────────────────────────────

interface TrackEntry {
  filepath: string
  filename: string
  type: "ambience" | "music" | "sfx"
}

function scanAudioDir(): TrackEntry[] {
  const base = path.resolve("assets/audio")
  const entries: TrackEntry[] = []

  const dirs: Array<{ dir: string; type: "ambience" | "music" | "sfx" }> = [
    { dir: path.join(base, "ambience"), type: "ambience" },
    { dir: path.join(base, "music"), type: "music" },
    { dir: path.join(base, "sound-effects"), type: "sfx" },
  ]

  for (const { dir, type } of dirs) {
    if (!fs.existsSync(dir)) continue
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".mp3"))
    for (const filename of files) {
      entries.push({ filepath: path.join(dir, filename), filename, type })
    }
  }

  return entries
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const tracks = scanAudioDir()
  console.log(`Found ${tracks.length} audio files.\n`)

  let uploaded = 0
  let skipped = 0
  let failed = 0

  for (const { filepath, filename, type } of tracks) {
    const r2Key = `audio/${type}/${filename}`
    const r2Url = getR2Url(r2Key)
    const name = fileNameToTrackName(filename)

    const intensityTier: "explore" | "combat" | null =
      type === "music" ? detectIntensityTier(filename) : null

    process.stdout.write(`[${type}] ${filename} … `)

    try {
      const exists = await fileExistsInR2(r2Key)
      if (!exists) {
        await uploadToR2(r2Key, filepath)
        process.stdout.write("uploaded → ")
      } else {
        process.stdout.write("already in R2 → ")
        skipped++
      }

      const duration = getDuration(filepath)
      await insertConvexTrack({ name, type, intensityTier, r2Key, r2Url, duration })
      console.log("✓ inserted")
      uploaded++
    } catch (err) {
      console.log(`✗ ${err instanceof Error ? err.message : err}`)
      failed++
    }
  }

  console.log(`\nDone. Inserted: ${uploaded}, Skipped R2 upload: ${skipped}, Failed: ${failed}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
