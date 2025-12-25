"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface Combatant {
  id: string
  name: string
  initiative: number
  initiativeRoll?: number
  initiativeModifier: number
  currentHP: number
  maxHP: number
  armorClass: number
  conditions: string[]
  isPlayer: boolean
  isActive: boolean
  notes?: string
}

export interface EncounterRecord {
  id: string
  date: Date
  combatants: string[]
  rounds: number
  outcome?: string
}

interface CombatStore {
  combatants: Combatant[]
  currentTurn: number
  round: number
  isActive: boolean
  encounterHistory: EncounterRecord[]
  addCombatant: (combatant: Omit<Combatant, "id">) => void
  removeCombatant: (id: string) => void
  updateCombatant: (id: string, updates: Partial<Combatant>) => void
  nextTurn: () => void
  previousTurn: () => void
  startCombat: () => void
  endCombat: () => void
  resetCombat: () => void
  rollInitiative: (id: string) => void
  rollAllInitiatives: () => void
  sortByInitiative: () => void
}

export const useCombatStore = create<CombatStore>()(
  persist(
    (set, get) => ({
      combatants: [],
      currentTurn: 0,
      round: 1,
      isActive: false,
      encounterHistory: [],

      addCombatant: (combatant) =>
        set((state) => ({
          combatants: [...state.combatants, { ...combatant, id: crypto.randomUUID() }],
        })),

      removeCombatant: (id) =>
        set((state) => ({
          combatants: state.combatants.filter((c) => c.id !== id),
        })),

      updateCombatant: (id, updates) =>
        set((state) => ({
          combatants: state.combatants.map((c) => (c.id === id ? { ...c, ...updates } : c)),
        })),

      nextTurn: () =>
        set((state) => {
          const nextTurn = (state.currentTurn + 1) % state.combatants.length
          const newRound = nextTurn === 0 ? state.round + 1 : state.round
          return { currentTurn: nextTurn, round: newRound }
        }),

      previousTurn: () =>
        set((state) => {
          const prevTurn = state.currentTurn === 0 ? state.combatants.length - 1 : state.currentTurn - 1
          const newRound = state.currentTurn === 0 && state.round > 1 ? state.round - 1 : state.round
          return { currentTurn: prevTurn, round: newRound }
        }),

      startCombat: () => {
        get().sortByInitiative()
        set({ isActive: true, currentTurn: 0, round: 1 })
      },

      endCombat: () =>
        set((state) => ({
          isActive: false,
          encounterHistory: [
            ...state.encounterHistory,
            {
              id: crypto.randomUUID(),
              date: new Date(),
              combatants: state.combatants.map((c) => c.name),
              rounds: state.round,
            },
          ],
        })),

      resetCombat: () =>
        set({
          combatants: [],
          currentTurn: 0,
          round: 1,
          isActive: false,
        }),

      rollInitiative: (id) =>
        set((state) => ({
          combatants: state.combatants.map((c) => {
            if (c.id === id) {
              const roll = Math.floor(Math.random() * 20) + 1
              return {
                ...c,
                initiativeRoll: roll,
                initiative: roll + c.initiativeModifier,
              }
            }
            return c
          }),
        })),

      rollAllInitiatives: () =>
        set((state) => ({
          combatants: state.combatants.map((c) => {
            const roll = Math.floor(Math.random() * 20) + 1
            return {
              ...c,
              initiativeRoll: roll,
              initiative: roll + c.initiativeModifier,
            }
          }),
        })),

      sortByInitiative: () =>
        set((state) => ({
          combatants: [...state.combatants].sort((a, b) => b.initiative - a.initiative),
        })),
    }),
    {
      name: "dnd-combat",
    },
  ),
)

export const conditions = [
  "Blinded",
  "Charmed",
  "Deafened",
  "Frightened",
  "Grappled",
  "Incapacitated",
  "Invisible",
  "Paralyzed",
  "Petrified",
  "Poisoned",
  "Prone",
  "Restrained",
  "Stunned",
  "Unconscious",
  "Exhaustion",
  "Concentration",
]
