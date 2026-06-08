// Server-side Open5e SRD lookups for the DM Assistant's tool-calling.
//
// WHY THIS EXISTS (and isn't lib/open5e-api.ts): the existing client is
// IndexedDB-cached and therefore browser-only. The DM Assistant route runs on
// the server, so it can't reach that cache — it needs its own plain fetch against
// the public Open5e API (api.open5e.com, no auth). These helpers return COMPACT,
// already-summarized objects so the model gets clean SRD facts without the full
// payload bloating the context.
//
// EDITION: FeyForge serves the 2024 SRD (5.2). v2's edition filter is inconsistent
// per endpoint (spells/conditions honor document__key, magicitems honors document=),
// so each lookup passes its own working filter. Monsters come from the baked bundle.

import srdMonstersJson from "./data/srd-monsters.json"
import type { Open5eMonster } from "./open5e-api"

const API_BASE = "https://api.open5e.com"
const SRD_DOC = "srd-2024" // v2 document key for the 2024 SRD
const COND_DOC = "core" // conditions live under the shared "core" document
const TIMEOUT_MS = 8_000

// The baked SRD creature set (edition per the bundle). Static import is fine here —
// this lib only runs server-side (DM Assistant route), so it never ships to a client.
const SRD_MONSTERS = srdMonstersJson as unknown as Open5eMonster[]

interface Paginated<T> {
  results: T[]
}

// One small fetch against an Open5e list endpoint, filtered to the SRD. Returns the
// results array (empty on any network/timeout/HTTP failure, so a lookup degrades to
// "not found" rather than throwing into the model's tool loop).
async function fetchList<T>(
  endpoint: string,
  params: Record<string, string>,
): Promise<T[]> {
  const url = new URL(`${API_BASE}${endpoint}`)
  url.searchParams.set("limit", "20")
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url.toString(), { signal: controller.signal })
    if (!res.ok) return []
    const data = (await res.json()) as Paginated<T>
    return data.results ?? []
  } catch {
    return []
  } finally {
    clearTimeout(timeout)
  }
}

// Open5e's full-text `search` ranks fuzzily — "Fireball" can surface "Antimagic
// Field" first — so it's unsafe to trust results[0]. Instead we filter by NAME
// (name__icontains, precise) and rank exact > prefix > substring, preferring the
// shortest (closest) name on ties. Falls back to `search` only when the name filter
// finds nothing, so a precise query never gets a fuzzy mismatch.
function pickBest<T>(results: T[], query: string, getName: (r: T) => string): T | null {
  if (!results.length) return null
  const q = query.trim().toLowerCase()
  const scored = results.map((r) => {
    const n = getName(r).trim().toLowerCase()
    let score = 0
    if (n === q) score = 4
    else if (n.startsWith(q)) score = 3
    else if (q.startsWith(n)) score = 2
    else if (n.includes(q)) score = 1
    return { r, score, len: n.length }
  })
  scored.sort((a, b) => b.score - a.score || a.len - b.len)
  return scored[0].r
}

async function findOne<T>(
  endpoint: string,
  query: string,
  getName: (r: T) => string,
  doc: Record<string, string>, // per-endpoint edition filter (varies on v2)
): Promise<T | null> {
  let results = await fetchList<T>(endpoint, { ...doc, name__icontains: query })
  if (!results.length) results = await fetchList<T>(endpoint, { ...doc, search: query })
  return pickBest(results, query, getName)
}

// Trim Open5e desc prose so a stat block doesn't dominate the prompt. Keeps it
// readable; the model can ask the DM if they need the full text.
const clip = (text: string | undefined, max = 600): string => {
  if (!text) return ""
  const t = text.trim()
  return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t
}

// ── Spells ───────────────────────────────────────────────────────────────────

interface Open5eSpellRaw {
  name: string
  level?: number
  school?: { name?: string }
  casting_time?: string
  range_text?: string
  duration?: string
  concentration?: boolean
  ritual?: boolean
  verbal?: boolean
  somatic?: boolean
  material?: boolean
  material_specified?: string
  desc?: string
  higher_level?: string
}

