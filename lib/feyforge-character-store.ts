"use client"

import { create } from "zustand"
import { toast } from "sonner"
import { getErrorMessage, isAuthError } from "@/lib/errors"
import type {
  Character,
  CharacterProperty,
  CalculatedStats,
  AlternateFormProperty,
  ClassResourceProperty,
  CharacterUpdateInput,
} from "./character/types"
import { calculateAllStats } from "./character/calculations"
import {
  getLevelFromXP,
  getXPToNextLevel,
  getLevelsGained,
  getXPForLevel,
} from "./character/experience"
import { XP_THRESHOLDS } from "./character/constants"
import {
  fetchUserCharacters,
  createCharacter as createCharacterAction,
  updateCharacter as updateCharacterAction,
  deleteCharacter as deleteCharacterAction,
  getCharactersByCampaign as getCharactersByCampaignAction,
  addCharacterProperty as addPropertyAction,
  updateCharacterProperty as updatePropertyAction,
  deleteCharacterProperty as deletePropertyAction,
  type Character as DBCharacter,
} from "@/lib/actions/characters"

interface CharacterStore {
  // State
  characters: Character[]
  activeCharacterId: string | null
  isLoading: boolean
  isInitialized: boolean
  error: string | null

  // Cached calculations (local only)
  calculatedStats: Record<string, CalculatedStats>

  // Active form tracking (for wildshape/polymorph - session state)
  activeFormId: Record<string, string | null>

  // Initialize from database
  initialize: () => Promise<void>

  // CRUD operations (async - persist to DB)
  addCharacter: (character: Character) => Promise<void>
  updateCharacter: (id: string, updates: CharacterUpdateInput) => Promise<void>
  deleteCharacter: (id: string) => Promise<void>
  setActiveCharacter: (id: string | null) => void
  getActiveCharacter: () => Character | undefined
  getCharacter: (id: string) => Character | undefined
  getCharactersByCampaign: (campaignId: string) => Character[]

  // Property management (async - persist to DB)
  addProperty: (
    characterId: string,
    property: CharacterProperty
  ) => Promise<void>
  updateProperty: (
    characterId: string,
    propertyId: string,
    updates: Partial<CharacterProperty>
  ) => Promise<void>
  removeProperty: (characterId: string, propertyId: string) => Promise<void>
  toggleProperty: (characterId: string, propertyId: string) => Promise<void>

  // HP management (optimistic - local first, then persist)
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
  updateCurrency: (
    characterId: string,
    currency: Partial<Character["currency"]>
  ) => void

  // Experience & Leveling (XP-driven)
  addExperience: (
    characterId: string,
    xp: number
  ) => { newLevel: number; levelsGained: number[] }
  setLevel: (characterId: string, level: number) => void
  getLevel: (characterId: string) => number
  getXPProgress: (characterId: string) => {
    current: number
    toNext: number
    percentage: number
  }

  // Spell Slots
  useSpellSlot: (characterId: string, level: number) => void
  restoreSpellSlot: (characterId: string, level: number) => void
  restoreAllSpellSlots: (characterId: string) => void

  // Class Resources
  useClassResource: (
    characterId: string,
    resourceId: string,
    amount?: number
  ) => void
  restoreClassResource: (
    characterId: string,
    resourceId: string,
    amount?: number
  ) => void
  getClassResources: (characterId: string) => ClassResourceProperty[]

  // Alternate Forms (Wildshape/Polymorph)
  transformIntoForm: (characterId: string, formId: string) => void
  revertFromForm: (characterId: string) => void
  getActiveForm: (characterId: string) => AlternateFormProperty | null
  updateFormHP: (characterId: string, formId: string, hp: number) => void
  addAlternateForm: (
    characterId: string,
    form: AlternateFormProperty
  ) => Promise<void>
  removeAlternateForm: (characterId: string, formId: string) => Promise<void>

  // Rest mechanics
  shortRest: (characterId: string) => void
  longRest: (characterId: string) => void

  // Recalculation
  recalculateStats: (characterId: string) => void
  getCalculatedStats: (characterId: string) => CalculatedStats | undefined

  // Persist pending changes (batch update to DB)
  persistCharacter: (characterId: string) => Promise<void>

  // Reset
  reset: () => void
}

