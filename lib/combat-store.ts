"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { toast } from "sonner"
import {
  fetchSavedEncounters,
  createSavedEncounter,
  deleteSavedEncounter,
} from "@/lib/actions/encounters"

export type CombatantType = "pc" | "npc" | "monster"

export type Condition =
  | "blinded"
  | "charmed"
  | "deafened"
  | "frightened"
  | "grappled"
  | "incapacitated"
  | "invisible"
  | "paralyzed"
  | "petrified"
  | "poisoned"
  | "prone"
  | "restrained"
  | "stunned"
  | "unconscious"
  | "exhaustion"
  | "concentrating"

export interface Combatant {
  id: string
  name: string
  type: CombatantType
  initiative: number
  initiativeBonus: number
  armorClass: number
  hitPoints: {
    current: number
    max: number
    temp: number
  }
  conditions: Condition[]
  deathSaves?: {
    successes: number
    failures: number
  }
  notes: string
  isActive: boolean
  characterId?: string // Link to PC if applicable
}

export interface SavedEncounter {
  id: string
  name: string
  combatants: Combatant[]
  round: number
  createdAt: string
}

interface CombatStore {
  combatants: Combatant[]
  currentRound: number
  activeCombatantIndex: number
  isInCombat: boolean
  savedEncounters: SavedEncounter[]
  isInitialized: boolean

  // Initialization
  initialize: () => Promise<void>

  // Combatant management
  addCombatant: (combatant: Omit<Combatant, "id" | "isActive">) => void
  removeCombatant: (id: string) => void
  updateCombatant: (id: string, data: Partial<Combatant>) => void

  // HP management
  adjustHP: (id: string, amount: number) => void
  setTempHP: (id: string, amount: number) => void

  // Condition management
  addCondition: (id: string, condition: Condition) => void
  removeCondition: (id: string, condition: Condition) => void

  // Death saves (for PCs)
  addDeathSave: (id: string, success: boolean) => void
  resetDeathSaves: (id: string) => void

  // Initiative & Turn management
  sortByInitiative: () => void
  nextTurn: () => void
  previousTurn: () => void
  setActiveCombatant: (index: number) => void

  // Round management
  incrementRound: () => void
  decrementRound: () => void
  resetRound: () => void

  // Combat state
  startCombat: () => void
  endCombat: () => void

  // Save/Load (DB-backed)
  saveEncounter: (name: string) => Promise<void>
  loadEncounter: (id: string) => void
  deleteEncounter: (id: string) => Promise<void>
  clearCombat: () => void
}

