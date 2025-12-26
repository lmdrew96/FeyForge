/**
 * D&D 5e Character Type Definitions
 * Property-based character system inspired by DiceCloud
 */

import type { 
  Ability, 
  Skill, 
  DamageType, 
  ProficiencyLevel,
  PropertyCategory,
  ArmorCategory,
  SpellSchool,
  CurrencyType,
  Alignment,
  Size,
  Condition
} from './constants';

/**
 * Base Property
 * Everything on a character sheet is a property
 */
export interface BaseProperty {
  id: string;
  type: PropertyCategory;
  name: string;
  description?: string;
  active: boolean;
  tags?: string[];
  order?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Modifier
 * Represents a bonus/penalty to an attribute
 */
export interface Modifier {
  id: string;
  source: string;
  sourceId?: string;
  target: string;
  type: 'add' | 'multiply' | 'set' | 'advantage' | 'disadvantage' | 'min' | 'max';
  value: number;
  active: boolean;
  condition?: string;
  priority?: number;
}

/**
 * Attribute Property
 * Core stats like STR, DEX, HP, AC, Speed
 */
export interface AttributeProperty extends BaseProperty {
  type: 'attribute';
  attributeName: string;
  baseValue: number;
  modifiers: Modifier[];
  currentValue?: number;
  maxValue?: number;
}

/**
 * Skill Property
 * Skills, saves, tool proficiencies
 */
export interface SkillProperty extends BaseProperty {
  type: 'skill';
  skillName: Skill | string;
  ability: Ability;
  proficiencyLevel: ProficiencyLevel;
  modifiers: Modifier[];
}

/**
 * Saving Throw Property
 */
export interface SavingThrowProperty extends BaseProperty {
  type: 'skill';
  ability: Ability;
  proficient: boolean;
  modifiers: Modifier[];
}

/**
 * Feature Property
 * Racial traits, class features, feats
 */
export interface FeatureProperty extends BaseProperty {
  type: 'feature';
  source: 'race' | 'class' | 'background' | 'feat' | 'other';
  sourceClass?: string;
  level?: number;
  uses?: {
    current: number;
    max: number;
    rechargeOn: 'shortRest' | 'longRest' | 'dawn' | 'never';
  };
  grants?: BaseProperty[];
  modifiers?: Modifier[];
}

/**
 * Item Property
 * Equipment, weapons, magic items
 */
export interface ItemProperty extends BaseProperty {
  type: 'item';
  category: 'weapon' | 'armor' | 'gear' | 'magic' | 'consumable' | 'treasure' | 'tool';
  equipped: boolean;
  attuned?: boolean;
  requiresAttunement?: boolean;
  quantity: number;
  weight: number;
  cost?: {
    amount: number;
    currency: CurrencyType;
  };
  modifiers: Modifier[];
  properties?: string[];
  rarity?: 'common' | 'uncommon' | 'rare' | 'very rare' | 'legendary' | 'artifact';
}

/**
 * Weapon Item (extends ItemProperty)
 */
export interface WeaponProperty extends ItemProperty {
  category: 'weapon';
  weaponType: 'simple' | 'martial';
  damageType: DamageType;
  damageDice: string;
  range?: {
    normal: number;
    long?: number;
  };
  properties: string[];
}

/**
 * Armor Item (extends ItemProperty)
 */
export interface ArmorProperty extends ItemProperty {
  category: 'armor';
  armorCategory: ArmorCategory;
  baseAC: number;
  strengthRequirement?: number;
  stealthDisadvantage?: boolean;
}

/**
 * Spell Property
 */
export interface SpellProperty extends BaseProperty {
  type: 'spell';
  spellLevel: number;
  school: SpellSchool;
  castingTime: string;
  range: string;
  components: {
    verbal: boolean;
    somatic: boolean;
    material: boolean;
    materialCost?: string;
  };
  duration: string;
  concentration: boolean;
  ritual: boolean;
  damage?: {
    diceCount: number;
    diceSize: number;
    damageType: DamageType;
    bonus?: number;
    scaling?: string;
  };
  prepared: boolean;
  alwaysPrepared?: boolean;
  source?: string;
}

/**
 * Action Property
 * Attacks, special actions
 */
export interface ActionProperty extends BaseProperty {
  type: 'action';
  actionType: 'action' | 'bonusAction' | 'reaction' | 'free' | 'movement';
  attack?: {
    type: 'melee' | 'ranged' | 'spell';
    ability?: Ability;
    proficient?: boolean;
    bonus?: number;
    reach?: number;
    range?: {
      normal: number;
      long?: number;
    };
  };
  damage?: Array<{
    diceCount: number;
    diceSize: number;
    damageType: DamageType;
    bonus?: number;
    ability?: Ability;
  }>;
  uses?: {
    current: number;
    max: number;
    rechargeOn: 'shortRest' | 'longRest' | 'turn' | 'never';
  };
  linkedItemId?: string;
}

/**
 * Effect Property
 * Temporary conditions, buffs, debuffs
 */
export interface EffectProperty extends BaseProperty {
  type: 'effect';
  effectType: 'condition' | 'buff' | 'debuff' | 'other';
  condition?: Condition;
  duration?: {
    value: number;
    unit: 'rounds' | 'minutes' | 'hours' | 'days' | 'permanent';
  };
  modifiers: Modifier[];
  source?: string;
}

/**
 * Union type for all property types
 */
export type CharacterProperty = 
  | AttributeProperty 
  | SkillProperty 
  | FeatureProperty 
  | ItemProperty 
  | WeaponProperty
  | ArmorProperty
  | SpellProperty 
  | ActionProperty
  | EffectProperty;

/**
 * Ability Scores object
 */
export interface AbilityScores {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

/**
 * Hit Points tracking
 */
export interface HitPoints {
  current: number;
  max: number;
  temp: number;
}

/**
 * Hit Dice tracking
 */
export interface HitDice {
  diceSize: number;
  total: number;
  used: number;
}

/**
 * Death Saves tracking
 */
export interface DeathSaves {
  successes: number;
  failures: number;
}

/**
 * Currency/Money
 */
export interface Currency {
  cp: number;
  sp: number;
  ep: number;
  gp: number;
  pp: number;
}

/**
 * Spellcasting info
 */
export interface SpellcastingInfo {
  ability: Ability;
  spellSaveDC: number;
  spellAttackBonus: number;
  spellSlots: Record<number, { total: number; used: number }>;
  cantripsKnown: number;
  spellsKnown?: number;
  spellsPrepared?: number;
}

/**
 * Character
 * The complete character data structure
 */
export interface Character {
  id: string;
  campaignId?: string;
  
