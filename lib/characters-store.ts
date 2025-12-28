import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface Character {
  id: string
  // Basics
  name: string
  race: string
  subrace: string
  characterClass: string
  level: number
  background: string
  alignment: string
  experiencePoints: number

  // Ability Scores (base values without racial bonuses)
  abilities: {
    strength: number
    dexterity: number
    constitution: number
    intelligence: number
    wisdom: number
    charisma: number
  }

  // Proficiencies
  skillProficiencies: string[]
  savingThrowProficiencies: string[]
  toolProficiencies: string[]
  languages: string[]
  proficiencyBonus: number

  // Combat
  armorClass: number
  initiative: number
  speed: number
  hitPoints: {
    current: number
    max: number
    temp: number
  }
  hitDice: {
    total: number
    current: number
    type: string
  }
  deathSaves: {
    successes: number
    failures: number
  }

  // Attacks
  attacks: {
    name: string
    attackBonus: number
    damage: string
    damageType: string
  }[]

  // Features & Traits
  racialTraits: string[]
  classFeatures: string[]
  feats: string[]

  // Inventory
  equipment: {
    name: string
    quantity: number
    weight: number
    equipped: boolean
    attuned?: boolean
  }[]
  currency: {
    cp: number
    sp: number
    ep: number
    gp: number
    pp: number
  }

  // Spellcasting (optional)
  spellcasting?: {
    ability: string
    saveDC: number
    attackBonus: number
    spellSlots: { level: number; total: number; used: number }[]
    spells: {
      name: string
      level: number
      prepared: boolean
      ritual?: boolean
      concentration?: boolean
    }[]
  }

  // Personality
  personalityTraits: string
  ideals: string
  bonds: string
  flaws: string
  backstory: string

  // Physical
  age: string
  height: string
  weight: string
  eyes: string
  skin: string
  hair: string
  imageUrl: string

  // Meta
  createdAt: string
  updatedAt: string
}

interface CharactersStore {
  characters: Character[]
  addCharacter: (character: Character) => void
  updateCharacter: (id: string, data: Partial<Character>) => void
  deleteCharacter: (id: string) => void
  getCharacter: (id: string) => Character | undefined
}

// Sample character for demo
const sampleCharacter: Character = {
  id: "demo-1",
  name: "Lyralei Whisperwind",
  race: "elf",
  subrace: "Wood Elf",
  characterClass: "ranger",
  level: 5,
  background: "outlander",
  alignment: "Chaotic Good",
  experiencePoints: 6500,
  abilities: {
    strength: 12,
    dexterity: 18,
    constitution: 14,
    intelligence: 10,
    wisdom: 16,
    charisma: 8,
  },
  skillProficiencies: ["Perception", "Stealth", "Survival", "Nature", "Athletics", "Animal Handling"],
  savingThrowProficiencies: ["Strength", "Dexterity"],
  toolProficiencies: ["Herbalism Kit"],
  languages: ["Common", "Elvish", "Sylvan"],
  proficiencyBonus: 3,
  armorClass: 15,
  initiative: 4,
  speed: 35,
  hitPoints: {
    current: 38,
    max: 42,
    temp: 0,
  },
  hitDice: {
    total: 5,
    current: 5,
    type: "d10",
  },
  deathSaves: {
    successes: 0,
    failures: 0,
  },
  attacks: [
    { name: "Longbow", attackBonus: 7, damage: "1d8+4", damageType: "Piercing" },
    { name: "Shortsword", attackBonus: 7, damage: "1d6+4", damageType: "Piercing" },
    { name: "Shortsword (Off-hand)", attackBonus: 7, damage: "1d6", damageType: "Piercing" },
  ],
  racialTraits: ["Darkvision", "Fey Ancestry", "Trance", "Keen Senses", "Mask of the Wild", "Fleet of Foot"],
  classFeatures: [
    "Favored Enemy: Beasts, Fey",
    "Natural Explorer: Forest",
    "Fighting Style: Archery",
    "Ranger Conclave: Gloom Stalker",
    "Dread Ambusher",
    "Umbral Sight",
    "Primeval Awareness",
    "Extra Attack",
  ],
  feats: [],
  equipment: [
    { name: "Longbow", quantity: 1, weight: 2, equipped: true },
    { name: "Shortsword", quantity: 2, weight: 2, equipped: true },
    { name: "Studded Leather Armor", quantity: 1, weight: 13, equipped: true },
    { name: "Arrows", quantity: 40, weight: 2, equipped: false },
    { name: "Explorer's Pack", quantity: 1, weight: 59, equipped: false },
    { name: "Hunting Trap", quantity: 1, weight: 25, equipped: false },
    { name: "Cloak of Elvenkind", quantity: 1, weight: 1, equipped: true, attuned: true },
  ],
  currency: {
    cp: 15,
    sp: 32,
    ep: 0,
    gp: 145,
    pp: 2,
  },
  spellcasting: {
    ability: "Wisdom",
    saveDC: 14,
    attackBonus: 6,
    spellSlots: [
      { level: 1, total: 4, used: 1 },
      { level: 2, total: 2, used: 0 },
    ],
    spells: [
      { name: "Hunter's Mark", level: 1, prepared: true, concentration: true },
      { name: "Cure Wounds", level: 1, prepared: true },
      { name: "Fog Cloud", level: 1, prepared: false },
      { name: "Goodberry", level: 1, prepared: true, ritual: false },
      { name: "Pass Without Trace", level: 2, prepared: true, concentration: true },
      { name: "Spike Growth", level: 2, prepared: true, concentration: true },
    ],
  },
  personalityTraits:
    "I watch over my friends as if they were a litter of newborn pups. I feel far more comfortable around animals than people.",
  ideals: "Nature. The natural world is more important than all the constructs of civilization.",
  bonds: "I will bring terrible wrath down on the evildoers who destroyed my homeland.",
  flaws: "I am slow to trust members of other races, tribes, and societies.",
  backstory:
    "Born in the ancient Whisperwind Grove, Lyralei trained as a guardian of the forest from a young age. When a dark force corrupted her homeland, she set out to find allies and the power to restore what was lost.",
  age: "127",
  height: "5'9\"",
  weight: "130 lbs",
  eyes: "Amber",
  skin: "Copper",
  hair: "Dark Brown with green streaks",
  imageUrl: "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

export const useCharactersStore = create<CharactersStore>()(
  persist(
    (set, get) => ({
      characters: [sampleCharacter],
      addCharacter: (character) =>
        set((state) => ({
          characters: [...state.characters, character],
        })),
      updateCharacter: (id, data) =>
        set((state) => ({
          characters: state.characters.map((c) =>
            c.id === id ? { ...c, ...data, updatedAt: new Date().toISOString() } : c,
          ),
        })),
      deleteCharacter: (id) =>
        set((state) => ({
          characters: state.characters.filter((c) => c.id !== id),
        })),
      getCharacter: (id) => get().characters.find((c) => c.id === id),
    }),
    {
      name: "feyforge-characters",
    },
  ),
)
