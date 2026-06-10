import { describe, expect, it } from "vitest"
import { clampExhaustion, exhaustionEffects, exhaustionSummary } from "./exhaustion"

describe("clampExhaustion", () => {
  it("clamps into 0–6 and rounds", () => {
    expect(clampExhaustion(-2)).toBe(0)
    expect(clampExhaustion(2.6)).toBe(3)
    expect(clampExhaustion(9)).toBe(6)
  })
})

describe("exhaustionEffects", () => {
  it("is empty at level 0 in both editions", () => {
    expect(exhaustionEffects(0, "2014")).toEqual([])
    expect(exhaustionEffects(0, "2024")).toEqual([])
  })

  it("2014 is cumulative — level 3 includes levels 1–3", () => {
    expect(exhaustionEffects(3, "2014")).toEqual([
      "Disadvantage on ability checks",
      "Speed halved",
      "Disadvantage on attack rolls and saving throws",
    ])
  })

  it("2014 level 6 ends in death", () => {
    expect(exhaustionEffects(6, "2014").at(-1)).toBe("Death")
  })

  it("2024 scales −2/level to d20 tests and −5 ft/level speed", () => {
    expect(exhaustionEffects(2, "2024")).toEqual([
      "−4 to every d20 Test (attacks, checks, saves)",
      "Speed −10 ft",
    ])
  })

  it("2024 level 6 is death", () => {
    expect(exhaustionEffects(6, "2024")).toEqual(["Death (Exhaustion level 6)"])
  })
})

describe("exhaustionSummary", () => {
  it("joins effects into one line", () => {
    expect(exhaustionSummary(1, "2024")).toBe(
      "−2 to every d20 Test (attacks, checks, saves); Speed −5 ft",
    )
  })
})
