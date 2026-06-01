/**
 * World-map preset seeder — parses the Azgaar `.map` exports in `maps/`, uploads
 * each paired PNG to R2, and creates a global `preset` worldMap (+ its pins) in
 * Convex so the free-tier picker has starter maps. This is the Phase 2 import
 * pipeline from docs/specs/feyforge-world-map-spec.md.
 *
 * Usage:
 *   npx tsx scripts/seed-presets.ts --dry-run   # parse + report, no R2/DB writes
 *   npx tsx scripts/seed-presets.ts             # upload to R2 + seed Convex
 *
 * Prereq: the seedPreset mutation must be deployed first — run `npx convex deploy`
 * (NOT `npx convex dev`, which rewrites .env.local to a local backend).
 *
 * Auth: SEED_SECRET env var (CLI scripts can't do headless Clerk auth — same
 * pattern as scripts/audio-pipeline/upload.ts).
 *
 * Requires in .env.local:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME,
 *   R2_PUBLIC_URL, NEXT_PUBLIC_CONVEX_URL, SEED_SECRET
 *
 * .map format (Azgaar FMG v1.122.x, verified 2026-05-31): line 0 is a
 * pipe-delimited params header (width @ idx4, height @ idx5); line 1 is
 * pipe-delimited settings (distanceUnit @ idx0, distanceScale @ idx1); the
 * pack.* data lives as bare positional JSON-array lines after an embedded <svg>.
 * Line indices shift with Azgaar version / SVG size, so we detect the burgs,
 * markers, and notes arrays by their element-key SIGNATURE, never by line number.
 */

import * as dotenv from "dotenv"
import * as fs from "fs"
import * as path from "path"
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3"
// Relative (not "@/…") — tsx doesn't resolve tsconfig path aliases here.
import { htmlToMarkdown } from "../lib/html-to-markdown"

dotenv.config({ path: ".env.local" })

// ── Tunables (curation) ─────────────────────────────────────────────────────
// Azgaar maps carry 470–850 burgs + 56–73 markers — far too many pins. Each
// preset stores at most MAX_PINS, ranked by `prominence` (capitals > POIs >
// towns, scaled by population). adoptPreset then samples a per-campaign random
// subset down to the DM's chosen density tier; 100 is the largest ("mega") tier.
const MAX_PINS = 100

// Keep the stored pool settlement-leaning (most fantasy maps have more towns than
// landmarks): POIs are capped at this share of the pool, the rest is settlements
// (capitals + top towns). POI sampling weight (POI_PROMINENCE) sits among towns so
// per-campaign tiers also lean toward settlements rather than landmarks.
const POI_POOL_SHARE = 1 / 3
const POI_PROMINENCE = 1.2

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
const PUBLIC_URL = process.env.R2_PUBLIC_URL!
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

// ── .map parsing ────────────────────────────────────────────────────────────
type Burg = {
  x: number
  y: number
  name?: string
  capital?: number
  population?: number
}
type Marker = { type?: string; x: number; y: number; cell?: number; i: number }
type Note = { id: string; name: string; legend: string }
type SeedLocation = {
  type: "settlement" | "poi"
  name: string
  x: number
  y: number
  dmNotes?: string
  prominence: number
}
type ParsedMap = {
  width: number
  height: number
  scaleMilesPerPx?: number
  locations: SeedLocation[]
  stats: {
    candidates: number // total settlements + POIs before the MAX_PINS cap
    storedCapitals: number
    storedTowns: number
    storedPois: number
    poiNamed: number
  }
}

const clampPct = (v: number): number => Math.round(Math.max(0, Math.min(100, v)) * 10000) / 10000

// Azgaar legends occasionally carry a mangled emoji — a lone UTF-16 surrogate
// (half of a pair). Convex rejects strings with invalid Unicode (it surfaces as
// a generic "Server Error" on insert), so drop orphaned surrogates while leaving
// valid pairs (real emoji) intact.
const sanitizeText = (s: string): string =>
  s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "")

const titleCase = (s: string): string =>
  s
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase()) || "Point of Interest"

function isObjArray(arr: unknown): arr is Record<string, unknown>[] {
  return Array.isArray(arr)
}

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
function sampleByProminence(pool: SeedLocation[], limit: number, seed: string): SeedLocation[] {
  const rng = mulberry32(seedFromString(seed))
  return pool
    .map((loc) => ({ loc, key: Math.pow(rng(), 1 / Math.max(loc.prominence, 0.0001)) }))
    .sort((a, b) => b.key - a.key)
    .slice(0, limit)
    .map((e) => e.loc)
}

