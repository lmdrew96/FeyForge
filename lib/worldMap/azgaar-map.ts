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

// Render cap: how many pins a campaign map stores + renders (mirrors MAX_PINS in
// convex/worldMap.ts). Imports store up to this; adoptPreset never clones more.
export const PRESET_MAX_PINS = 100
// Preset POOL size: how many pins a seeded PRESET row holds. This is NOT rendered
// wholesale — adoptPreset weighted-samples a campaign's density tier (≤ PRESET_MAX_PINS)
// FROM this pool, so a bigger pool means more variety / fewer repeats across
// campaigns (a 100-pool sampled at the 100 "mega" tier hands every campaign the
// SAME pins). Density tiers are unchanged; only the draw is deeper. ⚠️ Re-seed to
// apply. Presets lean settlement: POIs capped at POI_POOL_SHARE of the pool.
export const PRESET_POOL_MAX = 250
export const POI_POOL_SHARE = 1 / 3
// Target share of NON-settlement pins in the FINAL map (import + adopt). Maps are
// POI-poor (hundreds of settlements, dozens of POIs), so unweighted selection
// drowns the POIs out — we stratify to guarantee this share, capped by how many
// POIs the map actually has. Combat/quest pins fill it first (prominence). Keep in
// sync with TARGET_POI_SHARE in convex/worldMap.ts (the adopt-sampling mirror).
export const TARGET_POI_SHARE = 0.4

// FeyForge POI subtypes — the ~25 Azgaar marker types collapsed into a handful of
// game-meaningful kinds. Drives the pin icon (SVG, not Azgaar's emoji) and which
// in-app action a pin offers (dungeon → drill-down map, encounter → AI/NPC, …).
// Keep in sync with poiKind in convex/schema.ts + POI_KIND_META in the map page.
export const POI_KINDS = ["dungeon", "ruin", "monster", "encounter", "npc", "tavern", "landmark"] as const
export type PoiKind = (typeof POI_KINDS)[number]

// Prominence by POI kind — the ONE lever feeding all three pin-thinning stages
// (curateForImport's top-N ranking, curateForPreset's POI ordering, and
// adoptPreset's prominence-weighted density sampling). Combat/quest pins are
// capital-tier (3.0) so they survive even at the smallest density — a DM picking
// "handful" wants the quest hooks, not 10 hamlets. Social/flavor sit BELOW towns
// (1.0–1.9) so the map stays settlement-lean and untyped markers rank last.
// (Was a flat 1.2 for every POI, tuned when settlements were the only priority —
// it silently starved the combat pins the encounter generator needs.)
const PROMINENCE_BY_POI_KIND: Record<PoiKind, number> = {
  npc: 3.0,
  encounter: 3.0,
  monster: 3.0,
  dungeon: 3.0,
  ruin: 2.8,
  tavern: 1.6,
  landmark: 1.1,
}
const POI_PROMINENCE_UNTYPED = 0.9 // unmapped marker type → below towns
export const prominenceForPoi = (poiKind?: PoiKind): number =>
  poiKind ? PROMINENCE_BY_POI_KIND[poiKind] : POI_PROMINENCE_UNTYPED

// Azgaar marker `type` → FeyForge PoiKind. Anything unmapped stays an untyped POI
// (falls back to the generic pin) so a new Azgaar marker type never breaks import.
const POI_KIND_FROM_MARKER: Record<string, PoiKind> = {
  dungeons: "dungeon",
  ruins: "ruin",
  necropolises: "ruin",
  "sea-monsters": "monster",
  "lake-monsters": "monster",
  "hill-monsters": "monster",
  encounters: "npc", // Azgaar "Random encounter" markers → first-party NPC (dealt server-side)
  brigands: "encounter", // creature/group fights stay generic encounters
  pirates: "encounter",
  migration: "encounter",
  inns: "tavern",
  fairs: "tavern",
  circuses: "tavern",
  jousts: "tavern",
  statues: "landmark",
  lighthouses: "landmark",
  bridges: "landmark",
  libraries: "landmark",
  volcanoes: "landmark",
  waterfalls: "landmark",
  "water-sources": "landmark",
  "sacred-forests": "landmark",
  "sacred-pineries": "landmark",
  battlefields: "landmark",
  canoes: "landmark",
}

