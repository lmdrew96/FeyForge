import { describe, it, expect } from "vitest"
import type { BackgroundData, ClassData } from "./character-data"
import { mergeToolProficiencies } from "./character-data"

const cls = (toolProficiencies: string[]) => ({ toolProficiencies }) as unknown as ClassData
const bg = (toolProficiencies: string[]) => ({ toolProficiencies }) as unknown as BackgroundData

describe("mergeToolProficiencies", () => {
  it("merges class + background tools", () => {
    expect(mergeToolProficiencies(cls(["Thieves' tools"]), bg(["Gaming set"]))).toEqual([
      "Thieves' tools",
      "Gaming set",
    ])
  })

  it("keeps the background's tools when the class grants none (the regression)", () => {
    expect(mergeToolProficiencies(cls([]), bg(["Disguise kit", "Forgery kit"]))).toEqual([
      "Disguise kit",
      "Forgery kit",
    ])
  })

  it("de-dupes case-insensitively", () => {
    expect(mergeToolProficiencies(cls(["Thieves' Tools"]), bg(["thieves' tools"]))).toEqual([
      "Thieves' Tools",
    ])
  })
})
