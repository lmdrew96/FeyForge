"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Character, CharacterProperty, CalculatedStats, AlternateFormProperty, ClassResourceProperty } from "./character/types"
import { calculateAllStats } from "./character/calculations"
import { getLevelFromXP, getXPToNextLevel, getLevelsGained } from "./character/experience"

interface CharacterStore {
  // State
  characters: Character[]
  activeCharacterId: string | null
  
  // Cached calculations
  calculatedStats: Record<string, CalculatedStats>
  
  // Active form tracking (for wildshape/polymorph)
  activeFormId: Record<string, string | null>
  
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
  
  // Experience & Leveling (XP-driven)
  addExperience: (characterId: string, xp: number) => { newLevel: number; levelsGained: number[] }
  setLevel: (characterId: string, level: number) => void
  getLevel: (characterId: string) => number
  getXPProgress: (characterId: string) => { current: number; toNext: number; percentage: number }
  
  // Spell Slots
  useSpellSlot: (characterId: string, level: number) => void
  restoreSpellSlot: (characterId: string, level: number) => void
  restoreAllSpellSlots: (characterId: string) => void
  
  // Class Resources
  useClassResource: (characterId: string, resourceId: string, amount?: number) => void
  restoreClassResource: (characterId: string, resourceId: string, amount?: number) => void
  getClassResources: (characterId: string) => ClassResourceProperty[]
  
  // Alternate Forms (Wildshape/Polymorph)
  transformIntoForm: (characterId: string, formId: string) => void
  revertFromForm: (characterId: string) => void
  getActiveForm: (characterId: string) => AlternateFormProperty | null
  updateFormHP: (characterId: string, formId: string, hp: number) => void
  addAlternateForm: (characterId: string, form: AlternateFormProperty) => void
  removeAlternateForm: (characterId: string, formId: string) => void
  
  // Rest mechanics
  shortRest: (characterId: string) => void
  longRest: (characterId: string) => void
  
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
      activeFormId: {},

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
      
      // Experience & Leveling (XP-driven)
      addExperience: (characterId, xp) => {
        const char = get().getCharacter(characterId)
        if (!char) return { newLevel: 1, levelsGained: [] }
        
        const levelsGained = getLevelsGained(char.experiencePoints, xp)
        const newXP = char.experiencePoints + xp
        const newLevel = getLevelFromXP(newXP)
        
        set((state) => ({
          characters: state.characters.map((c) =>
            c.id === characterId
              ? {
                  ...c,
                  experiencePoints: newXP,
                  level: newLevel,
                  updatedAt: new Date()
                }
              : c
          ),
        }))
        
        get().recalculateStats(characterId)
        return { newLevel, levelsGained }
      },
      
      setLevel: (characterId, level) => {
        const { getXPForLevel } = require('./character/experience')
        const xpForLevel = getXPForLevel(level)
        
        set((state) => ({
          characters: state.characters.map((char) =>
            char.id === characterId
              ? {
                  ...char,
                  level: Math.max(1, Math.min(20, level)),
                  experiencePoints: xpForLevel,
                  updatedAt: new Date()
                }
              : char
          ),
        }))
        get().recalculateStats(characterId)
      },
      
      getLevel: (characterId) => {
        const char = get().getCharacter(characterId)
        if (!char) return 1
        return getLevelFromXP(char.experiencePoints)
      },
      
      getXPProgress: (characterId) => {
        const char = get().getCharacter(characterId)
        if (!char) return { current: 0, toNext: 300, percentage: 0 }
        
        const toNext = getXPToNextLevel(char.experiencePoints)
        const level = getLevelFromXP(char.experiencePoints)
        const { XP_THRESHOLDS } = require('./character/constants')
        const currentLevelXP = XP_THRESHOLDS[level] || 0
        const nextLevelXP = XP_THRESHOLDS[level + 1] || currentLevelXP
        const xpInLevel = char.experiencePoints - currentLevelXP
        const xpNeeded = nextLevelXP - currentLevelXP
        const percentage = xpNeeded > 0 ? Math.floor((xpInLevel / xpNeeded) * 100) : 100
        
        return { current: char.experiencePoints, toNext, percentage }
      },
      
      // Spell Slots
      useSpellSlot: (characterId, level) => {
        set((state) => ({
          characters: state.characters.map((char) =>
            char.id === characterId && char.spellcasting?.spellSlots?.[level]
              ? {
                  ...char,
                  spellcasting: {
                    ...char.spellcasting,
                    spellSlots: {
                      ...char.spellcasting.spellSlots,
                      [level]: {
                        ...char.spellcasting.spellSlots[level],
                        used: Math.min(
                          char.spellcasting.spellSlots[level].total,
                          char.spellcasting.spellSlots[level].used + 1
                        ),
                      },
                    },
                  },
                  updatedAt: new Date(),
                }
              : char
          ),
        }))
      },
      
