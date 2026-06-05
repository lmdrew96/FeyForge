import { describe, it, expect } from "vitest"
import {
  getCasterType,
  getEffectiveCasterType,
  getSpellListSource,
  getSpellSlotsForClassLevel,
  getPactSlots,
  getCantripsKnown,
  getSpellLimits,
  maxSpellLevel,
} from "./leveling"

describe("getCasterType", () => {
  it("classifies the curated classes", () => {
    expect(getCasterType("wizard")).toBe("full")
    expect(getCasterType("paladin")).toBe("half")
    expect(getCasterType("warlock")).toBe("pact")
    expect(getCasterType("fighter")).toBe("none")
  })

  it("is case-insensitive", () => {
    expect(getCasterType("Bard")).toBe("full")
  })
})

describe("getSpellSlotsForClassLevel — full caster", () => {
  it("gives a level-1 wizard two 1st-level slots", () => {
    expect(getSpellSlotsForClassLevel("wizard", 1, "2014")).toEqual([
      { level: 1, total: 2 },
    ])
  })

  it("matches the SRD full-caster row at level 5", () => {
    expect(getSpellSlotsForClassLevel("wizard", 5, "2014")).toEqual([
      { level: 1, total: 4 },
      { level: 2, total: 3 },
      { level: 3, total: 2 },
    ])
  })

  it("reaches 9th-level slots at level 20", () => {
    const slots = getSpellSlotsForClassLevel("wizard", 20, "2014")
    expect(slots).toHaveLength(9)
    expect(slots.find((s) => s.level === 9)?.total).toBe(1)
  })

  it("returns [] for a non-caster", () => {
    expect(getSpellSlotsForClassLevel("fighter", 20, "2014")).toEqual([])
  })
})

describe("getSpellSlotsForClassLevel — half caster edition split", () => {
  it("gives a 2014 paladin no slots at level 1", () => {
    expect(getSpellSlotsForClassLevel("paladin", 1, "2014")).toEqual([])
  })

  it("gives a 2024 paladin two 1st-level slots at level 1", () => {
    expect(getSpellSlotsForClassLevel("paladin", 1, "2024")).toEqual([
      { level: 1, total: 2 },
    ])
  })

  it("is identical across editions from level 2 up", () => {
    expect(getSpellSlotsForClassLevel("ranger", 5, "2014")).toEqual(
      getSpellSlotsForClassLevel("ranger", 5, "2024"),
    )
  })
})

describe("getPactSlots", () => {
  it("is a single same-level pool that grows with warlock level", () => {
    expect(getPactSlots(1)).toEqual([{ level: 1, total: 1, used: 0 }])
    expect(getPactSlots(5)).toEqual([{ level: 3, total: 2, used: 0 }])
    expect(getPactSlots(11)).toEqual([{ level: 5, total: 3, used: 0 }])
  })
})

describe("getCantripsKnown", () => {
  it("steps at the level 4 and 10 breakpoints", () => {
    expect(getCantripsKnown("wizard", 1)).toBe(3)
    expect(getCantripsKnown("wizard", 4)).toBe(4)
    expect(getCantripsKnown("wizard", 10)).toBe(5)
  })

  it("is 0 for classes without cantrips", () => {
    expect(getCantripsKnown("paladin", 5)).toBe(0)
    expect(getCantripsKnown("fighter", 20)).toBe(0)
  })
})

describe("third-casters (Eldritch Knight / Arcane Trickster)", () => {
  it("resolves a third caster type only via the subclass", () => {
    expect(getEffectiveCasterType("fighter")).toBe("none")
    expect(getEffectiveCasterType("fighter", "eldritch-knight")).toBe("third")
    expect(getEffectiveCasterType("rogue", "arcane-trickster")).toBe("third")
    expect(getEffectiveCasterType("rogue", "thief")).toBe("none")
  })

  it("draws from the wizard spell list", () => {
    expect(getSpellListSource("fighter", "eldritch-knight")).toBe("wizard")
    expect(getSpellListSource("rogue", "arcane-trickster")).toBe("wizard")
    expect(getSpellListSource("wizard")).toBe("wizard")
    expect(getSpellListSource("rogue", "thief")).toBe("rogue")
  })

  it("has no slots before level 3, then the third-caster progression", () => {
    expect(getSpellSlotsForClassLevel("fighter", 2, "2014", "eldritch-knight")).toEqual([])
    expect(getSpellSlotsForClassLevel("fighter", 3, "2014", "eldritch-knight")).toEqual([
      { level: 1, total: 2 },
    ])
    expect(getSpellSlotsForClassLevel("rogue", 7, "2014", "arcane-trickster")).toEqual([
      { level: 1, total: 4 },
      { level: 2, total: 2 },
    ])
  })

  it("tops out at 4th-level slots at level 20", () => {
    const slots = getSpellSlotsForClassLevel("fighter", 20, "2014", "eldritch-knight")
    expect(slots).toEqual([
      { level: 1, total: 4 },
      { level: 2, total: 3 },
      { level: 3, total: 3 },
      { level: 4, total: 1 },
    ])
  })

  it("is edition-stable", () => {
    expect(getSpellSlotsForClassLevel("fighter", 13, "2014", "eldritch-knight")).toEqual(
      getSpellSlotsForClassLevel("fighter", 13, "2024", "eldritch-knight"),
    )
  })

  it("gives the Arcane Trickster one more cantrip than the Eldritch Knight", () => {
    expect(getCantripsKnown("fighter", 3, "eldritch-knight")).toBe(2)
    expect(getCantripsKnown("fighter", 10, "eldritch-knight")).toBe(3)
    expect(getCantripsKnown("rogue", 3, "arcane-trickster")).toBe(3)
    expect(getCantripsKnown("rogue", 10, "arcane-trickster")).toBe(4)
  })

  it("reports a known-spell limit that starts at level 3", () => {
    expect(getSpellLimits("fighter", 2, 0, "2014", "eldritch-knight")?.leveled).toBe(0)
    const l3 = getSpellLimits("fighter", 3, 0, "2014", "eldritch-knight")
    expect(l3?.leveledLabel).toBe("Spells known")
    expect(l3?.leveled).toBe(3)
    expect(getSpellLimits("rogue", 20, 0, "2014", "arcane-trickster")?.leveled).toBe(13)
  })
})

describe("maxSpellLevel", () => {
  it("is the highest slot level present", () => {
    expect(maxSpellLevel([{ level: 1 }, { level: 3 }, { level: 2 }])).toBe(3)
  })

  it("is 0 when there are no slots", () => {
    expect(maxSpellLevel([])).toBe(0)
  })
})
