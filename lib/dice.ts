export interface DiceRoll {
  id: string
  dice: string // e.g., "2d6+3"
  rolls: number[]
  modifier: number
  total: number
  advantage?: boolean
  disadvantage?: boolean
  criticalHit?: boolean
  criticalMiss?: boolean
  timestamp: Date
  label?: string
}

export interface DiceConfig {
  count: number
  sides: number
  modifier: number
}

export function parseDiceNotation(notation: string): DiceConfig | null {
  const match = notation.match(/^(\d+)?d(\d+)([+-]\d+)?$/i)
  if (!match) return null

  return {
    count: Number.parseInt(match[1] || "1"),
    sides: Number.parseInt(match[2]),
    modifier: Number.parseInt(match[3] || "0"),
  }
}

export function rollDice(config: DiceConfig): number[] {
  const rolls: number[] = []
  for (let i = 0; i < config.count; i++) {
    rolls.push(Math.floor(Math.random() * config.sides) + 1)
  }
  return rolls
}

export function rollWithAdvantage(sides: number): { rolls: number[]; result: number } {
  const roll1 = Math.floor(Math.random() * sides) + 1
  const roll2 = Math.floor(Math.random() * sides) + 1
  return {
    rolls: [roll1, roll2],
    result: Math.max(roll1, roll2),
  }
}

export function rollWithDisadvantage(sides: number): { rolls: number[]; result: number } {
  const roll1 = Math.floor(Math.random() * sides) + 1
  const roll2 = Math.floor(Math.random() * sides) + 1
  return {
    rolls: [roll1, roll2],
    result: Math.min(roll1, roll2),
  }
}

export function formatDiceNotation(config: DiceConfig): string {
  let notation = `${config.count}d${config.sides}`
  if (config.modifier > 0) notation += `+${config.modifier}`
  else if (config.modifier < 0) notation += config.modifier
  return notation
}

export const standardDice = [4, 6, 8, 10, 12, 20, 100]

export const commonRolls = [
  { name: "Attack (d20)", dice: "1d20", description: "Standard attack roll" },
  { name: "Ability Check", dice: "1d20", description: "Skill or ability check" },
  { name: "Saving Throw", dice: "1d20", description: "Save vs effect" },
  { name: "Greatsword", dice: "2d6", description: "Greatsword damage" },
  { name: "Longsword", dice: "1d8", description: "Longsword damage" },
  { name: "Fireball", dice: "8d6", description: "Fireball damage (3rd level)" },
  { name: "Sneak Attack (5th)", dice: "3d6", description: "Rogue sneak attack" },
  { name: "Healing Word", dice: "1d4+3", description: "Healing Word (1st level)" },
]
