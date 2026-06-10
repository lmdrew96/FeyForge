import { describe, it, expect } from "vitest"
import {
  partitionRaceLanguages,
  languageChoiceCount,
  resolveLanguages,
  ALL_LANGUAGES,
} from "./language-choices"

describe("partitionRaceLanguages", () => {
  it("keeps concrete languages as fixed, no choices", () => {
    const { fixed, choiceCount } = partitionRaceLanguages(["Common", "Dwarvish"])
    expect(fixed).toEqual(["Common", "Dwarvish"])
    expect(choiceCount).toBe(0)
  })

  it("counts a single 'One of your choice' slot", () => {
    const { fixed, choiceCount } = partitionRaceLanguages(["Common", "One of your choice"])
    expect(fixed).toEqual(["Common"])
    expect(choiceCount).toBe(1)
  })

  it("reads the leading count word ('Two of your choice' → 2)", () => {
    expect(partitionRaceLanguages(["Two of your choice"]).choiceCount).toBe(2)
  })
})

describe("languageChoiceCount", () => {
  it("sums race placeholders and the background bonus count", () => {
    // Human: Common + one choice; Outlander background grants 1 more.
    expect(languageChoiceCount(["Common", "One of your choice"], 1)).toBe(2)
  })
})

describe("resolveLanguages", () => {
  it("replaces a race placeholder with a concrete language — never the literal text", () => {
    const out = resolveLanguages(["Common", "One of your choice"], 0)
    expect(out).toContain("Common")
    expect(out).toHaveLength(2)
    expect(out.every((l) => ALL_LANGUAGES.includes(l))).toBe(true)
    expect(out).not.toContain("One of your choice")
  })

  it("honors the background bonus-language count", () => {
    // Elf (Common, Elvish, one choice) + Outlander (1) → 4 distinct languages.
    const out = resolveLanguages(["Common", "Elvish", "One of your choice"], 1)
    expect(out).toContain("Common")
    expect(out).toContain("Elvish")
    expect(out).toHaveLength(4)
    expect(new Set(out.map((l) => l.toLowerCase())).size).toBe(4)
  })

  it("respects explicit selections and never duplicates a fixed language", () => {
    const out = resolveLanguages(["Common", "One of your choice"], 1, ["Draconic", "Infernal"])
    expect(out).toEqual(["Common", "Draconic", "Infernal"])
  })

  it("falls back to a distinct default when a selection collides with a fixed language", () => {
    // Picking "Common" (already known) for the slot falls back to the first unused.
    const out = resolveLanguages(["Common", "One of your choice"], 0, ["Common"])
    expect(out).toHaveLength(2)
    expect(new Set(out.map((l) => l.toLowerCase())).size).toBe(2)
  })
})
