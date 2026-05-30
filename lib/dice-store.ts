"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

// ── Result shape ────────────────────────────────────────────────────────────────
// A roll is a list of dice groups (terms) plus a flat modifier. Each term keeps the
// individual dice so the UI can show "you rolled a nat 20", not just the sum.

export interface DiceTerm {
  sides: number // e.g. 20 for a d20
  rolls: number[] // every die rolled for this term (post-crit doubling)
  dropped: number[] // dice rolled but not counted (advantage/disadvantage)
  subtotal: number // this term's contribution to the total
}

export interface DiceRollResult {
  id: string
  expression: string // normalized, e.g. "1d8 + 3d6 + 2"
  terms: DiceTerm[]
  modifier: number // sum of flat (non-dice) modifiers
  total: number
  isAdvantage?: boolean
  isDisadvantage?: boolean
  isCrit?: boolean
  label?: string // optional name (e.g. a saved roll like "Fireball")
  timestamp: string // ISO string — survives localStorage persistence
}

export interface SavedRoll {
  id: string
  name: string
  expression: string
}

export type RollMode = "normal" | "advantage" | "disadvantage"

interface RollOptions {
  mode?: RollMode
  crit?: boolean
  label?: string
}

// ── Store ───────────────────────────────────────────────────────────────────────

interface DiceStore {
  // Roll history (persisted)
  rollHistory: DiceRollResult[]
  addRoll: (roll: DiceRollResult) => void
  clearHistory: () => void

  // Saved rolls (persisted)
  savedRolls: SavedRoll[]
  addSavedRoll: (roll: SavedRoll) => void
  removeSavedRoll: (id: string) => void
  updateSavedRoll: (id: string, updates: Partial<SavedRoll>) => void

  // Current roll state (not persisted)
  isRolling: boolean
  setIsRolling: (rolling: boolean) => void
  currentResult: DiceRollResult | null
  setCurrentResult: (result: DiceRollResult | null) => void

  // Roll mode + crit toggle (not persisted)
  rollMode: RollMode
  setRollMode: (mode: RollMode) => void
  crit: boolean
  setCrit: (crit: boolean) => void
}

export const useDiceStore = create<DiceStore>()(
  persist(
    (set) => ({
      rollHistory: [],
      addRoll: (roll) =>
        set((state) => ({
          rollHistory: [roll, ...state.rollHistory].slice(0, 50), // keep last 50
          currentResult: roll,
        })),
      clearHistory: () => set({ rollHistory: [] }),

      savedRolls: [
        { id: "default-1", name: "Fireball", expression: "8d6" },
        { id: "default-2", name: "Longsword", expression: "1d8+3" },
        { id: "default-3", name: "Sneak Attack", expression: "1d8+3d6" },
      ],
      addSavedRoll: (roll) =>
        set((state) => ({ savedRolls: [...state.savedRolls, roll] })),
      removeSavedRoll: (id) =>
        set((state) => ({
          savedRolls: state.savedRolls.filter((r) => r.id !== id),
        })),
      updateSavedRoll: (id, updates) =>
        set((state) => ({
          savedRolls: state.savedRolls.map((r) =>
            r.id === id ? { ...r, ...updates } : r,
          ),
        })),

      isRolling: false,
      setIsRolling: (rolling) => set({ isRolling: rolling }),
      currentResult: null,
      setCurrentResult: (result) => set({ currentResult: result }),

      rollMode: "normal",
      setRollMode: (mode) => set({ rollMode: mode }),
      crit: false,
      setCrit: (crit) => set({ crit }),
    }),
    {
      name: "feyforge-dice-store",
      partialize: (state) => ({
        rollHistory: state.rollHistory,
        savedRolls: state.savedRolls,
      }),
    },
  ),
)

// ── Parsing ─────────────────────────────────────────────────────────────────────

export interface ParsedTerm {
  type: "dice" | "flat"
  sign: 1 | -1
  count?: number // dice only
  sides?: number // dice only
  value?: number // flat only
}

const MAX_DICE = 100 // safety cap on total dice in one expression

/**
 * Parse a dice expression into signed terms.
 * Handles multiple dice groups and flat modifiers:
 *   "1d20+5", "8d6", "1d8+3d6+2", "d20", "2d6 + 1d8 - 1", "+1d4"
 * Returns null on anything it can't fully consume.
 */
