/**
 * Character Validation System
 * Validates character data for correctness
 */

import type { Character, CharacterCreationData, AbilityScores } from './types';
import type { Ability, Skill } from './constants';
import { 
  ABILITIES, 
  POINT_BUY_COSTS, 
  POINT_BUY_TOTAL, 
  POINT_BUY_MIN, 
  POINT_BUY_MAX,
  STANDARD_ARRAY,
} from './constants';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validate character name
 */
export function validateName(name: string | undefined): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!name || name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Name is required' });
  } else if (name.trim().length < 2) {
    errors.push({ field: 'name', message: 'Name must be at least 2 characters' });
  } else if (name.trim().length > 50) {
    errors.push({ field: 'name', message: 'Name must be 50 characters or less' });
  }
  
  return errors;
}

/**
 * Validate race selection
 */
export function validateRace(race: string | undefined): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!race || race.trim().length === 0) {
    errors.push({ field: 'race', message: 'Race is required' });
  }
  
  return errors;
}

/**
 * Validate class selection
 */
export function validateClass(className: string | undefined): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!className || className.trim().length === 0) {
    errors.push({ field: 'class', message: 'Class is required' });
  }
  
  return errors;
}

/**
 * Validate ability scores are within valid range (1-30)
 */
export function validateAbilityScores(
  abilities: Partial<AbilityScores> | undefined
): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!abilities) {
    errors.push({ field: 'abilities', message: 'Ability scores are required' });
    return errors;
  }
  
  for (const ability of ABILITIES) {
    const score = abilities[ability];
    
    if (score === undefined) {
      errors.push({ 
        field: `abilities.${ability}`, 
        message: `${ability} score is required` 
      });
    } else if (score < 1 || score > 30) {
      errors.push({ 
        field: `abilities.${ability}`, 
        message: `${ability} must be between 1 and 30` 
      });
    }
  }
  
  return errors;
}

/**
 * Validate point buy ability scores
 */
export function validatePointBuy(abilities: Partial<AbilityScores> | undefined): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!abilities) {
    errors.push({ field: 'abilities', message: 'Ability scores are required' });
    return errors;
  }
  
  let totalCost = 0;
  
  for (const ability of ABILITIES) {
    const score = abilities[ability];
    
    if (score === undefined) {
      errors.push({ 
        field: `abilities.${ability}`, 
        message: `${ability} score is required` 
      });
      continue;
    }
    
    if (score < POINT_BUY_MIN) {
      errors.push({ 
        field: `abilities.${ability}`, 
        message: `${ability} must be at least ${POINT_BUY_MIN} for point buy` 
      });
    } else if (score > POINT_BUY_MAX) {
      errors.push({ 
        field: `abilities.${ability}`, 
        message: `${ability} cannot exceed ${POINT_BUY_MAX} for point buy` 
      });
    } else {
      totalCost += POINT_BUY_COSTS[score] || 0;
    }
  }
  
  if (totalCost > POINT_BUY_TOTAL) {
    errors.push({ 
      field: 'abilities', 
      message: `Point buy total (${totalCost}) exceeds maximum (${POINT_BUY_TOTAL})` 
    });
  }
  
  return errors;
}

/**
 * Validate standard array ability scores
 */
export function validateStandardArray(abilities: Partial<AbilityScores> | undefined): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!abilities) {
    errors.push({ field: 'abilities', message: 'Ability scores are required' });
    return errors;
  }
  
  const usedValues: number[] = [];
  const availableValues = [...STANDARD_ARRAY];
  
  for (const ability of ABILITIES) {
    const score = abilities[ability];
    
    if (score === undefined) {
      errors.push({ 
        field: `abilities.${ability}`, 
        message: `${ability} score is required` 
      });
      continue;
    }
    
    if (!STANDARD_ARRAY.includes(score as typeof STANDARD_ARRAY[number])) {
      errors.push({ 
        field: `abilities.${ability}`, 
        message: `${score} is not a valid standard array value` 
      });
    } else {
      usedValues.push(score);
    }
  }
  
  // Check for duplicates (each value should be used exactly once)
  const counts = new Map<number, number>();
  for (const val of usedValues) {
    counts.set(val, (counts.get(val) || 0) + 1);
  }
  
  for (const [val, count] of counts) {
    const available = STANDARD_ARRAY.filter(v => v === val).length;
    if (count > available) {
      errors.push({ 
        field: 'abilities', 
        message: `Standard array value ${val} used too many times` 
      });
    }
  }
  
  return errors;
}

