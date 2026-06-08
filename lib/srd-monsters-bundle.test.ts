import { describe, it, expect } from "vitest"
import monsters from "./data/srd-monsters.json"
import { parseMonsterAttacks } from "./monster-attacks"
import type { Open5eMonster } from "./open5e-api"

// Guards the self-hosted SRD monster bundle (scripts/seed-monsters.ts) against a
// bad re-seed or a parser regression against REAL bundled prose — combat reads
// straight from this file now, with no live API to fall back on.
const SRD = monsters as unknown as Open5eMonster[]

describe("SRD monster bundle", () => {
  it("bundles the full SRD-2014 set with slug + name on every entry", () => {
    expect(SRD.length).toBe(325)
    expect(SRD.every((m) => Boolean(m.slug && m.name))).toBe(true)
  })

  it("flat-damage creatures still parse a rollable attack (Bat)", () => {
    const bat = SRD.find((m) => m.name === "Bat")!
    const bite = parseMonsterAttacks(bat.actions).find((a) => a.name === "Bite")!
    expect(bite.rollable).toBe(true)
    expect(bite.toHit).toBe(0)
    expect(bite.damage).toEqual([{ count: 0, sides: 0, bonus: 1, type: "piercing" }])
  })

  it("dice + rider damage parses from real bundled prose (Adult Black Dragon)", () => {
    const dragon = SRD.find((m) => m.name === "Adult Black Dragon")!
    const bite = parseMonsterAttacks(dragon.actions).find((a) => a.name === "Bite")!
    expect(bite.toHit).toBe(11)
    expect(bite.damage).toEqual([
      { count: 2, sides: 10, bonus: 6, type: "piercing" },
      { count: 1, sides: 8, bonus: 0, type: "acid" },
    ])
  })

  it("almost every creature exposes at least one rollable attack", () => {
    const withRollable = SRD.filter((m) =>
      parseMonsterAttacks(m.actions).some((a) => a.rollable),
    )
    expect(withRollable.length).toBeGreaterThanOrEqual(315) // 321/325 at seed time
  })
})
