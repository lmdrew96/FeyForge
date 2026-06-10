// Exhaustion rules text, edition-aware. Verified against the SRD (5.1 for 2014,
// 5.2 for 2024) via Open5e v2 conditions — do not edit from memory.
//
// 2014: six cumulative tiers (a creature suffers its level's effect AND all
// lower levels); long rest −1 (with food/drink). 2024: every d20 Test is
// reduced by 2 × level, Speed by 5 ft × level; death at level 6; long rest −1.
// Dependency-light leaf (relative imports only) so it stays unit-testable.

import type { Edition } from "../editions"

export const MAX_EXHAUSTION = 6

export const clampExhaustion = (level: number): number =>
  Math.max(0, Math.min(MAX_EXHAUSTION, Math.round(level)))

// SRD 5.1 tier effects, index 0 = level 1.
const EFFECTS_2014 = [
  "Disadvantage on ability checks",
  "Speed halved",
  "Disadvantage on attack rolls and saving throws",
  "Hit point maximum halved",
  "Speed reduced to 0",
  "Death",
] as const

// The effects in force at a given level (empty at 0). 2014 is cumulative, so
// the list grows with the level; 2024 scales two numbers.
export function exhaustionEffects(level: number, edition: Edition): string[] {
  const lvl = clampExhaustion(level)
  if (lvl === 0) return []
  if (edition === "2014") return EFFECTS_2014.slice(0, lvl)
  if (lvl >= MAX_EXHAUSTION) return ["Death (Exhaustion level 6)"]
  return [
    `−${2 * lvl} to every d20 Test (attacks, checks, saves)`,
    `Speed −${5 * lvl} ft`,
  ]
}

// One-line form for badges/tooltips.
export function exhaustionSummary(level: number, edition: Edition): string {
  return exhaustionEffects(level, edition).join("; ")
}

// ── Mechanical effect on a single d20 roll ───────────────────────────────────
// The kind of d20 Test being made. Skill, tool, ability, and initiative rolls
// are all ability CHECKS; weapon/spell attacks are "attack"; saving throws are
// "save". Used to apply 2014's roll-type-specific disadvantage tiers.
export type D20RollType = "check" | "attack" | "save"

export interface ExhaustionD20Effect {
  // Flat modifier to add to the d20 roll (2024 only; 2014 uses disadvantage).
  modifier: number
  // Whether exhaustion forces disadvantage on this roll (2014 only).
  disadvantage: boolean
}

// How exhaustion alters one d20 Test, edition-aware:
//   2024 — a flat −2 × level on EVERY d20 Test (checks, attacks, saves alike).
//   2014 — disadvantage (no flat modifier), gated by tier and roll type:
//          ability CHECKS get it from level 1+, ATTACK rolls and SAVING throws
//          from level 3+ (the level-3 tier is "disadvantage on attacks and saves").
// Returns the no-op effect at level 0 or with no exhaustion.
export function exhaustionD20Effect(
  level: number,
  edition: Edition,
  rollType: D20RollType,
): ExhaustionD20Effect {
  const lvl = clampExhaustion(level)
  if (lvl === 0) return { modifier: 0, disadvantage: false }
  if (edition === "2024") return { modifier: -2 * lvl, disadvantage: false }
  // 2014: checks from level 1, attacks + saves from level 3 (cumulative tiers).
  const disadvantage = rollType === "check" ? lvl >= 1 : lvl >= 3
  return { modifier: 0, disadvantage }
}
