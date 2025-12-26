// D&D 5e SRD Data for Character Creation

export const races = [
  {
    id: "human",
    name: "Human",
    abilityBonuses: { all: 1 },
    speed: 30,
    traits: ["Extra Language", "Versatile"],
    description: "Humans are the most adaptable and ambitious people among the common races.",
  },
  {
    id: "elf",
    name: "Elf",
    abilityBonuses: { dex: 2 },
    speed: 30,
    traits: ["Darkvision", "Keen Senses", "Fey Ancestry", "Trance"],
    description: "Elves are a magical people of otherworldly grace, living in the world but not entirely part of it.",
    subraces: [
      { id: "high-elf", name: "High Elf", abilityBonuses: { int: 1 }, traits: ["Cantrip", "Extra Language"] },
      { id: "wood-elf", name: "Wood Elf", abilityBonuses: { wis: 1 }, traits: ["Fleet of Foot", "Mask of the Wild"] },
    ],
  },
  {
    id: "dwarf",
    name: "Dwarf",
    abilityBonuses: { con: 2 },
    speed: 25,
    traits: ["Darkvision", "Dwarven Resilience", "Stonecunning"],
    description: "Bold and hardy, dwarves are known as skilled warriors, miners, and workers of stone and metal.",
    subraces: [
      { id: "hill-dwarf", name: "Hill Dwarf", abilityBonuses: { wis: 1 }, traits: ["Dwarven Toughness"] },
      { id: "mountain-dwarf", name: "Mountain Dwarf", abilityBonuses: { str: 2 }, traits: ["Dwarven Armor Training"] },
    ],
  },
  {
    id: "halfling",
    name: "Halfling",
    abilityBonuses: { dex: 2 },
    speed: 25,
    traits: ["Lucky", "Brave", "Halfling Nimbleness"],
    description: "The diminutive halflings survive in a world full of larger creatures by avoiding notice.",
    subraces: [
      { id: "lightfoot", name: "Lightfoot", abilityBonuses: { cha: 1 }, traits: ["Naturally Stealthy"] },
      { id: "stout", name: "Stout", abilityBonuses: { con: 1 }, traits: ["Stout Resilience"] },
    ],
  },
  {
    id: "dragonborn",
    name: "Dragonborn",
    abilityBonuses: { str: 2, cha: 1 },
    speed: 30,
    traits: ["Draconic Ancestry", "Breath Weapon", "Damage Resistance"],
    description: "Dragonborn look very much like dragons standing erect in humanoid form.",
  },
  {
    id: "gnome",
    name: "Gnome",
    abilityBonuses: { int: 2 },
    speed: 25,
    traits: ["Darkvision", "Gnome Cunning"],
    description: "A gnome's energy and enthusiasm for living shines through every inch of their tiny body.",
  },
  {
    id: "half-elf",
    name: "Half-Elf",
    abilityBonuses: { cha: 2, choice: 2 },
    speed: 30,
    traits: ["Darkvision", "Fey Ancestry", "Skill Versatility"],
    description: "Half-elves combine what some say are the best qualities of their elf and human parents.",
  },
  {
    id: "half-orc",
    name: "Half-Orc",
    abilityBonuses: { str: 2, con: 1 },
    speed: 30,
    traits: ["Darkvision", "Menacing", "Relentless Endurance", "Savage Attacks"],
    description: "Half-orcs exhibit a blend of orcish and human characteristics.",
  },
  {
    id: "tiefling",
    name: "Tiefling",
    abilityBonuses: { int: 1, cha: 2 },
    speed: 30,
    traits: ["Darkvision", "Hellish Resistance", "Infernal Legacy"],
    description: "Tieflings are derived from human bloodlines with infernal ancestry.",
  },
]

