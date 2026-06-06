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
import { getEffectiveCasterType, type CasterType } from "@/lib/character/leveling"
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
  getCritRange,
  hasDraconicResilience,
  type GrantedSpellRef,
  type GrantedFeatureData,
  type GrantedProficiency,
} from "@/lib/character/class-grants"
import { getCircleSpells } from "@/lib/character/circle-of-the-land"

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
  formRows: PropDoc[]
  companionRows: PropDoc[]
  invocationRows: PropDoc[]
  maneuverRows: PropDoc[]
  landCircleRow: PropDoc | undefined
  landCircleTerrain: string | undefined
  casterType: CasterType
  edition: Edition
  subclassId: string | undefined
  shortRestResourceKeys: string[]
  equippedWeapons: SheetItem[]
  fightingStyleId: string | undefined
  armorClass: number
  critRange: number
  // Draconic Resilience +1 HP/level: how much SHOULD be baked into max HP (level
  // if a draconic sorcerer, else 0) and the marker row tracking how much IS baked.
  // A reconciliation card applies the delta — kept in stored max so combat (which
  // reads stored max server-side) stays consistent.
  draconicHpExpected: number
  draconicHpRow: PropDoc | undefined
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
  const formRows = myProps.filter((p) => p.type === "alternateForm")
  const companionRows = myProps.filter((p) => p.type === "companion")
  const invocationRows = myProps.filter((p) => p.type === "invocation")
  const maneuverRows = myProps.filter((p) => p.type === "maneuver")
  // Circle of the Land stores a single chosen terrain (Druid Land circle).
  const landCircleRow = myProps.find((p) => p.type === "landCircle")
  const landCircleTerrain = (landCircleRow?.data as { terrain?: string } | undefined)?.terrain
  const edition = resolveEdition(campaign?.edition)

  // Class/subclass "special procedurals" — derived live, never stored (see
  // lib/character/class-grants.ts). char.subclass may be a display name, an id,
  // or free text, so resolve it to a canonical subclass id first.
  const subclassId = getSubclassId(char.characterClass, char.subclass)
  // Effective caster type so Eldritch Knight / Arcane Trickster (third-casters via
  // subclass) get the full spellcasting UI; class-only casters are unaffected.
  const casterType = getEffectiveCasterType(char.characterClass, subclassId)
  // Subclass-granted always-prepared spells (cleric domain / paladin oath / warlock
  // patron). Circle of the Land's terrain spells depend on a STORED choice, so they
  // ride alongside the static grants rather than living in the CLASS_GRANTS table.
  const grantedSpells = [
    ...getGrantedSpells(char.characterClass, subclassId, char.level, edition),
    ...(subclassId === "land" ? getCircleSpells(landCircleTerrain, char.level) : []),
  ]
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
    subclassId,
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
  // Numeric subclass auto-applies (derive-live, see class-grants): Draconic
  // Resilience bumps unarmored AC to 13 + Dex; Champion lowers the crit threshold.
  const draconicResilience = hasDraconicResilience(char.characterClass, subclassId)
  const critRange = getCritRange(char.characterClass, subclassId, char.level)
  // Draconic Resilience grants +1 max HP per sorcerer level. Expected = level when
  // active; the marker row records how much is currently baked into stored max.
  const draconicHpExpected = draconicResilience ? char.level : 0
  const draconicHpRow = myProps.find(
    (p) =>
      p.type === "hpAdjustment" &&
      (p.data as { source?: string } | undefined)?.source === "draconic-resilience",
  )
  // Pass RAW ability scores — computeArmorClass derives the DEX modifier itself.
  const armorClass = computeArmorClass(char.level, totalAbilities, items, fightingStyleId, draconicResilience)
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
    formRows,
    companionRows,
    invocationRows,
    maneuverRows,
    landCircleRow,
    landCircleTerrain,
    subclassId,
    casterType,
    edition,
    shortRestResourceKeys,
    equippedWeapons,
    fightingStyleId,
    armorClass,
    critRange,
    draconicHpExpected,
    draconicHpRow,
    armorName,
    nextOrder,
    grantedSpells,
    grantedFeatures,
    channelDivinityOptions,
    grantedProficiencies,
  }
}
