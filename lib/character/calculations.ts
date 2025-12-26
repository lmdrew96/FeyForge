/**
 * Character Stat Calculation Engine
 * Computes all derived stats from base values and modifiers
 */

import type { 
  Character, 
  CalculatedStats, 
  AbilityScores,
  Modifier,
  ArmorProperty,
  ItemProperty,
  EffectProperty,
} from './types';
import type { Ability, Skill } from './constants';
import { 
  SKILLS, 
  ABILITIES,
  getAbilityModifier, 
  getProficiencyBonus,
  PROFICIENCY_LEVELS,
} from './constants';
import { applyModifiers, combineModifiers, filterModifiersByTarget } from './modifiers';

/**
 * Calculate final ability scores including racial bonuses and modifiers
 */
export function calculateAbilityScores(character: Character): AbilityScores {
  // Support both old schema (abilityScores) and new schema (baseAbilities)
  const baseScores = character.baseAbilities || (character as any).abilityScores || {
    strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10
  };
  const result: AbilityScores = { ...baseScores };
  
  // Apply racial bonuses
  if (character.racialBonuses) {
    for (const ability of ABILITIES) {
      if (character.racialBonuses[ability]) {
        result[ability] += character.racialBonuses[ability]!;
      }
    }
  }
  
  // Apply modifiers from properties (magic items, effects, etc.)
  const modifiers = getAllModifiers(character);
  
  for (const ability of ABILITIES) {
    const abilityMods = filterModifiersByTarget(modifiers, ability);
    result[ability] = applyModifiers(result[ability], abilityMods);
  }
  
  return result;
}

/**
 * Calculate ability modifiers from scores
 */
export function calculateAbilityModifiers(abilities: AbilityScores): Record<Ability, number> {
  const result = {} as Record<Ability, number>;
  
  for (const ability of ABILITIES) {
    result[ability] = getAbilityModifier(abilities[ability]);
  }
  
  return result;
}

/**
 * Get all active modifiers from character properties
 */
export function getAllModifiers(character: Character): Modifier[] {
  const modifiers: Modifier[] = [];
  
  // Safety check for characters without properties array
  if (!character.properties || !Array.isArray(character.properties)) {
    return modifiers;
  }
  
  for (const prop of character.properties) {
    if (!prop.active) continue;
    
    // Get modifiers from items
    if (prop.type === 'item' && 'modifiers' in prop) {
      const item = prop as ItemProperty;
      // Only apply modifiers from equipped items
      if (item.equipped) {
        // For attunable items, only apply if attuned
        if (item.requiresAttunement && !item.attuned) continue;
        modifiers.push(...item.modifiers);
      }
    }
    
    // Get modifiers from effects
    if (prop.type === 'effect' && 'modifiers' in prop) {
      const effect = prop as EffectProperty;
      modifiers.push(...effect.modifiers);
    }
    
    // Get modifiers from features
    if (prop.type === 'feature' && 'modifiers' in prop) {
      const feature = prop as { modifiers?: Modifier[] };
      if (feature.modifiers) {
        modifiers.push(...feature.modifiers);
      }
    }
  }
  
  return modifiers.filter(m => m.active);
}

/**
 * Calculate skill modifier
 * Formula: Ability Modifier + (Proficiency Bonus × proficiency level)
 */
export function calculateSkillModifier(
  character: Character,
  skill: Skill,
  abilities: AbilityScores
): number {
  const ability = SKILLS[skill];
  const abilityMod = getAbilityModifier(abilities[ability]);
  const profBonus = getProficiencyBonus(character.level || 1);
  
  // Check proficiency level
  let profMultiplier = 0;
  if ((character.skillExpertise || []).includes(skill)) {
    profMultiplier = PROFICIENCY_LEVELS.expertise;
  } else if ((character.skillProficiencies || []).includes(skill)) {
    profMultiplier = PROFICIENCY_LEVELS.proficient;
  }
  
  const baseModifier = abilityMod + Math.floor(profBonus * profMultiplier);
  
  // Apply additional modifiers from items/effects
  const modifiers = getAllModifiers(character);
  const skillMods = filterModifiersByTarget(modifiers, skill);
  
  return applyModifiers(baseModifier, skillMods);
}

/**
 * Calculate all skill modifiers
 */
export function calculateAllSkillModifiers(
  character: Character,
  abilities: AbilityScores
): Record<Skill, number> {
  const result = {} as Record<Skill, number>;
  
  for (const skill of Object.keys(SKILLS) as Skill[]) {
    result[skill] = calculateSkillModifier(character, skill, abilities);
  }
  
  return result;
}

