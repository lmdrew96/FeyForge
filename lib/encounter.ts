// Encounter difficulty engine — pure functions over SRD-verified data tables.
// Branches on the campaign edition flag (see lib/editions.ts).
//
// Data sources (verified against authoritative references, not memory):
//  - XP by CR: same in both editions (2014 DMG / 2024 DMG monster XP table).
//  - 2014: per-character XP thresholds by level + encounter multiplier ladder
//    (DMG p.82-83). Difficulty bands: Easy / Medium / Hard / Deadly.
//  - 2024: per-character XP budget by level, no multiplier. Bands: Low /
//    Moderate / High. (The fiddly 2014 multiplier table was removed in 2024.)

import { type Edition } from "./editions"

// ── XP by Challenge Rating (both editions) ──────────────────────────────────
// CR 0 monsters that can fight are worth 10 XP (non-combatants are 0 — we treat
// any CR-0 monster added to an encounter as 10).
export const XP_BY_CR: Record<string, number> = {
  "0": 10,
  "1/8": 25,
  "1/4": 50,
  "1/2": 100,
  "1": 200,
  "2": 450,
  "3": 700,
  "4": 1100,
  "5": 1800,
  "6": 2300,
  "7": 2900,
  "8": 3900,
  "9": 5000,
  "10": 5900,
  "11": 7200,
  "12": 8400,
  "13": 10000,
  "14": 11500,
  "15": 13000,
  "16": 15000,
  "17": 18000,
  "18": 20000,
  "19": 22000,
  "20": 25000,
  "21": 33000,
  "22": 41000,
  "23": 50000,
  "24": 62000,
  "25": 75000,
  "26": 90000,
  "27": 105000,
  "28": 120000,
  "29": 135000,
  "30": 155000,
}

// Resolve a monster's XP. Prefer the Open5e `challenge_rating` string ("1/4");
// fall back to converting the numeric `cr` (0.25 → "1/4") so a string miss
// never silently contributes 0 XP.
export function crToXp(challengeRating?: string, numericCr?: number): number {
  if (challengeRating && challengeRating in XP_BY_CR) return XP_BY_CR[challengeRating]
  if (numericCr !== undefined) {
    const key =
      numericCr === 0.125 ? "1/8" : numericCr === 0.25 ? "1/4" : numericCr === 0.5 ? "1/2" : String(numericCr)
    if (key in XP_BY_CR) return XP_BY_CR[key]
  }
  return 0
}

// ── 2014: per-character XP thresholds by level [easy, medium, hard, deadly] ──
export const THRESHOLDS_2014: Record<number, [number, number, number, number]> = {
  1: [25, 50, 75, 100],
  2: [50, 100, 150, 200],
  3: [75, 150, 225, 400],
  4: [125, 250, 375, 500],
  5: [250, 500, 750, 1100],
  6: [300, 600, 900, 1400],
  7: [350, 750, 1100, 1700],
  8: [450, 900, 1400, 2100],
  9: [550, 1100, 1600, 2400],
  10: [600, 1200, 1900, 2800],
  11: [800, 1600, 2400, 3600],
  12: [1000, 2000, 3000, 4500],
  13: [1100, 2200, 3400, 5100],
  14: [1250, 2500, 3800, 5700],
  15: [1400, 2800, 4300, 6400],
  16: [1600, 3200, 4800, 7200],
  17: [2000, 3900, 5900, 8800],
  18: [2100, 4200, 6300, 9500],
  19: [2400, 4900, 7300, 10900],
  20: [2800, 5700, 8500, 12700],
}

// ── 2024: per-character XP budget by level [low, moderate, high] ─────────────
export const BUDGET_2024: Record<number, [number, number, number]> = {
  1: [50, 75, 100],
  2: [100, 150, 200],
  3: [150, 225, 400],
  4: [250, 375, 500],
  5: [500, 750, 1100],
  6: [600, 1000, 1400],
  7: [750, 1300, 1700],
  8: [1000, 1700, 2100],
  9: [1300, 2000, 2600],
  10: [1600, 2300, 3100],
  11: [1900, 2900, 4100],
  12: [2200, 3700, 4700],
  13: [2600, 4200, 5400],
  14: [2900, 4900, 6200],
  15: [3300, 5400, 7800],
  16: [3800, 6100, 9800],
  17: [4500, 7200, 11700],
  18: [5000, 8700, 14200],
  19: [5500, 10700, 17200],
  20: [6400, 13200, 22000],
}

