/**
 * Level-up engine — pure helpers over SRD-verified data.
 *
 * Spell-slot tables verified against the SRD full-caster and half-caster
 * progressions (full caster L5 = 4/3/2; half caster has no slots at L1, first
 * slot at L2). Warlock Pact Magic is deliberately NOT modeled here — its slots
 * are uniform-level and refresh on a short rest, which the stored
 * `{level,total,used}[]` shape doesn't represent; warlocks are routed to the
 * manual feature/slot reminder in the level-up flow instead.
 */

import { getProficiencyBonus, getAbilityModifier, type Ability } from "./constants"
import type { AbilityScores } from "./types"
import type { Edition } from "../editions"

export type CasterType = "full" | "half" | "pact" | "none"

const FULL_CASTERS = new Set(["bard", "cleric", "druid", "sorcerer", "wizard"])
const HALF_CASTERS = new Set(["paladin", "ranger"])
const PACT_CASTERS = new Set(["warlock"])

export function getCasterType(classId: string): CasterType {
  const id = classId.toLowerCase()
  if (FULL_CASTERS.has(id)) return "full"
  if (HALF_CASTERS.has(id)) return "half"
  if (PACT_CASTERS.has(id)) return "pact"
  return "none"
}

// How a class manages its spells — drives the spellbook UI branch:
//  • spellbook    Wizard: learn into a book, prepare a subset each long rest
//  • prepared     Cleric/Druid/Paladin: prepare from the full class list daily
//  • known        Sorcerer/Bard/Ranger/Warlock: a fixed known set, no daily prep
// v1 follows the 2014-style split (locked w/ Coru); 2024 only shifts prepared
// COUNTS + free-swap, which v1 doesn't hard-enforce, so the mode mapping holds.
export type PrepMode = "spellbook" | "prepared" | "known"

const SPELL_ABILITY: Record<string, Ability> = {
  wizard: "intelligence",
  cleric: "wisdom",
  druid: "wisdom",
  ranger: "wisdom",
  bard: "charisma",
  sorcerer: "charisma",
  warlock: "charisma",
  paladin: "charisma",
}

const PREP_MODE: Record<string, PrepMode> = {
  wizard: "spellbook",
  cleric: "prepared",
  druid: "prepared",
  paladin: "prepared",
  bard: "known",
  sorcerer: "known",
  ranger: "known",
  warlock: "known",
}

export interface CastingDescriptor {
  casterType: CasterType
  prepMode: PrepMode | null // null only for non-casters
  ability: Ability | null // the spellcasting ability; null for non-casters
}

// The casting "spine" for a class, derived live from its id. Curated SRD classes
// only (homebrew casters are deferred — they have no caster-type field yet), so a
// homebrew/unknown class resolves to a non-caster. No persistence: the sheet, the
// init helper, and the level-up recompute all re-derive this, so there's nothing
// to migrate and nothing to drift.
export function getCastingDescriptor(classId: string): CastingDescriptor {
  const id = classId.toLowerCase()
  const casterType = getCasterType(id)
  if (casterType === "none") return { casterType, prepMode: null, ability: null }
  return {
    casterType,
    prepMode: PREP_MODE[id] ?? "known",
    ability: SPELL_ABILITY[id] ?? "intelligence",
  }
}

// Full-caster spell slots per spell level [1st..9th], by class level.
const FULL_CASTER_SLOTS: Record<number, number[]> = {
  1: [2, 0, 0, 0, 0, 0, 0, 0, 0],
  2: [3, 0, 0, 0, 0, 0, 0, 0, 0],
  3: [4, 2, 0, 0, 0, 0, 0, 0, 0],
  4: [4, 3, 0, 0, 0, 0, 0, 0, 0],
  5: [4, 3, 2, 0, 0, 0, 0, 0, 0],
  6: [4, 3, 3, 0, 0, 0, 0, 0, 0],
  7: [4, 3, 3, 1, 0, 0, 0, 0, 0],
  8: [4, 3, 3, 2, 0, 0, 0, 0, 0],
  9: [4, 3, 3, 3, 1, 0, 0, 0, 0],
  10: [4, 3, 3, 3, 2, 0, 0, 0, 0],
  11: [4, 3, 3, 3, 2, 1, 0, 0, 0],
  12: [4, 3, 3, 3, 2, 1, 0, 0, 0],
  13: [4, 3, 3, 3, 2, 1, 1, 0, 0],
  14: [4, 3, 3, 3, 2, 1, 1, 0, 0],
  15: [4, 3, 3, 3, 2, 1, 1, 1, 0],
  16: [4, 3, 3, 3, 2, 1, 1, 1, 0],
  17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
  18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
  19: [4, 3, 3, 3, 3, 2, 1, 1, 1],
  20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
}