// Helper to convert DB character to local character type
function dbToLocal(dbChar: DBCharacter): Character {
  return {
    id: dbChar.id,
    campaignId: dbChar.campaignId || undefined,
    name: dbChar.name,
    race: dbChar.race,
    subrace: dbChar.subrace || undefined,
    class: dbChar.class,
    subclass: dbChar.subclass || undefined,
    level: dbChar.level,
    experiencePoints: dbChar.experiencePoints,
    background: dbChar.background || undefined,
    alignment: (dbChar.alignment as Character["alignment"]) || undefined,
    playerName: dbChar.playerName || undefined,
    age: dbChar.age || undefined,
    height: dbChar.height || undefined,
    weight: dbChar.weight || undefined,
    eyes: dbChar.eyes || undefined,
    skin: dbChar.skin || undefined,
    hair: dbChar.hair || undefined,
    size: (dbChar.size as Character["size"]) || undefined,
    baseAbilities: dbChar.baseAbilities as Character["baseAbilities"],
    racialBonuses:
      (dbChar.racialBonuses as Record<string, number>) || undefined,
    hitPoints: dbChar.hitPoints as Character["hitPoints"],
    hitDice: (dbChar.hitDice as Character["hitDice"]) || [],
    deathSaves: dbChar.deathSaves as Character["deathSaves"],
    speed: dbChar.speed,
    inspiration: dbChar.inspiration,
    savingThrowProficiencies:
      (dbChar.savingThrowProficiencies as Character["savingThrowProficiencies"]) ||
      [],
    skillProficiencies:
      (dbChar.skillProficiencies as Character["skillProficiencies"]) || [],
    skillExpertise:
      (dbChar.skillExpertise as Character["skillExpertise"]) || [],
    armorProficiencies: (dbChar.armorProficiencies as string[]) || [],
    weaponProficiencies: (dbChar.weaponProficiencies as string[]) || [],
    toolProficiencies: (dbChar.toolProficiencies as string[]) || [],
    languages: (dbChar.languages as string[]) || [],
    currency: dbChar.currency as Character["currency"],
    spellcasting:
      (dbChar.spellcasting as Character["spellcasting"]) || undefined,
    personalityTraits: dbChar.personalityTraits || undefined,
    ideals: dbChar.ideals || undefined,
    bonds: dbChar.bonds || undefined,
    flaws: dbChar.flaws || undefined,
    backstory: dbChar.backstory || undefined,
    imageUrl: dbChar.imageUrl || undefined,
    properties: [], // Properties loaded separately
    createdAt: new Date(dbChar.createdAt),
    updatedAt: new Date(dbChar.updatedAt),
  }
}

