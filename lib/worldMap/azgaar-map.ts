// Shared Azgaar `.map` parser — the single source of truth for turning an Azgaar
// Fantasy Map Generator export into FeyForge pins. Used by BOTH the preset seed
// script (scripts/seed-presets.ts, Node) and the in-app importer (browser).
//
// Browser-safe: depends only on htmlToMarkdown (already imported client-side) and
// buildMfcgUrl. No fs / no @aws-sdk — those stay in the seed script.
//
// Split by concern:
//   parseMap        → ALL settlements + ALL POIs, uncurated (raw parse).
//   curateForPreset → the shared-template curation (cap + settlement-leaning POI
//                     share). Presets ship to the free tier, so they're trimmed.
//   curateForImport → a DM's OWN world: keep the most prominent pins, mix
//                     preserved (no POI-share skew — don't cull hand-placed POIs).
//
// .map format (Azgaar FMG v1.122.x): line 0 = pipe-delimited params header
// (seed @ idx3, width @ idx4, height @ idx5); line 1 = settings (distanceUnit @
// idx0, distanceScale @ idx1); the pack.* data is bare positional JSON-array
// lines after an embedded <svg>. Line indices shift with version/SVG size, so we
// detect the burgs/markers/notes arrays by element-key SIGNATURE, not line number.

import { htmlToMarkdown } from "../html-to-markdown"
import { buildMfcgUrl } from "./mfcgLink"

// Hard ceiling on stored pins (matches MAX_PINS in convex/worldMap.ts). The DM map
// renders every pin, so this is the render-perf cap for presets AND imports.
export const PRESET_MAX_PINS = 100
// Presets lean settlement: POIs capped at this share of the pool, the rest is
// capitals + top towns. POIs get a flat prominence sitting among towns.
export const POI_POOL_SHARE = 1 / 3
export const POI_PROMINENCE = 1.2

export type ParsedLocation = {
  type: "settlement" | "poi"
  name: string
  x: number // normalized 0–100
  y: number // normalized 0–100
  dmNotes?: string
  drillDownUrl?: string // MFCG city iframe URL (settlements only)
  prominence: number
}

export type ParsedMap = {
  width: number
  height: number
  scaleMilesPerPx?: number
  settlements: ParsedLocation[]
  pois: ParsedLocation[]
  poiNamedTotal: number // POIs that resolved a real name (not a type fallback) — for seed reporting
}

export type PresetStats = {
  candidates: number // total settlements + POIs before the cap
  storedCapitals: number
  storedTowns: number
  storedPois: number
  poiNamed: number
  storedCityLinks: number // settlements with an MFCG drill-down URL
}

// ── Raw object shapes (subset of Azgaar's pack.*) ────────────────────────────
type Burg = {
  i?: number
  x: number
  y: number
  name?: string
  capital?: number
  population?: number
  port?: number | null
  citadel?: number
  plaza?: number
  walls?: number
  shanty?: number
  temple?: number
  MFCG?: number | null
  link?: string | null
}
type Marker = { type?: string; x: number; y: number; cell?: number; i: number }
type Note = { id: string; name: string; legend: string }

const clampPct = (v: number): number => Math.round(Math.max(0, Math.min(100, v)) * 10000) / 10000

// Azgaar legends occasionally carry a mangled emoji — a lone UTF-16 surrogate
// (half of a pair). Convex rejects strings with invalid Unicode (surfaces as a
// generic "Server Error" on insert), and encodeURIComponent throws on them, so
// drop orphaned surrogates while leaving valid pairs (real emoji) intact.
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