// Hosts we trust to embed a per-pin drill-down (dungeon map / premade-NPC) in an
// <iframe>. Azgaar itself emits these inside its marker legends. ALLOWLISTED so a
// hand-edited or malicious .map can't inject an arbitrary iframe src into the app.
// Only Watabou's One Page Dungeon is framed now. Deorum (encounter NPCs) was
// dropped in favor of a first-party NPC pool — see convex/npcPool.ts — so its
// host is no longer allowlisted and those markers carry no drill-down URL.
const DRILLDOWN_HOSTS = new Set(["watabou.github.io"])

// Pull the first allowlisted https URL out of a marker legend's raw HTML — Azgaar
// embeds a One Page Dungeon link as both an <iframe src> and an <a href>. Prefer
// the iframe src (the canonical embed), else the first anchor.
function extractDrillDownUrl(legendHtml: string): string | undefined {
  const candidates: string[] = []
  const iframe = legendHtml.match(/<iframe[^>]*\bsrc\s*=\s*["']([^"']+)["']/i)
  if (iframe) candidates.push(iframe[1])
  const hrefRe = /<a[^>]*\bhref\s*=\s*["']([^"']+)["']/gi
  let m: RegExpExecArray | null
  while ((m = hrefRe.exec(legendHtml))) candidates.push(m[1])
  for (const raw of candidates) {
    try {
      const u = new URL(raw)
      if (u.protocol === "https:" && DRILLDOWN_HOSTS.has(u.hostname)) return u.toString()
    } catch {
      // not a parseable absolute URL — skip
    }
  }
  return undefined
}

export type ParsedLocation = {
  type: "settlement" | "poi"
  name: string
  x: number // normalized 0–100
  y: number // normalized 0–100
  dmNotes?: string
  drillDownUrl?: string // MFCG city iframe URL (settlements); dungeon/NPC URL (POIs)
  poiKind?: PoiKind // POIs only — the game-meaningful subtype (icon + action)
  town?: TownMeta // settlements only — the gazetteer block (population, crest, realm…)
  prominence: number
}

// Settlement-only metadata lifted from the Azgaar burg (+ resolved state/culture).
// Display-only and NOT secret — rides to players on revealed pins, like the city
// link. Mirrors the `town` object in convex/schema.ts mapLocations.
export type TownMeta = {
  population?: number // real head count (Azgaar stores thousands)
  coa?: string // Armoria coat-of-arms spec (compact JSON) — rendered as <img> at view time
  realm?: string // owning state's fullName, e.g. "Kingdom of Bogen" (neutral state omitted)
  government?: string // state government TYPE, e.g. "Monarchy" (Azgaar `form`)
  culture?: string // culture/people name, e.g. "Yardish" (neutral/wildlands omitted)
  features?: string[] // ["Capital","Port","Walled","Citadel","Temple","Market","Shantytown"]
}

// A named active world event (Azgaar "zone": invasions, plagues, eruptions, …).
// World-level, not a pin — stored on the worldMaps row, DM-only. name + type only
// (Azgaar zones carry no prose; the evocative name + category IS the hook).
// A settlement an event affects — enough to MINT a full pin if the DM clicks "+",
// since a town beyond the preset's stored set exists nowhere else in Convex.
export type EventPlace = {
  name: string
  x: number // normalized 0–100 (same space as mapLocations) — matches the burg's pin if it exists
  y: number
  drillDownUrl?: string // MFCG city link, so an added town gets the city drill-down too
  town?: TownMeta // gazetteer (population/crest/realm/…) so an added pin is first-class
}

export type ZoneInfo = {
  name: string
  type: string // Invasion | Rebels | Proselytism | Crusade | Disease | Disaster | Eruption | Fault | Flood | Avalanche | Tsunami | …
  // # of Azgaar pack cells the zone spans — a relative geographic-reach signal, shown
  // as a Localized/Regional/Widespread "scope" badge. Counts assume Azgaar's default
  // ~10k-cell resolution (true of every map we've seen); the bands live UI-side
  // (eventScope() in the map page) so they retune without a reseed.
  cellCount?: number
  places?: EventPlace[] // settlements in the event's cells (top by population) — jump-link or "+ add"
}

