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
  PRESET_POOL_MAX,
  POI_POOL_SHARE,
  type ParsedLocation,
  type ZoneInfo,
  type RouteInfo,
  type RealmInfo,
  type FaithInfo,
} from "../lib/worldMap/azgaar-map"
import type {
  VibeShape,
  VibeClimate,
  VibeCivilization,
  VibeScale,
} from "../lib/worldMap/vibe"

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

// Premium "vibe" library — hand-curated maps tagged by scripts/tag-premium.ts.
// (We drive Azgaar by hand: its UI renders perfectly; headless automation of
// regeneration proved too brittle. See docs/specs/feyforge-premium-map-curation.md.)
const PREMIUM_SRC_DIR = "maps/premium-src"
const PREMIUM_MANIFEST = path.join(PREMIUM_SRC_DIR, "manifest.json")
const PREMIUM_R2_PREFIX = "maps/premium"

// What the seed needs per map: a unique slug (R2 key + DB upsert), the source file
// base (locates the local .map/.png), name + the 4 vibe tags. Dims/scale/locations
// come from re-parsing the .map. Written by tag-premium.ts.
type PremiumManifestEntry = {
  slug: string
  file: string
  name: string
  vibeShape: VibeShape
  vibeClimate: VibeClimate
  vibeCivilization: VibeCivilization
  vibeScale: VibeScale
}

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
  worldEvents?: ZoneInfo[] // named active world events (Azgaar zones) → worldMaps row, DM-only
  routes?: RouteInfo[] // roads/trails/searoutes polylines → worldMaps row (travel overlay)
  realms?: RealmInfo[] // Azgaar states → worldMaps row (Realms & Faiths panel)
  faiths?: FaithInfo[] // Azgaar religions → worldMaps row (Realms & Faiths panel)
  // All 4 present ⇒ the mutation stores source:"premium-preset" + these tags;
  // absent ⇒ a free starter preset (source:"preset").
  vibeShape?: VibeShape
  vibeClimate?: VibeClimate
  vibeCivilization?: VibeCivilization
  vibeScale?: VibeScale
}): Promise<{ mapId: string; replaced: boolean; locationCount: number }> {
  const res = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "worldMap:seedPreset",
      args: { seedSecret: SEED_SECRET, ...args },
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

// ── Premium library (--premium): seed the hand-curated vibe maps ─────────────
// Reads maps/premium-src/manifest.json (written by scripts/tag-premium.ts), seeds
// each tagged map as a source:"premium-preset" worldMap with its 4 vibe axes.
// Re-parses the .map for dims/scale/locations (same curation as free presets so
// adoptPreset's density sampler works identically); PNG goes to maps/premium/<slug>.png.
async function seedPremium(dryRun: boolean): Promise<void> {
  if (!fs.existsSync(PREMIUM_MANIFEST)) {
    console.error(`❌  ${PREMIUM_MANIFEST} not found — tag your maps first:`)
    console.error(`    npx tsx scripts/tag-premium.ts`)
    process.exit(1)
  }
  let manifest: PremiumManifestEntry[]
  try {
    manifest = JSON.parse(fs.readFileSync(PREMIUM_MANIFEST, "utf8")) as PremiumManifestEntry[]
  } catch (err) {
    console.error(`❌  Could not parse ${PREMIUM_MANIFEST}: ${err instanceof Error ? err.message : err}`)
    process.exit(1)
  }

  // Seedable = entries whose .map AND .png are both on disk, AND that carry all 4
  // vibe tags (an untagged entry would seed as a FREE preset and pollute the starter
  // grid — skip it loudly). Local files are found by `file`; `slug` keys R2 + the DB.
  const onDisk = manifest.filter(
    (e) =>
      e.file &&
      fs.existsSync(path.join(PREMIUM_SRC_DIR, `${e.file}.map`)) &&
      fs.existsSync(path.join(PREMIUM_SRC_DIR, `${e.file}.png`)),
  )
  const survivors = onDisk.filter(
    (e) => e.vibeShape && e.vibeClimate && e.vibeCivilization && e.vibeScale,
  )
  console.log(`\nPremium library seed`)
  console.log(
    `Manifest: ${manifest.length} tagged · ${onDisk.length} present on disk · ${survivors.length} fully tagged`,
  )
  if (onDisk.length - survivors.length > 0) {
    console.warn(`⚠️  ${onDisk.length - survivors.length} map(s) missing vibe tags — skipped (re-run tag-premium).`)
  }
  if (survivors.length === 0) {
    console.error(`❌  Nothing to seed. Tag maps first (pnpm tag-premium) and keep their files.`)
    process.exit(1)
  }
  console.log(dryRun ? "Mode: DRY RUN (no R2 uploads, no DB writes)\n" : "Mode: LIVE\n")

  let seeded = 0
  let failed = 0
  for (const e of survivors) {
    process.stdout.write(`  ${e.name} [${e.slug}] … `)
    try {
      const parsed = parseMap(fs.readFileSync(path.join(PREMIUM_SRC_DIR, `${e.file}.map`), "utf8"))
      const { locations, stats } = curateForPreset(parsed)
      const scaleStr = parsed.scaleMilesPerPx ? `${parsed.scaleMilesPerPx} mi/px` : "scale: deferred"
      const summary =
        `pool ${locations.length} (${stats.storedCapitals} caps, ${stats.storedTowns} towns, ` +
        `${stats.storedPois} POIs · ${stats.storedCityLinks} city links) — ${scaleStr}`

      if (dryRun) {
        console.log(`→ ${summary}`)
        seeded++
        continue
      }

      const r2Key = `${PREMIUM_R2_PREFIX}/${e.slug}.png`
      if (await fileExistsInR2(r2Key)) {
        process.stdout.write("PNG in R2 → ")
      } else {
        await uploadPng(r2Key, path.join(PREMIUM_SRC_DIR, `${e.file}.png`))
        process.stdout.write("PNG uploaded → ")
      }

      const result = await seedPresetInConvex({
        name: e.name,
        imageStorageKey: r2Key,
        width: parsed.width,
        height: parsed.height,
        scaleMilesPerPx: parsed.scaleMilesPerPx,
        locations,
        worldEvents: parsed.zones,
        routes: parsed.routes,
        realms: parsed.realms,
        faiths: parsed.faiths,
        vibeShape: e.vibeShape,
        vibeClimate: e.vibeClimate,
        vibeCivilization: e.vibeCivilization,
        vibeScale: e.vibeScale,
      })
      console.log(`${result.replaced ? "↻ updated" : "✓ seeded"} ${result.locationCount}-pin pool — ${summary}`)
      seeded++
    } catch (err) {
      console.log(`✗ ${err instanceof Error ? err.message : String(err)}`)
      failed++
    }
  }

  console.log(`\n${"─".repeat(60)}`)
  if (dryRun) {
    console.log(`Dry run complete. Would seed/update ${seeded} premium map(s).`)
  } else {
    console.log(`Done. Seeded/updated ${seeded}, failed ${failed}.`)
    if (seeded > 0) console.log(`Premium picker should now list these vibe-tagged worlds.`)
  }
  process.exit(failed > 0 && seeded === 0 ? 1 : 0)
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run")
  validateEnv()
  // --premium: seed the hand-curated vibe library instead of the free starter presets.
  if (process.argv.includes("--premium")) return seedPremium(dryRun)

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
    `Pool cap: ${PRESET_POOL_MAX} pins/preset (sampling source; settlement-leaning: POIs ≤ ${Math.round(POI_POOL_SHARE * 100)}%, rest = capitals + top towns)`,
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
        worldEvents: parsed.zones,
        routes: parsed.routes,
        realms: parsed.realms,
        faiths: parsed.faiths,
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
