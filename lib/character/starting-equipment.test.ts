import { describe, it, expect } from "vitest"
import { explodeWeaponPairs, type StartingItem } from "./starting-equipment"

const weapon = (name: string, quantity?: number, equipped = false): StartingItem => ({
  name,
  equipped,
  data: {
    category: "weapon",
    weaponType: "martial",
    damageDice: "1d6",
    damageType: "piercing",
    melee: true,
    properties: [],
    ...(quantity ? { quantity } : {}),
  },
})

describe("explodeWeaponPairs", () => {
  it("splits a quantity-2 weapon into two discrete, quantity-less rows", () => {
    const out = explodeWeaponPairs([weapon("Shortsword", 2)])
    expect(out).toHaveLength(2)
    expect(out.every((i) => i.name === "Shortsword")).toBe(true)
    expect(out.every((i) => i.data.quantity === undefined)).toBe(true)
  })

  it("preserves the equipped flag on both halves of a pair", () => {
    const out = explodeWeaponPairs([weapon("Scimitar", 2, true)])
    expect(out).toHaveLength(2)
    expect(out.every((i) => i.equipped === true)).toBe(true)
  })

  it("leaves 3+ thrown stacks (javelins, darts) as a single counted row", () => {
    const out = explodeWeaponPairs([weapon("Javelin", 4)])
    expect(out).toHaveLength(1)
    expect(out[0].data.quantity).toBe(4)
  })

  it("ignores single weapons and non-weapon items", () => {
    const gear: StartingItem = { name: "Caltrops", data: { category: "gear", quantity: 2 } }
    const out = explodeWeaponPairs([weapon("Longsword"), gear])
    expect(out).toHaveLength(2)
    expect(out[1]).toEqual(gear)
  })
})
