import type { Doc } from "@/convex/_generated/dataModel"
import type { Ability, Skill } from "@/lib/character/constants"
import type { StoredItemData } from "@/lib/character/sheet-items"
import {
  RACES,
  BACKGROUNDS,
  type RaceData,
  type SubraceData,
  type BackgroundData,
} from "@/lib/character/character-data"

// ── Homebrew client helpers ───────────────────────────────────────────────────
// Converts a stored `homebrew` row into the exact RaceData / BackgroundData shape
// the character builder already consumes, so homebrew entries merge straight into
// the existing pickers. Synthesized ids are prefixed `hb:` so they can never
// collide with a curated SRD slug. RaceData / BackgroundData carry an optional
// `homebrew` flag (set here) so the builder can badge custom content.

// Mirror the validator shapes in convex/lib/homebrewValidators.ts. `doc.data` is a
// discriminated union keyed by `doc.kind`; we narrow by casting on that.
export interface HomebrewRaceData {
  description: string
  size: string
  speed: number
  abilityBonuses: Partial<Record<Ability, number>>
  traits: string[]
  languages: string[]
  darkvision?: number
  subraces?: Array<{
    name: string
    description: string
    abilityBonuses: Partial<Record<Ability, number>>
    traits: string[]
    speed?: number
    darkvision?: number
  }>
}

export interface HomebrewBackgroundData {
  description: string
  skillProficiencies: string[]
  toolProficiencies: string[]
  languages: number
  equipment: string[]
  feature: string
}

// A homebrew item, ready for the inventory's item editor: the stored data IS a
// StoredItemData blob (what the item form produces), so adding it to a character
// clones it into a property row — a snapshot, same as an SRD item.
export interface HomebrewItem {
  id: string
  name: string
  data: StoredItemData
}

export function homebrewToItem(doc: Doc<"homebrew">): HomebrewItem {
  return { id: doc._id, name: doc.name, data: doc.data as StoredItemData }
}

const HB_PREFIX = "hb:"

export function isHomebrewId(id: string): boolean {
  return id.startsWith(HB_PREFIX)
}

export function homebrewToRaceData(doc: Doc<"homebrew">): RaceData {
  const data = doc.data as HomebrewRaceData
  const subraces: SubraceData[] | undefined = data.subraces?.map((sr, i) => ({
    id: `${HB_PREFIX}${doc._id}:sub:${i}`,
    name: sr.name,
    description: sr.description,
    abilityBonuses: sr.abilityBonuses,
    traits: sr.traits,
    speed: sr.speed,
    darkvision: sr.darkvision,
  }))
  return {
    id: `${HB_PREFIX}${doc._id}`,
    name: doc.name,
    description: data.description,
    size: data.size,
    speed: data.speed,
    abilityBonuses: data.abilityBonuses,
    traits: data.traits,
    languages: data.languages,
    darkvision: data.darkvision,
    subraces: subraces && subraces.length > 0 ? subraces : undefined,
    homebrew: true,
  }
}

export function homebrewToBackgroundData(doc: Doc<"homebrew">): BackgroundData {
  const data = doc.data as HomebrewBackgroundData
  return {
    id: `${HB_PREFIX}${doc._id}`,
    name: doc.name,
    description: data.description,
    skillProficiencies: data.skillProficiencies as Skill[],
    toolProficiencies: data.toolProficiencies,
    languages: data.languages,
    equipment: data.equipment,
    feature: data.feature,
    // Backgrounds carry suggestion arrays in the curated set; homebrew leaves them
    // empty (the builder maps over them safely).
    personalityTraits: [],
    ideals: [],
    bonds: [],
    flaws: [],
    homebrew: true,
  }
}

// Split a homebrew list into builder-ready race/background/item arrays.
export function partitionHomebrew(docs: Doc<"homebrew">[] | undefined): {
  races: RaceData[]
  backgrounds: BackgroundData[]
  items: HomebrewItem[]
} {
  const races: RaceData[] = []
  const backgrounds: BackgroundData[] = []
  const items: HomebrewItem[] = []
  for (const doc of docs ?? []) {
    if (doc.kind === "race") races.push(homebrewToRaceData(doc))
    else if (doc.kind === "background") backgrounds.push(homebrewToBackgroundData(doc))
    else if (doc.kind === "item") items.push(homebrewToItem(doc))
  }
  return { races, backgrounds, items }
}

// True if `name` (case-insensitive) collides with a curated SRD race/background.
// A homebrew entry sharing a curated name would shadow it in the merged list and
// confuse the sheet's name-keyed darkvision lookup — block it in the form.
export function collidesWithCuratedName(
  kind: "race" | "background",
  name: string,
): boolean {
  const lower = name.trim().toLowerCase()
  if (!lower) return false
  const pool = kind === "race" ? RACES : BACKGROUNDS
  return pool.some((entry) => entry.name.toLowerCase() === lower)
}
