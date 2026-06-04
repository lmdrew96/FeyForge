import type { Doc } from "@/convex/_generated/dataModel"
import type { Ability, Skill } from "@/lib/character/constants"
import type { StoredItemData } from "@/lib/character/sheet-items"
import {
  RACES,
  BACKGROUNDS,
  CLASSES,
  type RaceData,
  type SubraceData,
  type BackgroundData,
  type ClassData,
  type SubclassData,
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

export interface HomebrewClassData {
  description: string
  flavorText: string
  hitDie: number
  primaryAbility: string
  savingThrows: string[]
  armorProficiencies: string[]
  weaponProficiencies: string[]
  toolProficiencies: string[]
  skillChoices: { count: number; options: string[] }
  spellcasting?: { ability: string; type: string }
  subclasses?: { name: string; description: string }[]
}

export function homebrewToClassData(doc: Doc<"homebrew">): ClassData {
  const data = doc.data as HomebrewClassData
  const subclasses: SubclassData[] | undefined = data.subclasses?.map((s, i) => ({
    id: `${HB_PREFIX}${doc._id}:sub:${i}`,
    name: s.name,
    description: s.description,
  }))
  return {
    id: `${HB_PREFIX}${doc._id}`,
    name: doc.name,
    description: data.description,
    hitDie: data.hitDie,
    savingThrows: data.savingThrows as ClassData["savingThrows"],
    armorProficiencies: data.armorProficiencies,
    weaponProficiencies: data.weaponProficiencies,
    toolProficiencies: data.toolProficiencies,
    skillChoices: {
      count: data.skillChoices.count,
      options: data.skillChoices.options as ClassData["skillChoices"]["options"],
    },
    spellcasting: data.spellcasting as ClassData["spellcasting"],
    primaryAbility: data.primaryAbility as ClassData["primaryAbility"],
    flavorText: data.flavorText,
    subclasses: subclasses && subclasses.length > 0 ? subclasses : undefined,
    homebrew: true,
  }
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

// Split a homebrew list into builder-ready race/background/item/class arrays.
export function partitionHomebrew(docs: Doc<"homebrew">[] | undefined): {
  races: RaceData[]
  backgrounds: BackgroundData[]
  items: HomebrewItem[]
  classes: ClassData[]
} {
  const races: RaceData[] = []
  const backgrounds: BackgroundData[] = []
  const items: HomebrewItem[] = []
  const classes: ClassData[] = []
  for (const doc of docs ?? []) {
    if (doc.kind === "race") races.push(homebrewToRaceData(doc))
    else if (doc.kind === "background") backgrounds.push(homebrewToBackgroundData(doc))
    else if (doc.kind === "item") items.push(homebrewToItem(doc))
    else if (doc.kind === "class") classes.push(homebrewToClassData(doc))
  }
  return { races, backgrounds, items, classes }
}

// True if `name` (case-insensitive) collides with a curated SRD race/background.
// A homebrew entry sharing a curated name would shadow it in the merged list and
// confuse the sheet's name-keyed darkvision lookup — block it in the form.
export function collidesWithCuratedName(
  kind: "race" | "background" | "class",
  name: string,
): boolean {
  const lower = name.trim().toLowerCase()
  if (!lower) return false
  const pool = kind === "race" ? RACES : kind === "background" ? BACKGROUNDS : CLASSES
  return pool.some((entry) => entry.name.toLowerCase() === lower)
}
