"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface DiceRollResult {
  id: string
  expression: string
  rolls: number[]
  modifier: number
  total: number
  dieType: number
  count: number
  isAdvantage?: boolean
  isDisadvantage?: boolean
  timestamp: Date
}

export interface SavedRoll {
  id: string
  name: string
  expression: string
}

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

  // Advantage/Disadvantage toggle
  rollMode: "normal" | "advantage" | "disadvantage"
  setRollMode: (mode: "normal" | "advantage" | "disadvantage") => void
}

export const useDiceStore = create<DiceStore>()(
  persist(
    (set) => ({
      // Roll history
      rollHistory: [],
      addRoll: (roll) =>
        set((state) => ({
          rollHistory: [roll, ...state.rollHistory].slice(0, 50), // Keep last 50 rolls
          currentResult: roll,
        })),
      clearHistory: () => set({ rollHistory: [] }),

      // Saved rolls
      savedRolls: [
        { id: "default-1", name: "Fireball", expression: "8d6" },
        { id: "default-2", name: "Longsword", expression: "1d8+3" },
        { id: "default-3", name: "Sneak Attack", expression: "3d6" },
      ],
      addSavedRoll: (roll) =>
        set((state) => ({
          savedRolls: [...state.savedRolls, roll],
        })),
      removeSavedRoll: (id) =>
        set((state) => ({
          savedRolls: state.savedRolls.filter((r) => r.id !== id),
        })),
      updateSavedRoll: (id, updates) =>
        set((state) => ({
          savedRolls: state.savedRolls.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        })),

      // Current roll state
      isRolling: false,
      setIsRolling: (rolling) => set({ isRolling: rolling }),
      currentResult: null,
      setCurrentResult: (result) => set({ currentResult: result }),

      // Roll mode
      rollMode: "normal",
      setRollMode: (mode) => set({ rollMode: mode }),
    }),
    {
      name: "feyforge-dice-store",
      partialize: (state) => ({
        rollHistory: state.rollHistory,
        savedRolls: state.savedRolls,
      }),
    }
  )
)

// Helper function to parse dice expressions
export function parseDiceExpression(expression: string): {
  count: number
  sides: number
  modifier: number
} | null {
  const match = expression.match(/^(\d*)d(\d+)([+-]\d+)?$/i)
  if (!match) return null

  const count = parseInt(match[1]) || 1
  const sides = parseInt(match[2])
  const modifier = match[3] ? parseInt(match[3]) : 0

  if (sides <= 0 || count <= 0 || count > 100) return null

  return { count, sides, modifier }
}

// Helper function to roll dice
export function rollDice(
  sides: number,
  count: number = 1,
  modifier: number = 0,
  options?: {
    isAdvantage?: boolean
    isDisadvantage?: boolean
    label?: string
  }
): DiceRollResult {
  const rolls: number[] = []

  // For advantage/disadvantage, roll twice
  if ((options?.isAdvantage || options?.isDisadvantage) && sides === 20 && count === 1) {
    const roll1 = Math.floor(Math.random() * sides) + 1
    const roll2 = Math.floor(Math.random() * sides) + 1
    rolls.push(roll1, roll2)

    const selectedRoll = options?.isAdvantage
      ? Math.max(roll1, roll2)
      : Math.min(roll1, roll2)

    return {
      id: crypto.randomUUID(),
      expression: options?.label || `1d20${modifier >= 0 ? "+" : ""}${modifier !== 0 ? modifier : ""}`,
      rolls,
      modifier,
      total: selectedRoll + modifier,
      dieType: sides,
      count: 1,
      isAdvantage: options?.isAdvantage,
      isDisadvantage: options?.isDisadvantage,
      timestamp: new Date(),
    }
  }

  // Normal rolling
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1)
  }

  const total = rolls.reduce((sum, r) => sum + r, 0) + modifier

  return {
    id: crypto.randomUUID(),
    expression:
      options?.label ||
      `${count}d${sides}${modifier >= 0 ? "+" : ""}${modifier !== 0 ? modifier : ""}`,
    rolls,
    modifier,
    total,
    dieType: sides,
    count,
    isAdvantage: options?.isAdvantage,
    isDisadvantage: options?.isDisadvantage,
    timestamp: new Date(),
  }
}
