"use client"

/**
 * Character Builder Store
 * Manages state for the multi-step character creation wizard
 * This is ephemeral state - not persisted to database until character is created
 */

import { create } from 'zustand';
import { getErrorMessage } from "@/lib/errors"
import type {
  CharacterCreationData,
  Character,
  AbilityScores,
} from './character/types';
import type { Ability, Skill } from './character/constants';
import type { Open5eRace, Open5eClass, Open5eBackground } from './open5e-api';
import {
  ABILITIES,
  getProficiencyBonus,
  getAbilityModifier,
  CLASS_HIT_DICE,
} from './character/constants';
import { calculateMaxHP } from './character/calculations';
import { useCharacterStore } from './feyforge-character-store';

export type BuilderStep = 1 | 2 | 3 | 4 | 5;

interface CharacterBuilderStore {
  // Current step
  currentStep: BuilderStep;

  // Form data
  data: CharacterCreationData;

  // Open5e data cache
  raceData: Open5eRace | null;
  classData: Open5eClass | null;
  backgroundData: Open5eBackground | null;

  // Loading state for save operation
  isSaving: boolean;
  saveError: string | null;

  // Navigation
  setStep: (step: BuilderStep) => void;
  nextStep: () => void;
  previousStep: () => void;

  // Data updates
  updateData: (updates: Partial<CharacterCreationData>) => void;
  setRaceData: (data: Open5eRace | null) => void;
  setClassData: (data: Open5eClass | null) => void;
  setBackgroundData: (data: Open5eBackground | null) => void;

  // Ability score helpers
  setAbilityScore: (ability: Ability, value: number) => void;
  resetAbilityScores: () => void;
  applyStandardArray: (assignments: Record<Ability, number>) => void;

  // Skills
  toggleSkillProficiency: (skill: Skill) => void;

  // Reset
  reset: () => void;

  // Create character (builds object)
  buildCharacter: (campaignId?: string) => Character;

  // Create and save character (async - persists to DB)
  createAndSaveCharacter: (campaignId?: string) => Promise<Character>;

  // Validation state
  canProceed: () => boolean;
}

const initialData: CharacterCreationData = {
  name: '',
  race: undefined,
  subrace: undefined,
  class: undefined,
  background: undefined,
  alignment: undefined,
  baseAbilities: {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  },
  abilityScoreMethod: 'pointBuy',
  racialBonuses: {},
  skillProficiencies: [],
  toolProficiencies: [],
  languages: [],
  startingEquipment: [],
  startingGold: 0,
  useStartingEquipment: true,
  personalityTraits: '',
  ideals: '',
  bonds: '',
  flaws: '',
  backstory: '',
};

