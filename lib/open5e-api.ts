// Open5e API client with IndexedDB caching

const API_BASE = "https://api.open5e.com"
const DB_NAME = "arcane-codex-srd"
const DB_VERSION = 1
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

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

export interface Open5eRace {
  slug: string
  name: string
  desc: string
  asi_desc: string
  asi: Array<{ attributes: string[]; value: number }>
  age: string
  alignment: string
  size: string
  size_raw: string
  speed: { walk: number; swim?: number; fly?: number }
  speed_desc: string
  languages: string
  vision: string
  traits: string
  subraces: Array<{
    name: string
    slug: string
    desc: string
    asi_desc: string
    asi: Array<{ attributes: string[]; value: number }>
    traits: string
  }>
  document__slug: string
  document__title: string
}

export interface Open5eClass {
  slug: string
  name: string
  desc: string
  hit_dice: string
  hp_at_1st_level: string
  hp_at_higher_levels: string
  prof_armor: string
  prof_weapons: string
  prof_tools: string
  prof_saving_throws: string
  prof_skills: string
  equipment: string
  table: string
  spellcasting_ability: string
  subtypes_name: string
  archetypes: Array<{
    name: string
    slug: string
    desc: string
  }>
  document__slug: string
  document__title: string
}

export interface Open5eBackground {
  slug: string
  name: string
  desc: string
  skill_proficiencies: string
  tool_proficiencies?: string
  languages?: string
  equipment: string
  feature: string
  feature_desc: string
  suggested_characteristics?: string
  document__slug: string
  document__title: string
}

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

// Content source filter type
export type ContentSource = "srd" | "all"

// Helper to get source filter params
function getSourceParams(source?: ContentSource): Record<string, string> {
  if (source === "all") return {}
  return { document__slug: "wotc-srd" }
}

// API methods
export const open5eApi = {
  // Spells
  async getSpells(params?: {
    search?: string
    level?: number
    school?: string
    class?: string
  }): Promise<Open5eSpell[]> {
    const queryParams: Record<string, string> = {
      document__slug: "wotc-srd", // Only get SRD content
    }
    if (params?.search) queryParams.search = params.search
    if (params?.level !== undefined) queryParams.level_int = params.level.toString()
    if (params?.school) queryParams.school = params.school.toLowerCase()
    if (params?.class) queryParams.dnd_class__icontains = params.class

    return fetchAllPages<Open5eSpell>("/v1/spells/", queryParams)
  },

  async getSpell(slug: string): Promise<Open5eSpell> {
    return fetchWithCache<Open5eSpell>(`/v1/spells/${slug}/`)
  },

  // Monsters — from v2/creatures (v1/monsters is deprecated), mapped to the
  // Open5eMonster shape at the lib boundary (see v2CreatureToMonster). Defaults to
  // the 2014 SRD; `search`/`type` filter server-side (both verified on v2).
  async getMonsters(params?: {
    search?: string
    cr?: string
    type?: string
    size?: string
  }): Promise<Open5eMonster[]> {
    const queryParams: Record<string, string> = { document__key: "srd-2014" }
    if (params?.search) queryParams.search = params.search
    if (params?.type) queryParams.type = params.type.toLowerCase()

    const raw = await fetchAllPages<Open5eV2Creature>("/v2/creatures/", queryParams)
    return raw.map(v2CreatureToMonster)
  },

  async getMonster(slug: string): Promise<Open5eMonster> {
    const raw = await fetchWithCache<Open5eV2Creature>(`/v2/creatures/${slug}/`)
    return v2CreatureToMonster(raw)
  },

  // Conditions
  async getConditions(): Promise<Open5eCondition[]> {
    return fetchAllPages<Open5eCondition>("/v1/conditions/", {
      document__slug: "wotc-srd",
    })
  },

  // Weapons
  async getWeapons(search?: string): Promise<Open5eWeapon[]> {
    const params: Record<string, string> = { document__slug: "wotc-srd" }
    if (search) params.search = search
    return fetchAllPages<Open5eWeapon>("/v1/weapons/", params)
  },

  // Armor
  async getArmor(search?: string): Promise<Open5eArmor[]> {
    const params: Record<string, string> = { document__slug: "wotc-srd" }
    if (search) params.search = search
    return fetchAllPages<Open5eArmor>("/v1/armor/", params)
  },

  // Magic Items
  async getMagicItems(params?: {
    search?: string
    rarity?: string
    type?: string
  }): Promise<Open5eMagicItem[]> {
    const queryParams: Record<string, string> = { document__slug: "wotc-srd" }
    if (params?.search) queryParams.search = params.search
    if (params?.rarity) queryParams.rarity = params.rarity
    if (params?.type) queryParams.type__icontains = params.type
    return fetchAllPages<Open5eMagicItem>("/v1/magicitems/", queryParams)
  },

  // Races
  async getRaces(source?: ContentSource): Promise<Open5eRace[]> {
    return fetchAllPages<Open5eRace>("/v1/races/", getSourceParams(source))
  },

  async getRace(slug: string): Promise<Open5eRace> {
    return fetchWithCache<Open5eRace>(`/v1/races/${slug}/`)
  },

  // Classes
  async getClasses(source?: ContentSource): Promise<Open5eClass[]> {
    return fetchAllPages<Open5eClass>("/v1/classes/", getSourceParams(source))
  },

  async getClass(slug: string): Promise<Open5eClass> {
    return fetchWithCache<Open5eClass>(`/v1/classes/${slug}/`)
  },

  // Backgrounds
  async getBackgrounds(source?: ContentSource): Promise<Open5eBackground[]> {
    return fetchAllPages<Open5eBackground>("/v1/backgrounds/", getSourceParams(source))
  },

  async getBackground(slug: string): Promise<Open5eBackground> {
    return fetchWithCache<Open5eBackground>(`/v1/backgrounds/${slug}/`)
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
