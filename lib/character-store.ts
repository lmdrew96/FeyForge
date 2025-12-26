"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Character, CharacterProperty, CalculatedStats } from "./character/types"
import { calculateAllStats } from "./character/calculations"

interface CharacterStore {
  // State
  characters: Character[]
  activeCharacterId: string | null
  
  // Cached calculations
  calculatedStats: Record<string, CalculatedStats>
  
  // CRUD operations
  addCharacter: (character: Character) => void
  updateCharacter: (id: string, updates: Partial<Character>) => void
  deleteCharacter: (id: string) => void
  setActiveCharacter: (id: string | null) => void
  getActiveCharacter: () => Character | undefined
  getCharacter: (id: string) => Character | undefined
  getCharactersByCampaign: (campaignId: string) => Character[]
  
  // Property management
  addProperty: (characterId: string, property: CharacterProperty) => void
  updateProperty: (characterId: string, propertyId: string, updates: Partial<CharacterProperty>) => void
  removeProperty: (characterId: string, propertyId: string) => void
  toggleProperty: (characterId: string, propertyId: string) => void
  
  // HP management
  updateHP: (characterId: string, current: number, temp?: number) => void
  healCharacter: (characterId: string, amount: number) => void
  damageCharacter: (characterId: string, amount: number) => void
  
  // Hit Dice
  useHitDie: (characterId: string, dieIndex: number) => void
  resetHitDice: (characterId: string) => void
  
  // Death Saves
  addDeathSave: (characterId: string, success: boolean) => void
  resetDeathSaves: (characterId: string) => void
  
  // Currency
  updateCurrency: (characterId: string, currency: Partial<Character['currency']>) => void
  
  // Experience & Leveling
  addExperience: (characterId: string, xp: number) => void
  setLevel: (characterId: string, level: number) => void
  
  // Recalculation
  recalculateStats: (characterId: string) => void
  getCalculatedStats: (characterId: string) => CalculatedStats | undefined
}

