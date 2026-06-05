import { describe, it, expect } from "vitest"
import {
  getAbilityModifier,
  getProficiencyBonus,
  formatModifier,
  XP_THRESHOLDS,
} from "./constants"

describe("getAbilityModifier", () => {
  it("returns 0 for a score of 10 and 11", () => {
    expect(getAbilityModifier(10)).toBe(0)
    expect(getAbilityModifier(11)).toBe(0)
  })

  it("floors toward negative for odd low scores", () => {
    expect(getAbilityModifier(8)).toBe(-1)
    expect(getAbilityModifier(7)).toBe(-2)
    expect(getAbilityModifier(9)).toBe(-1)
  })

  it("matches the SRD table at the extremes", () => {
    expect(getAbilityModifier(1)).toBe(-5)
    expect(getAbilityModifier(20)).toBe(5)
    expect(getAbilityModifier(30)).toBe(10)
  })

  it("rounds down for even/odd positive scores", () => {
    expect(getAbilityModifier(12)).toBe(1)
    expect(getAbilityModifier(13)).toBe(1)
    expect(getAbilityModifier(15)).toBe(2)
  })
})

describe("getProficiencyBonus", () => {
  it("steps +2/+3/+4/+5/+6 across the four-level bands", () => {
    expect([1, 2, 3, 4].map(getProficiencyBonus)).toEqual([2, 2, 2, 2])
    expect([5, 6, 7, 8].map(getProficiencyBonus)).toEqual([3, 3, 3, 3])
    expect([9, 10, 11, 12].map(getProficiencyBonus)).toEqual([4, 4, 4, 4])
    expect([13, 14, 15, 16].map(getProficiencyBonus)).toEqual([5, 5, 5, 5])
    expect([17, 18, 19, 20].map(getProficiencyBonus)).toEqual([6, 6, 6, 6])
  })
})

describe("formatModifier", () => {
  it("prefixes a + on non-negative values and leaves the - on negatives", () => {
    expect(formatModifier(0)).toBe("+0")
    expect(formatModifier(3)).toBe("+3")
    expect(formatModifier(-2)).toBe("-2")
  })
})

describe("XP_THRESHOLDS", () => {
  it("starts at 0 for level 1 and ends at 355000 for level 20", () => {
    expect(XP_THRESHOLDS[1]).toBe(0)
    expect(XP_THRESHOLDS[20]).toBe(355000)
  })

  it("is strictly increasing across all 20 levels", () => {
    for (let level = 2; level <= 20; level++) {
      expect(XP_THRESHOLDS[level]).toBeGreaterThan(XP_THRESHOLDS[level - 1])
    }
  })
})
