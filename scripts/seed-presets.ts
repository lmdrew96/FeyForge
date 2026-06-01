/**
 * World-map preset seeder — parses the Azgaar `.map` exports in `maps/`, uploads
 * each paired PNG to R2, and creates a global `preset` worldMap (+ its pins) in
 * Convex so the free-tier picker has starter maps.
 *
 * The `.map` PARSER + curation now live in lib/worldMap/azgaar-map.ts (shared with
 * the in-app importer at app/dm/world-map). This script owns only the CLI/R2/Convex
 * orchestration and the per-density-tier dry-run preview.
 *
 * Usage:
 *   npx tsx scripts/seed-presets.ts --dry-run   # parse + report, no R2/DB writes
 *   npx tsx scripts/seed-presets.ts             # upload to R2 + seed Convex
 *
 * Prereq: the seedPreset mutation must be deployed first — run `npx convex deploy`
 * (NOT `npx convex dev`, which rewrites .env.local to a local backend).
 *
 * Requires in .env.local:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME,
 *   R2_PUBLIC_URL, NEXT_PUBLIC_CONVEX_URL, SEED_SECRET
 */

import * as dotenv from "dotenv"
import * as fs from "fs"
import * as path from "path"
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3"
// Relative (not "@/…") — tsx doesn't resolve tsconfig path aliases here.
import {
  parseMap,
  curateForPreset,
  PRESET_MAX_PINS,
  POI_POOL_SHARE,
  type ParsedLocation,
} from "../lib/worldMap/azgaar-map"

dotenv.config({ path: ".env.local" })

// Tier limits the seed report previews — must mirror DENSITY_TIERS in the UI and
// FREE_MAX_PINS in convex/worldMap.ts (free ≤ 40; "a bunch"/"mega" are premium).
const PREVIEW_TIERS: { label: string; limit: number }[] = [
  { label: "handful", limit: 10 },
  { label: "several", limit: 20 },
  { label: "many", limit: 40 },
  { label: "a bunch", limit: 75 },
  { label: "mega", limit: 100 },
]

const MAPS_DIR = "maps"
const R2_KEY_PREFIX = "maps/presets"

// ── Env / clients ───────────────────────────────────────────────────────────
const REQUIRED_ENV = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
  "NEXT_PUBLIC_CONVEX_URL",
  "SEED_SECRET",
] as const

function validateEnv(): void {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k])
  if (missing.length > 0) {
    console.error(`❌  Missing required env vars: ${missing.join(", ")}`)
    console.error("    Check .env.local")
    process.exit(1)
  }
}

const BUCKET = process.env.R2_BUCKET_NAME!
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL!
const SEED_SECRET = process.env.SEED_SECRET!

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

// ── Dry-run preview sampler ──────────────────────────────────────────────────
// Mirror of adoptPreset's per-campaign sampler (convex/worldMap.ts) so --dry-run
// can preview the composition a campaign would actually get at each density tier.
function seedFromString(s: string): number {
  let h = 1779033703 ^ s.length
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return h >>> 0
}
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function sampleByProminence(pool: ParsedLocation[], limit: number, seed: string): ParsedLocation[] {
  const rng = mulberry32(seedFromString(seed))
  return pool
    .map((loc) => ({ loc, key: Math.pow(rng(), 1 / Math.max(loc.prominence, 0.0001)) }))
    .sort((a, b) => b.key - a.key)
    .slice(0, limit)
    .map((e) => e.loc)
}

// ── R2 + Convex ─────────────────────────────────────────────────────────────
async function fileExistsInR2(key: string): Promise<boolean> {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
    return true
  } catch {
    return false
  }
}

async function uploadPng(key: string, filepath: string): Promise<void> {
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: fs.readFileSync(filepath),
      ContentType: "image/png",
    }),
  )
}

