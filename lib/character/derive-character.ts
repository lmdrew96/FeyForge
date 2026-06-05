import type { Doc } from "@/convex/_generated/dataModel"
import {
  ABILITIES,
  SKILLS,
  CLASS_COLORS,
  getAbilityModifier,
  getProficiencyBonus,
  type Ability,
  type Skill,
} from "@/lib/character/constants"
import { getDarkvisionRange, getSubclassId } from "@/lib/character/character-data"
import { getCasterType, type CasterType } from "@/lib/character/leveling"
import { resolveEdition, type Edition } from "@/lib/editions"
import {
  computeArmorClass,
  equippedArmor,
  rowToItem,
  type SheetItem,
} from "@/lib/character/sheet-items"
import { rowToSpell, type SheetSpell } from "@/lib/character/sheet-spells"
import { getClassResources } from "@/lib/character/resources"
import {
  getGrantedSpells,
  getGrantedFeatures,
  getGrantedProficiencies,
  type GrantedSpellRef,
  type GrantedFeatureData,
  type GrantedProficiency,
} from "@/lib/character/class-grants"

type CharDoc = Doc<"characters">
type PropDoc = Doc<"characterProperties">

export interface CharacterDerived {
  totalAbilities: Record<Ability, number>
  mods: Record<Ability, number>
  profBonus: number
  saveMods: Record<Ability, number>
  skillMods: Record<Skill, number>
  passivePerception: number
  initiative: number
  raceName: string
  classColor: string
  hitDie: number
  darkvision: number
  myProps: PropDoc[]
  items: SheetItem[]
  spells: SheetSpell[]
  resourceRows: PropDoc[]
  featRows: PropDoc[]
  casterType: CasterType
  edition: Edition
  shortRestResourceKeys: string[]
  equippedWeapons: SheetItem[]
  fightingStyleId: string | undefined
  armorClass: number
  armorName: string | undefined
  nextOrder: number
  grantedSpells: GrantedSpellRef[]
  grantedFeatures: (GrantedFeatureData & { level: number })[]
  channelDivinityOptions: (GrantedFeatureData & { level: number })[]
  grantedProficiencies: GrantedProficiency[]
}

// Pure ability/skill/save derivation from a character's stored fields. The sheet
// reads these directly (no modifier engine) — see Tangle 01KTASQJ.
function computeStats(char: CharDoc) {
  const racialBonuses = char.racialBonuses ?? {}
  const totalAbilities = Object.fromEntries(
    ABILITIES.map((a) => [a, char.baseAbilities[a] + (racialBonuses[a] ?? 0)]),
  ) as Record<Ability, number>

  const mods = Object.fromEntries(
    ABILITIES.map((a) => [a, getAbilityModifier(totalAbilities[a])]),
  ) as Record<Ability, number>

  const profBonus = getProficiencyBonus(char.level)

  const saveMods = Object.fromEntries(
    ABILITIES.map((a) => {
      const isProficient = char.savingThrowProficiencies.includes(a)
      return [a, mods[a] + (isProficient ? profBonus : 0)]
    }),
  ) as Record<Ability, number>

  const skillMods = Object.fromEntries(
    (Object.keys(SKILLS) as Skill[]).map((skill) => {
      const ability = SKILLS[skill] as Ability
      const isExpert = char.skillExpertise.includes(skill)
      const isProficient = char.skillProficiencies.includes(skill)
      const bonus = isExpert ? profBonus * 2 : isProficient ? profBonus : 0
      return [skill, mods[ability] + bonus]
    }),
  ) as Record<Skill, number>

  const passivePerception = 10 + skillMods.perception
  const initiative = mods.dexterity

  return { totalAbilities, mods, profBonus, saveMods, skillMods, passivePerception, initiative }
}