// A travel route from Azgaar's pack.routes. UNLIKE rivers/zones (cell-index only,
// geometry regenerated from the seed → no offline coordinates), routes store an
// explicit point polyline, so they CAN be drawn and measured. `points` are 0–100 %
// (the same space as pins); `miles` is the polyline length × scaleMilesPerPx, and
// is omitted when the map has no usable scale. World-level, not secret.
export type RouteInfo = {
  group: string // "roads" | "trails" | "searoutes" (land vs sea; verified across 21 maps)
  // Each point is [x%, y%, cellId?]: x/y are 0–100 (burg/pin space) for drawing; the
  // optional cellId is Azgaar's pack-cell index — the junction key that lets segments
  // be stitched into a graph for point-to-point routing (lib/worldMap/routing.ts).
  points: number[][]
  miles?: number // whole-segment length (Σ px × scaleMilesPerPx); routing recomputes per-edge
}

// A realm (Azgaar state) for the "Realms & Faiths" worldbuilding panel. No geometry —
// indices (capital burg, culture) are resolved to names at parse time. World-level.
export type RealmInfo = {
  name: string // fullName ("Ocrafren Kingdom") or plain name
  form?: string // government type (Monarchy, Theocracy, …)
  capital?: string // capital settlement name
  culture?: string // dominant culture/people
  population?: number // urban + rural head count
  coa?: string // Armoria coat-of-arms spec (rendered as <img>, like burgs)
  color?: string // realm map color (a swatch in the panel)
  provinces?: number // sub-division count
  campaigns?: string[] // historical war/campaign names (flavor)
  relations?: { relation: string; realm: string }[] // diplomacy → named realms (ally/enemy/…)
}

// A faith (Azgaar religion) for the same panel.
export type FaithInfo = {
  name: string
  type?: string // Folk | Organized | Cult | Heresy
  form?: string // Shamanism | Polytheism | Monotheism | …
  deity?: string // named god(s), when the faith has one
  color?: string
  culture?: string // associated culture, when resolved
  expansion?: string // human-readable spread mode (cultural / state / worldwide)
  origin?: string // parent faith name, when this one descends from another
}

// Azgaar's GRID heightmap: a regular `cols × rows` lattice (≈129×78), one height
// 0–100 per cell (≥20 = land). Powers Phase-2 "terrain GPS" routing — crossing open
// water (or trackless land) where no route/searoute is drawn. A regular grid has
// IMPLICIT adjacency (cell i → col = i % cols, row = ⌊i / cols⌋), so no neighbor list
// or centroid is stored. `heights` is a base64-encoded byte-per-cell array (row-major):
// ~10k cells → ~13KB string, well under Convex's 1MB value cap and its 8192-element
// ARRAY cap (why a string, not number[]). Optional — maps without it route via Phase 1.
export type HeightGridData = {
  cols: number
  rows: number
  heights: string // base64 of a Uint8Array, length === cols*rows, each 0–100
}