export const useCharacterStore = create<CharacterStore>()(
  persist(
    (set, get) => ({
      characters: [],
      activeCharacterId: null,
      calculatedStats: {},

      addCharacter: (character) => {
        // Ensure properties array exists for new characters
        const charWithProperties = {
          ...character,
          properties: character.properties || []
        }
        set((state) => ({
          characters: [...state.characters, charWithProperties],
        }))
        // Calculate stats for new character
        get().recalculateStats(character.id)
      },

      updateCharacter: (id, updates) => {
        set((state) => ({
          characters: state.characters.map((char) =>
            char.id === id ? { ...char, ...updates, updatedAt: new Date() } : char,
          ),
        }))
        // Recalculate stats after update
        get().recalculateStats(id)
      },

      deleteCharacter: (id) =>
        set((state) => ({
          characters: state.characters.filter((char) => char.id !== id),
          activeCharacterId: state.activeCharacterId === id ? null : state.activeCharacterId,
          calculatedStats: Object.fromEntries(
            Object.entries(state.calculatedStats).filter(([key]) => key !== id)
          ),
        })),

      setActiveCharacter: (id) => set({ activeCharacterId: id }),

      getActiveCharacter: () => {
        const state = get()
        return state.characters.find((char) => char.id === state.activeCharacterId)
      },
      
      getCharacter: (id) => {
        return get().characters.find((char) => char.id === id)
      },
      
      getCharactersByCampaign: (campaignId) => {
        return get().characters.filter((char) => char.campaignId === campaignId)
      },
      
      // Property management
      addProperty: (characterId, property) => {
        set((state) => ({
          characters: state.characters.map((char) =>
            char.id === characterId
              ? { 
                  ...char, 
                  properties: [...(char.properties || []), property],
                  updatedAt: new Date()
                }
              : char
          ),
        }))
        get().recalculateStats(characterId)
      },
      
      updateProperty: (characterId, propertyId, updates) => {
        set((state) => ({
          characters: state.characters.map((char) =>
            char.id === characterId
              ? {
                  ...char,
                  properties: (char.properties || []).map((prop) =>
                    prop.id === propertyId ? { ...prop, ...updates, updatedAt: new Date() } : prop
                  ),
                  updatedAt: new Date()
                }
              : char
          ),
        }))
        get().recalculateStats(characterId)
      },
      
      removeProperty: (characterId, propertyId) => {
        set((state) => ({
          characters: state.characters.map((char) =>
            char.id === characterId
              ? {
                  ...char,
                  properties: (char.properties || []).filter((prop) => prop.id !== propertyId),
                  updatedAt: new Date()
                }
              : char
          ),
        }))
        get().recalculateStats(characterId)
      },
      
      toggleProperty: (characterId, propertyId) => {
        set((state) => ({
          characters: state.characters.map((char) =>
            char.id === characterId
              ? {
                  ...char,
                  properties: (char.properties || []).map((prop) =>
                    prop.id === propertyId ? { ...prop, active: !prop.active, updatedAt: new Date() } : prop
                  ),
                  updatedAt: new Date()
                }
              : char
          ),
        }))
        get().recalculateStats(characterId)
      },
      
      // HP management
      updateHP: (characterId, current, temp) => {
        set((state) => ({
          characters: state.characters.map((char) =>
            char.id === characterId
              ? {
                  ...char,
                  hitPoints: {
                    ...char.hitPoints,
                    current: Math.max(0, Math.min(current, char.hitPoints.max)),
                    temp: temp !== undefined ? Math.max(0, temp) : char.hitPoints.temp,
                  },
                  updatedAt: new Date()
                }
              : char
          ),
        }))
      },
      
      healCharacter: (characterId, amount) => {
        const char = get().getCharacter(characterId)
        if (!char) return
        
        const newHP = Math.min(char.hitPoints.current + amount, char.hitPoints.max)
        get().updateHP(characterId, newHP)
      },
      
      damageCharacter: (characterId, amount) => {
        const char = get().getCharacter(characterId)
        if (!char) return
        
        let remaining = amount
        
        // First absorb from temp HP
        if (char.hitPoints.temp > 0) {
          if (remaining <= char.hitPoints.temp) {
            get().updateHP(characterId, char.hitPoints.current, char.hitPoints.temp - remaining)
            return
          }
          remaining -= char.hitPoints.temp
          get().updateHP(characterId, char.hitPoints.current - remaining, 0)
        } else {
          get().updateHP(characterId, char.hitPoints.current - remaining)
        }
      },
      
      // Hit Dice
      useHitDie: (characterId, dieIndex) => {
        set((state) => ({
          characters: state.characters.map((char) =>
            char.id === characterId
              ? {
                  ...char,
                  hitDice: char.hitDice.map((die, i) =>
                    i === dieIndex && die.used < die.total
                      ? { ...die, used: die.used + 1 }
                      : die
                  ),
                  updatedAt: new Date()
                }
              : char
          ),
        }))
      },
      
      resetHitDice: (characterId) => {
        set((state) => ({
          characters: state.characters.map((char) =>
            char.id === characterId
              ? {
                  ...char,
                  hitDice: char.hitDice.map((die) => ({
                    ...die,
                    used: Math.max(0, die.used - Math.ceil(die.total / 2)),
                  })),
                  updatedAt: new Date()
                }
              : char
          ),
        }))
      },
      
      // Death Saves
      addDeathSave: (characterId, success) => {
        set((state) => ({
          characters: state.characters.map((char) =>
            char.id === characterId
              ? {
                  ...char,
                  deathSaves: {
                    successes: success 
                      ? Math.min(3, char.deathSaves.successes + 1) 
                      : char.deathSaves.successes,
                    failures: !success 
                      ? Math.min(3, char.deathSaves.failures + 1) 
                      : char.deathSaves.failures,
                  },
                  updatedAt: new Date()
                }
              : char
          ),
        }))
      },
      
      resetDeathSaves: (characterId) => {
        set((state) => ({
          characters: state.characters.map((char) =>
            char.id === characterId
              ? {
                  ...char,
                  deathSaves: { successes: 0, failures: 0 },
                  updatedAt: new Date()
                }
              : char
          ),
        }))
      },
      
      // Currency
      updateCurrency: (characterId, currency) => {
        set((state) => ({
          characters: state.characters.map((char) =>
            char.id === characterId
              ? {
                  ...char,
                  currency: { ...char.currency, ...currency },
                  updatedAt: new Date()
                }
              : char
          ),
        }))
      },
      
      // Experience & Leveling
      addExperience: (characterId, xp) => {
        set((state) => ({
          characters: state.characters.map((char) =>
            char.id === characterId
              ? {
                  ...char,
                  experiencePoints: char.experiencePoints + xp,
                  updatedAt: new Date()
                }
              : char
          ),
        }))
      },
      
      setLevel: (characterId, level) => {
        set((state) => ({
          characters: state.characters.map((char) =>
            char.id === characterId
              ? {
                  ...char,
                  level: Math.max(1, Math.min(20, level)),
                  updatedAt: new Date()
                }
              : char
          ),
        }))
        get().recalculateStats(characterId)
      },
      
      // Recalculation
      recalculateStats: (characterId) => {
        const character = get().getCharacter(characterId)
        if (!character) return
        
        const stats = calculateAllStats(character)
        
        set((state) => ({
          calculatedStats: {
            ...state.calculatedStats,
            [characterId]: stats,
          },
        }))
      },
      
      getCalculatedStats: (characterId) => {
        const state = get()
        
        // Recalculate if not cached
        if (!state.calculatedStats[characterId]) {
          const character = state.getCharacter(characterId)
          if (character) {
            return calculateAllStats(character)
          }
          return undefined
        }
        
        return state.calculatedStats[characterId]
      },
    }),
    {
      name: "feyforge-characters",
      // Handle Date serialization
      onRehydrateStorage: () => (state) => {
        if (state?.characters) {
          state.characters = state.characters.map(char => ({
            ...char,
            createdAt: new Date(char.createdAt),
            updatedAt: new Date(char.updatedAt),
            // Safety check for properties array
            properties: (char.properties || []).map(prop => ({
              ...prop,
              createdAt: new Date(prop.createdAt),
              updatedAt: new Date(prop.updatedAt),
            })),
          }))
          
          // Recalculate all stats on rehydration
          for (const char of state.characters) {
            const stats = calculateAllStats(char)
            state.calculatedStats[char.id] = stats
          }
        }
      },
    },
  ),
)