export async function lookupSpell(name: string): Promise<string> {
  const s = await findOne<Open5eSpellRaw>("/v2/spells/", name, (r) => r.name, {
    document__key: SRD_DOC,
  })
  if (!s) return `No SRD spell found matching "${name}".`
  const lvl = s.level ?? 0
  const levelLabel = lvl === 0 ? "Cantrip" : `Level ${lvl}`
  const comps = [s.verbal && "V", s.somatic && "S", s.material && "M"].filter(Boolean).join(", ")
  const lines = [
    `**${s.name}** — ${levelLabel}, ${s.school?.name ?? ""}`,
    `Casting time: ${s.casting_time ?? "—"} · Range: ${s.range_text ?? "—"} · Duration: ${s.duration ?? "—"}${s.concentration ? " (concentration)" : ""}`,
    `Components: ${comps}${s.material && s.material_specified ? ` (${s.material_specified})` : ""}${s.ritual ? " · Ritual" : ""}`,
    clip(s.desc),
  ]
  if (s.higher_level) lines.push(`At higher levels: ${clip(s.higher_level, 300)}`)
  return lines.filter(Boolean).join("\n")
}

// ── Monsters ─────────────────────────────────────────────────────────────────
// Served from the self-hosted SRD bundle (scripts/seed-monsters.ts), same as the
// combat tracker — the DM Assistant must not depend on the live API either, and the
// bundle IS the complete SRD set. Edition follows the bundle (currently srd-2024).

export async function lookupMonster(name: string): Promise<string> {
  const m = pickBest(SRD_MONSTERS, name, (r) => r.name)
  if (!m) return `No SRD monster found matching "${name}".`
  const speed = Object.entries(m.speed ?? {})
    .map(([k, v]) => (k === "walk" ? `${v} ft.` : `${k} ${v} ft.`))
    .join(", ")
  const abilities = `STR ${m.strength}, DEX ${m.dexterity}, CON ${m.constitution}, INT ${m.intelligence}, WIS ${m.wisdom}, CHA ${m.charisma}`
  const lines = [
    `**${m.name}** — ${m.size} ${m.type}, ${m.alignment}`,
    `AC ${m.armor_class} · HP ${m.hit_points} (${m.hit_dice}) · Speed ${speed} · CR ${m.challenge_rating}`,
    abilities,
  ]
  if (m.senses) lines.push(`Senses: ${m.senses}`)
  const actions = (m.actions ?? []).slice(0, 6)
  if (actions.length) {
    lines.push("Actions:")
    for (const a of actions) lines.push(`- ${a.name}: ${clip(a.desc, 240)}`)
  }
  return lines.join("\n")
}

// ── Magic items ──────────────────────────────────────────────────────────────

interface Open5eMagicItemRaw {
  name: string
  category?: { name?: string }
  rarity?: { name?: string }
  requires_attunement?: boolean
  attunement_detail?: string | null
  desc?: string
}

export async function lookupItem(name: string): Promise<string> {
  const i = await findOne<Open5eMagicItemRaw>("/v2/magicitems/", name, (r) => r.name, {
    document: SRD_DOC, // magicitems honor `document=`, not `document__key=`
  })
  if (!i) return `No SRD magic item found matching "${name}".`
  const attune = i.requires_attunement
    ? ` (requires attunement${i.attunement_detail ? ` ${i.attunement_detail}` : ""})`
    : ""
  return [
    `**${i.name}** — ${i.category?.name ?? ""}, ${i.rarity?.name ?? ""}${attune}`,
    clip(i.desc, 800),
  ].join("\n")
}

// ── Conditions ───────────────────────────────────────────────────────────────
// Under the shared "core" document; each carries a per-gamesystem description array.

interface Open5eConditionRaw {
  name: string
  descriptions?: { desc?: string; gamesystem?: string }[]
}

export async function lookupCondition(name: string): Promise<string> {
  const c = await findOne<Open5eConditionRaw>("/v2/conditions/", name, (r) => r.name, {
    document__key: COND_DOC,
  })
  if (!c) return `No SRD condition found matching "${name}".`
  const descs = c.descriptions ?? []
  const pick =
    descs.find((d) => d.gamesystem === "5e-2024") ??
    descs.find((d) => (d.gamesystem ?? "").toLowerCase().startsWith("5e")) ??
    descs[0]
  return [`**${c.name}**`, clip(pick?.desc, 800)].join("\n")
}