function parseMap(text: string): ParsedMap {
  const lines = text.split("\n")

  // Header (pipe-delimited): width @ idx4, height @ idx5.
  const header = lines[0].split("|")
  const width = Number(header[4])
  const height = Number(header[5])
  if (!width || !height) throw new Error("Could not read width/height from .map header")

  // Settings (pipe-delimited): distanceUnit @ idx0, distanceScale @ idx1.
  // Azgaar's distanceScale IS units-per-pixel (confirmed against the FMG wiki).
  const settings = lines[1].split("|")
  const unit = settings[0]
  const scale = Number(settings[1])
  let scaleMilesPerPx: number | undefined
  if (!isNaN(scale) && scale > 0) {
    if (unit === "mi") scaleMilesPerPx = scale
    else if (unit === "km") scaleMilesPerPx = Math.round(scale * 0.621371 * 10000) / 10000
    // Other units (leagues, versts, …) are ambiguous — leave undefined.
  }

  // Detect the burgs / markers / notes arrays by element-key signature.
  let burgs: Burg[] = []
  let markers: Marker[] = []
  let notes: Note[] = []
  for (const ln of lines) {
    const t = ln.trimStart()
    if (!t.startsWith("[")) continue
    let arr: unknown
    try {
      arr = JSON.parse(t)
    } catch {
      continue
    }
    if (!isObjArray(arr)) continue
    const sample = arr.find((e) => e && typeof e === "object" && !Array.isArray(e)) as
      | Record<string, unknown>
      | undefined
    if (!sample) continue
    if (
      burgs.length === 0 &&
      arr.length > 50 &&
      "population" in sample &&
      "capital" in sample &&
      "x" in sample &&
      "y" in sample
    ) {
      burgs = arr as Burg[]
    } else if (
      markers.length === 0 &&
      "icon" in sample &&
      "x" in sample &&
      "y" in sample &&
      "cell" in sample
    ) {
      markers = arr as Marker[]
    } else if (notes.length === 0 && "legend" in sample && "id" in sample && "name" in sample) {
      notes = arr as Note[]
    }
  }

  // Settlements: real burgs only (burgs[0] is a numeric 0 placeholder). Each gets
  // a prominence band: capitals 3.0–3.9 > towns 1.0–1.9, scaled by population
  // within this map. Drives the MAX_PINS cap below + adoptPreset's sampling.
  const realBurgs = burgs.filter(
    (b) => b && typeof b === "object" && typeof b.name === "string" && b.name.trim().length > 0,
  )
  const maxPop = Math.max(
    1,
    ...realBurgs.map((b) => Number(b.population)).filter((n) => Number.isFinite(n) && n > 0),
  )
  const settlements: SeedLocation[] = realBurgs.map((b) => {
    const pop = Number(b.population)
    const popNorm = Number.isFinite(pop) && pop > 0 ? Math.min(1, pop / maxPop) : 0
    const isCapital = b.capital === 1
    return {
      type: "settlement" as const,
      name: sanitizeText(b.name!.trim()),
      x: clampPct((b.x / width) * 100),
      y: clampPct((b.y / height) * 100),
      prominence: Math.round(((isCapital ? 3 : 1) + 0.9 * popNorm) * 1000) / 1000,
    }
  })

  // POIs: markers, named via the paired note (id === `marker${i}`); the note's
  // legend seeds dmNotes (DM-secret — never goes to playerNotes). Fall back to a
  // title-cased marker type when there's no note. Flat prominence 2.0 → ranked
  // above towns, below capitals, so every POI survives the MAX_PINS cap.
  const noteById = new Map(notes.map((n) => [n.id, n]))
  let poiNamed = 0
  const pois: SeedLocation[] = markers
    .filter((m) => m && typeof m === "object" && typeof m.x === "number" && typeof m.y === "number")
    .map((m) => {
      const note = noteById.get(`marker${m.i}`)
      const named = !!note?.name?.trim()
      if (named) poiNamed++
      // Azgaar legends are HTML; convert to clean Markdown at seed time so new
      // imports store readable notes (display also normalizes legacy HTML).
      const legend = note?.legend ? htmlToMarkdown(sanitizeText(note.legend.trim())) : ""
      return {
        type: "poi" as const,
        name: sanitizeText(named ? note!.name.trim() : titleCase(String(m.type ?? ""))),
        x: clampPct((m.x / width) * 100),
        y: clampPct((m.y / height) * 100),
        dmNotes: legend.length > 0 ? legend : undefined,
        prominence: POI_PROMINENCE,
      }
    })

  // Build the stored pool, settlement-leaning: cap POIs at POI_POOL_SHARE of
  // MAX_PINS (preferring those with legend notes), then fill the rest with the
  // top settlements by prominence (capitals first, then towns by population).
  const candidates = settlements.length + pois.length
  const keptPois = [...pois]
    .sort((a, b) => (b.dmNotes ? 1 : 0) - (a.dmNotes ? 1 : 0))
    .slice(0, Math.floor(MAX_PINS * POI_POOL_SHARE))
  const keptSettlements = [...settlements]
    .sort((a, b) => b.prominence - a.prominence)
    .slice(0, MAX_PINS - keptPois.length)
  const pool = [...keptSettlements, ...keptPois]

  return {
    width,
    height,
    scaleMilesPerPx,
    locations: pool,
    stats: {
      candidates,
      storedCapitals: pool.filter((l) => l.type === "settlement" && l.prominence >= 3).length,
      storedTowns: pool.filter((l) => l.type === "settlement" && l.prominence < 3).length,
      storedPois: pool.filter((l) => l.type === "poi").length,
      poiNamed: Math.min(poiNamed, pool.filter((l) => l.type === "poi").length),
    },
  }
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
  locations: SeedLocation[]
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
    `Pool cap: ${MAX_PINS} pins/preset (settlement-leaning: POIs ≤ ${Math.round(POI_POOL_SHARE * 100)}%, rest = capitals + top towns)`,
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
      const { stats } = parsed
      const scaleStr = parsed.scaleMilesPerPx ? `${parsed.scaleMilesPerPx} mi/px` : "scale: deferred"
      const summary =
        `pool ${parsed.locations.length} of ${stats.candidates} ` +
        `(${stats.storedCapitals} capitals, ${stats.storedTowns} towns, ${stats.storedPois} POIs · ` +
        `${stats.poiNamed} POIs named) — ${scaleStr}`

      if (dryRun) {
        console.log(`→ ${summary}`)
        // Preview the per-campaign mix at each density tier (sample seed).
        for (const tier of PREVIEW_TIERS) {
          const pick = sampleByProminence(parsed.locations, tier.limit, `sample:${slug}`)
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
        locations: parsed.locations,
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