export const classes = [
  {
    id: "barbarian",
    name: "Barbarian",
    hitDie: 12,
    primaryAbility: "str",
    savingThrows: ["str", "con"],
    description: "A fierce warrior who can enter a battle rage",
    features: ["Rage", "Unarmored Defense"],
  },
  {
    id: "bard",
    name: "Bard",
    hitDie: 8,
    primaryAbility: "cha",
    savingThrows: ["dex", "cha"],
    description: "An inspiring magician whose power echoes the music of creation",
    features: ["Spellcasting", "Bardic Inspiration"],
    spellcaster: true,
  },
  {
    id: "cleric",
    name: "Cleric",
    hitDie: 8,
    primaryAbility: "wis",
    savingThrows: ["wis", "cha"],
    description: "A priestly champion who wields divine magic in service of a higher power",
    features: ["Spellcasting", "Divine Domain"],
    spellcaster: true,
  },
  {
    id: "druid",
    name: "Druid",
    hitDie: 8,
    primaryAbility: "wis",
    savingThrows: ["int", "wis"],
    description: "A priest of the Old Faith, wielding the powers of nature",
    features: ["Druidic", "Spellcasting"],
    spellcaster: true,
  },
  {
    id: "fighter",
    name: "Fighter",
    hitDie: 10,
    primaryAbility: "str",
    savingThrows: ["str", "con"],
    description: "A master of martial combat, skilled with a variety of weapons and armor",
    features: ["Fighting Style", "Second Wind"],
  },
  {
    id: "monk",
    name: "Monk",
    hitDie: 8,
    primaryAbility: "dex",
    savingThrows: ["str", "dex"],
    description: "A master of martial arts, harnessing the power of body and soul",
    features: ["Unarmored Defense", "Martial Arts"],
  },
  {
    id: "paladin",
    name: "Paladin",
    hitDie: 10,
    primaryAbility: "str",
    savingThrows: ["wis", "cha"],
    description: "A holy warrior bound to a sacred oath",
    features: ["Divine Sense", "Lay on Hands"],
    spellcaster: true,
  },
  {
    id: "ranger",
    name: "Ranger",
    hitDie: 10,
    primaryAbility: "dex",
    savingThrows: ["str", "dex"],
    description: "A warrior who combats threats on the edges of civilization",
    features: ["Favored Enemy", "Natural Explorer"],
    spellcaster: true,
  },
  {
    id: "rogue",
    name: "Rogue",
    hitDie: 8,
    primaryAbility: "dex",
    savingThrows: ["dex", "int"],
    description: "A scoundrel who uses stealth and trickery to overcome obstacles",
    features: ["Expertise", "Sneak Attack", "Thieves' Cant"],
  },
  {
    id: "sorcerer",
    name: "Sorcerer",
    hitDie: 6,
    primaryAbility: "cha",
    savingThrows: ["con", "cha"],
    description: "A spellcaster who draws on inherent magic from a gift or bloodline",
    features: ["Spellcasting", "Sorcerous Origin"],
    spellcaster: true,
  },
  {
    id: "warlock",
    name: "Warlock",
    hitDie: 8,
    primaryAbility: "cha",
    savingThrows: ["wis", "cha"],
    description: "A wielder of magic derived from a bargain with an extraplanar entity",
    features: ["Otherworldly Patron", "Pact Magic"],
    spellcaster: true,
  },
  {
    id: "wizard",
    name: "Wizard",
    hitDie: 6,
    primaryAbility: "int",
    savingThrows: ["int", "wis"],
    description: "A scholarly magic-user capable of manipulating the structures of reality",
    features: ["Spellcasting", "Arcane Recovery"],
    spellcaster: true,
  },
]