export function parseDiceExpression(expression: string): ParsedTerm[] | null {
  // Collapse whitespace around +/- operators, then reject any leftover internal
  // whitespace — that means two terms with no operator (e.g. "1d6 1d6"), which
  // would otherwise silently merge into a bogus "1d61" die.
  const collapsed = expression.trim().replace(/\s*([+-])\s*/g, "$1")
  if (/\s/.test(collapsed)) return null
  const cleaned = collapsed.toLowerCase()
  if (!cleaned) return null

  const tokenRe = /([+-]?)(?:(\d*)d(\d+)|(\d+))/g
  const terms: ParsedTerm[] = []
  let consumed = 0
  let totalDice = 0
  let match: RegExpExecArray | null

  while ((match = tokenRe.exec(cleaned)) !== null) {
    // Reject gaps — every character must be part of a valid token.
    if (match.index !== consumed) return null
    consumed += match[0].length

    const sign: 1 | -1 = match[1] === "-" ? -1 : 1
    const isDice = match[3] !== undefined

    if (isDice) {
      const count = match[2] === "" ? 1 : parseInt(match[2], 10)
      const sides = parseInt(match[3], 10)
      if (count <= 0 || sides <= 1) return null
      totalDice += count
      if (totalDice > MAX_DICE) return null
      terms.push({ type: "dice", sign, count, sides })
    } else {
      const value = parseInt(match[4], 10)
      terms.push({ type: "flat", sign, value })
    }
  }

  if (consumed !== cleaned.length || terms.length === 0) return null
  return terms
}

/** Pretty-print parsed terms back into a normalized expression string. */
export function formatExpression(terms: ParsedTerm[]): string {
  return terms
    .map((t, i) => {
      const body =
        t.type === "dice" ? `${t.count}d${t.sides}` : `${t.value}`
      if (i === 0) return t.sign === -1 ? `-${body}` : body
      return t.sign === -1 ? ` - ${body}` : ` + ${body}`
    })
    .join("")
}

// ── Rolling ─────────────────────────────────────────────────────────────────────

const rollOne = (sides: number) => Math.floor(Math.random() * sides) + 1

/**
 * Roll a parsed expression.
 * - Advantage/disadvantage applies to a single d20 (the canonical case): the term
 *   rolls two d20s and keeps the higher/lower; the other is recorded as dropped.
 * - Crit doubles the number of dice rolled for every dice term (damage dice),
 *   never the flat modifier.
 */
export function rollParsed(
  terms: ParsedTerm[],
  options?: RollOptions,
): DiceRollResult {
  const mode = options?.mode ?? "normal"
  const crit = options?.crit ?? false

  const resultTerms: DiceTerm[] = []
  let modifier = 0
  let total = 0

  const diceTermCount = terms.filter((t) => t.type === "dice").length

  for (const term of terms) {
    if (term.type === "flat") {
      const v = term.sign * (term.value ?? 0)
      modifier += v
      total += v
      continue
    }

    const sides = term.sides!
    const baseCount = term.count!
    // Crit doubles damage dice — never the d20 (a d20 is an attack/check roll,
    // not damage). This also lets a mixed attack+damage expression like
    // "1d20+3d6" crit correctly: the d20 stays single, the 3d6 doubles.
    const count = crit && sides !== 20 ? baseCount * 2 : baseCount

    const rolls: number[] = []
    const dropped: number[] = []

    const singleD20 =
      sides === 20 && baseCount === 1 && diceTermCount === 1

    if (singleD20 && mode !== "normal") {
      const a = rollOne(20)
      const b = rollOne(20)
      const kept = mode === "advantage" ? Math.max(a, b) : Math.min(a, b)
      const drop = mode === "advantage" ? Math.min(a, b) : Math.max(a, b)
      rolls.push(kept)
      dropped.push(drop)
    } else {
      for (let i = 0; i < count; i++) rolls.push(rollOne(sides))
    }

    const subtotal = term.sign * rolls.reduce((s, r) => s + r, 0)
    total += subtotal
    resultTerms.push({ sides, rolls, dropped, subtotal })
  }

  return {
    id: crypto.randomUUID(),
    expression: formatExpression(terms),
    terms: resultTerms,
    modifier,
    total,
    isAdvantage: mode === "advantage",
    isDisadvantage: mode === "disadvantage",
    isCrit: crit,
    label: options?.label,
    timestamp: new Date().toISOString(),
  }
}

/** Parse + roll a raw expression string. Returns null if the expression is invalid. */
export function rollExpression(
  expression: string,
  options?: RollOptions,
): DiceRollResult | null {
  const terms = parseDiceExpression(expression)
  if (!terms) return null
  return rollParsed(terms, options)
}

/** Convenience for the quick-die buttons (d4–d100). */
export function rollDie(
  sides: number,
  options?: RollOptions,
): DiceRollResult {
  return rollParsed([{ type: "dice", sign: 1, count: 1, sides }], options)
}