// Half-caster spell slots per spell level [1st..5th], by class level (paladin/
// ranger). This is the 2014 progression — no slots at level 1, first slot at L2.
const HALF_CASTER_SLOTS: Record<number, number[]> = {
  1: [0, 0, 0, 0, 0],
  2: [2, 0, 0, 0, 0],
  3: [3, 0, 0, 0, 0],
  4: [3, 0, 0, 0, 0],
  5: [4, 2, 0, 0, 0],
  6: [4, 2, 0, 0, 0],
  7: [4, 3, 0, 0, 0],
  8: [4, 3, 0, 0, 0],
  9: [4, 3, 2, 0, 0],
  10: [4, 3, 2, 0, 0],
  11: [4, 3, 3, 0, 0],
  12: [4, 3, 3, 0, 0],
  13: [4, 3, 3, 1, 0],
  14: [4, 3, 3, 1, 0],
  15: [4, 3, 3, 2, 0],
  16: [4, 3, 3, 2, 0],
  17: [4, 3, 3, 3, 1],
  18: [4, 3, 3, 3, 1],
  19: [4, 3, 3, 3, 2],
  20: [4, 3, 3, 3, 2],
}

// 2024 (SRD 5.2) half-caster slots. Paladin AND Ranger gained the Spellcasting
// feature at LEVEL 1 in 2024, so the ONLY change from the 2014 table is that level
// 1 now grants two 1st-level slots; L2-20 are byte-identical across editions.
// (Verified: Roll20 confirms the L1 feature; 5e24srd + aidedd confirm L2-20 match
// the 2014 progression.) Slot LEVELS are unchanged too.
const HALF_CASTER_SLOTS_2024: Record<number, number[]> = {
  ...HALF_CASTER_SLOTS,
  1: [2, 0, 0, 0, 0],
}

export interface SpellSlot {
  level: number
  total: number
  used: number
}

const clampLevel = (level: number): number => Math.max(1, Math.min(20, Math.round(level)))

/**
 * Spell-slot totals for a class at a given level, as {level,total} for each
 * spell level that has slots. Returns [] for pact/non-casters (handled
 * separately).
 */
export function getSpellSlotsForClassLevel(
  classId: string,
  level: number,
  edition: Edition,
): { level: number; total: number }[] {
  const type = getCasterType(classId)
  const halfTable = edition === "2024" ? HALF_CASTER_SLOTS_2024 : HALF_CASTER_SLOTS
  const table = type === "full" ? FULL_CASTER_SLOTS : type === "half" ? halfTable : null
  if (!table) return []
  return table[clampLevel(level)]
    .map((total, i) => ({ level: i + 1, total }))
    .filter((s) => s.total > 0)
}

// Warlock Pact Magic: a small number of slots, ALL at the same (highest castable)
// level, recharging on a SHORT rest. The {level,total,used}[] shape can't be filled
// by the full/half tables — pact is one pool — so it gets its own [count, slotLevel]
// table (SRD, shared 2014/2024). At L9+ all slots are 5th level.
const PACT_SLOTS: Record<number, [count: number, slotLevel: number]> = {
  1: [1, 1], 2: [2, 1], 3: [2, 2], 4: [2, 2], 5: [2, 3], 6: [2, 3], 7: [2, 4],
  8: [2, 4], 9: [2, 5], 10: [2, 5], 11: [3, 5], 12: [3, 5], 13: [3, 5], 14: [3, 5],
  15: [3, 5], 16: [3, 5], 17: [4, 5], 18: [4, 5], 19: [4, 5], 20: [4, 5],
}

// Pact slots as a single {level,total,used} pool. Returns [] for non-warlocks.
export function getPactSlots(level: number): SpellSlot[] {
  const entry = PACT_SLOTS[clampLevel(level)]
  if (!entry) return []
  const [count, slotLevel] = entry
  return [{ level: slotLevel, total: count, used: 0 }]
}

// Cantrips known by class & level (SRD; breakpoints at 1 / 4 / 10). Half-casters
// (paladin/ranger) get none → 0. A guidance count, not a hard cap. Edition-stable
// for these SRD classes.
const CANTRIPS_KNOWN: Record<string, [l1to3: number, l4to9: number, l10plus: number]> = {
  bard: [2, 3, 4],
  cleric: [3, 4, 5],
  druid: [2, 3, 4],
  sorcerer: [4, 5, 6],
  warlock: [2, 3, 4],
  wizard: [3, 4, 5],
}