/**
 * Calculate saving throw modifier
 */
export function calculateSavingThrow(
  character: Character,
  ability: Ability,
  abilities: AbilityScores
): number {
  const abilityMod = getAbilityModifier(abilities[ability]);
  const profBonus = getProficiencyBonus(character.level || 1);
  
  // Check if proficient in this saving throw
  const isProficient = (character.savingThrowProficiencies || []).includes(ability);
  const baseSave = abilityMod + (isProficient ? profBonus : 0);
  
  // Apply additional modifiers
  const modifiers = getAllModifiers(character);
  const saveMods = filterModifiersByTarget(modifiers, `${ability}Save`);
  
  return applyModifiers(baseSave, saveMods);
}

/**
 * Calculate all saving throws
 */
export function calculateAllSavingThrows(
  character: Character,
  abilities: AbilityScores
): Record<Ability, number> {
  const result = {} as Record<Ability, number>;
  
  for (const ability of ABILITIES) {
    result[ability] = calculateSavingThrow(character, ability, abilities);
  }
  
  return result;
}

/**
 * Calculate Armor Class
 */
export function calculateArmorClass(
  character: Character,
  abilities: AbilityScores
): number {
  const dexMod = getAbilityModifier(abilities.dexterity);
  
  // Safety check for characters without properties array
  const properties = character.properties || [];
  
  // Find equipped armor and shield
  const equippedArmor = properties.find(
    p => p.type === 'item' && 
         p.active &&
         (p as ItemProperty).equipped && 
         (p as ItemProperty).category === 'armor' &&
         (p as ArmorProperty).armorCategory !== 'shield'
  ) as ArmorProperty | undefined;
  
  const equippedShield = properties.find(
    p => p.type === 'item' && 
         p.active &&
         (p as ItemProperty).equipped && 
         (p as ArmorProperty).armorCategory === 'shield'
  ) as ArmorProperty | undefined;
  
  let baseAC = 10 + dexMod; // Unarmored default
  
  if (equippedArmor) {
    const armor = equippedArmor;
    baseAC = armor.baseAC;
    
    // Add dex modifier based on armor category
    switch (armor.armorCategory) {
      case 'light':
        baseAC += dexMod;
        break;
      case 'medium':
        baseAC += Math.min(dexMod, 2);
        break;
      case 'heavy':
        // No dex modifier
        break;
    }
  }
  
  // Add shield bonus
  if (equippedShield) {
    baseAC += equippedShield.baseAC;
  }
  
  // Apply additional AC modifiers (magic items, spells, etc.)
  const modifiers = getAllModifiers(character);
  const acMods = filterModifiersByTarget(modifiers, 'armorClass');
  
  return applyModifiers(baseAC, acMods);
}

/**
 * Calculate initiative modifier
 */
export function calculateInitiative(
  character: Character,
  abilities: AbilityScores
): number {
  const dexMod = getAbilityModifier(abilities.dexterity);
  
  const modifiers = getAllModifiers(character);
  const initMods = filterModifiersByTarget(modifiers, 'initiative');
  
  return applyModifiers(dexMod, initMods);
}

/**
 * Calculate speed
 */
export function calculateSpeed(character: Character): number {
  const baseSpeed = character.speed || 30;
  
  const modifiers = getAllModifiers(character);
  const speedMods = filterModifiersByTarget(modifiers, 'speed');
  
  return applyModifiers(baseSpeed, speedMods);
}

/**
 * Calculate passive perception
 */
export function calculatePassivePerception(
  character: Character,
  skillModifiers: Record<Skill, number>
): number {
  const perceptionMod = skillModifiers.perception;
  let passive = 10 + perceptionMod;
  
  // Check for advantage/disadvantage on perception
  const modifiers = getAllModifiers(character);
  const perceptionMods = filterModifiersByTarget(modifiers, 'perception');
  
  const hasAdv = perceptionMods.some(m => m.type === 'advantage');
  const hasDisadv = perceptionMods.some(m => m.type === 'disadvantage');
  
  if (hasAdv && !hasDisadv) passive += 5;
  if (hasDisadv && !hasAdv) passive -= 5;
  
  return passive;
}

/**
 * Calculate carrying capacity
 */
export function calculateCarryingCapacity(abilities: AbilityScores): number {
  return abilities.strength * 15;
}

/**
 * Calculate current load (total weight of equipped and carried items)
 */
