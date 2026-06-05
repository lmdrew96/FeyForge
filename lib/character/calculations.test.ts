import { describe, it, expect } from "vitest"
import type { AbilityScores, Character } from "./types"
import {
  calculateAttackBonus,
  calculateDamageBonus,
  calculateMaxHP,
} from "./calculations"

// Build a full AbilityScores from partial overrides (everything else = 10/+0).
const scores = (over: Partial<AbilityScores> = {}): AbilityScores => ({
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
  ...over,
})

const atLevel = (level: number): Character => ({ level } as Character)

describe("calculateAttackBonus", () => {
  it("uses STR + proficiency for a melee weapon", () => {
    // STR 16 (+3) + proficiency +2 at level 1
    expect(
      calculateAttackBonus(atLevel(1), scores({ strength: 16 }), [], true, true),
    ).toBe(5)
  })

  it("uses DEX for a ranged weapon", () => {
    // DEX 12 (+1) + proficiency +3 at level 5
    expect(
      calculateAttackBonus(atLevel(5), scores({ dexterity: 12 }), [], true, false),
    ).toBe(4)
  })

  it("uses the better of STR/DEX for a finesse weapon", () => {
    // STR 12 (+1), DEX 18 (+4) -> uses +4; proficiency +2 at level 1
    expect(
      calculateAttackBonus(
        atLevel(1),
        scores({ strength: 12, dexterity: 18 }),
        ["finesse"],
        true,
        true,
      ),
    ).toBe(6)
  })

  it("omits the proficiency bonus when not proficient", () => {
    expect(
      calculateAttackBonus(atLevel(1), scores({ strength: 16 }), [], false, true),
    ).toBe(3)
  })
})

describe("calculateDamageBonus", () => {
  it("uses STR for melee, DEX for ranged", () => {
    expect(calculateDamageBonus(scores({ strength: 14 }), [], true)).toBe(2)
    expect(calculateDamageBonus(scores({ dexterity: 16 }), [], false)).toBe(3)
  })

  it("uses the better ability for finesse", () => {
    expect(
      calculateDamageBonus(scores({ strength: 8, dexterity: 16 }), ["finesse"], true),
    ).toBe(3)
  })
})

describe("calculateMaxHP", () => {
  it("is max hit die + CON at level 1", () => {
    expect(calculateMaxHP(1, 10, 2)).toBe(12)
  })

  it("never drops below 1", () => {
    expect(calculateMaxHP(1, 6, -10)).toBe(1)
  })

  it("adds the rounded-up average + CON per level past 1 (useAverage)", () => {
    // L5 d10 CON+2: 12 + (6 + 2) * 4 = 44
    expect(calculateMaxHP(5, 10, 2, true)).toBe(44)
  })

  it("uses the lower per-level average when useAverage is false", () => {
    // L5 d10 CON+2: 12 + (5 + 2) * 4 = 40
    expect(calculateMaxHP(5, 10, 2, false)).toBe(40)
  })
})
