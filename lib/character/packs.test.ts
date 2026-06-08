import { describe, it, expect } from "vitest"
import { getPackContents, PACK_CONTENTS } from "./packs"

describe("getPackContents", () => {
  it("resolves a standard pack by name", () => {
    const c = getPackContents("Explorer's Pack")
    expect(c).not.toBeNull()
    expect(c!.some((x) => x.name === "Bedroll")).toBe(true)
    expect(c!.find((x) => x.name === "Torch")?.quantity).toBe(10)
  })

  it("is tolerant of case and curly apostrophes", () => {
    expect(getPackContents("scholar’s pack")).toBe(PACK_CONTENTS["scholar's pack"])
  })

  it("returns null for a non-pack item", () => {
    expect(getPackContents("Longsword")).toBeNull()
    expect(getPackContents("Potion of Healing")).toBeNull()
  })

  it("tags consumable components so they get Use + steppers", () => {
    const c = getPackContents("Dungeoneer's Pack")!
    expect(c.find((x) => x.name === "Rations (day)")?.category).toBe("consumable")
    expect(c.find((x) => x.name === "Torch")?.category).toBe("consumable")
  })
})