  // Basic Info
  name: string;
  playerName?: string;
  race: string;
  subrace?: string;
  class: string;
  subclass?: string;
  level: number;
  experiencePoints: number;
  background?: string;
  alignment?: Alignment;
  
  // Physical characteristics
  age?: string;
  height?: string;
  weight?: string;
  eyes?: string;
  skin?: string;
  hair?: string;
  size?: Size;
  
  // Ability Scores (base values before racial bonuses)
  baseAbilities: AbilityScores;
  
  // Racial ability bonuses (applied on top of base)
  racialBonuses?: Partial<AbilityScores>;
  
  // Combat stats
  hitPoints: HitPoints;
  hitDice: HitDice[];
  deathSaves: DeathSaves;
  speed: number;
  inspiration: boolean;
  
  // Proficiencies (tracked as sets of strings)
  savingThrowProficiencies: Ability[];
  skillProficiencies: Skill[];
  skillExpertise: Skill[];
  armorProficiencies: string[];
  weaponProficiencies: string[];
  toolProficiencies: string[];
  languages: string[];
  
  // Money
  currency: Currency;
  
  // Spellcasting (if applicable)
  spellcasting?: SpellcastingInfo;
  
  // Properties (everything else)
  properties: CharacterProperty[];
  
  // Personality
  personalityTraits?: string;
  ideals?: string;
  bonds?: string;
  flaws?: string;
  backstory?: string;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  
  // Portrait/image
  imageUrl?: string;
}

/**
 * Calculated Stats
 * These are computed from Character data, not stored
 */
export interface CalculatedStats {
  // Final ability scores (base + racial + modifiers)
  abilities: AbilityScores;
  abilityModifiers: Record<Ability, number>;
  
  // Combat stats
  armorClass: number;
  initiative: number;
  speed: number;
  passivePerception: number;
  
  // Proficiency
  proficiencyBonus: number;
  
  // Skills
  skillModifiers: Record<Skill, number>;
  
  // Saving throws
  savingThrows: Record<Ability, number>;
  
  // Spellcasting (if applicable)
  spellSaveDC?: number;
  spellAttackBonus?: number;
  
  // Carrying capacity
  carryingCapacity: number;
  currentLoad: number;
  encumbered: boolean;
}

/**
 * Character Creation Data
 * Used during the character builder workflow
 */
export interface CharacterCreationData {
  // Step 1: Basics
  name?: string;
  race?: string;
  subrace?: string;
  class?: string;
  background?: string;
  alignment?: Alignment;
  
  // Step 2: Ability Scores
  baseAbilities?: Partial<AbilityScores>;
  abilityScoreMethod?: 'pointBuy' | 'standardArray' | 'roll' | 'manual';
  racialBonuses?: Partial<AbilityScores>;
  
  // Step 3: Skills & Proficiencies
  skillProficiencies?: Skill[];
  toolProficiencies?: string[];
  languages?: string[];
  
  // Step 4: Equipment
  startingEquipment?: ItemProperty[];
  startingGold?: number;
  useStartingEquipment?: boolean;
  
  // Step 5: Details
  personalityTraits?: string;
  ideals?: string;
  bonds?: string;
  flaws?: string;
  backstory?: string;
  age?: string;
  height?: string;
  weight?: string;
  eyes?: string;
  skin?: string;
  hair?: string;
  imageUrl?: string;
}

/**
 * Class skill choices info
 */
export interface ClassSkillChoices {
  choose: number;
  from: Skill[];
}

/**
 * Parsed class proficiency info
 */
export interface ClassProficiencies {
  armor: string[];
  weapons: string[];
  tools: string[];
  savingThrows: Ability[];
  skills: ClassSkillChoices;
}