export function calculateCurrentLoad(character: Character): number {
  // Safety check for characters without properties array
  if (!character.properties || !Array.isArray(character.properties)) {
    return 0;
  }
  
  return character.properties
    .filter(p => p.type === 'item' && p.active)
    .reduce((total, item) => {
      const i = item as ItemProperty;
      return total + (i.weight * i.quantity);
    }, 0);
}

/**
 * Calculate spellcasting stats
 */
export function calculateSpellcasting(
  character: Character,
  abilities: AbilityScores
): { spellSaveDC: number; spellAttackBonus: number } | null {
  if (!character.spellcasting) return null;
  
  const ability = character.spellcasting.ability;
  const abilityMod = getAbilityModifier(abilities[ability]);
  const profBonus = getProficiencyBonus(character.level || 1);
  
  return {
    spellSaveDC: 8 + profBonus + abilityMod,
    spellAttackBonus: profBonus + abilityMod,
  };
}

/**
 * Calculate all character stats at once
 */
export function calculateAllStats(character: Character): CalculatedStats {
  // Normalize character with default values for missing properties
  const level = character.level || 1;
  
  // Calculate ability scores first (needed for other calculations)
  const abilities = calculateAbilityScores(character);
  const abilityModifiers = calculateAbilityModifiers(abilities);
  
  // Calculate skill modifiers
  const skillModifiers = calculateAllSkillModifiers(character, abilities);
  
  // Calculate saving throws
  const savingThrows = calculateAllSavingThrows(character, abilities);
  
  // Calculate combat stats
  const armorClass = calculateArmorClass(character, abilities);
  const initiative = calculateInitiative(character, abilities);
  const speed = calculateSpeed(character);
  const passivePerception = calculatePassivePerception(character, skillModifiers);
  
  // Calculate carrying
  const carryingCapacity = calculateCarryingCapacity(abilities);
  const currentLoad = calculateCurrentLoad(character);
  const encumbered = currentLoad > carryingCapacity;
  
  // Calculate spellcasting
  const spellcasting = calculateSpellcasting(character, abilities);
  
  return {
    abilities,
    abilityModifiers,
    armorClass,
    initiative,
    speed,
    passivePerception,
    proficiencyBonus: getProficiencyBonus(level),
    skillModifiers,
    savingThrows,
    spellSaveDC: spellcasting?.spellSaveDC,
    spellAttackBonus: spellcasting?.spellAttackBonus,
    carryingCapacity,
    currentLoad,
    encumbered,
  };
}

/**
 * Calculate max HP for a character
 * First level: max hit die + CON mod
 * Higher levels: hit die roll (or average) + CON mod per level
 */
export function calculateMaxHP(
  level: number,
  hitDieSize: number,
  conModifier: number,
  useAverage: boolean = true
): number {
  // First level: max hit die + CON
  const firstLevelHP = hitDieSize + conModifier;
  
  if (level === 1) return Math.max(1, firstLevelHP);
  
  // Higher levels: (hit die average rounded up) + CON per level
  const averageRoll = useAverage ? Math.ceil(hitDieSize / 2) + 1 : Math.ceil(hitDieSize / 2);
  const higherLevelHP = (averageRoll + conModifier) * (level - 1);
  
  return Math.max(1, firstLevelHP + higherLevelHP);
}

/**
 * Get attack bonus for a weapon attack
 */
export function calculateAttackBonus(
  character: Character,
  abilities: AbilityScores,
  weaponProperties: string[],
  isProficient: boolean,
  isMelee: boolean
): number {
  const profBonus = isProficient ? getProficiencyBonus(character.level) : 0;
  
  // Determine which ability to use
  const strMod = getAbilityModifier(abilities.strength);
  const dexMod = getAbilityModifier(abilities.dexterity);
  
  let abilityMod: number;
  
  if (weaponProperties.includes('finesse')) {
    // Finesse weapons can use STR or DEX
    abilityMod = Math.max(strMod, dexMod);
  } else if (isMelee) {
    abilityMod = strMod;
  } else {
    abilityMod = dexMod;
  }
  
  return profBonus + abilityMod;
}

/**
 * Get damage bonus for a weapon attack
 */
export function calculateDamageBonus(
  abilities: AbilityScores,
  weaponProperties: string[],
  isMelee: boolean
): number {
  const strMod = getAbilityModifier(abilities.strength);
  const dexMod = getAbilityModifier(abilities.dexterity);
  
  if (weaponProperties.includes('finesse')) {
    return Math.max(strMod, dexMod);
  } else if (isMelee) {
    return strMod;
  } else {
    return dexMod;
  }
}