export const useCharacterBuilderStore = create<CharacterBuilderStore>((set, get) => ({
  currentStep: 1,
  data: { ...initialData },
  raceData: null,
  classData: null,
  backgroundData: null,
  isSaving: false,
  saveError: null,

  setStep: (step) => set({ currentStep: step }),

  nextStep: () => set((state) => ({
    currentStep: Math.min(5, state.currentStep + 1) as BuilderStep
  })),

  previousStep: () => set((state) => ({
    currentStep: Math.max(1, state.currentStep - 1) as BuilderStep
  })),

  updateData: (updates) => set((state) => ({
    data: { ...state.data, ...updates }
  })),

  setRaceData: (data) => set({ raceData: data }),
  setClassData: (data) => set({ classData: data }),
  setBackgroundData: (data) => set({ backgroundData: data }),

  setAbilityScore: (ability, value) => set((state) => ({
    data: {
      ...state.data,
      baseAbilities: {
        ...state.data.baseAbilities,
        [ability]: value,
      }
    }
  })),

  resetAbilityScores: () => set((state) => ({
    data: {
      ...state.data,
      baseAbilities: {
        strength: 8,
        dexterity: 8,
        constitution: 8,
        intelligence: 8,
        wisdom: 8,
        charisma: 8,
      }
    }
  })),

  applyStandardArray: (assignments) => set((state) => ({
    data: {
      ...state.data,
      baseAbilities: { ...assignments } as AbilityScores,
    }
  })),

  toggleSkillProficiency: (skill) => set((state) => {
    const current = state.data.skillProficiencies || [];
    const isSelected = current.includes(skill);

    return {
      data: {
        ...state.data,
        skillProficiencies: isSelected
          ? current.filter(s => s !== skill)
          : [...current, skill]
      }
    };
  }),

  reset: () => set({
    currentStep: 1,
    data: { ...initialData },
    raceData: null,
    classData: null,
    backgroundData: null,
    isSaving: false,
    saveError: null,
  }),

  canProceed: () => {
    const { currentStep, data } = get();

    switch (currentStep) {
      case 1:
        return !!(data.name?.trim() && data.race && data.class);
      case 2:
        // Check if all ability scores are assigned
        if (!data.baseAbilities) return false;
        for (const ability of ABILITIES) {
          if (data.baseAbilities[ability] === undefined) return false;
        }
        return true;
      case 3:
        // Skills are optional but should respect class limits
        return true;
      case 4:
        // Equipment is optional
        return true;
      case 5:
        // Details are optional
        return true;
      default:
        return false;
    }
  },

  buildCharacter: (campaignId) => {
    const state = get();
    const { data, raceData, classData } = state;

    // Get hit die from class data or fallback
    const className = data.class?.toLowerCase() || 'fighter';
    const hitDieSize = CLASS_HIT_DICE[className] || 10;

    // Calculate CON modifier for HP
    const conScore = (data.baseAbilities?.strength || 10) + (data.racialBonuses?.constitution || 0);
    const conMod = getAbilityModifier(conScore);

    // Calculate max HP
    const maxHP = calculateMaxHP(1, hitDieSize, conMod);

    // Get speed from race data or default
    const speed = raceData?.speed?.walk || 30;

    // Parse saving throw proficiencies from class
    const savingThrowProficiencies: Ability[] = [];
    if (classData?.prof_saving_throws) {
      const saves = classData.prof_saving_throws.toLowerCase();
      for (const ability of ABILITIES) {
        if (saves.includes(ability)) {
          savingThrowProficiencies.push(ability);
        }
      }
    }

    // Build the character object
    const character: Character = {
      id: crypto.randomUUID(),
      campaignId,

      // Basic info
      name: data.name || 'Unnamed Character',
      race: data.race || 'Human',
      subrace: data.subrace,
      class: data.class || 'Fighter',
      level: 1,
      experiencePoints: 0,
      background: data.background,
      alignment: data.alignment,

      // Physical
      age: data.age,
      height: data.height,
      weight: data.weight,
      eyes: data.eyes,
      skin: data.skin,
      hair: data.hair,

      // Abilities
      baseAbilities: {
        strength: data.baseAbilities?.strength || 10,
        dexterity: data.baseAbilities?.dexterity || 10,
        constitution: data.baseAbilities?.constitution || 10,
        intelligence: data.baseAbilities?.intelligence || 10,
        wisdom: data.baseAbilities?.wisdom || 10,
        charisma: data.baseAbilities?.charisma || 10,
      },
      racialBonuses: data.racialBonuses,

      // Combat
      hitPoints: {
        current: maxHP,
        max: maxHP,
        temp: 0,
      },
      hitDice: [{
        diceSize: hitDieSize,
        total: 1,
        used: 0,
      }],
      deathSaves: {
        successes: 0,
        failures: 0,
      },
      speed,
      inspiration: false,

      // Proficiencies
      savingThrowProficiencies,
      skillProficiencies: data.skillProficiencies || [],
      skillExpertise: [],
      armorProficiencies: [],
      weaponProficiencies: [],
      toolProficiencies: data.toolProficiencies || [],
      languages: data.languages || ['Common'],

      // Money
      currency: {
        cp: 0,
        sp: 0,
        ep: 0,
        gp: data.startingGold || 0,
        pp: 0,
      },

      // Properties (items, features, spells, etc.)
      properties: data.startingEquipment || [],

      // Personality
      personalityTraits: data.personalityTraits,
      ideals: data.ideals,
      bonds: data.bonds,
      flaws: data.flaws,
      backstory: data.backstory,

      // Metadata
      createdAt: new Date(),
      updatedAt: new Date(),

      imageUrl: data.imageUrl,
    };

    return character;
  },

  createAndSaveCharacter: async (campaignId) => {
    set({ isSaving: true, saveError: null });

    try {
      const character = get().buildCharacter(campaignId);

      // Use the character store to save (which handles DB persistence)
      await useCharacterStore.getState().addCharacter(character);

      // Reset the builder after successful save
      get().reset();

      set({ isSaving: false });
      return character;
    } catch (error) {
      const errorMessage = getErrorMessage(error, "Failed to save character");
      set({ isSaving: false, saveError: errorMessage });
      throw error;
    }
  },
}));
