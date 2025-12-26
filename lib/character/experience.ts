/**
 * Experience Points & Leveling System
 * XP is the source of truth - level is always derived
 */

import { XP_THRESHOLDS } from './constants';

/**
 * Get character level from XP
 */
export function getLevelFromXP(xp: number): number {
  for (let level = 20; level >= 1; level--) {
    if (xp >= XP_THRESHOLDS[level]) {
      return level;
    }
  }
  return 1;
}

/**
 * Get XP required for a specific level
 */
export function getXPForLevel(level: number): number {
  return XP_THRESHOLDS[Math.min(Math.max(level, 1), 20)] || 0;
}

/**
 * Get XP needed to reach the next level
 */
export function getXPToNextLevel(currentXP: number): number {
  const currentLevel = getLevelFromXP(currentXP);
  if (currentLevel >= 20) return 0;
  return XP_THRESHOLDS[currentLevel + 1] - currentXP;
}

/**
 * Get XP progress percentage to next level
 */
export function getXPProgress(currentXP: number): number {
  const currentLevel = getLevelFromXP(currentXP);
  if (currentLevel >= 20) return 100;
  
  const currentLevelXP = XP_THRESHOLDS[currentLevel];
  const nextLevelXP = XP_THRESHOLDS[currentLevel + 1];
  const xpIntoLevel = currentXP - currentLevelXP;
  const xpNeededForLevel = nextLevelXP - currentLevelXP;
  
  return Math.floor((xpIntoLevel / xpNeededForLevel) * 100);
}

/**
 * Check if character would level up with added XP
 */
export function wouldLevelUp(currentXP: number, addedXP: number): boolean {
  const currentLevel = getLevelFromXP(currentXP);
  const newLevel = getLevelFromXP(currentXP + addedXP);
  return newLevel > currentLevel;
}

/**
 * Get all levels gained from XP addition
 */
export function getLevelsGained(currentXP: number, addedXP: number): number[] {
  const currentLevel = getLevelFromXP(currentXP);
  const newLevel = getLevelFromXP(currentXP + addedXP);
  const levels: number[] = [];
  
  for (let level = currentLevel + 1; level <= newLevel; level++) {
    levels.push(level);
  }
  
  return levels;
}

/**
 * Experience tracker class for managing XP
 */
export class ExperienceTracker {
  private _xp: number;
  
  constructor(initialXP: number = 0) {
    this._xp = Math.max(0, initialXP);
  }
  
  get xp(): number {
    return this._xp;
  }
  
  set xp(value: number) {
    this._xp = Math.max(0, value);
  }
  
  get level(): number {
    return getLevelFromXP(this._xp);
  }
  
  get xpToNextLevel(): number {
    return getXPToNextLevel(this._xp);
  }
  
  get progress(): number {
    return getXPProgress(this._xp);
  }
  
  addXP(amount: number): { newXP: number; levelsGained: number[] } {
    const levelsGained = getLevelsGained(this._xp, amount);
    this._xp += amount;
    return { newXP: this._xp, levelsGained };
  }
  
  setLevel(level: number): void {
    this._xp = getXPForLevel(level);
  }
}

/**
 * Milestone leveling utilities
 */
export const MilestoneLeveling = {
  /**
   * Set character to a specific level (milestone style)
   */
  setToLevel(level: number): number {
    return getXPForLevel(level);
  },
  
  /**
   * Level up by one
   */
  levelUp(currentXP: number): number {
    const currentLevel = getLevelFromXP(currentXP);
    if (currentLevel >= 20) return currentXP;
    return getXPForLevel(currentLevel + 1);
  },
  
  /**
   * Level down by one (for respec/corrections)
   */
  levelDown(currentXP: number): number {
    const currentLevel = getLevelFromXP(currentXP);
    if (currentLevel <= 1) return 0;
    return getXPForLevel(currentLevel - 1);
  },
};
