/**
 * D&D 5e Character System Constants
 * Inspired by DiceCloud's property-based architecture
 */

/**
 * D&D 5e Damage Types
 * These are part of the SRD
 */
export const DAMAGE_TYPES = [
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'force',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'psychic',
  'radiant',
  'slashing',
  'thunder'
] as const;

export type DamageType = typeof DAMAGE_TYPES[number];

/**
 * Ability Scores
 */
export const ABILITIES = [
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma'
] as const;

export type Ability = typeof ABILITIES[number];

/**
 * Ability abbreviations for display
 */
export const ABILITY_ABBREVIATIONS: Record<Ability, string> = {
  strength: 'STR',
  dexterity: 'DEX',
  constitution: 'CON',
  intelligence: 'INT',
  wisdom: 'WIS',
  charisma: 'CHA'
};

/**
 * Ability Score Modifiers
 * Maps ability score to modifier
 */
export function getAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/**
 * Format modifier with sign
 */
export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/**
 * Skills and their associated abilities
 * Based on D&D 5e SRD
 */
export const SKILLS = {
  acrobatics: 'dexterity',
  animalHandling: 'wisdom',
  arcana: 'intelligence',
  athletics: 'strength',
  deception: 'charisma',
  history: 'intelligence',
  insight: 'wisdom',
  intimidation: 'charisma',
  investigation: 'intelligence',
  medicine: 'wisdom',
  nature: 'intelligence',
  perception: 'wisdom',
  performance: 'charisma',
  persuasion: 'charisma',
  religion: 'intelligence',
  sleightOfHand: 'dexterity',
  stealth: 'dexterity',
  survival: 'wisdom',
} as const;

export type Skill = keyof typeof SKILLS;

/**
 * Skill display names
 */
export const SKILL_DISPLAY_NAMES: Record<Skill, string> = {
  acrobatics: 'Acrobatics',
  animalHandling: 'Animal Handling',
  arcana: 'Arcana',
  athletics: 'Athletics',
  deception: 'Deception',
  history: 'History',
  insight: 'Insight',
  intimidation: 'Intimidation',
  investigation: 'Investigation',
  medicine: 'Medicine',
  nature: 'Nature',
  perception: 'Perception',
  performance: 'Performance',
  persuasion: 'Persuasion',
  religion: 'Religion',
  sleightOfHand: 'Sleight of Hand',
  stealth: 'Stealth',
  survival: 'Survival',
};

/**
 * Proficiency levels
 */
export const PROFICIENCY_LEVELS = {
  none: 0,
  half: 0.5,
  proficient: 1,
  expertise: 2,
} as const;

export type ProficiencyLevel = keyof typeof PROFICIENCY_LEVELS;

/**
 * Calculate proficiency bonus by character level
 */
export function getProficiencyBonus(level: number): number {
  return Math.ceil(level / 4) + 1;
}

/**
 * Property Categories
 * Adapted from DiceCloud's property system
 */
export const PROPERTY_CATEGORIES = {
  attribute: {
    name: 'Attribute',
    description: 'Core character statistics',
    icon: 'zap',
  },
  skill: {
    name: 'Skill',
    description: 'Skills, saves, and proficiencies',
    icon: 'target',
  },
  feature: {
    name: 'Feature',
    description: 'Class and racial features',
    icon: 'star',
  },
  action: {
    name: 'Action',
    description: 'Actions your character can take',
    icon: 'sword',
  },
  spell: {
    name: 'Spell',
    description: 'Spells your character knows',
    icon: 'sparkles',
  },
  item: {
    name: 'Item',
    description: 'Equipment and inventory',
    icon: 'package',
  },
  effect: {
    name: 'Effect',
    description: 'Temporary effects and conditions',
    icon: 'circle-dot',
  },
  classResource: {
    name: 'Class Resource',
    description: 'Ki, Rage, Sorcery Points, etc.',
    icon: 'flame',
  },
  alternateForm: {
    name: 'Alternate Form',
    description: 'Wildshape, Polymorph forms',
    icon: 'paw-print',
  },
  companion: {
    name: 'Companion',
    description: 'Familiars, mounts, sidekicks',
    icon: 'heart-handshake',
  },
} as const;

export type PropertyCategory = keyof typeof PROPERTY_CATEGORIES;

/**
 * Armor categories for AC calculation
 */
