/**
 * D&D 5e Character Type Definitions
 * Property-based character system inspired by DiceCloud
 * 
 * Key Principles:
 * 1. Store CHOICES, compute RESULTS
 * 2. XP is source of truth for level
 * 3. Everything is a property with modifiers
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

// ============================================
// CHOICES-BASED CHARACTER DATA
// ============================================

/**
 * ASI (Ability Score Improvement) or Feat choice
 */
export interface ASIChoice {
  type: 'asi' | 'feat';
  // For ASI
  abilityIncreases?: Partial<Record<Ability, number>>;
  // For Feat
  featId?: string;
  featName?: string;
  featChoices?: Record<string, string>; // For feats with sub-choices
}

/**
 * Equipment choice made during character creation
 */
export interface EquipmentChoice {
  promptId: string;
  selectedOptionIndex: number;
  customizations?: Record<string, string>; // e.g., "which martial weapon?"
}

/**
 * Character Choices
 * ONLY stores player decisions - everything else is derived
 */
export interface CharacterChoices {
  // Core selections
  race: string;
  subrace?: string;
  class: string;
  subclass?: string;
  background?: string;
  alignment?: Alignment;
  
  // Experience points (level is derived from this)
  experiencePoints: number;
  
  // Ability score assignment
  abilityScoreMethod: 'pointBuy' | 'standardArray' | 'rolled' | 'manual';
  baseAbilities: AbilityScores;
  rolledScores?: number[]; // If rolled, store the original rolls
  
  // Proficiency selections
  skillProficiencies: Skill[];
  toolProficiencies: string[];
  languages: string[];
  
  // Equipment from creation
  equipmentChoices: EquipmentChoice[];
  startingGold?: number;
  usedStartingGold?: boolean; // If true, took gold instead of equipment
  
  // Spellcasting choices
  cantripsKnown: string[];  // Spell slugs
  spellsKnown: string[];    // Spell slugs
  spellsPrepared: string[]; // For prepared casters
  
  // Level-up choices
  asiChoices: Record<number, ASIChoice>; // Keyed by level (4, 8, 12, etc.)
  subclassLevel?: number; // When subclass was chosen
  
  // Fighting styles, invocations, etc.
  classChoices: Record<string, string[]>; // e.g., { "fightingStyle": ["defense"] }
  
  // Multiclass (if applicable)
  multiclassLevels?: Record<string, number>; // e.g., { "fighter": 5, "wizard": 3 }
}

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
  // Attunement object for components that expect this structure
  attunement?: {
    attuned: boolean;
    maxAttunement?: number;
  };
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
 * Class Resource Property
 * Ki Points, Rage Uses, Sorcery Points, Channel Divinity, etc.
 */
export interface ClassResourceProperty extends BaseProperty {
  type: 'classResource';
  resourceName: string;
  className: string;
  current: number;
  max: number;
  rechargeOn: 'shortRest' | 'longRest' | 'dawn' | 'turn' | 'never';
  rechargeAmount?: number | 'all'; // How much to restore
  levelScaling?: Record<number, number>; // Max at each level
  modifiers?: Modifier[];
}

/**
 * Alternate Form Property
 * Wildshape, Polymorph, True Polymorph forms
 */
export interface AlternateFormProperty extends BaseProperty {
  type: 'alternateForm';
  formSource: 'wildshape' | 'polymorph' | 'truePolymorph' | 'shapechange' | 'other';
  creatureName: string;
  creatureSlug?: string; // Open5e monster slug
  
  // Temporary stats when in this form
  formHP: {
    current: number;
    max: number;
  };
  formAC: number;
  formSpeed: Record<string, number>; // walk, fly, swim, etc.
  formAbilities: AbilityScores;
  
  // Form restrictions
  canSpeak: boolean;
  canCastSpells: boolean;
  retainMentalStats: boolean; // INT, WIS, CHA from original
  retainProficiencies: boolean;
  retainClassFeatures: boolean;
  
  // Actions available in this form
  formActions?: ActionProperty[];
  
  // CR/Level limit for the form
  crLimit?: number;
  
  // Duration tracking
  duration?: {
    value: number;
    unit: 'hours' | 'minutes' | 'rounds';
    remaining?: number;
  };
}

/**
 * Companion Property
 * Familiars, Animal Companions, Mounts, Sidekicks
 */
export interface CompanionProperty extends BaseProperty {
  type: 'companion';
  companionType: 'familiar' | 'animalCompanion' | 'mount' | 'sidekick' | 'summon' | 'other';
  creatureName: string;
  creatureSlug?: string; // Open5e monster slug
  customName?: string;
  
  // Companion stats
  hp: {
    current: number;
    max: number;
  };
  ac: number;
  speed: Record<string, number>;
  abilities: AbilityScores;
  
  // Companion features
  actions?: ActionProperty[];
  traits?: FeatureProperty[];
  
  // Link to summoning spell/feature
  sourceFeatureId?: string;
  sourceSpellId?: string;
  
  // Companion state
  isSummoned: boolean;
  distance?: number; // Distance from caster (for familiars)
  
  // For Find Familiar-style companions
  formOptions?: string[]; // List of available forms
  currentForm?: string;
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
  | EffectProperty
  | ClassResourceProperty
  | AlternateFormProperty
  | CompanionProperty;

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
 * Spell slot info
 */
export interface SpellSlot {
  level: number;
  total: number;
  used: number;
}

/**
 * Known spell info (for UI)
 */
export interface KnownSpell {
  name: string;
  level: number;
  prepared: boolean;
  concentration?: boolean;
  ritual?: boolean;
}

/**
 * Spellcasting info
 */
export interface SpellcastingInfo {
  ability: Ability;
  // Support both naming conventions
  spellSaveDC?: number;
  saveDC?: number;
  spellAttackBonus?: number;
  attackBonus?: number;
  // Support both array and Record for spell slots
  spellSlots: SpellSlot[] | Record<number, { total: number; used: number }>;
  cantripsKnown: number;
  spellsKnown?: number;
  spellsPrepared?: number;
  // Spells list for UI
  spells?: KnownSpell[];
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

/**
 * CharacterUpdateInput
 * Partial character data for updates
 * Uses a simplified spellcasting type to avoid union conflicts
 */
export interface CharacterUpdateInput extends Omit<Partial<Character>, 'spellcasting'> {
  // Allow updating spellcasting with simplified type
  spellcasting?: {
    ability?: Ability;
    spellSaveDC?: number;
    saveDC?: number;
    spellAttackBonus?: number;
    attackBonus?: number;
    spellSlots?: SpellSlot[];
    cantripsKnown?: number;
    spellsKnown?: number;
    spellsPrepared?: number;
    spells?: KnownSpell[];
  };
  // Legacy equipment array support
  equipment?: Array<{
    name: string;
    quantity: number;
    weight: number;
    equipped?: boolean;
  }>;
}