      restoreSpellSlot: (characterId, level) => {
        set((state) => ({
          characters: state.characters.map((char) =>
            char.id === characterId && char.spellcasting?.spellSlots?.[level]
              ? {
                  ...char,
                  spellcasting: {
                    ...char.spellcasting,
                    spellSlots: {
                      ...char.spellcasting.spellSlots,
                      [level]: {
                        ...char.spellcasting.spellSlots[level],
                        used: Math.max(0, char.spellcasting.spellSlots[level].used - 1),
                      },
                    },
                  },
                  updatedAt: new Date(),
                }
              : char
          ),
        }))
      },
      
      restoreAllSpellSlots: (characterId) => {
        set((state) => ({
          characters: state.characters.map((char) =>
            char.id === characterId && char.spellcasting?.spellSlots
              ? {
                  ...char,
                  spellcasting: {
                    ...char.spellcasting,
                    spellSlots: Object.fromEntries(
                      Object.entries(char.spellcasting.spellSlots).map(([lvl, slot]) => [
                        lvl,
                        { ...slot, used: 0 },
                      ])
                    ),
                  },
                  updatedAt: new Date(),
                }
              : char
          ),
        }))
      },
      
      // Class Resources
      useClassResource: (characterId, resourceId, amount = 1) => {
        set((state) => ({
          characters: state.characters.map((char) =>
            char.id === characterId
              ? {
                  ...char,
                  properties: (char.properties || []).map((prop) =>
                    prop.id === resourceId && prop.type === 'classResource'
                      ? {
                          ...prop,
                          current: Math.max(0, (prop as ClassResourceProperty).current - amount),
                          updatedAt: new Date(),
                        }
                      : prop
                  ),
                  updatedAt: new Date(),
                }
              : char
          ),
        }))
      },
      
      restoreClassResource: (characterId, resourceId, amount) => {
        set((state) => ({
          characters: state.characters.map((char) =>
            char.id === characterId
              ? {
                  ...char,
                  properties: (char.properties || []).map((prop) => {
                    if (prop.id === resourceId && prop.type === 'classResource') {
                      const resource = prop as ClassResourceProperty
                      const restoreAmount = amount ?? resource.max
                      return {
                        ...prop,
                        current: Math.min(resource.max, resource.current + restoreAmount),
                        updatedAt: new Date(),
                      }
                    }
                    return prop
                  }),
                  updatedAt: new Date(),
                }
              : char
          ),
        }))
      },
      
      getClassResources: (characterId) => {
        const char = get().getCharacter(characterId)
        if (!char) return []
        return (char.properties || []).filter(
          (p): p is ClassResourceProperty => p.type === 'classResource'
        )
      },
      
      // Alternate Forms
      transformIntoForm: (characterId, formId) => {
        set((state) => ({
          activeFormId: {
            ...state.activeFormId,
            [characterId]: formId,
          },
        }))
      },
      
      revertFromForm: (characterId) => {
        set((state) => ({
          activeFormId: {
            ...state.activeFormId,
            [characterId]: null,
          },
        }))
      },
      
      getActiveForm: (characterId) => {
        const state = get()
        const formId = state.activeFormId[characterId]
        if (!formId) return null
        
        const char = state.getCharacter(characterId)
        if (!char) return null
        
        return (char.properties || []).find(
          (p): p is AlternateFormProperty => p.type === 'alternateForm' && p.id === formId
        ) || null
      },
      
      updateFormHP: (characterId, formId, hp) => {
        set((state) => ({
          characters: state.characters.map((char) =>
            char.id === characterId
              ? {
                  ...char,
                  properties: (char.properties || []).map((prop) =>
                    prop.id === formId && prop.type === 'alternateForm'
                      ? {
                          ...prop,
                          formHP: {
                            ...(prop as AlternateFormProperty).formHP,
                            current: Math.max(0, hp),
                          },
                          updatedAt: new Date(),
                        }
                      : prop
                  ),
                  updatedAt: new Date(),
                }
              : char
          ),
        }))
      },
      
      addAlternateForm: (characterId, form) => {
        get().addProperty(characterId, form)
      },
      
      removeAlternateForm: (characterId, formId) => {
        get().removeProperty(characterId, formId)
      },
      
      // Rest mechanics
      shortRest: (characterId) => {
        const char = get().getCharacter(characterId)
        if (!char) return
        
        // Restore class resources that recharge on short rest
        const resources = get().getClassResources(characterId)
        for (const resource of resources) {
          if (resource.rechargeOn === 'shortRest') {
            get().restoreClassResource(characterId, resource.id)
          }
        }
        
        // Warlocks recover spell slots on short rest (handled separately if needed)
      },
      
      longRest: (characterId) => {
        const char = get().getCharacter(characterId)
        if (!char) return
        
        // Restore HP to max
        get().updateHP(characterId, char.hitPoints.max, 0)
        
        // Reset death saves
        get().resetDeathSaves(characterId)
        
        // Restore half hit dice
        get().resetHitDice(characterId)
        
        // Restore all spell slots
        get().restoreAllSpellSlots(characterId)
        
        // Restore all class resources that recharge on long rest or short rest
        const resources = get().getClassResources(characterId)
        for (const resource of resources) {
          if (resource.rechargeOn === 'shortRest' || resource.rechargeOn === 'longRest') {
            get().restoreClassResource(characterId, resource.id)
          }
        }
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