// The full derived-character-state block, shared by the standalone sheet page
// (app/characters/[id]) and the in-session "Sheet" tab. Single source of truth
// so the two surfaces can never report different numbers. AC, attack, and damage
// flow through the calculations engine via sheet-items; abilities/skills/saves
// derive directly from stored fields here.
//
// Plain function (NOT a hook): both callers derive AFTER their loading guards,
// where a hook with useMemo would break the Rules of Hooks. The derivation is
// cheap and matches the page's pre-existing per-render compute — no memo needed.
export function deriveCharacter(
  char: CharDoc,
  allProps: PropDoc[] | undefined,
  campaign: Doc<"campaigns"> | null | undefined,
): CharacterDerived {
  const stats = computeStats(char)
  const { totalAbilities, mods } = stats

  const raceName = char.subrace ? `${char.subrace} ${char.race}` : char.race
  const classColor =
    CLASS_COLORS[char.characterClass.toLowerCase()] ?? "bg-gray-600 text-white"
  const hitDie = char.hitDice[0]?.diceSize ?? 8
  // Prefer the value snapshotted at creation (works for homebrew races too);
  // fall back to the static name lookup for pre-snapshot characters.
  const darkvision = char.darkvision ?? getDarkvisionRange(char.race, char.subrace)

  const myProps = (allProps ?? [])
    .filter((p) => p.characterId === char._id)
    .sort((a, b) => a.orderIndex - b.orderIndex)
  const items = myProps.filter((p) => p.type === "item").map(rowToItem)
  const spells = myProps.filter((p) => p.type === "spell").map(rowToSpell)
  const resourceRows = myProps.filter((p) => p.type === "classResource")
  const featRows = myProps.filter((p) => p.type === "feature")
  const casterType = getCasterType(char.characterClass)
  const edition = resolveEdition(campaign?.edition)

  // Class/subclass "special procedurals" — derived live, never stored (see
  // lib/character/class-grants.ts). char.subclass may be a display name, an id,
  // or free text, so resolve it to a canonical subclass id first.
  const subclassId = getSubclassId(char.characterClass, char.subclass)
  const grantedSpells = getGrantedSpells(char.characterClass, subclassId, char.level, edition)
  // Channel Divinity options (Turn Undead + the subclass option) split out so they
  // render under the Channel Divinity resource pool as spendable actions; the rest
  // are passive Class Features. CD options use the canonical "Channel Divinity: X" name.
  const allGrantedFeatures = getGrantedFeatures(char.characterClass, subclassId, char.level, edition)
  const channelDivinityOptions = allGrantedFeatures.filter((f) => f.name.startsWith("Channel Divinity:"))
  const grantedFeatures = allGrantedFeatures.filter((f) => !f.name.startsWith("Channel Divinity:"))
  const grantedProficiencies = getGrantedProficiencies(char.characterClass, subclassId, char.level, edition)

  const shortRestResourceKeys = getClassResources(
    char.characterClass,
    char.level,
    mods,
    edition,
  )
    .filter((r) => r.rechargeOn === "shortRest")
    .map((r) => r.key)

  const equippedWeapons = items.filter(
    (i) => i.active && i.equipped && i.category === "weapon",
  )
  // The chosen fighting style (if any), stored as a feature row's data — drives
  // Defense's +1 AC and Archery's +2 ranged to-hit.
  const fightingStyleId = featRows
    .map((p) => (p.data as { fightingStyleId?: string } | undefined)?.fightingStyleId)
    .find(Boolean)
  // Pass RAW ability scores — computeArmorClass derives the DEX modifier itself.
  const armorClass = computeArmorClass(char.level, totalAbilities, items, fightingStyleId)
  const armorName = equippedArmor(items)?.name
  const nextOrder = myProps.length
    ? Math.max(...myProps.map((p) => p.orderIndex)) + 1
    : 0

  return {
    ...stats,
    raceName,
    classColor,
    hitDie,
    darkvision,
    myProps,
    items,
    spells,
    resourceRows,
    featRows,
    casterType,
    edition,
    shortRestResourceKeys,
    equippedWeapons,
    fightingStyleId,
    armorClass,
    armorName,
    nextOrder,
    grantedSpells,
    grantedFeatures,
    channelDivinityOptions,
    grantedProficiencies,
  }
}
