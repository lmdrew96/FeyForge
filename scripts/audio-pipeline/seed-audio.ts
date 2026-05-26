/**
 * Seed script: uploads Low/Med/High MP3 variants from feyforge-audio/ready/
 * to R2 and inserts sceneMusicSets records into Convex.
 *
 * Run with: pnpm seed
 *
 * Requires in .env.local:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *   R2_BUCKET_NAME, R2_PUBLIC_URL,
 *   NEXT_PUBLIC_CONVEX_URL,
 *   SEED_SECRET
 *
 * Input structure:
 *   feyforge-audio/ready/
 *     track-name/
 *       low.mp3
 *       med.mp3
 *       high.mp3
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

const READY_DIR = path.resolve("feyforge-audio/ready")
const VARIANTS = ["low", "med", "high"] as const
type Variant = typeof VARIANTS[number]

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

function detectIntensityTier(trackName: string): "explore" | "combat" {
  const name = trackName.toLowerCase()
  if (name.includes("intense") || name.includes("combative") || name.includes("combat")) {
    return "combat"
  }
  return "explore"
}

function fileNameToTrackName(trackName: string, variant: Variant): string {
  const base = trackName
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
  return `${base} (${variant.charAt(0).toUpperCase() + variant.slice(1)})`
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

async function insertTrack(data: {
  name: string
  intensityTier: "explore" | "combat"
  r2Key: string
  r2Url: string
  duration: number
}): Promise<string> {
  const res = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "audio:insertAudioTrackSeed",
      args: { seedSecret: SEED_SECRET, type: "music", ...data },
      format: "json",
    }),
  })
  if (!res.ok) throw new Error(`insertAudioTrackSeed failed: ${await res.text()}`)
  const json = await res.json() as { value: string }
  return json.value
}

async function insertMusicSetLibrary(data: {
  name: string
  intensityTier: "explore" | "combat"
  lowTrackId: string
  medTrackId: string
  highTrackId: string
}): Promise<void> {
  const res = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "audio:insertMusicSetLibrarySeed",
      args: { seedSecret: SEED_SECRET, ...data },
      format: "json",
    }),
  })
  if (!res.ok) throw new Error(`insertSceneMusicSetSeed failed: ${await res.text()}`)
}

// ── Directory scan ────────────────────────────────────────────────────────────

function scanReadyDir(): string[] {
  if (!fs.existsSync(READY_DIR)) {
    console.error(`❌  Ready directory not found: ${READY_DIR}`)
    console.error("    Run feyforge_normalize.py first to generate upload-ready files.")
    process.exit(1)
  }

  const sets = fs.readdirSync(READY_DIR).filter((entry) => {
    const full = path.join(READY_DIR, entry)
    if (!fs.statSync(full).isDirectory()) return false
    return VARIANTS.every((v) => fs.existsSync(path.join(full, `${v}.mp3`)))
  })

  if (sets.length === 0) {
    console.error(`❌  No complete sets found in ${READY_DIR}`)
    console.error("    Each folder needs low.mp3, med.mp3, and high.mp3.")
    process.exit(1)
  }

  return sets.sort()
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const sets = scanReadyDir()
  console.log(`Found ${sets.length} set(s) in ${READY_DIR}\n`)

  let succeeded = 0
  let failed = 0

  for (const setName of sets) {
    const setDir = path.join(READY_DIR, setName)
    const intensityTier = detectIntensityTier(setName)
    const trackIds: Record<Variant, string> = { low: "", med: "", high: "" }

    process.stdout.write(`\n[${intensityTier}] ${setName}\n`)

    let setFailed = false

    for (const variant of VARIANTS) {
      const filepath = path.join(setDir, `${variant}.mp3`)
      const r2Key = `audio/music/sets/${setName}/${variant}.mp3`
      const r2Url = getR2Url(r2Key)
      const name = fileNameToTrackName(setName, variant)

      process.stdout.write(`  ${variant}.mp3 … `)

      try {
        const exists = await fileExistsInR2(r2Key)
        if (!exists) {
          await uploadToR2(r2Key, filepath)
          process.stdout.write("uploaded → ")
        } else {
          process.stdout.write("already in R2 → ")
        }

        const duration = getDuration(filepath)
        const trackId = await insertTrack({ name, intensityTier, r2Key, r2Url, duration })
        trackIds[variant] = trackId
        console.log("✓")
      } catch (err) {
        console.log(`✗ ${err instanceof Error ? err.message : err}`)
        setFailed = true
        break
      }
    }

    if (setFailed) {
      console.log(`  ⚠️  Skipping sceneMusicSet insert for ${setName}`)
      failed++
      continue
    }

    try {
      await insertMusicSetLibrary({
        name: setName,
        intensityTier,
        lowTrackId: trackIds.low,
        medTrackId: trackIds.med,
        highTrackId: trackIds.high,
      })
      console.log(`  ✅  sceneMusicSet inserted`)
      succeeded++
    } catch (err) {
      console.log(`  ✗  sceneMusicSet failed: ${err instanceof Error ? err.message : err}`)
      failed++
    }
  }

  console.log(`\n${"─".repeat(50)}`)
  console.log(`Done. Sets succeeded: ${succeeded}, failed: ${failed}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