export const backgrounds = [
  {
    id: "acolyte",
    name: "Acolyte",
    skillProficiencies: ["Insight", "Religion"],
    feature: "Shelter of the Faithful",
  },
  {
    id: "charlatan",
    name: "Charlatan",
    skillProficiencies: ["Deception", "Sleight of Hand"],
    feature: "False Identity",
  },
  {
    id: "criminal",
    name: "Criminal",
    skillProficiencies: ["Deception", "Stealth"],
    feature: "Criminal Contact",
  },
  {
    id: "entertainer",
    name: "Entertainer",
    skillProficiencies: ["Acrobatics", "Performance"],
    feature: "By Popular Demand",
  },
  {
    id: "folk-hero",
    name: "Folk Hero",
    skillProficiencies: ["Animal Handling", "Survival"],
    feature: "Rustic Hospitality",
  },
  {
    id: "guild-artisan",
    name: "Guild Artisan",
    skillProficiencies: ["Insight", "Persuasion"],
    feature: "Guild Membership",
  },
  {
    id: "hermit",
    name: "Hermit",
    skillProficiencies: ["Medicine", "Religion"],
    feature: "Discovery",
  },
  {
    id: "noble",
    name: "Noble",
    skillProficiencies: ["History", "Persuasion"],
    feature: "Position of Privilege",
  },
  {
    id: "outlander",
    name: "Outlander",
    skillProficiencies: ["Athletics", "Survival"],
    feature: "Wanderer",
  },
  {
    id: "sage",
    name: "Sage",
    skillProficiencies: ["Arcana", "History"],
    feature: "Researcher",
  },
  {
    id: "sailor",
    name: "Sailor",
    skillProficiencies: ["Athletics", "Perception"],
    feature: "Ship's Passage",
  },
  {
    id: "soldier",
    name: "Soldier",
    skillProficiencies: ["Athletics", "Intimidation"],
    feature: "Military Rank",
  },
  {
    id: "urchin",
    name: "Urchin",
    skillProficiencies: ["Sleight of Hand", "Stealth"],
    feature: "City Secrets",
  },
]

export const abilities = [
  { id: "str", name: "Strength", abbr: "STR" },
  { id: "dex", name: "Dexterity", abbr: "DEX" },
  { id: "con", name: "Constitution", abbr: "CON" },
  { id: "int", name: "Intelligence", abbr: "INT" },
  { id: "wis", name: "Wisdom", abbr: "WIS" },
  { id: "cha", name: "Charisma", abbr: "CHA" },
]

export const skills = [
  { id: "acrobatics", name: "Acrobatics", ability: "dex" },
  { id: "animal-handling", name: "Animal Handling", ability: "wis" },
  { id: "arcana", name: "Arcana", ability: "int" },
  { id: "athletics", name: "Athletics", ability: "str" },
  { id: "deception", name: "Deception", ability: "cha" },
  { id: "history", name: "History", ability: "int" },
  { id: "insight", name: "Insight", ability: "wis" },
  { id: "intimidation", name: "Intimidation", ability: "cha" },
  { id: "investigation", name: "Investigation", ability: "int" },
  { id: "medicine", name: "Medicine", ability: "wis" },
  { id: "nature", name: "Nature", ability: "int" },
  { id: "perception", name: "Perception", ability: "wis" },
  { id: "performance", name: "Performance", ability: "cha" },
  { id: "persuasion", name: "Persuasion", ability: "cha" },
  { id: "religion", name: "Religion", ability: "int" },
  { id: "sleight-of-hand", name: "Sleight of Hand", ability: "dex" },
  { id: "stealth", name: "Stealth", ability: "dex" },
  { id: "survival", name: "Survival", ability: "wis" },
]

export function calculateModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`
}

export interface Character {
  id: string
  campaignId?: string
  name: string
  gender?: string
  race: string
  subrace?: string
  class: string
  level: number
  background: string
  alignment: string
  experiencePoints: number
  abilityScores: {
    str: number
    dex: number
    con: number
    int: number
    wis: number
    cha: number
  }
  proficiencies: string[]
  hitPoints: {
    current: number
    max: number
    temp: number
  }
  armorClass: number
  initiative: number
  speed: number
  personalityTraits: string
  ideals: string
  bonds: string
  flaws: string
  backstory: string
  equipment: string[]
  spells?: string[]
  features: string[]
  createdAt: Date
  updatedAt: Date
}
