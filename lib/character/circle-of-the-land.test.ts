import { describe, it, expect } from "vitest"
import { LAND_TERRAINS, getTerrainById, getCircleSpells } from "./circle-of-the-land"

describe("getCircleSpells", () => {
  it("grants nothing below druid level 3", () => {
    expect(getCircleSpells("forest", 2)).toEqual([])
  })

  it("grants the 3rd-level tier as 2nd-level spells at druid 3", () => {
    expect(getCircleSpells("forest", 3)).toEqual([
      { name: "barkskin", spellLevel: 2 },
      { name: "spider climb", spellLevel: 2 },
    ])
  })

  it("accumulates tiers with the fixed 2/3/4/5 cadence", () => {
    const spells = getCircleSpells("arctic", 20)
    expect(spells).toHaveLength(8)
    expect(spells.map((s) => s.spellLevel)).toEqual([2, 2, 3, 3, 4, 4, 5, 5])
    // 9th-level tier (spell level 5) — verified vs wikidot.
    expect(spells.slice(6)).toEqual([
      { name: "commune with nature", spellLevel: 5 },
      { name: "cone of cold", spellLevel: 5 },
    ])
  })

  it("returns [] for an unknown terrain", () => {
    expect(getCircleSpells("nonsense", 9)).toEqual([])
    expect(getCircleSpells(undefined, 9)).toEqual([])
  })
})

describe("getTerrainById", () => {
  it("is case-insensitive and covers all eight lands", () => {
    expect(LAND_TERRAINS).toHaveLength(8)
    expect(getTerrainById("UNDERDARK")?.name).toBe("Underdark")
    expect(getTerrainById(undefined)).toBeUndefined()
  })
})
