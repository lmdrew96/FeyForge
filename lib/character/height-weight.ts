// 5e random height & weight tables.
//
// These are the standard "Random Height and Weight" figures: a base height (in
// inches) plus a modifier die added in inches, and a base weight (lb) plus the
// height-modifier roll times a weight-modifier die. Numbers are facts/figures —
// same curated-content posture as the rest of the SRD data in this repo.
//
// Rule (PHB): roll the height-modifier die → add to base height. Roll the
// weight-modifier die → multiply by the SAME height-modifier roll → add to base
// weight. Halflings/gnomes have a flat ×1 weight modifier (weightModDie = null).

type Die = { count: number; sides: number }

type HeightWeightRow = {
  baseHeightIn: number
  heightModDie: Die
  baseWeightLb: number
  weightModDie: Die | null // null → flat ×1 multiplier
}

// Keyed by race id (lowercase). Races with size-divergent subraces resolve below.
const BY_RACE: Record<string, HeightWeightRow> = {
  human: { baseHeightIn: 56, heightModDie: { count: 2, sides: 10 }, baseWeightLb: 110, weightModDie: { count: 2, sides: 4 } },
  dragonborn: { baseHeightIn: 66, heightModDie: { count: 2, sides: 8 }, baseWeightLb: 175, weightModDie: { count: 2, sides: 6 } },
  "half-elf": { baseHeightIn: 57, heightModDie: { count: 2, sides: 8 }, baseWeightLb: 110, weightModDie: { count: 2, sides: 4 } },
  "half-orc": { baseHeightIn: 58, heightModDie: { count: 2, sides: 10 }, baseWeightLb: 140, weightModDie: { count: 2, sides: 6 } },
  tiefling: { baseHeightIn: 57, heightModDie: { count: 2, sides: 8 }, baseWeightLb: 110, weightModDie: { count: 2, sides: 4 } },
  // Halfling subraces share one row; gnome subraces share one row.
  halfling: { baseHeightIn: 31, heightModDie: { count: 2, sides: 4 }, baseWeightLb: 35, weightModDie: null },
  gnome: { baseHeightIn: 36, heightModDie: { count: 2, sides: 4 }, baseWeightLb: 35, weightModDie: null },
}

const ELF_HIGH: HeightWeightRow = { baseHeightIn: 54, heightModDie: { count: 2, sides: 10 }, baseWeightLb: 90, weightModDie: { count: 1, sides: 4 } }
const ELF_WOOD: HeightWeightRow = { baseHeightIn: 54, heightModDie: { count: 2, sides: 10 }, baseWeightLb: 100, weightModDie: { count: 1, sides: 4 } }
const ELF_DROW: HeightWeightRow = { baseHeightIn: 53, heightModDie: { count: 2, sides: 6 }, baseWeightLb: 75, weightModDie: { count: 1, sides: 6 } }
const DWARF_HILL: HeightWeightRow = { baseHeightIn: 44, heightModDie: { count: 2, sides: 4 }, baseWeightLb: 115, weightModDie: { count: 2, sides: 6 } }
const DWARF_MOUNTAIN: HeightWeightRow = { baseHeightIn: 48, heightModDie: { count: 2, sides: 4 }, baseWeightLb: 130, weightModDie: { count: 2, sides: 6 } }

// Resolve a race (+ optional subrace) to its height/weight row, or null when the
// lineage isn't in the table (homebrew races → no roll offered).
function resolveRow(race: string, subrace?: string | null): HeightWeightRow | null {
  const r = race.trim().toLowerCase()
  const s = (subrace ?? "").toLowerCase()
  if (r === "elf") {
    if (s.includes("wood")) return ELF_WOOD
    if (s.includes("drow") || s.includes("dark")) return ELF_DROW
    return ELF_HIGH // high elf is the default/typical elf
  }
  if (r === "dwarf") {
    return s.includes("mountain") ? DWARF_MOUNTAIN : DWARF_HILL
  }
  return BY_RACE[r] ?? null
}

/** Does the 5e chart cover this race? (Drives whether the Roll button shows.) */
export function hasHeightWeightTable(race: string, subrace?: string | null): boolean {
  return resolveRow(race, subrace) !== null
}

function rollDie({ count, sides }: Die): number {
  let total = 0
  for (let i = 0; i < count; i++) total += Math.floor(Math.random() * sides) + 1
  return total
}

/**
 * Roll height + weight for a race using the 5e chart. Returns display-ready
 * strings (`5'9"`, `165 lb.`) matching the free-text Appearance fields, or null
 * for an unlisted lineage. Weight is derived from the height-modifier roll, per RAW.
 */
export function rollHeightWeight(
  race: string,
  subrace?: string | null,
): { height: string; weight: string } | null {
  const row = resolveRow(race, subrace)
  if (!row) return null
  const heightMod = rollDie(row.heightModDie)
  const totalInches = row.baseHeightIn + heightMod
  const weightMod = row.weightModDie ? rollDie(row.weightModDie) : 1
  const weightLb = row.baseWeightLb + heightMod * weightMod
  const feet = Math.floor(totalInches / 12)
  const inches = totalInches % 12
  return {
    height: `${feet}'${inches}"`,
    weight: `${weightLb.toLocaleString()} lb.`,
  }
}