export const ARMOR_CATEGORIES = {
  light: {
    name: 'Light Armor',
    addDexMod: true,
    maxDexBonus: null,
  },
  medium: {
    name: 'Medium Armor',
    addDexMod: true,
    maxDexBonus: 2,
  },
  heavy: {
    name: 'Heavy Armor',
    addDexMod: false,
    maxDexBonus: 0,
  },
  shield: {
    name: 'Shield',
    addDexMod: false,
    maxDexBonus: null,
  },
} as const;

export type ArmorCategory = keyof typeof ARMOR_CATEGORIES;

/**
 * Standard array for ability score assignment
 */
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;

/**
 * Point buy costs for ability scores
 */
export const POINT_BUY_COSTS: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};

export const POINT_BUY_TOTAL = 27;
export const POINT_BUY_MIN = 8;
export const POINT_BUY_MAX = 15;

/**
 * Alignments
 */
export const ALIGNMENTS = [
  'Lawful Good',
  'Neutral Good',
  'Chaotic Good',
  'Lawful Neutral',
  'True Neutral',
  'Chaotic Neutral',
  'Lawful Evil',
  'Neutral Evil',
  'Chaotic Evil',
] as const;

export type Alignment = typeof ALIGNMENTS[number];

/**
 * Experience points thresholds for each level
 */
export const XP_THRESHOLDS: Record<number, number> = {
  1: 0,
  2: 300,
  3: 900,
  4: 2700,
  5: 6500,
  6: 14000,
  7: 23000,
  8: 34000,
  9: 48000,
  10: 64000,
  11: 85000,
  12: 100000,
  13: 120000,
  14: 140000,
  15: 165000,
  16: 195000,
  17: 225000,
  18: 265000,
  19: 305000,
  20: 355000,
};

/**
 * Hit dice by class
 */
export const CLASS_HIT_DICE: Record<string, number> = {
  barbarian: 12,
  bard: 8,
  cleric: 8,
  druid: 8,
  fighter: 10,
  monk: 8,
  paladin: 10,
  ranger: 10,
  rogue: 8,
  sorcerer: 6,
  warlock: 8,
  wizard: 6,
};

/**
 * Class badge colors for UI display
 */
export const CLASS_COLORS: Record<string, string> = {
  barbarian: "bg-red-600 text-white",
  bard: "bg-pink-500 text-white",
  cleric: "bg-yellow-500 text-black",
  druid: "bg-green-600 text-white",
  fighter: "bg-orange-600 text-white",
  monk: "bg-blue-500 text-white",
  paladin: "bg-yellow-400 text-black",
  ranger: "bg-emerald-600 text-white",
  rogue: "bg-gray-700 text-white",
  sorcerer: "bg-purple-600 text-white",
  warlock: "bg-violet-800 text-white",
  wizard: "bg-indigo-600 text-white",
};

/**
 * Spell schools
 */
export const SPELL_SCHOOLS = [
  'abjuration',
  'conjuration',
  'divination',
  'enchantment',
  'evocation',
  'illusion',
  'necromancy',
  'transmutation',
] as const;

export type SpellSchool = typeof SPELL_SCHOOLS[number];

/**
 * Condition types
 */
export const CONDITIONS = [
  'blinded',
  'charmed',
  'deafened',
  'frightened',
  'grappled',
  'incapacitated',
  'invisible',
  'paralyzed',
  'petrified',
  'poisoned',
  'prone',
  'restrained',
  'stunned',
  'unconscious',
  'exhaustion',
] as const;

export type Condition = typeof CONDITIONS[number];

/**
 * Currency types and their conversion rates to copper pieces
 */
export const CURRENCY = {
  cp: { name: 'Copper', abbr: 'CP', copperValue: 1 },
  sp: { name: 'Silver', abbr: 'SP', copperValue: 10 },
  ep: { name: 'Electrum', abbr: 'EP', copperValue: 50 },
  gp: { name: 'Gold', abbr: 'GP', copperValue: 100 },
  pp: { name: 'Platinum', abbr: 'PP', copperValue: 1000 },
} as const;

export type CurrencyType = keyof typeof CURRENCY;

/**
 * Size categories
 */
export const SIZES = [
  'Tiny',
  'Small',
  'Medium',
  'Large',
  'Huge',
  'Gargantuan',
] as const;

export type Size = typeof SIZES[number];
