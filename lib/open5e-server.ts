// Server-side Open5e SRD lookups for the DM Assistant's tool-calling.
//
// WHY THIS EXISTS (and isn't lib/open5e-api.ts): the existing client is
// IndexedDB-cached and therefore browser-only. The DM Assistant route runs on
// the server, so it can't reach that cache — it needs its own plain fetch against
// the public Open5e API (api.open5e.com, no auth). These helpers return COMPACT,
// already-summarized objects so the model gets clean SRD facts without the full
// payload bloating the context.
//
// EDITION: Open5e's `wotc-srd` document is the 2014 SRD 5.1. 2024 (5.2) coverage
// is partial, so the route's system prompt tells the model to caveat 2024-specific
// details. Slot/stat data here is 2014-accurate.

const API_BASE = "https://api.open5e.com"
const SRD = "wotc-srd" // document__slug filter → only the official SRD
const TIMEOUT_MS = 8_000

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
  url.searchParams.set("document__slug", SRD)
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
): Promise<T | null> {
  let results = await fetchList<T>(endpoint, { name__icontains: query })
  if (!results.length) results = await fetchList<T>(endpoint, { search: query })
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
  level: string
  school: string
  casting_time: string
  range: string
  components: string
  material?: string
  duration: string
  concentration: string
  ritual: string
  desc: string
  higher_level?: string
}

export async function lookupSpell(name: string): Promise<string> {
  const s = await findOne<Open5eSpellRaw>("/v1/spells/", name, (r) => r.name)
  if (!s) return `No SRD spell found matching "${name}".`
  const lines = [
    `**${s.name}** — ${s.level}, ${s.school}`,
    `Casting time: ${s.casting_time} · Range: ${s.range} · Duration: ${s.duration}${s.concentration === "true" ? " (concentration)" : ""}`,
    `Components: ${s.components}${s.material ? ` (${s.material})` : ""}${s.ritual === "true" ? " · Ritual" : ""}`,
    clip(s.desc),
  ]
  if (s.higher_level) lines.push(`At higher levels: ${clip(s.higher_level, 300)}`)
  return lines.filter(Boolean).join("\n")
}

// ── Monsters ─────────────────────────────────────────────────────────────────

interface Open5eMonsterRaw {
  name: string
  size: string
  type: string
  alignment: string
  armor_class: number
  hit_points: number
  hit_dice: string
  speed: Record<string, number>
  strength: number
  dexterity: number
  constitution: number
  intelligence: number
  wisdom: number
  charisma: number
  challenge_rating: string
  senses: string
  languages: string
  actions?: { name: string; desc: string }[]
}

export async function lookupMonster(name: string): Promise<string> {
  const m = await findOne<Open5eMonsterRaw>("/v1/monsters/", name, (r) => r.name)
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
  type: string
  rarity: string
  requires_attunement: string
  desc: string
}

export async function lookupItem(name: string): Promise<string> {
  const i = await findOne<Open5eMagicItemRaw>("/v1/magicitems/", name, (r) => r.name)
  if (!i) return `No SRD magic item found matching "${name}".`
  const attune = i.requires_attunement ? ` (requires attunement${i.requires_attunement.replace(/^requires attunement/i, "").trim() ? ` ${i.requires_attunement.replace(/^requires attunement/i, "").trim()}` : ""})` : ""
  return [
    `**${i.name}** — ${i.type}, ${i.rarity}${attune}`,
    clip(i.desc, 800),
  ].join("\n")
}

// ── Conditions ───────────────────────────────────────────────────────────────

interface Open5eConditionRaw {
  name: string
  desc: string
}

export async function lookupCondition(name: string): Promise<string> {
  const c = await findOne<Open5eConditionRaw>("/v1/conditions/", name, (r) => r.name)
  if (!c) return `No SRD condition found matching "${name}".`
  return [`**${c.name}**`, clip(c.desc, 800)].join("\n")
}