/**
 * Validate skill proficiency selections
 */
export function validateSkillProficiencies(
  skills: Skill[] | undefined,
  maxChoices: number,
  availableSkills: Skill[]
): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!skills || skills.length === 0) {
    if (maxChoices > 0) {
      errors.push({ 
        field: 'skillProficiencies', 
        message: `Select ${maxChoices} skill proficiencies` 
      });
    }
    return errors;
  }
  
  if (skills.length > maxChoices) {
    errors.push({ 
      field: 'skillProficiencies', 
      message: `Too many skills selected (max ${maxChoices})` 
    });
  }
  
  for (const skill of skills) {
    if (!availableSkills.includes(skill)) {
      errors.push({ 
        field: 'skillProficiencies', 
        message: `${skill} is not available for this class` 
      });
    }
  }
  
  // Check for duplicates
  const unique = new Set(skills);
  if (unique.size !== skills.length) {
    errors.push({ 
      field: 'skillProficiencies', 
      message: 'Duplicate skill selections are not allowed' 
    });
  }
  
  return errors;
}

/**
 * Validate Step 1 (Basics)
 */
export function validateStep1(data: CharacterCreationData): ValidationResult {
  const errors: ValidationError[] = [
    ...validateName(data.name),
    ...validateRace(data.race),
    ...validateClass(data.class),
  ];
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validate Step 2 (Abilities)
 */
export function validateStep2(data: CharacterCreationData): ValidationResult {
  let errors: ValidationError[] = [];
  
  switch (data.abilityScoreMethod) {
    case 'pointBuy':
      errors = validatePointBuy(data.baseAbilities);
      break;
    case 'standardArray':
      errors = validateStandardArray(data.baseAbilities);
      break;
    case 'roll':
    case 'manual':
      errors = validateAbilityScores(data.baseAbilities);
      break;
    default:
      errors.push({ 
        field: 'abilityScoreMethod', 
        message: 'Select an ability score method' 
      });
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validate Step 3 (Skills)
 */
export function validateStep3(
  data: CharacterCreationData,
  maxSkillChoices: number,
  availableSkills: Skill[]
): ValidationResult {
  const errors = validateSkillProficiencies(
    data.skillProficiencies,
    maxSkillChoices,
    availableSkills
  );
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validate complete character creation data
 */
export function validateCharacterCreation(
  data: CharacterCreationData,
  maxSkillChoices: number = 2,
  availableSkills: Skill[] = []
): ValidationResult {
  const errors: ValidationError[] = [
    ...validateStep1(data).errors,
    ...validateStep2(data).errors,
    ...validateStep3(data, maxSkillChoices, availableSkills).errors,
  ];
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validate a complete character object
 */
export function validateCharacter(character: Character): ValidationResult {
  const errors: ValidationError[] = [];
  
  // Basic info validation
  errors.push(...validateName(character.name));
  errors.push(...validateRace(character.race));
  errors.push(...validateClass(character.class));
  
  // Level validation
  if (character.level < 1 || character.level > 20) {
    errors.push({ field: 'level', message: 'Level must be between 1 and 20' });
  }
  
  // Ability scores validation
  errors.push(...validateAbilityScores(character.baseAbilities));
  
  // HP validation
  if (character.hitPoints.max < 1) {
    errors.push({ field: 'hitPoints.max', message: 'Max HP must be at least 1' });
  }
  if (character.hitPoints.current > character.hitPoints.max + character.hitPoints.temp) {
    errors.push({ 
      field: 'hitPoints.current', 
      message: 'Current HP cannot exceed max HP + temp HP' 
    });
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Calculate point buy remaining points
 */
export function calculatePointBuyRemaining(abilities: Partial<AbilityScores>): number {
  let totalCost = 0;
  
  for (const ability of ABILITIES) {
    const score = abilities[ability];
    if (score !== undefined && score >= POINT_BUY_MIN && score <= POINT_BUY_MAX) {
      totalCost += POINT_BUY_COSTS[score] || 0;
    }
  }
  
  return POINT_BUY_TOTAL - totalCost;
}
