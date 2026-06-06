import { describe, it, expect } from "vitest"
import { getCritRange, hasDraconicResilience } from "./class-grants"
import { computeArmorClass } from "./sheet-items"
import type { AbilityScores } from "./types"

const abilities = (dex: number): AbilityScores => ({
  strength: 10,
  dexterity: dex,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
})

describe("getCritRange — Champion Improved/Superior Critical", () => {
  it("is 20 for everyone by default", () => {
    expect(getCritRange("fighter", "battle-master", 20)).toBe(20)
    expect(getCritRange("rogue", "thief", 20)).toBe(20)
    expect(getCritRange("fighter", "champion", 2)).toBe(20) // not yet level 3
  })

  it("drops to 19 at Champion level 3 and 18 at level 15", () => {
    expect(getCritRange("fighter", "champion", 3)).toBe(19)
    expect(getCritRange("fighter", "champion", 14)).toBe(19)
    expect(getCritRange("fighter", "champion", 15)).toBe(18)
    expect(getCritRange("fighter", "champion", 20)).toBe(18)
  })
})

describe("hasDraconicResilience", () => {
  it("is true only for the Draconic Bloodline sorcerer", () => {
    expect(hasDraconicResilience("sorcerer", "draconic-bloodline")).toBe(true)
    expect(hasDraconicResilience("sorcerer", "wild-magic")).toBe(false)
    expect(hasDraconicResilience("wizard", "draconic-bloodline")).toBe(false)
  })
})

describe("computeArmorClass — Draconic Resilience", () => {
  it("makes unarmored AC 13 + Dex (a flat +3 over the 10 + Dex default)", () => {
    const dex16 = abilities(16) // +3
    expect(computeArmorClass(1, dex16, [], undefined, false)).toBe(13) // 10 + 3
    expect(computeArmorClass(1, dex16, [], undefined, true)).toBe(16) // 13 + 3
  })

  it("does not stack the bonus onto worn body armor (only unarmored)", () => {
    const dex14 = abilities(14)
    const leather = [
      {
        id: "a1",
        name: "Leather Armor",
        active: true,
        equipped: true,
        category: "armor",
        type: "item",
        armorCategory: "light",
        baseAC: 11,
      },
    ] as unknown as Parameters<typeof computeArmorClass>[2]
    // Light armor = 11 + Dex(2) = 13, with or without Draconic Resilience.
    expect(computeArmorClass(1, dex14, leather, undefined, true)).toBe(13)
  })
})
