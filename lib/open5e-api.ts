// Open5e API client with IndexedDB caching

import { srdItemCost } from "./character/srd-item-costs"
import type { ItemCategory } from "./character/sheet-items"

const API_BASE = "https://api.open5e.com"
const DB_NAME = "arcane-codex-srd"
const DB_VERSION = 1
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

// SRD edition. FeyForge serves the 2024 SRD (5.2). Open5e's per-endpoint edition
// filtering is inconsistent (spells honor document__key, magicitems/items honor
// document=, weapons/armor honor neither), so every list is ALSO filtered client-side
// on the nested document.key — guaranteeing edition purity and excluding 3pp content.
// Conditions are the exception: they live under the shared "core" document, identical
// across editions. Flip SRD_DOC to "srd-2014" to serve the older edition.
const SRD_DOC = "srd-2024"
const COND_DOC = "core"

// Types for Open5e API responses
export interface Open5eSpell {
  slug: string
  name: string
  desc: string
  higher_level?: string
  page?: string
  range: string
  components: string
  material?: string
  ritual: string
  duration: string
  concentration: string
  casting_time: string
  level: string
  level_int: number
  school: string
  dnd_class: string
  archetype?: string
  circles?: string
  document__slug: string
  document__title: string
}

export interface Open5eMonster {
  slug: string
  name: string
  size: string
  type: string
  subtype?: string
  alignment: string
  armor_class: number
  armor_desc?: string
  hit_points: number
  hit_dice: string
  speed: Record<string, number>
  strength: number
  dexterity: number
  constitution: number
  intelligence: number
  wisdom: number
  charisma: number
  strength_save?: number
  dexterity_save?: number
  constitution_save?: number
  intelligence_save?: number
  wisdom_save?: number
  charisma_save?: number
  perception?: number
  skills?: Record<string, number>
  damage_vulnerabilities: string
  damage_resistances: string
  damage_immunities: string
  condition_immunities: string
  senses: string
  languages: string
  challenge_rating: string
  cr: number
  actions?: MonsterAction[]
  reactions?: MonsterAction[]
  legendary_actions?: MonsterAction[]
  special_abilities?: MonsterAction[]
  document__slug: string
  document__title: string
}

// A creature action/ability. Beyond name+desc, open5e exposes STRUCTURED attack
// fields on weapon-attack actions (verified live against the SRD): attack_bonus is
// the to-hit, damage_dice + damage_bonus the primary damage. They're absent on
// non-attacks (Multiattack, save-based breath weapons, traits), so treat them as
// optional and fall back to the desc prose. Damage TYPE and rider damage ("plus 7
// (2d6) fire damage") live only in the desc — see lib/monster-attacks.ts.
export interface MonsterAction {
  name: string
  desc: string
  attack_bonus?: number
  damage_dice?: string // e.g. "1d6" or "2d10"
  damage_bonus?: number
}

// ─── Open5e v2 creatures → Open5eMonster ─────────────────────────────────────
// v1 /monsters is deprecated; monsters now come from /v2/creatures, which has a
// completely different (nested) schema. We map v2 → the existing Open5eMonster
// shape at THIS boundary so the ~20 consumers and the attack parser stay unchanged.
//
// IMPORTANT — trust the PROSE, not v2's structured attack fields. Verified live on
// SRD-2014: v2's per-attack damage_type is hardcoded "Thunder" on ~96% of attacks,
// the flat damage_bonus is dropped on ~99%, and "plus X" riders are never
// populated. Only the desc prose is correct (same SRD text as v1). So we map each
// action to { name, desc } only and let lib/monster-attacks.ts parse the prose —
// exactly how homebrew (prose-only) monsters already roll correctly.

interface Open5eV2Action {
  name: string
  desc?: string
  action_type?: string // ACTION | LEGENDARY_ACTION | BONUS_ACTION | REACTION
}

