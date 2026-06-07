import { describe, it, expect } from "vitest"
import { synthesizeAction, actionToInput, type MonsterActionInput } from "./homebrew-monster"
import { parseMonsterAttacks } from "./monster-attacks"

// The whole feature hinges on this contract: the form authors structured fields, we
// synthesize an SRD-format `desc`, and the SAME parser the combat tracker uses must
// pull rollable to-hit / damage / save back out. These tests guard that prose ↔ regex
// seam — the one thing tsc and the build can't catch.

const base: MonsterActionInput = {
  name: "",
  kind: "melee",
  toHit: 0,
  range: "",
  damageDice: "",
  damageBonus: 0,
  damageType: "slashing",
  saveDC: 13,
  saveAbility: "Dexterity",
  desc: "",
}

describe("synthesizeAction → parseMonsterAttacks (combat-tracker round trip)", () => {
  it("melee attack parses to a rollable to-hit + typed damage", () => {
    const [a] = parseMonsterAttacks([
      synthesizeAction({ ...base, name: "Bite", kind: "melee", toHit: 5, range: "5 ft.", damageDice: "1d8", damageBonus: 3, damageType: "piercing" }),
    ])
    expect(a.rollable).toBe(true)
    expect(a.kind).toBe("melee")
    expect(a.toHit).toBe(5)
    expect(a.damage).toEqual([{ count: 1, sides: 8, bonus: 3, type: "piercing" }])
  })

  it("ranged attack keeps its range and to-hit", () => {
    const [a] = parseMonsterAttacks([
      synthesizeAction({ ...base, name: "Longbow", kind: "ranged", toHit: 4, range: "80/320 ft.", damageDice: "1d8", damageBonus: 2, damageType: "piercing" }),
    ])
    expect(a.rollable).toBe(true)
    expect(a.kind).toBe("ranged")
    expect(a.toHit).toBe(4)
    expect(a.reach).toMatch(/80\/320/)
  })

  it("save attack parses DC + ability + damage (breath-weapon shape)", () => {
    const [a] = parseMonsterAttacks([
      synthesizeAction({ ...base, name: "Fire Breath", kind: "save", saveDC: 15, saveAbility: "Dexterity", damageDice: "6d6", damageBonus: 0, damageType: "fire" }),
    ])
    expect(a.rollable).toBe(true)
    expect(a.toHit).toBeNull()
    expect(a.kind).toBe("area")
    expect(a.save).toEqual({ dc: 15, ability: "Dexterity" })
    expect(a.damage).toEqual([{ count: 6, sides: 6, bonus: 0, type: "fire" }])
  })

  it("info action (Multiattack) is preserved but non-rollable", () => {
    const [a] = parseMonsterAttacks([
      synthesizeAction({ ...base, name: "Multiattack", kind: "other", desc: "The creature makes two attacks." }),
    ])
    expect(a.rollable).toBe(false)
    expect(a.name).toBe("Multiattack")
    expect(a.desc).toContain("two attacks")
  })

  it("negative to-hit synthesizes a parseable sign", () => {
    const [a] = parseMonsterAttacks([
      synthesizeAction({ ...base, name: "Clumsy Swipe", kind: "melee", toHit: -1, range: "5 ft.", damageDice: "1d4", damageBonus: 0, damageType: "bludgeoning" }),
    ])
    expect(a.toHit).toBe(-1)
  })

  it("appends extra flavor without breaking the parse", () => {
    const [a] = parseMonsterAttacks([
      synthesizeAction({ ...base, name: "Sting", kind: "melee", toHit: 6, range: "5 ft.", damageDice: "1d6", damageBonus: 3, damageType: "piercing", desc: "The target must succeed on a save or be poisoned." }),
    ])
    expect(a.rollable).toBe(true)
    expect(a.toHit).toBe(6)
    expect(a.desc).toContain("poisoned")
  })
})

describe("actionToInput (edit-form reload)", () => {
  it("round-trips a melee attack's fields", () => {
    const input: MonsterActionInput = { ...base, name: "Claw", kind: "melee", toHit: 6, range: "10 ft.", damageDice: "2d6", damageBonus: 4, damageType: "slashing" }
    const back = actionToInput(synthesizeAction(input))
    expect(back).toMatchObject({ kind: "melee", toHit: 6, range: "10 ft.", damageDice: "2d6", damageBonus: 4, damageType: "slashing" })
  })

  it("round-trips a save action's DC / ability / damage", () => {
    const input: MonsterActionInput = { ...base, name: "Frost Breath", kind: "save", saveDC: 14, saveAbility: "Constitution", damageDice: "4d8", damageBonus: 0, damageType: "cold" }
    const back = actionToInput(synthesizeAction(input))
    expect(back).toMatchObject({ kind: "save", saveDC: 14, saveAbility: "Constitution", damageDice: "4d8", damageType: "cold" })
  })

  it("keeps an info action's full body editable", () => {
    const back = actionToInput(synthesizeAction({ ...base, name: "Multiattack", kind: "other", desc: "Two claw attacks." }))
    expect(back.kind).toBe("other")
    expect(back.desc).toBe("Two claw attacks.")
  })
})