export function getCantripsKnown(classId: string, level: number): number {
  const t = CANTRIPS_KNOWN[classId.toLowerCase()]
  if (!t) return 0
  const l = clampLevel(level)
  return l >= 10 ? t[2] : l >= 4 ? t[1] : t[0]
}

// Spells known by class & level (index 0 = level 1 … 19 = level 20), for the
// fixed-known casters. VERIFIED against Open5e's SRD class tables (2014 SRD 5.1);
// see the spell-limit display. Prepared/spellbook casters use a formula instead.
const SPELLS_KNOWN: Record<string, number[]> = {
  bard:     [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22],
  sorcerer: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15],
  ranger:   [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11],
  warlock:  [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
}

// 2024 (SRD 5.2) "Prepared Spells" progression SHARED by all five full casters
// (Bard/Cleric/Druid/Sorcerer/Wizard). Index 0 = level 1. VERIFIED against three
// independent reads of the SRD 5.2 class tables (5e24srd Cleric + Sorcerer, aidedd
// Cleric — all identical). 2024 collapses "known" into a fixed prepared count.
const PREPARED_2024_FULL: number[] = [
  4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22,
]

// 2024 (SRD 5.2) prepared-spell counts for HALF-casters. Paladin and Ranger share
// one table (verified: 5e24srd paladin == 5e24srd ranger, cross-checked vs aidedd
// ranger). The L9/L10 value is 9 per 5e24srd's corroborating reads; aidedd shows 8
// there — a soft-guidance discrepancy on this non-blocking count, not the slots.
const PREPARED_2024_HALF: number[] = [
  2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15,
]

// 2024 (SRD 5.2) prepared-spell counts for the WARLOCK. 2024 makes the warlock a
// prepared caster; the pact SLOT pool itself is unchanged from 2014 (PACT_SLOTS).
// Verified vs aidedd + the L9=10 / L11=11 figures in the SRD warlock text.
const PREPARED_2024_WARLOCK: number[] = [
  2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15,
]

export interface SpellLimits {
  cantrips: number
  // Display label for the leveled-spell cap ("Prepared" or "Spells known").
  leveledLabel: string
  leveled: number
}

// How many cantrips + leveled spells a caster should have at a level — guidance
// for the sheet, not hard-enforced.
//
// EDITION HANDLING: in 2024 EVERY caster type uses its verified fixed prepared-
// count table (full → PREPARED_2024_FULL, half → PREPARED_2024_HALF, pact →
// PREPARED_2024_WARLOCK) under the "Prepared" label, because 2024 collapses the old
// "known" casters into fixed prepared counts. In 2014 the known casters (bard/
// sorcerer/ranger/warlock) read SPELLS_KNOWN and prepared/spellbook casters use the
// SRD formula (ability mod + level; paladin = mod + level/2). The internal prepMode
// enum stays 2014-style (it only drives the spellbook UI's prepare toggle); the
// COUNT + LABEL are what go edition-aware here, mirroring the v0.92.0 full-caster
// work. `abilityMod` = spellcasting mod.
export function getSpellLimits(
  classId: string,
  level: number,
  abilityMod: number,
  edition: Edition,
): SpellLimits | null {
  const id = classId.toLowerCase()
  const desc = getCastingDescriptor(id)
  if (desc.casterType === "none") return null
  const l = clampLevel(level)
  const cantrips = getCantripsKnown(id, level)

  if (edition === "2024") {
    // casterType is full | half | pact here (none returned null above).
    const table =
      desc.casterType === "full"
        ? PREPARED_2024_FULL
        : desc.casterType === "half"
          ? PREPARED_2024_HALF
          : PREPARED_2024_WARLOCK
    return { cantrips, leveledLabel: "Prepared", leveled: table[l - 1] ?? 0 }
  }

  if (desc.prepMode === "known") {
    return { cantrips, leveledLabel: "Spells known", leveled: SPELLS_KNOWN[id]?.[l - 1] ?? 0 }
  }

  // prepared + spellbook casters (2014 logic)
  const hasSlots = desc.casterType === "pact" || getSpellSlotsForClassLevel(id, level, edition).length > 0
  if (!hasSlots) return { cantrips, leveledLabel: "Prepared", leveled: 0 }
  const leveled =
    id === "paladin"
      ? Math.max(1, abilityMod + Math.floor(l / 2))
      : Math.max(1, abilityMod + l)
  return { cantrips, leveledLabel: "Prepared", leveled }
}

// Highest spell level a caster can currently cast — the cap for which spells they
// can learn/prepare. Drives the picker's level-gating. Derived from the slot pools
// (edition-agnostic), so it's 0 for a slotless level-1 half-caster.
export function maxSpellLevel(spellSlots: { level: number }[]): number {
  return spellSlots.length ? Math.max(...spellSlots.map((s) => s.level)) : 0
}