interface Open5eV2Creature {
  key: string
  name: string
  size?: { name: string }
  type?: { name: string }
  subcategory?: string | null
  alignment?: string
  challenge_rating?: number
  armor_class?: number
  armor_detail?: string
  hit_points?: number
  hit_dice?: string
  speed?: Record<string, number | string | boolean>
  ability_scores?: Partial<Record<"strength" | "dexterity" | "constitution" | "intelligence" | "wisdom" | "charisma", number>>
  saving_throws?: Partial<Record<"strength" | "dexterity" | "constitution" | "intelligence" | "wisdom" | "charisma", number>>
  skill_bonuses?: Record<string, number>
  passive_perception?: number
  resistances_and_immunities?: Record<string, string | string[]>
  languages?: { as_string?: string }
  blindsight_range?: number | null
  darkvision_range?: number | null
  tremorsense_range?: number | null
  truesight_range?: number | null
  actions?: Open5eV2Action[]
  traits?: Open5eV2Action[]
  document?: { key?: string; name?: string }
}

// Normalize the light markdown v2 sprinkles into some action descs (e.g. a dragon's
// "**Fire Breath.**" breath-weapon sub-options) into plain SRD prose, so the attack
// parser's regexes see clean text and the combat panel doesn't render raw asterisks.
export function stripSrdMarkdown(s: string): string {
  return s
    .replace(/\r\n?/g, "\n")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`+/g, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[—–]/g, "-")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim()
}

// v2 serves CR as a number (0.5, 10.0); restore the SRD's fractional display.
function formatCr(cr: number | null | undefined): string {
  if (cr == null) return "0"
  if (cr === 0.125) return "1/8"
  if (cr === 0.25) return "1/4"
  if (cr === 0.5) return "1/2"
  return String(cr)
}

function v2Speed(speed: Open5eV2Creature["speed"]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(speed ?? {})) {
    if (k !== "unit" && typeof v === "number" && v > 0) out[k] = v
  }
  if (Object.keys(out).length === 0) out.walk = 0
  return out
}

function v2Senses(c: Open5eV2Creature): string {
  const parts: string[] = []
  if (c.blindsight_range) parts.push(`blindsight ${c.blindsight_range} ft.`)
  if (c.darkvision_range) parts.push(`darkvision ${c.darkvision_range} ft.`)
  if (c.tremorsense_range) parts.push(`tremorsense ${c.tremorsense_range} ft.`)
  if (c.truesight_range) parts.push(`truesight ${c.truesight_range} ft.`)
  if (c.passive_perception != null) parts.push(`passive Perception ${c.passive_perception}`)
  return parts.join(", ")
}

const toAction = (a: Open5eV2Action): MonsterAction => ({ name: a.name, desc: stripSrdMarkdown(a.desc ?? "") })

export function v2CreatureToMonster(c: Open5eV2Creature): Open5eMonster {
  const ab = c.ability_scores ?? {}
  const sv = c.saving_throws ?? {}
  const ri = c.resistances_and_immunities ?? {}
  const display = (k: string): string => {
    const v = ri[`${k}_display`]
    return typeof v === "string" ? v : ""
  }

  const actions: MonsterAction[] = []
  const legendary_actions: MonsterAction[] = []
  const reactions: MonsterAction[] = []
  for (const a of c.actions ?? []) {
    if (a.action_type === "LEGENDARY_ACTION") legendary_actions.push(toAction(a))
    else if (a.action_type === "REACTION") reactions.push(toAction(a))
    else actions.push(toAction(a)) // ACTION + BONUS_ACTION
  }

  return {
    slug: c.key,
    name: c.name,
    size: c.size?.name ?? "",
    type: c.type?.name ?? "",
    subtype: c.subcategory ?? undefined,
    alignment: c.alignment ?? "",
    armor_class: c.armor_class ?? 10,
    armor_desc: c.armor_detail,
    hit_points: c.hit_points ?? 1,
    hit_dice: c.hit_dice ?? "",
    speed: v2Speed(c.speed),
    strength: ab.strength ?? 10,
    dexterity: ab.dexterity ?? 10,
    constitution: ab.constitution ?? 10,
    intelligence: ab.intelligence ?? 10,
    wisdom: ab.wisdom ?? 10,
    charisma: ab.charisma ?? 10,
    strength_save: sv.strength,
    dexterity_save: sv.dexterity,
    constitution_save: sv.constitution,
    intelligence_save: sv.intelligence,
    wisdom_save: sv.wisdom,
    charisma_save: sv.charisma,
    perception: c.passive_perception,
    skills: c.skill_bonuses,
    damage_vulnerabilities: display("damage_vulnerabilities"),
    damage_resistances: display("damage_resistances"),
    damage_immunities: display("damage_immunities"),
    condition_immunities: display("condition_immunities"),
    senses: v2Senses(c),
    languages: c.languages?.as_string ?? "",
    challenge_rating: formatCr(c.challenge_rating),
    cr: c.challenge_rating ?? 0,
    actions,
    reactions,
    legendary_actions,
    special_abilities: (c.traits ?? []).map(toAction),
    document__slug: c.document?.key ?? "srd-2014",
    document__title: c.document?.name ?? "SRD",
  }
}

// ─── Open5e v2 spells / gear / conditions → existing shapes ───────────────────
// v1 is deprecated; these now come from v2 with reshaped, nested fields. We remap at
// THIS boundary so consumers + the Open5eX types stay unchanged (same posture as the
// monster mapper). Booleans → the "yes"/"no" strings the codex/sheet expect; nested
// {name} → flat strings.

interface V2Ref {
  name?: string
  key?: string
}
interface V2Doc {
  key?: string
  name?: string
}

interface Open5eV2Spell {
  key: string
  name: string
  desc?: string
  higher_level?: string
  level?: number
  school?: V2Ref
  classes?: V2Ref[]
  casting_time?: string
  range_text?: string
  duration?: string
  concentration?: boolean
  ritual?: boolean
  verbal?: boolean
  somatic?: boolean
  material?: boolean
  material_specified?: string
  document?: V2Doc
}
export function v2SpellToSpell(s: Open5eV2Spell): Open5eSpell {
  const lvl = s.level ?? 0
  const components = [s.verbal && "V", s.somatic && "S", s.material && "M"]
    .filter(Boolean)
    .join(", ")
  return {
    slug: s.key,
    name: s.name,
    desc: s.desc ?? "",
    higher_level: s.higher_level,
    range: s.range_text ?? "",
    components,
    material: s.material && s.material_specified ? s.material_specified : undefined,
    ritual: s.ritual ? "yes" : "no",
    duration: s.duration ?? "",
    concentration: s.concentration ? "yes" : "no",
    casting_time: s.casting_time ?? "",
    level: String(lvl),
    level_int: lvl,
    school: s.school?.name ?? "",
    dnd_class: (s.classes ?? []).map((c) => c.name ?? "").filter(Boolean).join(", "),
    document__slug: s.document?.key ?? SRD_DOC,
    document__title: s.document?.name ?? "SRD",
  }
}

interface Open5eV2Weapon {
  key: string
  name: string
  damage_dice?: string
  damage_type?: V2Ref | string
  range?: number
  long_range?: number
  is_simple?: boolean
  properties?: { property?: V2Ref & { type?: string | null }; detail?: string | null }[]
  document?: V2Doc
}
export function v2WeaponToWeapon(w: Open5eV2Weapon): Open5eWeapon {
  const ranged = (w.range ?? 0) > 0 || (w.long_range ?? 0) > 0
  // Only Ammunition weapons (bows/crossbows/slings) are "ranged"; thrown MELEE weapons
  // (handaxe, javelin) carry a range but stay melee for the prefill's category.
  const hasAmmo = (w.properties ?? []).some(
    (p) => (p.property?.name ?? "").toLowerCase() === "ammunition",
  )
  const dt = typeof w.damage_type === "string" ? w.damage_type : w.damage_type?.name ?? ""
  const properties = (w.properties ?? [])
    .filter((p) => p.property?.type !== "Mastery") // 2024 masteries aren't sheet-modeled
    .map((p) => {
      const name = (p.property?.name ?? "").toLowerCase()
      if (name === "versatile" && p.detail) return `versatile (${p.detail})`
      if ((name === "thrown" || name === "ammunition") && ranged)
        return `${name} (range ${w.range ?? 0}/${w.long_range ?? 0})`
      return name
    })
    .filter(Boolean)
  return {
    slug: w.key,
    name: w.name,
    category: `${w.is_simple ? "Simple" : "Martial"} ${hasAmmo ? "Ranged" : "Melee"} Weapon`,
    cost: srdItemCost(w.name) ?? "",
    damage_dice: w.damage_dice ?? "",
    damage_type: dt,
    weight: "",
    properties,
    document__slug: w.document?.key ?? SRD_DOC,
    document__title: w.document?.name ?? "SRD",
  }
}

interface Open5eV2Armor {
  key: string
  name: string
  category?: string
  ac_display?: string
  ac_base?: number
  grants_stealth_disadvantage?: boolean
  strength_score_required?: number | null
  document?: V2Doc
}
export function v2ArmorToArmor(a: Open5eV2Armor): Open5eArmor {
  const isShield = /shield/i.test(a.name) // v2 files shields under category "heavy"
  return {
    slug: a.key,
    name: a.name,
    category: isShield ? "shield" : a.category ?? "light",
    cost: srdItemCost(a.name) ?? "",
    ac_string: a.ac_display ?? String(a.ac_base ?? 10),
    strength_requirement:
      a.strength_score_required != null ? String(a.strength_score_required) : undefined,
    stealth_disadvantage: a.grants_stealth_disadvantage ?? false,
    weight: "",
    document__slug: a.document?.key ?? SRD_DOC,
    document__title: a.document?.name ?? "SRD",
  }
}

interface Open5eV2MagicItem {
  key: string
  name: string
  desc?: string
  category?: V2Ref
  rarity?: V2Ref
  requires_attunement?: boolean
  attunement_detail?: string | null
  document?: V2Doc
}
export function v2MagicItemToItem(m: Open5eV2MagicItem): Open5eMagicItem {
  return {
    slug: m.key,
    name: m.name,
    type: m.category?.name ?? "",
    rarity: m.rarity?.name ?? "",
    desc: m.desc ?? "",
    requires_attunement: m.requires_attunement
      ? `requires attunement${m.attunement_detail ? ` ${m.attunement_detail}` : ""}`
      : "",
    document__slug: m.document?.key ?? SRD_DOC,
    document__title: m.document?.name ?? "SRD",
  }
}

// /v2/items rows carry weight/cost as strings ("4.000", "10.00") and a nested
// {key} category. We map at this boundary like every other v2 shape.
interface Open5eV2Item {
  key: string
  name: string
  category?: V2Ref
  weight?: number | string | null
  cost?: number | string | null
  desc?: string
  document?: V2Doc
}

// Open5e item category key → the sheet's ItemCategory. weapon/armor keep their own
// kinds (their mechanics come from the dedicated endpoints; here they're only a
// price+weight source). Magic-ish keys (wondrous/scroll) map to "magic" so the gear
// search can exclude them — they have a richer dedicated tab (rarity + attunement).
const ITEM_CATEGORY_MAP: Record<string, ItemCategory> = {
  weapon: "weapon",
  armor: "armor",
  ammunition: "gear",
  "adventuring-gear": "gear",
  "equipment-pack": "gear",
  "spellcasting-focus": "gear",
  mount: "gear",
  "land-vehicle": "gear",
  "waterborne-vehicle": "gear",
  tools: "tool",
  potion: "consumable",
  "wondrous-item": "magic",
  scroll: "magic",
}

// Open5e prices everything in decimal gp (0.40 = 4 sp, 0.01 = 1 cp). Render it back
// to the largest whole denomination so the form prefills "4 sp", not "0.4 gp".
function gpToCostString(gp: number): string {
  if (!Number.isFinite(gp) || gp <= 0) return ""
  if (Number.isInteger(gp)) return `${gp} gp`
  const sp = gp * 10
  if (Number.isInteger(sp)) return `${sp} sp`
  return `${Math.round(gp * 100)} cp`
}

export function v2ItemToEquipment(it: Open5eV2Item): Open5eEquipment {
  const key = (it.category?.key ?? "").toLowerCase()
  return {
    slug: it.key,
    name: it.name,
    category: ITEM_CATEGORY_MAP[key] ?? "gear",
    weight: Number(it.weight) || 0,
    cost: gpToCostString(Number(it.cost) || 0),
    desc: it.desc ?? "",
  }
}

// Name key for matching across endpoints: lowercase, punctuation-stripped, the
// noise word "armor" dropped, words sorted — so "/v2/armor"'s "Studded Leather
// Armor" matches "/v2/items"'s entry regardless of suffix/word order. Mirrors the
// srd-item-costs normalize, kept local to avoid coupling.
function equipNormKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w && w !== "armor")
    .sort()
    .join(" ")
}

interface Open5eV2Condition {
  key: string
  name: string
  descriptions?: { desc?: string; gamesystem?: string }[]
  document?: V2Doc
}
export function v2ConditionToCondition(c: Open5eV2Condition): Open5eCondition {
  const descs = c.descriptions ?? []
  // Each condition carries a per-gamesystem description; prefer 2024 5e, then any 5e
  // variant (NOT a5e — "a5e" doesn't start with "5e"), then whatever's first.
  const pick =
    descs.find((d) => d.gamesystem === "5e-2024") ??
    descs.find((d) => (d.gamesystem ?? "").toLowerCase().startsWith("5e")) ??
    descs[0]
  return {
    slug: c.key,
    name: c.name,
    desc: pick?.desc ?? "",
    document__slug: c.document?.key ?? COND_DOC,
    document__title: c.document?.name ?? "SRD",
  }
}

export interface Open5eCondition {
  slug: string
  name: string
  desc: string
  document__slug: string
  document__title: string
}

export interface Open5eWeapon {
  slug: string
  name: string
  category: string
  cost: string
  damage_dice: string
  damage_type: string
  weight: string
  properties: string[]
  document__slug: string
  document__title: string
}

export interface Open5eArmor {
  slug: string
  name: string
  category: string
  cost: string
  ac_string: string
  strength_requirement?: string
  stealth_disadvantage: boolean
  weight: string
  document__slug: string
  document__title: string
}

export interface Open5eMagicItem {
  slug: string
  name: string
  type: string
  rarity: string
  desc: string
  requires_attunement: string
  document__slug: string
  document__title: string
}

// Mundane SRD equipment from /v2/items — the catalog the weapon/armor/magic-item
// mechanics endpoints DON'T cover: ammunition, adventuring gear, tools, packs,
// potions, spellcasting foci, mounts. Unlike those endpoints, /v2/items carries
// real `weight` (lbs) and `cost` (gp), so it doubles as the price+weight source
// that enriches weapons/armor (see getEquipmentStats). `category` is pre-mapped to
// the sheet's ItemCategory so the item picker can drop a pick straight into a form.
export interface Open5eEquipment {
  slug: string
  name: string
  category: ItemCategory
  weight: number // lbs
  cost: string // "1 gp" / "4 sp" / "" — parseCost-compatible
  desc: string
}

// NOTE: races, classes, and backgrounds are NOT fetched from Open5e — character
// creation uses curated in-repo data (lib/character/*). Their old v1 getters +
// interfaces were orphaned and were removed in the v2 migration.

interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

interface CacheEntry<T> {
  data: T
  timestamp: number
  endpoint: string
}

// IndexedDB helpers
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains("cache")) {
        db.createObjectStore("cache", { keyPath: "endpoint" })
      }
    }
  })
}

async function getCached<T>(endpoint: string): Promise<T | null> {
  try {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("cache", "readonly")
      const store = transaction.objectStore("cache")
      const request = store.get(endpoint)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const entry = request.result as CacheEntry<T> | undefined
        if (entry && Date.now() - entry.timestamp < CACHE_DURATION) {
          resolve(entry.data)
        } else {
          resolve(null)
        }
      }
    })
  } catch {
    return null
  }
}

async function setCache<T>(endpoint: string, data: T): Promise<void> {
  try {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("cache", "readwrite")
      const store = transaction.objectStore("cache")
      const entry: CacheEntry<T> = { endpoint, data, timestamp: Date.now() }
      const request = store.put(entry)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  } catch {
    // Silently fail cache writes
  }
}

// Fetch with retry and timeout for transient failures
const MAX_RETRIES = 3
const REQUEST_TIMEOUT = 10_000

async function fetchWithRetry(url: string): Promise<Response> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

    try {
      const response = await fetch(url, { signal: controller.signal })
      clearTimeout(timeoutId)

      // Don't retry client errors (4xx)
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response
      }

      // Retry on 5xx server errors
      if (attempt === MAX_RETRIES) {
        return response
      }
    } catch (error) {
      clearTimeout(timeoutId)
      if (attempt === MAX_RETRIES) {
        throw error
      }
    }

    // Exponential backoff: 1s, 2s, 4s
    await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)))
  }

  // Unreachable, but satisfies TypeScript
  throw new Error("Retry attempts exhausted")
}

// Generic fetch with caching
async function fetchWithCache<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}${endpoint}`)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.append(key, value)
    })
  }

  const cacheKey = url.toString()
  const cached = await getCached<T>(cacheKey)
  if (cached) return cached

  const response = await fetchWithRetry(url.toString())
  if (!response.ok) {
    throw new Error(`Open5e API error: ${response.status}`)
  }

  const data = await response.json()
  await setCache(cacheKey, data)
  return data
}

