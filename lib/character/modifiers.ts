/**
 * Modifier Application System
 * Handles applying modifiers to base values in the correct order
 */

import type { Modifier } from './types';

/**
 * Sort modifiers by type priority
 * Order: set -> add -> multiply -> min -> max
 */
function sortModifiersByPriority(modifiers: Modifier[]): Modifier[] {
  const priorityOrder: Record<Modifier['type'], number> = {
    set: 0,
    add: 1,
    multiply: 2,
    min: 3,
    max: 4,
    advantage: 5,
    disadvantage: 5,
  };
  
  return [...modifiers].sort((a, b) => {
    const priorityDiff = priorityOrder[a.type] - priorityOrder[b.type];
    if (priorityDiff !== 0) return priorityDiff;
    return (a.priority ?? 0) - (b.priority ?? 0);
  });
}

/**
 * Apply modifiers to a base value
 * Follows D&D 5e stacking rules
 */
export function applyModifiers(
  baseValue: number,
  modifiers: Modifier[]
): number {
  const activeModifiers = modifiers.filter(m => m.active);
  if (activeModifiers.length === 0) return baseValue;
  
  const sorted = sortModifiersByPriority(activeModifiers);
  let result = baseValue;
  
  // Track if we've applied a 'set' modifier
  let hasSet = false;
  
  for (const mod of sorted) {
    switch (mod.type) {
      case 'set':
        if (!hasSet) {
          result = mod.value;
          hasSet = true;
        } else {
          // Multiple 'set' modifiers: use the highest
          result = Math.max(result, mod.value);
        }
        break;
        
      case 'add':
        result += mod.value;
        break;
        
      case 'multiply':
        result *= mod.value;
        break;
        
      case 'min':
        result = Math.max(result, mod.value);
        break;
        
      case 'max':
        result = Math.min(result, mod.value);
        break;
        
      // advantage/disadvantage don't affect numeric values
      case 'advantage':
      case 'disadvantage':
        break;
    }
  }
  
  return Math.floor(result);
}

/**
 * Check if roll has advantage
 */
export function hasAdvantage(modifiers: Modifier[]): boolean {
  const active = modifiers.filter(m => m.active);
  const hasAdv = active.some(m => m.type === 'advantage');
  const hasDisadv = active.some(m => m.type === 'disadvantage');
  
  // Advantage and disadvantage cancel out
  if (hasAdv && hasDisadv) return false;
  return hasAdv;
}

/**
 * Check if roll has disadvantage
 */
export function hasDisadvantage(modifiers: Modifier[]): boolean {
  const active = modifiers.filter(m => m.active);
  const hasAdv = active.some(m => m.type === 'advantage');
  const hasDisadv = active.some(m => m.type === 'disadvantage');
  
  // Advantage and disadvantage cancel out
  if (hasAdv && hasDisadv) return false;
  return hasDisadv;
}

/**
 * Get all unique modifier sources for a target
 */
export function getModifierSources(modifiers: Modifier[], target: string): string[] {
  return [...new Set(
    modifiers
      .filter(m => m.active && m.target === target)
      .map(m => m.source)
  )];
}

/**
 * Create a new modifier
 */
export function createModifier(
  source: string,
  target: string,
  type: Modifier['type'],
  value: number,
  options?: Partial<Omit<Modifier, 'id' | 'source' | 'target' | 'type' | 'value'>>
): Modifier {
  return {
    id: crypto.randomUUID(),
    source,
    target,
    type,
    value,
    active: true,
    ...options,
  };
}

/**
 * Combine modifiers from multiple sources
 * Handles same-source stacking rules
 */
export function combineModifiers(
  ...modifierArrays: Modifier[][]
): Modifier[] {
  const allModifiers = modifierArrays.flat();
  
  // Group by source and target for same-source non-stacking
  const grouped = new Map<string, Modifier[]>();
  
  for (const mod of allModifiers) {
    const key = `${mod.source}:${mod.target}`;
    const existing = grouped.get(key) || [];
    existing.push(mod);
    grouped.set(key, existing);
  }
  
  // For each group, only keep the best modifier of each type
  // (same named bonuses don't stack in D&D 5e)
  const result: Modifier[] = [];
  
  for (const mods of grouped.values()) {
    // Group by type within this source
    const byType = new Map<Modifier['type'], Modifier[]>();
    
    for (const mod of mods) {
      const existing = byType.get(mod.type) || [];
      existing.push(mod);
      byType.set(mod.type, existing);
    }
    
    // For 'add' type from same source, keep highest
    // For other types, keep all (they might have different effects)
    for (const [type, typeMods] of byType) {
      if (type === 'add' && typeMods.length > 1) {
        // Keep only the highest add modifier from same source
        const best = typeMods.reduce((a, b) => a.value > b.value ? a : b);
        result.push(best);
      } else {
        result.push(...typeMods);
      }
    }
  }
  
  return result;
}

/**
 * Filter modifiers by target
 */
export function filterModifiersByTarget(
  modifiers: Modifier[],
  target: string
): Modifier[] {
  return modifiers.filter(m => m.target === target);
}

/**
 * Get the total bonus from add modifiers
 */
export function getTotalAddBonus(modifiers: Modifier[]): number {
  return modifiers
    .filter(m => m.active && m.type === 'add')
    .reduce((sum, m) => sum + m.value, 0);
}

/**
 * Describe modifiers in human-readable format
 */
export function describeModifiers(modifiers: Modifier[]): string[] {
  return modifiers
    .filter(m => m.active)
    .map(m => {
      const sign = m.value >= 0 ? '+' : '';
      switch (m.type) {
        case 'add':
          return `${sign}${m.value} (${m.source})`;
        case 'multiply':
          return `×${m.value} (${m.source})`;
        case 'set':
          return `= ${m.value} (${m.source})`;
        case 'min':
          return `min ${m.value} (${m.source})`;
        case 'max':
          return `max ${m.value} (${m.source})`;
        case 'advantage':
          return `Advantage (${m.source})`;
        case 'disadvantage':
          return `Disadvantage (${m.source})`;
        default:
          return `${m.source}`;
      }
    });
}
