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

import { getProficiencyBonus } from "./constants"

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
// ranger). No slots at level 1.
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
export function getSpellSlotsForClassLevel(classId: string, level: number): { level: number; total: number }[] {
  const type = getCasterType(classId)
  const table = type === "full" ? FULL_CASTER_SLOTS : type === "half" ? HALF_CASTER_SLOTS : null
  if (!table) return []
  return table[clampLevel(level)]
    .map((total, i) => ({ level: i + 1, total }))
    .filter((s) => s.total > 0)
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
 * always rescale with proficiency (both are STORED, not derived). Spell slots
 * are recomputed for full/half casters, preserving `used` (clamped to the new
 * total); pact/other casters keep their existing slots untouched.
 */
export function recomputeSpellcasting(
  existing: RecomputedSpellcasting,
  classId: string,
  newLevel: number,
  abilityMod: number
): RecomputedSpellcasting {
  const prof = getProficiencyBonus(newLevel)
  const type = getCasterType(classId)

  let spellSlots = existing.spellSlots
  if (type === "full" || type === "half") {
    const totals = getSpellSlotsForClassLevel(classId, newLevel)
    spellSlots = totals.map(({ level, total }) => {
      const prev = existing.spellSlots.find((s) => s.level === level)
      return { level, total, used: Math.min(prev?.used ?? 0, total) }
    })
  }

  return {
    ...existing,
    spellSaveDC: 8 + prof + abilityMod,
    spellAttackBonus: prof + abilityMod,
    spellSlots,
  }
}