// Fetch all pages of a paginated endpoint
async function fetchAllPages<T>(endpoint: string, params?: Record<string, string>): Promise<T[]> {
  const cacheKey = `${endpoint}_all_${JSON.stringify(params || {})}`
  const cached = await getCached<T[]>(cacheKey)
  if (cached) return cached

  const allResults: T[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const response = await fetchWithCache<PaginatedResponse<T>>(endpoint, {
      ...params,
      limit: "100",
      page: page.toString(),
    })
    allResults.push(...response.results)
    hasMore = response.next !== null
    page++
  }

  await setCache(cacheKey, allResults)
  return allResults
}

// ─── Self-hosted SRD monsters ────────────────────────────────────────────────
// The full SRD creature set (edition = SRD_DOC) is baked into lib/data/srd-monsters.json by
// scripts/seed-monsters.ts and served from here, so the combat tracker never hits
// the live (volunteer-run) api.open5e.com at play time. A lazy dynamic import keeps
// the ~550 KB out of the main bundle — it loads as its own chunk only when a monster
// surface (codex, combat tracker, encounter builder) first asks, then stays cached
// in-memory for the session. Re-seed to refresh the snapshot.
let srdMonstersPromise: Promise<Open5eMonster[]> | null = null
function loadSrdMonsters(): Promise<Open5eMonster[]> {
  if (!srdMonstersPromise) {
    srdMonstersPromise = import("./data/srd-monsters.json").then(
      (m) => (m.default ?? m) as unknown as Open5eMonster[],
    )
  }
  return srdMonstersPromise
}