export type ParsedMap = {
  width: number
  height: number
  scaleMilesPerPx?: number
  settlements: ParsedLocation[]
  pois: ParsedLocation[]
  poiNamedTotal: number // POIs that resolved a real name (not a type fallback) — for seed reporting
  zones: ZoneInfo[] // named active world events (DM-only)
  routes: RouteInfo[] // roads/trails/searoutes polylines for the travel overlay
  realms: RealmInfo[] // Azgaar states → "Realms & Faiths" panel
  faiths: FaithInfo[] // Azgaar religions → "Realms & Faiths" panel
  heightGrid?: HeightGridData // Azgaar grid heightmap (Phase-2 terrain routing); absent on old formats
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
  cell?: number // the pack cell this burg sits in (used to anchor zones → places)
  state?: number // index into the states array (0 = neutral)
  culture?: number // index into the cultures array (0 = wildlands)
  coa?: unknown // Armoria coat-of-arms spec (object) or "custom"
}
type Marker = { type?: string; x: number; y: number; cell?: number; i: number }
type Note = { id: string; name: string; legend: string }
// Subsets of Azgaar's pack.states / pack.cultures (index 0 of each is the neutral
// placeholder). Resolved by burg.state / burg.culture into the town gazetteer.
type State = {
  i?: number
  name?: string
  fullName?: string
  form?: string // government type, e.g. "Monarchy"
  removed?: boolean
  capital?: number // capital burg index
  culture?: number // culture index
  coa?: unknown // Armoria coat-of-arms spec (object)
  color?: string
  urban?: number // urban population (thousands)
  rural?: number // rural population (thousands)
  provinces?: number[] // province indices
  campaigns?: { name?: string; start?: number; end?: number }[] // historical wars
  diplomacy?: string[] // relation to each state by index (Ally/Enemy/Vassal/…)
}
type Culture = { i?: number; name?: string; removed?: boolean }
type Religion = {
  i?: number
  name?: string
  type?: string // Folk | Organized | Cult | Heresy
  form?: string // Shamanism | Polytheism | Monotheism | …
  deity?: string | null // named god(s); null/"No religion" for deity-less folk faiths
  culture?: number
  color?: string
  removed?: boolean
  expansion?: string // how it spreads: "culture" | "state" | "global"
  origins?: number[] // parent religion ids (lineage); first >0 is the direct parent
}
type Zone = { i?: number; name?: string; type?: string; cells?: number[] }
type Route = { i?: number; group?: string; feature?: number; points?: number[][] }

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

// Base64-encode a byte array (browser + Node ≥16 via global btoa). Chunked so a large
// grid (~10k bytes) doesn't blow the String.fromCharCode argument-count limit.
function encodeBytesBase64(bytes: Uint8Array): string {
  let bin = ""
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}