// Parse a `.map` into ALL settlements + ALL POIs (no cap, no curation). Throws on
// a malformed header so callers can show a friendly "couldn't read this .map".
export function parseMap(text: string): ParsedMap {
  const lines = text.split("\n")

  // Header (pipe-delimited): seed @ idx3, width @ idx4, height @ idx5.
  const header = lines[0]?.split("|") ?? []
  const width = Number(header[4])
  const height = Number(header[5])
  if (!width || !height) {
    throw new Error("Could not read width/height from .map header")
  }
  // Map seed feeds the per-burg MFCG seed (`${mapSeed}${burgId}`, FMG formula).
  const mapSeed = header[3] || "0"

  // Settings (pipe-delimited): distanceUnit @ idx0, distanceScale @ idx1.
  // Azgaar's distanceScale IS units-per-pixel (confirmed against the FMG wiki).
  const settings = lines[1]?.split("|") ?? []
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
  // within this map. Each also gets a Watabou MFCG city drill-down URL.
  const realBurgs = burgs.filter(
    (b) => b && typeof b === "object" && typeof b.name === "string" && b.name.trim().length > 0,
  )
  const maxPop = Math.max(
    1,
    ...realBurgs.map((b) => Number(b.population)).filter((n) => Number.isFinite(n) && n > 0),
  )
  const settlements: ParsedLocation[] = realBurgs.map((b, idx) => {
    const pop = Number(b.population)
    const popThousands = Number.isFinite(pop) && pop > 0 ? pop : 0
    const popNorm = popThousands > 0 ? Math.min(1, popThousands / maxPop) : 0
    const isCapital = b.capital === 1
    const cleanName = sanitizeText(b.name!.trim())
    return {
      type: "settlement" as const,
      name: cleanName,
      x: clampPct((b.x / width) * 100),
      y: clampPct((b.y / height) * 100),
      prominence: Math.round(((isCapital ? 3 : 1) + 0.9 * popNorm) * 1000) / 1000,
      // Use the sanitized name (a lone surrogate makes encodeURIComponent throw).
      // burg.i drives the MFCG seed; fall back to array position if Azgaar omits it.
      drillDownUrl: buildMfcgUrl(
        {
          i: typeof b.i === "number" ? b.i : idx,
          name: cleanName,
          population: popThousands,
          capital: b.capital,
          port: b.port,
          citadel: b.citadel,
          plaza: b.plaza,
          walls: b.walls,
          shanty: b.shanty,
          temple: b.temple,
          MFCG: b.MFCG,
          link: b.link,
        },
        mapSeed,
      ),
    }
  })

  // POIs: markers, named via the paired note (id === `marker${i}`); the note's
  // legend seeds dmNotes (DM-secret). Fall back to a title-cased marker type when
  // there's no note. Flat prominence ranks them among towns.
  const noteById = new Map(notes.map((n) => [n.id, n]))
  let poiNamedTotal = 0
  const pois: ParsedLocation[] = markers
    .filter((m) => m && typeof m === "object" && typeof m.x === "number" && typeof m.y === "number")
    .map((m) => {
      const note = noteById.get(`marker${m.i}`)
      const named = !!note?.name?.trim()
      if (named) poiNamedTotal++
      // Azgaar legends are HTML; convert to clean Markdown at parse time.
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

  return { width, height, scaleMilesPerPx, settlements, pois, poiNamedTotal }
}

// Preset curation: settlement-leaning, capped. POIs ≤ POI_POOL_SHARE of the cap
// (preferring those with legend notes), the rest = top settlements by prominence.
export function curateForPreset(
  parsed: ParsedMap,
  maxPins: number = PRESET_MAX_PINS,
  poiShare: number = POI_POOL_SHARE,
): { locations: ParsedLocation[]; stats: PresetStats } {
  const { settlements, pois, poiNamedTotal } = parsed
  const candidates = settlements.length + pois.length
  const keptPois = [...pois]
    .sort((a, b) => (b.dmNotes ? 1 : 0) - (a.dmNotes ? 1 : 0))
    .slice(0, Math.floor(maxPins * poiShare))
  const keptSettlements = [...settlements]
    .sort((a, b) => b.prominence - a.prominence)
    .slice(0, maxPins - keptPois.length)
  const pool = [...keptSettlements, ...keptPois]

  return {
    locations: pool,
    stats: {
      candidates,
      storedCapitals: pool.filter((l) => l.type === "settlement" && l.prominence >= 3).length,
      storedTowns: pool.filter((l) => l.type === "settlement" && l.prominence < 3).length,
      storedPois: pool.filter((l) => l.type === "poi").length,
      poiNamed: Math.min(poiNamedTotal, pool.filter((l) => l.type === "poi").length),
      storedCityLinks: pool.filter((l) => l.type === "settlement" && !!l.drillDownUrl).length,
    },
  }
}

// Import curation: a DM's OWN world. Keep the most prominent pins up to the cap,
// with the settlement/POI MIX preserved (POIs rank by prominence, NOT culled to a
// fixed share — a DM's markers are likely deliberate, unlike preset bulk).
export function curateForImport(
  parsed: ParsedMap,
  maxPins: number = PRESET_MAX_PINS,
): ParsedLocation[] {
  return [...parsed.settlements, ...parsed.pois]
    .sort((a, b) => b.prominence - a.prominence)
    .slice(0, maxPins)
}