// Name → {weight, cost} lookup built once from /v2/items, used to enrich the
// weapon/armor mechanics endpoints (which carry neither). Cached as a promise so
// concurrent getWeapons()/getArmor() calls share one fetch; failure degrades to an
// empty map (weapons/armor just keep their curated cost + zero weight).
let equipmentStatsPromise: Promise<Map<string, { weight: number; cost: string }>> | null = null
function getEquipmentStats(): Promise<Map<string, { weight: number; cost: string }>> {
  if (!equipmentStatsPromise) {
    equipmentStatsPromise = open5eApi
      .getEquipment()
      .then((list) => {
        const m = new Map<string, { weight: number; cost: string }>()
        for (const e of list) m.set(equipNormKey(e.name), { weight: e.weight, cost: e.cost })
        return m
      })
      .catch(() => new Map<string, { weight: number; cost: string }>())
  }
  return equipmentStatsPromise
}

// API methods
export const open5eApi = {
  // Spells — v2/spells (v1 deprecated). document__key filters edition server-side
  // here; class/level/school filter client-side off the mapped fields.
  async getSpells(params?: {
    search?: string
    level?: number
    school?: string
    class?: string
  }): Promise<Open5eSpell[]> {
    const queryParams: Record<string, string> = { document__key: SRD_DOC }
    if (params?.search) queryParams.search = params.search
    const raw = await fetchAllPages<Open5eV2Spell>("/v2/spells/", queryParams)
    let spells = raw
      .filter((s) => (s.document?.key ?? SRD_DOC) === SRD_DOC)
      .map(v2SpellToSpell)
    if (params?.level !== undefined) {
      spells = spells.filter((s) => s.level_int === params.level)
    }
    if (params?.school) {
      const sch = params.school.toLowerCase()
      spells = spells.filter((s) => s.school.toLowerCase() === sch)
    }
    if (params?.class) {
      const cls = params.class.toLowerCase()
      spells = spells.filter((s) => s.dnd_class.toLowerCase().includes(cls))
    }
    return spells
  },

  // Monsters — served from the self-hosted SRD bundle (see loadSrdMonsters),
  // NOT the live API. Combat rolls monster attacks at the table, so it must never
  // depend on the volunteer-run api.open5e.com (which went fully down mid-session)
  // or its broken v2 structured-attack fields. `search` (name substring) and `type`
  // (exact creature type) filter in-memory, matching the old server-side behavior.
  // Re-bake with `npm run seed:monsters` to refresh. Homebrew is a separate path.
  async getMonsters(params?: {
    search?: string
    cr?: string
    type?: string
    size?: string
  }): Promise<Open5eMonster[]> {
    const all = await loadSrdMonsters()
    let result = [...all] // fresh array — callers may sort it in place
    if (params?.type) {
      const t = params.type.toLowerCase()
      result = result.filter((m) => m.type.toLowerCase() === t)
    }
    if (params?.search) {
      const q = params.search.toLowerCase()
      result = result.filter((m) => m.name.toLowerCase().includes(q))
    }
    return result
  },

  async getMonster(slug: string): Promise<Open5eMonster> {
    const all = await loadSrdMonsters()
    const found = all.find((m) => m.slug === slug)
    if (!found) throw new Error(`Monster not found in SRD bundle: ${slug}`)
    return found
  },

  // Conditions — v2/conditions under the shared "core" document (the 15 standard
  // conditions, identical across editions); each carries per-gamesystem descriptions.
  async getConditions(): Promise<Open5eCondition[]> {
    const raw = await fetchAllPages<Open5eV2Condition>("/v2/conditions/", {
      document__key: COND_DOC,
    })
    return raw.map(v2ConditionToCondition)
  },

  // Weapons — v2/weapons. This endpoint ignores the edition filter (returns all
  // editions, ~75 rows), so we fetch all and keep our edition client-side. The
  // mechanics endpoint carries no weight/cost, so we enrich from /v2/items by name.
  async getWeapons(search?: string): Promise<Open5eWeapon[]> {
    const [raw, stats] = await Promise.all([
      fetchAllPages<Open5eV2Weapon>("/v2/weapons/", {}),
      getEquipmentStats(),
    ])
    let weapons = raw
      .filter((w) => w.document?.key === SRD_DOC)
      .map(v2WeaponToWeapon)
      .map((w) => {
        const s = stats.get(equipNormKey(w.name))
        if (!s) return w
        return { ...w, cost: s.cost || w.cost, weight: s.weight ? String(s.weight) : w.weight }
      })
    if (search) {
      const q = search.toLowerCase()
      weapons = weapons.filter((w) => w.name.toLowerCase().includes(q))
    }
    return weapons
  },

  // Armor — v2/armor. Like weapons, the edition filter is ignored (~25 rows), so we
  // filter client-side. Shields live here too (detected by name in the mapper). The
  // /v2/items enrichment is what finally gives 2024 armor ("Studded Leather Armor")
  // a price — its suffixed name broke the bare-keyed curated cost table.
  async getArmor(search?: string): Promise<Open5eArmor[]> {
    const [raw, stats] = await Promise.all([
      fetchAllPages<Open5eV2Armor>("/v2/armor/", {}),
      getEquipmentStats(),
    ])
    let armor = raw
      .filter((a) => a.document?.key === SRD_DOC)
      .map(v2ArmorToArmor)
      .map((a) => {
        const s = stats.get(equipNormKey(a.name))
        if (!s) return a
        return { ...a, cost: s.cost || a.cost, weight: s.weight ? String(s.weight) : a.weight }
      })
    if (search) {
      const q = search.toLowerCase()
      armor = armor.filter((a) => a.name.toLowerCase().includes(q))
    }
    return armor
  },

  // Mundane equipment — v2/items (ammunition, adventuring gear, tools, packs,
  // potions, foci, mounts). The catalog the mechanics endpoints don't cover, and
  // the only SRD source that carries weight + cost. `document=` filters the edition
  // server-side (the working form, same as magicitems); the client guard backs it up.
  async getEquipment(): Promise<Open5eEquipment[]> {
    const raw = await fetchAllPages<Open5eV2Item>("/v2/items/", { document: SRD_DOC })
    return raw
      .filter((it) => (it.document?.key ?? SRD_DOC) === SRD_DOC)
      .map(v2ItemToEquipment)
  },

  // Magic items — v2/magicitems. Here the working edition filter is `document=` (the
  // `document__key=` form is ignored); the client-side guard backs it up. search/
  // rarity/type filter off the mapped fields.
  async getMagicItems(params?: {
    search?: string
    rarity?: string
    type?: string
  }): Promise<Open5eMagicItem[]> {
    const raw = await fetchAllPages<Open5eV2MagicItem>("/v2/magicitems/", {
      document: SRD_DOC,
    })
    let items = raw
      .filter((m) => (m.document?.key ?? SRD_DOC) === SRD_DOC)
      .map(v2MagicItemToItem)
    if (params?.search) {
      const q = params.search.toLowerCase()
      items = items.filter((m) => m.name.toLowerCase().includes(q))
    }
    if (params?.rarity) {
      const r = params.rarity.toLowerCase()
      items = items.filter((m) => m.rarity.toLowerCase() === r)
    }
    if (params?.type) {
      const t = params.type.toLowerCase()
      items = items.filter((m) => m.type.toLowerCase().includes(t))
    }
    return items
  },

  // Clear cache
  async clearCache(): Promise<void> {
    try {
      const db = await openDatabase()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction("cache", "readwrite")
        const store = transaction.objectStore("cache")
        const request = store.clear()

        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve()
      })
    } catch {
      // Silently fail
    }
  },
}
