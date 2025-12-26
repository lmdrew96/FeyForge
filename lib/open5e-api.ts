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
  actions?: Array<{ name: string; desc: string }>
  reactions?: Array<{ name: string; desc: string }>
  legendary_actions?: Array<{ name: string; desc: string }>
  special_abilities?: Array<{ name: string; desc: string }>
  document__slug: string
  document__title: string
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

  const response = await fetch(url.toString())
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

  // Monsters
  async getMonsters(params?: {
    search?: string
    cr?: string
    type?: string
    size?: string
  }): Promise<Open5eMonster[]> {
    const queryParams: Record<string, string> = {
      document__slug: "wotc-srd",
    }
    if (params?.search) queryParams.search = params.search
    if (params?.cr) queryParams.cr = params.cr
    if (params?.type) queryParams.type__icontains = params.type.toLowerCase()
    if (params?.size) queryParams.size = params.size

    return fetchAllPages<Open5eMonster>("/v1/monsters/", queryParams)
  },

  async getMonster(slug: string): Promise<Open5eMonster> {
    return fetchWithCache<Open5eMonster>(`/v1/monsters/${slug}/`)
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