export const useCombatStore = create<CombatStore>()(
  persist(
    (set, get) => ({
      combatants: [],
      currentRound: 1,
      activeCombatantIndex: 0,
      isInCombat: false,
      savedEncounters: [],
      isInitialized: false,

      initialize: async () => {
        if (get().isInitialized) return
        try {
          const encounters = await fetchSavedEncounters()
          set({
            savedEncounters: encounters.map((e) => ({
              id: e.id,
              name: e.name,
              combatants: e.combatants as Combatant[],
              round: e.round,
              createdAt: e.createdAt.toISOString(),
            })),
            isInitialized: true,
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to load encounters"
          if (!message.includes("Not authenticated")) {
            toast.error(message)
          }
          set({ isInitialized: true })
        }
      },

      addCombatant: (combatant) =>
        set((state) => ({
          combatants: [...state.combatants, { ...combatant, id: crypto.randomUUID(), isActive: false }],
        })),

      removeCombatant: (id) =>
        set((state) => ({
          combatants: state.combatants.filter((c) => c.id !== id),
        })),

      updateCombatant: (id, data) =>
        set((state) => ({
          combatants: state.combatants.map((c) => (c.id === id ? { ...c, ...data } : c)),
        })),

      adjustHP: (id, amount) =>
        set((state) => ({
          combatants: state.combatants.map((c) => {
            if (c.id !== id) return c
            let newCurrent = c.hitPoints.current
            let newTemp = c.hitPoints.temp

            if (amount < 0) {
              // Damage - apply to temp HP first
              const damage = Math.abs(amount)
              if (newTemp > 0) {
                const tempDamage = Math.min(newTemp, damage)
                newTemp -= tempDamage
                newCurrent -= damage - tempDamage
              } else {
                newCurrent -= damage
              }
            } else {
              // Healing
              newCurrent += amount
            }

            newCurrent = Math.max(0, Math.min(newCurrent, c.hitPoints.max))

            return {
              ...c,
              hitPoints: { ...c.hitPoints, current: newCurrent, temp: newTemp },
            }
          }),
        })),

      setTempHP: (id, amount) =>
        set((state) => ({
          combatants: state.combatants.map((c) =>
            c.id === id ? { ...c, hitPoints: { ...c.hitPoints, temp: Math.max(0, amount) } } : c,
          ),
        })),

      addCondition: (id, condition) =>
        set((state) => ({
          combatants: state.combatants.map((c) =>
            c.id === id && !c.conditions.includes(condition) ? { ...c, conditions: [...c.conditions, condition] } : c,
          ),
        })),

      removeCondition: (id, condition) =>
        set((state) => ({
          combatants: state.combatants.map((c) =>
            c.id === id ? { ...c, conditions: c.conditions.filter((cond) => cond !== condition) } : c,
          ),
        })),

      addDeathSave: (id, success) =>
        set((state) => ({
          combatants: state.combatants.map((c) => {
            if (c.id !== id || !c.deathSaves) return c
            return {
              ...c,
              deathSaves: {
                successes: success ? Math.min(3, c.deathSaves.successes + 1) : c.deathSaves.successes,
                failures: !success ? Math.min(3, c.deathSaves.failures + 1) : c.deathSaves.failures,
              },
            }
          }),
        })),

      resetDeathSaves: (id) =>
        set((state) => ({
          combatants: state.combatants.map((c) =>
            c.id === id && c.deathSaves ? { ...c, deathSaves: { successes: 0, failures: 0 } } : c,
          ),
        })),

      sortByInitiative: () =>
        set((state) => ({
          combatants: [...state.combatants].sort((a, b) => {
            if (b.initiative !== a.initiative) return b.initiative - a.initiative
            return b.initiativeBonus - a.initiativeBonus // Tiebreaker
          }),
        })),

      nextTurn: () =>
        set((state) => {
          const newIndex = (state.activeCombatantIndex + 1) % state.combatants.length
          const newRound = newIndex === 0 ? state.currentRound + 1 : state.currentRound

          return {
            activeCombatantIndex: newIndex,
            currentRound: newRound,
            combatants: state.combatants.map((c, i) => ({
              ...c,
              isActive: i === newIndex,
            })),
          }
        }),

      previousTurn: () =>
        set((state) => {
          const newIndex =
            state.activeCombatantIndex === 0 ? state.combatants.length - 1 : state.activeCombatantIndex - 1
          const newRound =
            state.activeCombatantIndex === 0 && state.currentRound > 1 ? state.currentRound - 1 : state.currentRound

          return {
            activeCombatantIndex: newIndex,
            currentRound: newRound,
            combatants: state.combatants.map((c, i) => ({
              ...c,
              isActive: i === newIndex,
            })),
          }
        }),

      setActiveCombatant: (index) =>
        set((state) => ({
          activeCombatantIndex: index,
          combatants: state.combatants.map((c, i) => ({
            ...c,
            isActive: i === index,
          })),
        })),

      incrementRound: () => set((state) => ({ currentRound: state.currentRound + 1 })),

      decrementRound: () =>
        set((state) => ({
          currentRound: Math.max(1, state.currentRound - 1),
        })),

      resetRound: () => set({ currentRound: 1 }),

      startCombat: () => {
        const state = get()
        state.sortByInitiative()
        set({
          isInCombat: true,
          currentRound: 1,
          activeCombatantIndex: 0,
          combatants: get().combatants.map((c, i) => ({
            ...c,
            isActive: i === 0,
          })),
        })
      },

      endCombat: () =>
        set({
          isInCombat: false,
          combatants: get().combatants.map((c) => ({ ...c, isActive: false })),
        }),

      saveEncounter: async (name) => {
        const state = get()
        try {
          const encounter = await createSavedEncounter({
            name,
            combatants: state.combatants,
            round: state.currentRound,
          })
          set((s) => ({
            savedEncounters: [
              ...s.savedEncounters,
              {
                id: encounter.id,
                name: encounter.name,
                combatants: encounter.combatants as Combatant[],
                round: encounter.round,
                createdAt: encounter.createdAt.toISOString(),
              },
            ],
          }))
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to save encounter"
          toast.error(message)
        }
      },

      loadEncounter: (id) =>
        set((state) => {
          const encounter = state.savedEncounters.find((e) => e.id === id)
          if (!encounter) return state
          return {
            combatants: encounter.combatants,
            currentRound: encounter.round,
            activeCombatantIndex: 0,
            isInCombat: false,
          }
        }),

      deleteEncounter: async (id) => {
        try {
          await deleteSavedEncounter(id)
          set((state) => ({
            savedEncounters: state.savedEncounters.filter((e) => e.id !== id),
          }))
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to delete encounter"
          toast.error(message)
        }
      },

      clearCombat: () =>
        set({
          combatants: [],
          currentRound: 1,
          activeCombatantIndex: 0,
          isInCombat: false,
        }),
    }),
    {
      name: "feyforge-combat",
      partialize: (state) => ({
        combatants: state.combatants,
        currentRound: state.currentRound,
        activeCombatantIndex: state.activeCombatantIndex,
        isInCombat: state.isInCombat,
      }),
    },
  ),
)