// Pull Azgaar's GRID heightmap out of the raw `.map` for Phase-2 terrain routing.
// The grid-general object is the lone {…} line carrying numeric cellsX/cellsY/spacing;
// grid.cells.h is the FIRST bare comma-number line after it whose field count ===
// cols*rows (Azgaar always serializes heights first among the grid cell arrays). These
// bare lines never start with `[`, so the main signature loop skips them — we scan
// here. Returns undefined on any older/odd layout → the map just routes via Phase 1.
function extractHeightGrid(lines: string[]): HeightGridData | undefined {
  let cols = 0
  let rows = 0
  let gridLine = -1
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trimStart()
    if (!t.startsWith("{")) continue
    try {
      const o = JSON.parse(t) as Record<string, unknown>
      if (typeof o.cellsX === "number" && typeof o.cellsY === "number" && typeof o.spacing === "number") {
        cols = o.cellsX
        rows = o.cellsY
        gridLine = i
        break
      }
    } catch {
      // not the grid object — keep scanning
    }
  }
  if (gridLine < 0 || cols < 1 || rows < 1) return undefined
  const need = cols * rows
  for (let i = gridLine + 1; i < Math.min(gridLine + 12, lines.length); i++) {
    const ln = lines[i]
    if (!/^\s*-?\d/.test(ln)) continue // not a bare-number array line
    const parts = ln.split(",")
    if (parts.length !== need) continue // wrong array (prec/feature/temp/…) — heights is first
    const bytes = new Uint8Array(need)
    for (let k = 0; k < need; k++) {
      const v = parseInt(parts[k], 10)
      bytes[k] = v > 0 ? (v > 255 ? 255 : v) : 0 // heights are 0–100; clamp defensively
    }
    return { cols, rows, heights: encodeBytesBase64(bytes) }
  }
  return undefined
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

  // Detect the burgs / markers / notes / states / cultures arrays by element-key
  // signature (line indices shift with version + SVG size, so never key off them).
  let burgs: Burg[] = []
  let markers: Marker[] = []
  let notes: Note[] = []
  let states: State[] = []
  let cultures: Culture[] = []
  let zones: Zone[] = []
  let routes: Route[] = []
  let religions: Religion[] = []
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
    // Pick the RICHEST object as the signature sample: index 0 of states/cultures
    // (and burgs) is a thin neutral/placeholder stub that lacks the keys we match
    // on, so sampling the first object would mis-detect those arrays as nothing.
    let sample: Record<string, unknown> | undefined
    let sampleKeys = 0
    for (const e of arr) {
      if (e && typeof e === "object" && !Array.isArray(e)) {
        const n = Object.keys(e).length
        if (n > sampleKeys) {
          sample = e as Record<string, unknown>
          sampleKeys = n
        }
      }
    }
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
    } else if (
      // States: governments. `form`+`fullName`+`formName` together are unique —
      // provinces carry fullName/formName but NOT `form`; cultures have neither.
      states.length === 0 &&
      "form" in sample &&
      "fullName" in sample &&
      "formName" in sample
    ) {
      states = arr as State[]
    } else if (
      // Cultures: `base`+`shield`+`code` appear on no other pack array.
      cultures.length === 0 &&
      "base" in sample &&
      "shield" in sample &&
      "code" in sample &&
      !("form" in sample)
    ) {
      cultures = arr as Culture[]
    } else if (
      // Zones: named active world events. cells+color+name+type, but WITHOUT the
      // distinguishing keys of features (area/border), rivers (discharge/length),
      // states (form), notes (legend), cultures (base), or markers (icon).
      zones.length === 0 &&
      "cells" in sample &&
      "type" in sample &&
      "color" in sample &&
      "name" in sample &&
      !("area" in sample) &&
      !("discharge" in sample) &&
      !("length" in sample) &&
      !("form" in sample) &&
      !("legend" in sample) &&
      !("base" in sample) &&
      !("icon" in sample)
    ) {
      zones = arr as Zone[]
    } else if (
      // Routes: the ONLY pack array whose elements carry BOTH `group` and `points`
      // (roads/trails/searoutes polylines). Verified unique across 21 real maps.
      routes.length === 0 &&
      "group" in sample &&
      "points" in sample
    ) {
      routes = arr as Route[]
    } else if (
      // Religions: only the religions array carries `deity`. Folk faiths can have
      // deity:null but the key is present — richest-sample detection handles it.
      religions.length === 0 &&
      "deity" in sample
    ) {
      religions = arr as Religion[]
    }
  }

  // Resolve a burg's owning state (skip the neutral state at index 0 / name
  // "Neutrals", and any removed state) into a display realm + government type.
  const realmOf = (b: Burg): { realm?: string; government?: string } => {
    const s = typeof b.state === "number" && b.state > 0 ? states[b.state] : undefined
    if (!s || s.removed || !s.name || s.name === "Neutrals") return {}
    return { realm: (s.fullName || s.name)?.trim() || undefined, government: s.form?.trim() || undefined }
  }
  // Resolve a burg's culture (skip neutral/wildlands at index 0 and removed ones).
  const cultureOf = (b: Burg): string | undefined => {
    const c = typeof b.culture === "number" && b.culture > 0 ? cultures[b.culture] : undefined
    if (!c || c.removed || !c.name) return undefined
    return sanitizeText(c.name.trim()) || undefined
  }
  // Burg amenity flags → display chips (Capital first, then the rest in read order).
  const featuresOf = (b: Burg): string[] => {
    const f: string[] = []
    if (b.capital === 1) f.push("Capital")
    if (b.port) f.push("Port")
    if (b.walls) f.push("Walled")
    if (b.citadel) f.push("Citadel")
    if (b.temple) f.push("Temple")
    if (b.plaza) f.push("Market")
    if (b.shanty) f.push("Shantytown")
    return f
  }
  // Coat of arms → compact JSON string (Armoria spec). Skip "custom"/non-objects.
  const coaOf = (b: Burg): string | undefined => {
    if (!b.coa || typeof b.coa !== "object" || Array.isArray(b.coa)) return undefined
    try {
      return JSON.stringify(b.coa)
    } catch {
      return undefined
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
    // Gazetteer block — only include keys that resolved (an all-empty town is omitted).
    const { realm, government } = realmOf(b)
    const culture = cultureOf(b)
    const features = featuresOf(b)
    const coa = coaOf(b)
    const town: TownMeta = {}
    if (popThousands > 0) town.population = Math.round(popThousands * 1000)
    if (coa) town.coa = coa
    if (realm) town.realm = realm
    if (government) town.government = government
    if (culture) town.culture = culture
    if (features.length) town.features = features
    return {
      type: "settlement" as const,
      name: cleanName,
      x: clampPct((b.x / width) * 100),
      y: clampPct((b.y / height) * 100),
      town: Object.keys(town).length > 0 ? town : undefined,
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

  // World events (Azgaar "zones"): named active situations resolved to the
  // settlements in their cells. Azgaar stores no per-cell coordinates (geometry is
  // regenerated from the seed), so the burgs sitting in a zone's cells are the only
  // reliable "where". Each affected town carries a full pin payload (coords + city
  // link + gazetteer) so the DM can mint a real pin from it on demand. Built AFTER
  // `settlements` so we reuse those records rather than recompute. Deduped by
  // name+type (Azgaar emits the same proselytism/conflict twice for split clusters).
  const PLACES_PER_EVENT = 6
  const settlementByCell = new Map<number, ParsedLocation>()
  realBurgs.forEach((b, idx) => {
    if (typeof b.cell === "number" && !settlementByCell.has(b.cell)) {
      settlementByCell.set(b.cell, settlements[idx])
    }
  })
  const seenZone = new Set<string>()
  const zoneInfos: ZoneInfo[] = []
  for (const z of zones) {
    const name = z && typeof z.name === "string" ? sanitizeText(z.name.trim()) : ""
    const type = z && typeof z.type === "string" ? z.type.trim() : ""
    if (!name || !type) continue
    const key = `${name}|${type}`
    if (seenZone.has(key)) continue
    seenZone.add(key)
    // Cell span = the event's geographic reach. Azgaar emits split-cluster events
    // twice (same name+type); we keep the first occurrence here, matching how
    // `places` already only reflect that first cluster — a fine proxy for a badge.
    const cellCount = Array.isArray(z.cells) ? z.cells.length : 0
    const byName = new Map<string, ParsedLocation>()
    for (const c of z.cells ?? []) {
      const s = typeof c === "number" ? settlementByCell.get(c) : undefined
      if (s && !byName.has(s.name)) byName.set(s.name, s)
    }
    const places: EventPlace[] = [...byName.values()]
      .sort((a, b) => (b.town?.population ?? 0) - (a.town?.population ?? 0))
      .slice(0, PLACES_PER_EVENT)
      .map((s) => ({ name: s.name, x: s.x, y: s.y, drillDownUrl: s.drillDownUrl, town: s.town }))
    const info: ZoneInfo = { name, type }
    if (cellCount > 0) info.cellCount = cellCount
    if (places.length > 0) info.places = places
    zoneInfos.push(info)
  }

  // POIs: markers, named via the paired note (id === `marker${i}`); the note's
  // legend seeds dmNotes (DM-secret). Fall back to a title-cased marker type when
  // there's no note. Prominence is kind-based (prominenceForPoi) so combat/quest
  // pins survive curation + density sampling.
  const noteById = new Map(notes.map((n) => [n.id, n]))
  let poiNamedTotal = 0
  const pois: ParsedLocation[] = markers
    .filter((m) => m && typeof m === "object" && typeof m.x === "number" && typeof m.y === "number")
    .map((m) => {
      const note = noteById.get(`marker${m.i}`)
      const named = !!note?.name?.trim()
      if (named) poiNamedTotal++
      const rawLegend = note?.legend ? sanitizeText(note.legend.trim()) : ""
      // Azgaar legends are HTML; convert to clean Markdown at parse time. The embed
      // URL is extracted from the RAW HTML first (htmlToMarkdown drops <iframe>s).
      const legend = rawLegend ? htmlToMarkdown(rawLegend) : ""
      const drillDownUrl = rawLegend ? extractDrillDownUrl(rawLegend) : undefined
      const poiKind = POI_KIND_FROM_MARKER[String(m.type ?? "")]
      const isNpc = poiKind === "npc"
      return {
        type: "poi" as const,
        // NPC pins get the real NPC's name server-side at import/adopt; until then
        // a clean placeholder, never Azgaar's generic "Random encounter".
        name: isNpc
          ? "NPC Encounter"
          : sanitizeText(named ? note!.name.trim() : titleCase(String(m.type ?? ""))),
        x: clampPct((m.x / width) * 100),
        y: clampPct((m.y / height) * 100),
        // NPC markers carry only Deorum boilerplate ("You have encountered a
        // character.") — drop it; the dealt NPC's bio is the content.
        dmNotes: isNpc ? undefined : legend.length > 0 ? legend : undefined,
        // A dungeon pin's drill-down is a DM secret — listLocations strips it from
        // the player payload (unlike a settlement's city link). NPC pins get none.
        drillDownUrl,
        poiKind,
        prominence: prominenceForPoi(poiKind),
      }
    })

  // Travel routes (Azgaar pack.routes): roads/trails/searoutes. Each point is native
  // px in the same space as burgs → convert to 0–100 % (like pins). Length in miles =
  // Σ segment px-distance × scaleMilesPerPx (computed from the raw px BEFORE the %
  // conversion; omitted when the map has no usable scale). Round % to 2 decimals
  // (~0.15px on a 1500px map — plenty for line drawing) to keep the stored doc lean.
  const r2 = (v: number): number => Math.round(v * 100) / 100
  const routeInfos: RouteInfo[] = []
  for (const rt of routes) {
    const valid = (Array.isArray(rt.points) ? rt.points : []).filter(
      (p): p is number[] => Array.isArray(p) && typeof p[0] === "number" && typeof p[1] === "number",
    )
    if (valid.length < 2) continue
    let px = 0
    for (let k = 1; k < valid.length; k++) {
      px += Math.hypot(valid[k][0] - valid[k - 1][0], valid[k][1] - valid[k - 1][1])
    }
    // Keep the cellId (p[2]) alongside the % coords — it's the junction key for
    // routing. Points missing a numeric cell stay 2-element (just won't graph-join).
    const points = valid.map((p) => {
      const pt = [r2((p[0] / width) * 100), r2((p[1] / height) * 100)]
      if (typeof p[2] === "number") pt.push(p[2])
      return pt
    })
    const info: RouteInfo = {
      group: typeof rt.group === "string" ? rt.group : "roads",
      points,
    }
    if (scaleMilesPerPx) info.miles = Math.round(px * scaleMilesPerPx * 10) / 10
    routeInfos.push(info)
  }

  // Realms (states) + faiths (religions) for the worldbuilding panel. No geometry —
  // resolve indices (capital burg, culture) to names. Skip the neutral state /
  // "No religion" placeholders + removed entries.
  const cultureNameOf = (idx: number | undefined): string | undefined => {
    if (typeof idx !== "number" || idx <= 0) return undefined
    const c = cultures[idx]
    if (!c || c.removed || !c.name) return undefined
    return sanitizeText(c.name.trim()) || undefined
  }
  // Diplomacy relations worth surfacing (skip Neutral/Unknown/Suspicion noise) + the
  // human-readable religion spread modes.
  const NOTABLE_RELS = new Set(["Ally", "Friendly", "Enemy", "Rival", "Vassal", "Suzerain"])
  const EXPANSION_LABEL: Record<string, string> = {
    culture: "Spreads along cultural lines",
    state: "State religion",
    global: "Spreads worldwide",
  }
  const realms: RealmInfo[] = states
    .filter((s) => s && !s.removed && !!s.name && s.name !== "Neutrals" && (s.i ?? 0) > 0)
    .map((s) => {
      const cap = typeof s.capital === "number" ? burgs[s.capital] : undefined
      const pop = Math.round(((s.urban ?? 0) + (s.rural ?? 0)) * 1000)
      const r: RealmInfo = { name: sanitizeText((s.fullName || s.name || "").trim()) }
      if (s.form) r.form = s.form
      if (cap?.name) r.capital = sanitizeText(cap.name.trim())
      const culture = cultureNameOf(s.culture)
      if (culture) r.culture = culture
      if (pop > 0) r.population = pop
      if (s.coa && typeof s.coa === "object" && !Array.isArray(s.coa)) {
        try {
          r.coa = JSON.stringify(s.coa)
        } catch {
          // unserializable coa — skip
        }
      }
      if (s.color) r.color = s.color
      if (s.provinces?.length) r.provinces = s.provinces.length
      const wars = (s.campaigns ?? []).map((c) => c?.name).filter((n): n is string => !!n)
      if (wars.length) r.campaigns = wars.map((w) => sanitizeText(w))
      // Diplomacy → named realms. diplomacy[j] is this state's stance toward state j.
      const relations = (s.diplomacy ?? [])
        .map((relation, j) => ({ relation, j }))
        .filter(
          ({ relation, j }) =>
            NOTABLE_RELS.has(relation) &&
            j !== s.i &&
            !!states[j] &&
            !states[j].removed &&
            !!states[j].name &&
            states[j].name !== "Neutrals",
        )
        .map(({ relation, j }) => ({
          relation,
          realm: sanitizeText((states[j].fullName || states[j].name || "").trim()),
        }))
        .filter((rel) => !!rel.realm)
      if (relations.length) r.relations = relations
      return r
    })
    .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
  const faiths: FaithInfo[] = religions
    .filter((r) => r && !r.removed && !!r.name && r.name !== "No religion")
    .map((r) => {
      const f: FaithInfo = { name: sanitizeText(r.name!.trim()) }
      if (r.type) f.type = r.type
      if (r.form) f.form = r.form
      if (r.deity && r.deity !== "null") f.deity = sanitizeText(String(r.deity))
      if (r.color) f.color = r.color
      const culture = cultureNameOf(r.culture)
      if (culture) f.culture = culture
      if (r.expansion) f.expansion = EXPANSION_LABEL[r.expansion] ?? r.expansion
      const parentId = Array.isArray(r.origins)
        ? r.origins.find((o) => typeof o === "number" && o > 0)
        : undefined
      if (parentId != null) {
        const parent = religions[parentId]
        if (parent?.name && parent.name !== "No religion") f.origin = sanitizeText(parent.name.trim())
      }
      return f
    })

  return {
    width,
    height,
    scaleMilesPerPx,
    settlements,
    pois,
    poiNamedTotal,
    zones: zoneInfos,
    routes: routeInfos,
    realms,
    faiths,
    heightGrid: extractHeightGrid(lines),
  }
}

// Preset curation: settlement-leaning, capped to the POOL size (the sampling
// source, not the render cap). POIs ≤ POI_POOL_SHARE of the cap (combat/quest pins
// first via prominence), the rest = top settlements by prominence.
export function curateForPreset(
  parsed: ParsedMap,
  maxPins: number = PRESET_POOL_MAX,
  poiShare: number = POI_POOL_SHARE,
): { locations: ParsedLocation[]; stats: PresetStats } {
  const { settlements, pois, poiNamedTotal } = parsed
  const candidates = settlements.length + pois.length
  const keptPois = [...pois]
    // Combat/quest kinds first (kind-based prominence), legend-bearing pins as the
    // tiebreak — so the capped POI slots aren't filled by flavor in marker order.
    .sort((a, b) => b.prominence - a.prominence || (b.dmNotes ? 1 : 0) - (a.dmNotes ? 1 : 0))
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

// Import curation: a DM's OWN world. Stratified to TARGET_POI_SHARE so the DM's
// markers (encounters/dungeons) aren't crowded out by the hundreds of settlements
// when capping to maxPins — POIs fill their share by prominence (combat/quest
// first), settlements take the rest. POI share is capped by how many POIs exist.
export function curateForImport(
  parsed: ParsedMap,
  maxPins: number = PRESET_MAX_PINS,
): ParsedLocation[] {
  const poiTarget = Math.min(parsed.pois.length, Math.round(maxPins * TARGET_POI_SHARE))
  const keptPois = [...parsed.pois].sort((a, b) => b.prominence - a.prominence).slice(0, poiTarget)
  const keptSettlements = [...parsed.settlements]
    .sort((a, b) => b.prominence - a.prominence)
    .slice(0, maxPins - keptPois.length)
  return [...keptSettlements, ...keptPois]
}