// ── 2014 encounter multiplier (DMG p.82-83) ─────────────────────────────────
// The ladder of multipliers; monster count picks a base rung, then party size
// steps it (small party → next higher rung, large party → next lower).
const MULTIPLIER_LADDER = [0.5, 1, 1.5, 2, 2.5, 3, 4]

function baseMultiplierIndex(monsterCount: number): number {
  if (monsterCount <= 1) return 1 // ×1
  if (monsterCount === 2) return 2 // ×1.5
  if (monsterCount <= 6) return 3 // ×2
  if (monsterCount <= 10) return 4 // ×2.5
  if (monsterCount <= 14) return 5 // ×3
  return 6 // ×4
}

export function encounterMultiplier2014(monsterCount: number, partySize: number): number {
  if (monsterCount <= 0) return 1
  let idx = baseMultiplierIndex(monsterCount)
  if (partySize < 3) idx += 1
  else if (partySize >= 6) idx -= 1
  idx = Math.max(0, Math.min(MULTIPLIER_LADDER.length - 1, idx))
  return MULTIPLIER_LADDER[idx]
}

// ── Public compute API ───────────────────────────────────────────────────────

export interface EncounterMonster {
  challengeRating?: string
  cr?: number
  quantity: number
}

export interface DifficultyBand {
  label: string
  partyBudget: number
}

export interface EncounterResult {
  edition: Edition
  partySize: number
  monsterCount: number
  /** Raw summed monster XP — this is the XP award for defeating them. */
  monsterXpTotal: number
  /** 2014 encounter multiplier (1 for 2024). */
  multiplier: number
  /** 2014: monsterXpTotal × multiplier. 2024: equals monsterXpTotal. Drives difficulty. */
  adjustedXp: number
  /** Difficulty bands with the party's summed budget, ascending. */
  bands: DifficultyBand[]
  /** Computed band label, or "Trivial" when below the lowest band. */
  difficulty: string
}

const BANDS_2014 = ["Easy", "Medium", "Hard", "Deadly"] as const
const BANDS_2024 = ["Low", "Moderate", "High"] as const

const clampLevel = (level: number): number => Math.max(1, Math.min(20, Math.round(level)))

// Highest band whose budget the XP meets or exceeds (>=, so landing exactly on
// a threshold counts as that band). Below the lowest non-zero band → "Trivial".
function pickDifficulty(xp: number, bands: DifficultyBand[]): string {
  let result = "Trivial"
  for (const b of bands) {
    if (b.partyBudget > 0 && xp >= b.partyBudget) result = b.label
  }
  return result
}

export function computeEncounter(party: number[], monsters: EncounterMonster[], edition: Edition): EncounterResult {
  const partySize = party.length
  const monsterCount = monsters.reduce((n, m) => n + Math.max(0, m.quantity), 0)
  const monsterXpTotal = monsters.reduce(
    (sum, m) => sum + crToXp(m.challengeRating, m.cr) * Math.max(0, m.quantity),
    0
  )

  if (edition === "2024") {
    const totals = [0, 0, 0]
    for (const lvl of party) {
      const row = BUDGET_2024[clampLevel(lvl)]
      totals[0] += row[0]
      totals[1] += row[1]
      totals[2] += row[2]
    }
    const bands: DifficultyBand[] = BANDS_2024.map((label, i) => ({ label, partyBudget: totals[i] }))
    return {
      edition,
      partySize,
      monsterCount,
      monsterXpTotal,
      multiplier: 1,
      adjustedXp: monsterXpTotal,
      bands,
      difficulty: pickDifficulty(monsterXpTotal, bands),
    }
  }

  // 2014
  const totals = [0, 0, 0, 0]
  for (const lvl of party) {
    const row = THRESHOLDS_2014[clampLevel(lvl)]
    for (let i = 0; i < 4; i++) totals[i] += row[i]
  }
  const multiplier = encounterMultiplier2014(monsterCount, partySize)
  const adjustedXp = Math.round(monsterXpTotal * multiplier)
  const bands: DifficultyBand[] = BANDS_2014.map((label, i) => ({ label, partyBudget: totals[i] }))
  return {
    edition,
    partySize,
    monsterCount,
    monsterXpTotal,
    multiplier,
    adjustedXp,
    bands,
    difficulty: pickDifficulty(adjustedXp, bands),
  }
}
