import { describe, it, expect } from "vitest"
import type { Modifier } from "./types"
import {
  applyModifiers,
  hasAdvantage,
  hasDisadvantage,
  combineModifiers,
  getTotalAddBonus,
} from "./modifiers"

// Terse Modifier factory — explicit fields keep these tests free of crypto/UUIDs.
let n = 0
const mod = (
  type: Modifier["type"],
  value: number,
  opts: Partial<Modifier> = {},
): Modifier => ({
  id: `m${n++}`,
  source: opts.source ?? "test",
  target: opts.target ?? "ac",
  type,
  value,
  active: opts.active ?? true,
  ...opts,
})

describe("applyModifiers", () => {
  it("returns the base value when there are no modifiers", () => {
    expect(applyModifiers(10, [])).toBe(10)
  })

  it("ignores inactive modifiers", () => {
    expect(applyModifiers(10, [mod("add", 5, { active: false })])).toBe(10)
  })

  it("adds active add modifiers", () => {
    expect(applyModifiers(10, [mod("add", 5)])).toBe(15)
  })

  it("applies set before add (priority order)", () => {
    expect(applyModifiers(10, [mod("add", 2), mod("set", 8)])).toBe(10)
  })

  it("applies add before multiply (priority order)", () => {
    // 10 + 5 = 15, then * 2 = 30 — not (10 * 2) + 5
    expect(applyModifiers(10, [mod("multiply", 2), mod("add", 5)])).toBe(30)
  })

  it("treats min as a floor and max as a ceiling", () => {
    expect(applyModifiers(10, [mod("min", 15)])).toBe(15)
    expect(applyModifiers(20, [mod("min", 15)])).toBe(20)
    expect(applyModifiers(20, [mod("max", 15)])).toBe(15)
    expect(applyModifiers(10, [mod("max", 15)])).toBe(10)
  })

  it("keeps the highest of multiple set modifiers", () => {
    expect(applyModifiers(10, [mod("set", 8), mod("set", 12)])).toBe(12)
  })

  it("floors a fractional result", () => {
    expect(applyModifiers(7, [mod("multiply", 1.5)])).toBe(10) // 10.5 -> 10
  })
})

describe("hasAdvantage / hasDisadvantage", () => {
  it("detects a lone advantage or disadvantage", () => {
    expect(hasAdvantage([mod("advantage", 0)])).toBe(true)
    expect(hasDisadvantage([mod("disadvantage", 0)])).toBe(true)
  })

  it("cancels out when both are present", () => {
    const both = [mod("advantage", 0), mod("disadvantage", 0)]
    expect(hasAdvantage(both)).toBe(false)
    expect(hasDisadvantage(both)).toBe(false)
  })

  it("ignores inactive advantage", () => {
    expect(hasAdvantage([mod("advantage", 0, { active: false })])).toBe(false)
  })
})

describe("combineModifiers", () => {
  it("keeps only the highest add from the same source+target", () => {
    const combined = combineModifiers([
      mod("add", 1, { source: "ring" }),
      mod("add", 2, { source: "ring" }),
    ])
    expect(combined).toHaveLength(1)
    expect(combined[0].value).toBe(2)
  })

  it("stacks add modifiers from different sources", () => {
    const combined = combineModifiers([
      mod("add", 1, { source: "ring" }),
      mod("add", 2, { source: "cloak" }),
    ])
    expect(combined).toHaveLength(2)
    expect(getTotalAddBonus(combined)).toBe(3)
  })
})

describe("getTotalAddBonus", () => {
  it("sums active add modifiers only", () => {
    const mods = [
      mod("add", 3),
      mod("add", 2),
      mod("add", 99, { active: false }),
      mod("multiply", 2),
    ]
    expect(getTotalAddBonus(mods)).toBe(5)
  })
})
