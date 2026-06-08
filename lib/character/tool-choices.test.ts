import { describe, it, expect } from "vitest"
import {
  partitionToolProficiencies,
  autoResolveToolProficiencies,
  GAMING_SETS,
  ARTISANS_TOOLS,
  MUSICAL_INSTRUMENTS,
} from "./tool-choices"

describe("partitionToolProficiencies", () => {
  it("keeps concrete tools as fixed", () => {
    const { fixed, choices } = partitionToolProficiencies(["Thieves' tools", "Vehicles (land)"])
    expect(fixed).toEqual(["Thieves' tools", "Vehicles (land)"])
    expect(choices).toHaveLength(0)
  })

  it("maps 'One type of gaming set' to the gaming-set options", () => {
    const { choices } = partitionToolProficiencies(["One type of gaming set"])
    expect(choices).toHaveLength(1)
    expect(choices[0].options).toEqual(GAMING_SETS)
    expect(choices[0].count).toBe(1)
  })

  it("maps artisan's tools and musical instruments to their lists", () => {
    expect(partitionToolProficiencies(["One type of artisan's tools"]).choices[0].options).toEqual(ARTISANS_TOOLS)
    expect(partitionToolProficiencies(["One type of musical instrument"]).choices[0].options).toEqual(MUSICAL_INSTRUMENTS)
  })

  it("treats the Bard's three instruments as a count-3 choice", () => {
    const { choices } = partitionToolProficiencies(["Three musical instruments of your choice"])
    expect(choices[0].count).toBe(3)
    expect(choices[0].options).toEqual(MUSICAL_INSTRUMENTS)
  })

  it("combines artisan's tools and instruments for the Monk's either/or grant", () => {
    const { choices } = partitionToolProficiencies(["One type of artisan's tools or musical instrument"])
    expect(choices[0].options).toEqual([...ARTISANS_TOOLS, ...MUSICAL_INSTRUMENTS])
    expect(choices[0].count).toBe(1)
  })

  it("separates fixed and choice tools in a mixed list", () => {
    const { fixed, choices } = partitionToolProficiencies(["One type of gaming set", "Thieves' tools"])
    expect(fixed).toEqual(["Thieves' tools"])
    expect(choices).toHaveLength(1)
  })
})

describe("autoResolveToolProficiencies", () => {
  it("resolves choices to their first option and dedupes with fixed tools", () => {
    const out = autoResolveToolProficiencies(["One type of gaming set", "Thieves' tools"])
    // Fixed tools are listed first, then resolved picks.
    expect(out).toEqual(["Thieves' tools", GAMING_SETS[0]])
  })

  it("picks the first N for a multi-pick choice", () => {
    const out = autoResolveToolProficiencies(["Three musical instruments of your choice"])
    expect(out).toEqual(MUSICAL_INSTRUMENTS.slice(0, 3))
  })

  it("never leaves a 'One type of …' placeholder", () => {
    const out = autoResolveToolProficiencies([
      "One type of artisan's tools",
      "One type of gaming set",
      "Vehicles (land)",
    ])
    expect(out.some((t) => /one type of/i.test(t))).toBe(false)
  })
})