export interface InitializedSpellcasting {
  ability: Ability
  spellSaveDC: number
  spellAttackBonus: number
  spellSlots: SpellSlot[]
  cantripsKnown: number
}

// Build a caster's spellcasting block at a given level from class + ability scores.
// Returns null for non-casters. Pact casters get their dedicated slot pool; full/
// half casters get the standard table (half-casters are slotless until L2 → an
// empty-but-valid block, which is what lets the L2 level-up recompute kick in).
// Called both at creation and by the sheet's lazy "enable spellcasting" card, so a
// caster created before this feature still gets a block on demand.
export function initSpellcasting(
  classId: string,
  level: number,
  baseAbilities: AbilityScores,
  edition: Edition,
  racialBonuses?: Partial<AbilityScores>,
): InitializedSpellcasting | null {
  const desc = getCastingDescriptor(classId)
  if (desc.casterType === "none" || !desc.ability) return null

  const score = baseAbilities[desc.ability] + (racialBonuses?.[desc.ability] ?? 0)
  const mod = getAbilityModifier(score)
  const prof = getProficiencyBonus(clampLevel(level))
  const spellSlots =
    desc.casterType === "pact"
      ? getPactSlots(level)
      : getSpellSlotsForClassLevel(classId, level, edition).map((s) => ({ ...s, used: 0 }))

  return {
    ability: desc.ability,
    spellSaveDC: 8 + prof + mod,
    spellAttackBonus: prof + mod,
    spellSlots,
    cantripsKnown: getCantripsKnown(classId, level),
  }
}

/** Average HP gained per level after 1st: hit die average (d6→4, d8→5, d10→6, d12→7). */
export const avgHitDieRoll = (hitDie: number): number => Math.floor(hitDie / 2) + 1

/**
 * HP gained for a single level-up. Uses the rolled value if provided, else the
 * fixed average. Floored at 1 per RAW (a negative CON mod can't reduce a level's
 * gain below 1).
 */
export function hpGainForLevel(hitDie: number, conMod: number, roll?: number): number {
  const base = roll ?? avgHitDieRoll(hitDie)
  return Math.max(1, base + conMod)
}

export interface RecomputedSpellcasting {
  ability: string
  spellSaveDC: number
  spellAttackBonus: number
  spellSlots: SpellSlot[]
  cantripsKnown: number
  spellsKnown?: number
  spellsPrepared?: number
}

/**
 * Recompute a caster's spellcasting block at a new level. DC and attack bonus
 * always rescale with proficiency (both are STORED, not derived). Spell slots are
 * recomputed for full/half/pact casters, preserving `used` (clamped to the new
 * total); cantrips-known is rescaled too (full casters gain cantrips at 4/10).
 */
export function recomputeSpellcasting(
  existing: RecomputedSpellcasting,
  classId: string,
  newLevel: number,
  abilityMod: number,
  edition: Edition,
): RecomputedSpellcasting {
  const prof = getProficiencyBonus(newLevel)
  const type = getCasterType(classId)

  let spellSlots = existing.spellSlots
  if (type === "full" || type === "half") {
    const totals = getSpellSlotsForClassLevel(classId, newLevel, edition)
    spellSlots = totals.map(({ level, total }) => {
      const prev = existing.spellSlots.find((s) => s.level === level)
      return { level, total, used: Math.min(prev?.used ?? 0, total) }
    })
  } else if (type === "pact") {
    spellSlots = getPactSlots(newLevel).map((s) => {
      const prev = existing.spellSlots.find((p) => p.level === s.level)
      return { ...s, used: Math.min(prev?.used ?? 0, s.total) }
    })
  }

  return {
    ...existing,
    spellSaveDC: 8 + prof + abilityMod,
    spellAttackBonus: prof + abilityMod,
    spellSlots,
    cantripsKnown: getCantripsKnown(classId, newLevel),
  }
}

// Levels at which a class gains an Ability Score Improvement (and thus may take a
// feat instead). Standard progression is 4/8/12/16/19; Fighter gains two extra
// (6, 14) and Rogue one extra (10). Identical in the 2014 and 2024 rulesets.
export function getAsiLevels(classId: string): number[] {
  switch (classId.toLowerCase()) {
    case "fighter":
      return [4, 6, 8, 12, 14, 16, 19]
    case "rogue":
      return [4, 8, 10, 12, 16, 19]
    default:
      return [4, 8, 12, 16, 19]
  }
}

export function isAsiLevel(classId: string, level: number): boolean {
  return getAsiLevels(classId).includes(level)
}
