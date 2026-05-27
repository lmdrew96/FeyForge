/**
 * Bulk upload script — pushes a folder of flat MP3/WAV files to R2 and
 * creates pending audioTrack records in Convex.
 *
 * Usage:
 *   node scripts/audio-pipeline/upload.ts --input ./feyforge-audio/raw --type music
 *   node scripts/audio-pipeline/upload.ts --input ./feyforge-audio/raw --type music --dry-run
 *
 * Flags:
 *   --input   Path to a folder of MP3/WAV files
 *   --type    "music" or "ambience" — written to the audioTrack record
 *   --dry-run Print what would happen without uploading or writing to DB
 *
 * Auth:
 *   Uses SEED_SECRET env var (same as seed-audio.ts). CLI scripts cannot do
 *   headless Clerk auth, so this matches the existing seed pattern.
 *
 * R2 key convention: audio/{type}/{filename}  (e.g. audio/music/forest-strings.mp3)
 *
 * Dedup: if a track with the same r2Key already exists in Convex, it is skipped.
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

// ── CLI args ──────────────────────────────────────────────────────────────────

function parseArgs(): { input: string; type: "music" | "ambience"; dryRun: boolean } {
  const argv = process.argv.slice(2)
  let input = ""
  let type: "music" | "ambience" | null = null
  let dryRun = false

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--input" && argv[i + 1]) { input = argv[++i]; continue }
    if (argv[i] === "--type" && argv[i + 1]) {
      const t = argv[++i]
      if (t !== "music" && t !== "ambience") {
        console.error(`❌  --type must be "music" or "ambience", got "${t}"`)
        process.exit(1)
      }
      type = t
      continue
    }
    if (argv[i] === "--dry-run") { dryRun = true; continue }
  }

  if (!input) { console.error("❌  --input is required"); process.exit(1) }
  if (!type) { console.error("❌  --type is required (music | ambience)"); process.exit(1) }

  return { input: path.resolve(input), type, dryRun }
}

// ── Config ────────────────────────────────────────────────────────────────────

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID!
const BUCKET = process.env.R2_BUCKET_NAME!
const PUBLIC_URL = process.env.R2_PUBLIC_URL!
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL!
const SEED_SECRET = process.env.SEED_SECRET!

function validateEnv() {
  const missing = ["R2_ACCOUNT_ID", "R2_BUCKET_NAME", "R2_PUBLIC_URL", "NEXT_PUBLIC_CONVEX_URL", "SEED_SECRET"]
    .filter((k) => !process.env[k])
  if (missing.length > 0) {
    console.error(`❌  Missing required env vars: ${missing.join(", ")}`)
    console.error("    Check .env.local")
    process.exit(1)
  }
}

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

// ── Helpers ───────────────────────────────────────────────────────────────────

const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".ogg", ".flac", ".m4a"])

function getAudioFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    console.error(`❌  Input directory not found: ${dir}`)
    process.exit(1)
  }

  const files = fs.readdirSync(dir)
    .filter((f) => {
      const full = path.join(dir, f)
      return fs.statSync(full).isFile() && AUDIO_EXTENSIONS.has(path.extname(f).toLowerCase())
    })
    .sort()

  if (files.length === 0) {
    console.error(`❌  No audio files found in ${dir}`)
    console.error(`    Supported: ${[...AUDIO_EXTENSIONS].join(", ")}`)
    process.exit(1)
  }

  return files
}

function getR2Url(key: string): string {
  return `${PUBLIC_URL}/${key}`
}

function getDuration(filepath: string): number {
  try {
    const out = execSync(
      `ffprobe -v error -show_entries format=duration -of csv=p=0 "${filepath}" 2>/dev/null`,
      { timeout: 10000 },
    ).toString().trim()
    const parsed = parseFloat(out)
    return isNaN(parsed) ? 0 : Math.round(parsed)
  } catch {
    return 0
  }
}

function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  const map: Record<string, string> = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".flac": "audio/flac",
    ".m4a": "audio/mp4",
  }
  return map[ext] ?? "audio/mpeg"
}

async function fileExistsInR2(key: string): Promise<boolean> {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
    return true
  } catch {
    return false
  }
}

async function uploadToR2(key: string, filepath: string, filename: string): Promise<void> {
  const body = fs.readFileSync(filepath)
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: getContentType(filename),
    }),
  )
}

async function createTrackInConvex(data: {
  originalFilename: string
  type: "music" | "ambience"
  r2Key: string
  r2Url: string
  duration: number
}): Promise<{ id: string; skipped: boolean }> {
  const res = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "audio:createAudioTrackBulk",
      args: {
        bulkSecret: SEED_SECRET,
        ...data,
        tier: "free",
      },
      format: "json",
    }),
  })

  if (!res.ok) throw new Error(`createAudioTrackBulk failed: ${await res.text()}`)
  const json = await res.json() as { value: { id: string; skipped: boolean } }
  return json.value
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { input, type, dryRun } = parseArgs()
  validateEnv()

  const files = getAudioFiles(input)
  console.log(`\nFound ${files.length} audio file(s) in ${input}`)
  console.log(`Type: ${type}${dryRun ? " — DRY RUN (no uploads, no DB writes)" : ""}\n`)

  let uploaded = 0
  let skipped = 0
  let failed = 0

  for (const filename of files) {
    const filepath = path.join(input, filename)
    const r2Key = `audio/${type}/${filename}`
    const r2Url = getR2Url(r2Key)

    process.stdout.write(`  ${filename} … `)

    if (dryRun) {
      console.log(`→ would upload to ${r2Key}`)
      uploaded++
      continue
    }

    try {
      const alreadyInR2 = await fileExistsInR2(r2Key)
      if (!alreadyInR2) {
        await uploadToR2(r2Key, filepath, filename)
        process.stdout.write("uploaded → ")
      } else {
        process.stdout.write("already in R2 → ")
      }

      const duration = getDuration(filepath)
      const result = await createTrackInConvex({
        originalFilename: filename,
        type,
        r2Key,
        r2Url,
        duration,
      })

      if (result.skipped) {
        console.log("⏭  skipped (already in DB)")
        skipped++
      } else {
        console.log(`✓  pending (id: ${result.id})`)
        uploaded++
      }
    } catch (err) {
      console.log(`✗  ${err instanceof Error ? err.message : String(err)}`)
      failed++
    }
  }

  console.log(`\n${"─".repeat(60)}`)
  if (dryRun) {
    console.log(`Dry run complete. Would process: ${uploaded} file(s)`)
  } else {
    console.log(`Done. Uploaded: ${uploaded}, skipped: ${skipped}, failed: ${failed}`)
    if (uploaded > 0) {
      console.log(`\nTracks are now pending in the admin review queue.`)
      console.log(`Open /admin/review to assign stems and approve.`)
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