async function seedPresetInConvex(args: {
  name: string
  imageStorageKey: string
  width: number
  height: number
  scaleMilesPerPx?: number
  locations: ParsedLocation[]
}): Promise<{ mapId: string; replaced: boolean; locationCount: number }> {
  const res = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "worldMap:seedPreset",
      args: { seedSecret: SEED_SECRET, isPremiumPreset: false, ...args },
      format: "json",
    }),
  })
  if (!res.ok) throw new Error(`seedPreset failed: ${await res.text()}`)
  const json = (await res.json()) as {
    status: string
    value?: { mapId: string; replaced: boolean; locationCount: number }
    errorMessage?: string
  }
  if (json.status !== "success" || !json.value) {
    throw new Error(`seedPreset error: ${json.errorMessage ?? JSON.stringify(json)}`)
  }
  return json.value
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run")
  validateEnv()

  if (!fs.existsSync(MAPS_DIR)) {
    console.error(`❌  ${MAPS_DIR}/ not found`)
    process.exit(1)
  }
  const mapFiles = fs
    .readdirSync(MAPS_DIR)
    .filter((f) => f.toLowerCase().endsWith(".map"))
    .sort()
  if (mapFiles.length === 0) {
    console.error(`❌  No .map files in ${MAPS_DIR}/`)
    process.exit(1)
  }

  console.log(`\nFound ${mapFiles.length} .map file(s) in ${MAPS_DIR}/`)
  console.log(
    `Pool cap: ${PRESET_MAX_PINS} pins/preset (settlement-leaning: POIs ≤ ${Math.round(POI_POOL_SHARE * 100)}%, rest = capitals + top towns)`,
  )
  console.log(dryRun ? "Mode: DRY RUN (no R2 uploads, no DB writes)\n" : "Mode: LIVE\n")

  let seeded = 0
  let failed = 0

  for (const mapFile of mapFiles) {
    const slug = mapFile.split(/[\s.]/)[0].toLowerCase()
    const name = slug.charAt(0).toUpperCase() + slug.slice(1)
    const pngFile = mapFile.replace(/\.map$/i, ".png")
    const pngPath = path.join(MAPS_DIR, pngFile)
    const r2Key = `${R2_KEY_PREFIX}/${slug}.png`

    process.stdout.write(`  ${name} … `)

    try {
      if (!fs.existsSync(pngPath)) {
        console.log(`✗  missing paired PNG (${pngFile})`)
        failed++
        continue
      }

      const parsed = parseMap(fs.readFileSync(path.join(MAPS_DIR, mapFile), "utf8"))
      const { locations, stats } = curateForPreset(parsed)
      const scaleStr = parsed.scaleMilesPerPx ? `${parsed.scaleMilesPerPx} mi/px` : "scale: deferred"
      const summary =
        `pool ${locations.length} of ${stats.candidates} ` +
        `(${stats.storedCapitals} capitals, ${stats.storedTowns} towns, ${stats.storedPois} POIs · ` +
        `${stats.poiNamed} POIs named · ${stats.storedCityLinks} city links) — ${scaleStr}`

      if (dryRun) {
        console.log(`→ ${summary}`)
        // Preview the per-campaign mix at each density tier (sample seed).
        for (const tier of PREVIEW_TIERS) {
          const pick = sampleByProminence(locations, tier.limit, `sample:${slug}`)
          if (pick.length === 0) continue
          const caps = pick.filter((l) => l.type === "settlement" && l.prominence >= 3).length
          const towns = pick.filter((l) => l.type === "settlement" && l.prominence < 3).length
          const poi = pick.filter((l) => l.type === "poi").length
          console.log(
            `      ${tier.label.padEnd(8)} (≤${String(tier.limit).padStart(3)}): ` +
              `${pick.length} pins — ${caps} capitals, ${towns} towns, ${poi} POIs`,
          )
        }
        seeded++
        continue
      }

      if (await fileExistsInR2(r2Key)) {
        process.stdout.write("PNG already in R2 → ")
      } else {
        await uploadPng(r2Key, pngPath)
        process.stdout.write("PNG uploaded → ")
      }

      const result = await seedPresetInConvex({
        name,
        imageStorageKey: r2Key,
        width: parsed.width,
        height: parsed.height,
        scaleMilesPerPx: parsed.scaleMilesPerPx,
        locations,
      })

      console.log(`${result.replaced ? "↻  updated" : "✓  seeded"} ${result.locationCount}-pin pool — ${summary}`)
      seeded++
    } catch (err) {
      console.log(`✗  ${err instanceof Error ? err.message : String(err)}`)
      failed++
    }
  }

  console.log(`\n${"─".repeat(60)}`)
  if (dryRun) {
    console.log(`Dry run complete. Would seed/update: ${seeded} preset(s).`)
    console.log(`Re-run without --dry-run to upload to R2 + write to Convex.`)
  } else {
    console.log(`Done. Seeded/updated: ${seeded}, failed: ${failed}.`)
    if (seeded > 0) console.log(`Free-tier preset picker should now list these maps.`)
  }
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