export const useCharacterStore = create<CharacterStore>((set, get) => ({
  characters: [],
  activeCharacterId: null,
  calculatedStats: {},
  activeFormId: {},
  isLoading: false,
  isInitialized: false,
  error: null,

  initialize: async () => {
    if (get().isInitialized) return

    set({ isLoading: true, error: null })
    try {
      const dbCharacters = await fetchUserCharacters()
      const characters = dbCharacters.map(dbToLocal)

      // Calculate stats for all characters
      const calculatedStats: Record<string, CalculatedStats> = {}
      for (const char of characters) {
        calculatedStats[char.id] = calculateAllStats(char)
      }

      set({
        characters,
        calculatedStats,
        isLoading: false,
        isInitialized: true,
        activeCharacterId: characters[0]?.id || null,
      })
    } catch (error) {
      set({
        error: getErrorMessage(error, "Failed to load characters"),
        isLoading: false,
        isInitialized: true,
      })
    }
  },

  addCharacter: async (character) => {
    // Ensure properties array exists
    const charWithProperties = {
      ...character,
      properties: character.properties || [],
    }

    // Optimistic update
    set((state) => ({
      characters: [...state.characters, charWithProperties],
    }))
    get().recalculateStats(character.id)

    // Persist to database
    try {
      await createCharacterAction({
        campaignId: character.campaignId || null,
        name: character.name,
        race: character.race,
        class: character.class,
        level: character.level,
        experiencePoints: character.experiencePoints,
        subrace: character.subrace,
        subclass: character.subclass,
        background: character.background,
        alignment: character.alignment,
        playerName: character.playerName,
        age: character.age,
        height: character.height,
        weight: character.weight,
        eyes: character.eyes,
        skin: character.skin,
        hair: character.hair,
        size: character.size,
        baseAbilities: character.baseAbilities,
        racialBonuses: character.racialBonuses,
        hitPoints: character.hitPoints,
        hitDice: character.hitDice,
        deathSaves: character.deathSaves,
        speed: character.speed,
        inspiration: character.inspiration,
        savingThrowProficiencies: character.savingThrowProficiencies,
        skillProficiencies: character.skillProficiencies,
        skillExpertise: character.skillExpertise,
        armorProficiencies: character.armorProficiencies,
        weaponProficiencies: character.weaponProficiencies,
        toolProficiencies: character.toolProficiencies,
        languages: character.languages,
        currency: character.currency,
        spellcasting: character.spellcasting
          ? {
              ability: character.spellcasting.ability,
              spellSaveDC:
                character.spellcasting.spellSaveDC ??
                character.spellcasting.saveDC ??
                0,
              spellAttackBonus:
                character.spellcasting.spellAttackBonus ??
                character.spellcasting.attackBonus ??
                0,
              spellSlots: Array.isArray(character.spellcasting.spellSlots)
                ? character.spellcasting.spellSlots.reduce(
                    (acc, slot) => {
                      acc[slot.level] = { total: slot.total, used: slot.used }
                      return acc
                    },
                    {} as Record<number, { total: number; used: number }>
                  )
                : character.spellcasting.spellSlots,
              cantripsKnown: character.spellcasting.cantripsKnown,
              spellsKnown: character.spellcasting.spellsKnown,
              spellsPrepared: character.spellcasting.spellsPrepared,
            }
          : null,
        personalityTraits: character.personalityTraits,
        ideals: character.ideals,
        bonds: character.bonds,
        flaws: character.flaws,
        backstory: character.backstory,
        imageUrl: character.imageUrl,
      })
    } catch (error) {
      console.error("Failed to save character:", error)
      const message = getErrorMessage(error, "Failed to save character")
      if (isAuthError(message)) {
        toast.error("Please log in to save characters")
      } else {
        toast.error(message)
      }
      // Rollback on error
      set((state) => ({
        characters: state.characters.filter((c) => c.id !== character.id),
        error: message,
      }))
    }
  },

  updateCharacter: async (id, updates) => {
    // Optimistic update - merge the updates safely
    set((state) => ({
      characters: state.characters.map((char) =>
        char.id === id
          ? {
              ...char,
              ...(updates as Partial<Character>),
              updatedAt: new Date(),
            }
          : char
      ),
    }))
    get().recalculateStats(id)

    // Persist to database
    try {
      await updateCharacterAction(
        id,
        updates as Parameters<typeof updateCharacterAction>[1]
      )
    } catch (error) {
      console.error("Failed to update character:", error)
      const message = getErrorMessage(error, "Failed to update character")
      if (isAuthError(message)) {
        toast.error("Please log in to update characters")
      } else {
        toast.error(message)
      }
      set({ error: message })
    }
  },

  deleteCharacter: async (id) => {
    const charToDelete = get().getCharacter(id)

    // Optimistic update
    set((state) => ({
      characters: state.characters.filter((char) => char.id !== id),
      activeCharacterId:
        state.activeCharacterId === id ? null : state.activeCharacterId,
      calculatedStats: Object.fromEntries(
        Object.entries(state.calculatedStats).filter(([key]) => key !== id)
      ),
    }))

    // Persist to database
    try {
      await deleteCharacterAction(id)
    } catch (error) {
      console.error("Failed to delete character:", error)
      const message = getErrorMessage(error, "Failed to delete character")
      if (isAuthError(message)) {
        toast.error("Please log in to delete characters")
      } else {
        toast.error(message)
      }
      // Rollback on error
      if (charToDelete) {
        set((state) => ({
          characters: [...state.characters, charToDelete],
          error: message,
        }))
      }
    }
  },

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
  addProperty: async (characterId, property) => {
    // Optimistic update
    set((state) => ({
      characters: state.characters.map((char) =>
        char.id === characterId
          ? {
              ...char,
              properties: [...(char.properties || []), property],
              updatedAt: new Date(),
            }
          : char
      ),
    }))
    get().recalculateStats(characterId)

    // Persist to database
    try {
      await addPropertyAction({
        characterId,
        type: property.type,
        name: property.name,
        description: property.description,
        source: "source" in property ? property.source : undefined,
        active: property.active,
        equipped: "equipped" in property ? property.equipped : undefined,
        data: property as unknown as Record<string, unknown>,
        orderIndex:
          (get().getCharacter(characterId)?.properties?.length || 0) - 1,
      })
    } catch (error) {
      console.error("Failed to add property:", error)
      const message = getErrorMessage(error, "Failed to add property")
      if (isAuthError(message)) {
        toast.error("Please log in to add items")
      } else {
        toast.error(message)
      }
    }
  },

  updateProperty: async (characterId, propertyId, updates) => {
    // Optimistic update
    set((state) => ({
      characters: state.characters.map((char) =>
        char.id === characterId
          ? {
              ...char,
              properties: (char.properties || []).map((prop) =>
                prop.id === propertyId
                  ? ({
                      ...prop,
                      ...updates,
                      updatedAt: new Date(),
                    } as typeof prop)
                  : prop
              ),
              updatedAt: new Date(),
            }
          : char
      ),
    }))
    get().recalculateStats(characterId)

    // Persist to database
    try {
      await updatePropertyAction(propertyId, {
        ...updates,
        data: updates as Record<string, unknown>,
      })
    } catch (error) {
      console.error("Failed to update property:", error)
      const message = getErrorMessage(error, "Failed to update property")
      if (isAuthError(message)) {
        toast.error("Please log in to update items")
      } else {
        toast.error(message)
      }
    }
  },

  removeProperty: async (characterId, propertyId) => {
    const property = get()
      .getCharacter(characterId)
      ?.properties?.find((p) => p.id === propertyId)

    // Optimistic update
    set((state) => ({
      characters: state.characters.map((char) =>
        char.id === characterId
          ? {
              ...char,
              properties: (char.properties || []).filter(
                (prop) => prop.id !== propertyId
              ),
              updatedAt: new Date(),
            }
          : char
      ),
    }))
    get().recalculateStats(characterId)

    // Persist to database
    try {
      await deletePropertyAction(propertyId)
    } catch (error) {
      console.error("Failed to remove property:", error)
      const message = getErrorMessage(error, "Failed to remove property")
      if (isAuthError(message)) {
        toast.error("Please log in to remove items")
      } else {
        toast.error(message)
      }
      // Rollback on error
      if (property) {
        set((state) => ({
          characters: state.characters.map((char) =>
            char.id === characterId
              ? { ...char, properties: [...(char.properties || []), property] }
              : char
          ),
        }))
      }
    }
  },

  toggleProperty: async (characterId, propertyId) => {
    const property = get()
      .getCharacter(characterId)
      ?.properties?.find((p) => p.id === propertyId)
    if (!property) return

    // Optimistic update
    set((state) => ({
      characters: state.characters.map((char) =>
        char.id === characterId
          ? {
              ...char,
              properties: (char.properties || []).map((prop) =>
                prop.id === propertyId
                  ? { ...prop, active: !prop.active, updatedAt: new Date() }
                  : prop
              ),
              updatedAt: new Date(),
            }
          : char
      ),
    }))
    get().recalculateStats(characterId)

    // Persist to database
    try {
      await updatePropertyAction(propertyId, { active: !property.active })
    } catch (error) {
      console.error("Failed to toggle property:", error)
      const message = getErrorMessage(error, "Failed to toggle property")
      if (isAuthError(message)) {
        toast.error("Please log in to modify items")
      } else {
        toast.error(message)
      }
    }
  },

  // HP management (optimistic local updates, persisted in batch)
  updateHP: (characterId, current, temp) => {
    set((state) => ({
      characters: state.characters.map((char) =>
        char.id === characterId
          ? {
              ...char,
              hitPoints: {
                ...char.hitPoints,
                current: Math.max(0, Math.min(current, char.hitPoints.max)),
                temp:
                  temp !== undefined ? Math.max(0, temp) : char.hitPoints.temp,
              },
              updatedAt: new Date(),
            }
          : char
      ),
    }))
    // Debounced persist (handled by persistCharacter)
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
        get().updateHP(
          characterId,
          char.hitPoints.current,
          char.hitPoints.temp - remaining
        )
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
              updatedAt: new Date(),
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
              updatedAt: new Date(),
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
              updatedAt: new Date(),
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
              updatedAt: new Date(),
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
              updatedAt: new Date(),
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
              updatedAt: new Date(),
            }
          : c
      ),
    }))

    get().recalculateStats(characterId)
    return { newLevel, levelsGained }
  },

  setLevel: (characterId, level) => {
    const xpForLevel = getXPForLevel(level)

    set((state) => ({
      characters: state.characters.map((char) =>
        char.id === characterId
          ? {
              ...char,
              level: Math.max(1, Math.min(20, level)),
              experiencePoints: xpForLevel,
              updatedAt: new Date(),
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
    const currentLevelXP = XP_THRESHOLDS[level] || 0
    const nextLevelXP = XP_THRESHOLDS[level + 1] || currentLevelXP
    const xpInLevel = char.experiencePoints - currentLevelXP
    const xpNeeded = nextLevelXP - currentLevelXP
    const percentage =
      xpNeeded > 0 ? Math.floor((xpInLevel / xpNeeded) * 100) : 100

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
                    used: Math.max(
                      0,
                      char.spellcasting.spellSlots[level].used - 1
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

  restoreAllSpellSlots: (characterId) => {
    set((state) => ({
      characters: state.characters.map((char) =>
        char.id === characterId && char.spellcasting?.spellSlots
          ? {
              ...char,
              spellcasting: {
                ...char.spellcasting,
                spellSlots: Object.fromEntries(
                  Object.entries(char.spellcasting.spellSlots).map(
                    ([lvl, slot]) => [lvl, { ...slot, used: 0 }]
                  )
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
                prop.id === resourceId && prop.type === "classResource"
                  ? {
                      ...prop,
                      current: Math.max(
                        0,
                        (prop as ClassResourceProperty).current - amount
                      ),
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
                if (prop.id === resourceId && prop.type === "classResource") {
                  const resource = prop as ClassResourceProperty
                  const restoreAmount = amount ?? resource.max
                  return {
                    ...prop,
                    current: Math.min(
                      resource.max,
                      resource.current + restoreAmount
                    ),
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
      (p): p is ClassResourceProperty => p.type === "classResource"
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

    return (
      (char.properties || []).find(
        (p): p is AlternateFormProperty =>
          p.type === "alternateForm" && p.id === formId
      ) || null
    )
  },

  updateFormHP: (characterId, formId, hp) => {
    set((state) => ({
      characters: state.characters.map((char) =>
        char.id === characterId
          ? {
              ...char,
              properties: (char.properties || []).map((prop) =>
                prop.id === formId && prop.type === "alternateForm"
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

  addAlternateForm: async (characterId, form) => {
    await get().addProperty(characterId, form)
  },

  removeAlternateForm: async (characterId, formId) => {
    await get().removeProperty(characterId, formId)
  },

  // Rest mechanics
  shortRest: (characterId) => {
    const char = get().getCharacter(characterId)
    if (!char) return

    // Restore class resources that recharge on short rest
    const resources = get().getClassResources(characterId)
    for (const resource of resources) {
      if (resource.rechargeOn === "shortRest") {
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
      if (
        resource.rechargeOn === "shortRest" ||
        resource.rechargeOn === "longRest"
      ) {
        get().restoreClassResource(characterId, resource.id)
      }
    }

    // Persist all changes at once
    get().persistCharacter(characterId)
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

  // Persist pending changes to database
  persistCharacter: async (characterId) => {
    const char = get().getCharacter(characterId)
    if (!char) return

    try {
      await updateCharacterAction(characterId, {
        hitPoints: char.hitPoints,
        hitDice: char.hitDice,
        deathSaves: char.deathSaves,
        currency: char.currency,
        level: char.level,
        experiencePoints: char.experiencePoints,
        spellcasting: char.spellcasting
          ? {
              ability: char.spellcasting.ability,
              spellSaveDC:
                char.spellcasting.spellSaveDC ?? char.spellcasting.saveDC ?? 0,
              spellAttackBonus:
                char.spellcasting.spellAttackBonus ??
                char.spellcasting.attackBonus ??
                0,
              spellSlots: Array.isArray(char.spellcasting.spellSlots)
                ? char.spellcasting.spellSlots.reduce(
                    (acc, slot) => {
                      acc[slot.level] = { total: slot.total, used: slot.used }
                      return acc
                    },
                    {} as Record<number, { total: number; used: number }>
                  )
                : char.spellcasting.spellSlots,
              cantripsKnown: char.spellcasting.cantripsKnown,
              spellsKnown: char.spellcasting.spellsKnown,
              spellsPrepared: char.spellcasting.spellsPrepared,
            }
          : null,
        inspiration: char.inspiration,
      })
    } catch (error) {
      console.error("Failed to persist character:", error)
      const message = getErrorMessage(error, "Failed to save changes")
      if (isAuthError(message)) {
        toast.error("Please log in to save changes")
      } else {
        toast.error(message)
      }
    }
  },

  reset: () =>
    set({
      characters: [],
      activeCharacterId: null,
      calculatedStats: {},
      activeFormId: {},
      isLoading: false,
      isInitialized: false,
      error: null,
    }),
}))
