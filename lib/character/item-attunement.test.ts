import { describe, it, expect } from "vitest"
import { applyGrants, reverseGrants, type AppliedGrants, type GrantTarget } from "./feats"
import { rowToItem, itemToStoredData } from "./sheet-items"

// The load-bearing safety invariant for magic-item attunement: baking a grant
// (attune) and then reversing it (unattune / delete) must leave the character
// EXACTLY as it started — otherwise stat bonuses drift or strand.

const baseChar = (): GrantTarget => ({
  baseAbilities: {
    strength: 10,
    dexterity: 12,
    constitution: 14,
    intelligence: 8,
    wisdom: 13,
    charisma: 11,
  },
  savingThrowProficiencies: ["dexterity"],
  skillProficiencies: ["stealth"],
  skillExpertise: [],
  hitPoints: { current: 20, max: 20, temp: 0 },
})

// Mirrors the inventory's `update({ id, ...patch })` — patch fields replace whole.
const merge = (char: GrantTarget, patch: Partial<GrantTarget>): GrantTarget => ({
  ...char,
  ...patch,
})

describe("attunement grant bake/reverse", () => {
  it("apply then reverse restores the character exactly", () => {
    const char = baseChar()
    const grants: AppliedGrants = {
      ability: "strength",
      saveProficiency: "constitution",
      skillProficiencies: ["arcana"],
      hp: 5,
    }

    const attuned = merge(char, applyGrants(char, grants))
    expect(attuned.baseAbilities.strength).toBe(11)
    expect(attuned.savingThrowProficiencies).toContain("constitution")
    expect(attuned.skillProficiencies).toContain("arcana")
    expect(attuned.hitPoints.max).toBe(25)

    const restored = merge(attuned, reverseGrants(attuned, grants))
    expect(restored.baseAbilities).toEqual(char.baseAbilities)
    expect(restored.savingThrowProficiencies).toEqual(char.savingThrowProficiencies)
    expect(restored.skillProficiencies).toEqual(char.skillProficiencies)
    expect(restored.hitPoints).toEqual(char.hitPoints)
  })
})

describe('"set ability to N" magic items (Headband of Intellect etc.)', () => {
  // Floor semantics: applying only raises the score; the pre-attune value is
  // captured into the grant so reversing restores it exactly.
  const captured = (g: AppliedGrants, char: GrantTarget): AppliedGrants => ({
    ...g,
    setAbility: g.setAbility
      ? { ...g.setAbility, previousValue: char.baseAbilities[g.setAbility.ability] }
      : undefined,
  })

  it("raises INT 8 → 19 on attune and restores 8 on reverse", () => {
    const char = baseChar() // INT 8
    const grants = captured({ setAbility: { ability: "intelligence", value: 19 } }, char)

    const attuned = merge(char, applyGrants(char, grants))
    expect(attuned.baseAbilities.intelligence).toBe(19)

    const restored = merge(attuned, reverseGrants(attuned, grants))
    expect(restored.baseAbilities.intelligence).toBe(8)
    expect(restored.baseAbilities).toEqual(char.baseAbilities)
  })

  it("does nothing when the current score already meets or exceeds the target", () => {
    const char = baseChar()
    char.baseAbilities.intelligence = 20 // already above a Headband's 19
    const grants = captured({ setAbility: { ability: "intelligence", value: 19 } }, char)

    const attuned = merge(char, applyGrants(char, grants))
    expect(attuned.baseAbilities.intelligence).toBe(20) // floor — never lowers

    // Reverse restores the captured 20 (a no-op), never clobbering to 19.
    const restored = merge(attuned, reverseGrants(attuned, grants))
    expect(restored.baseAbilities.intelligence).toBe(20)
  })

  it("captures the live score at attune, so reverse can't strand a wrong value", () => {
    const char = baseChar()
    char.baseAbilities.strength = 15 // e.g. raised by an ASI since creation
    const grants = captured({ setAbility: { ability: "strength", value: 19 } }, char)

    const attuned = merge(char, applyGrants(char, grants))
    expect(attuned.baseAbilities.strength).toBe(19)

    const restored = merge(attuned, reverseGrants(attuned, grants))
    expect(restored.baseAbilities.strength).toBe(15)
  })
})

describe("item attunement data round-trip", () => {
  it("rowToItem ↔ itemToStoredData preserves attunement fields and drops row-level keys", () => {
    const item = rowToItem({
      _id: "ring1",
      name: "Ring of Protection",
      active: true,
      equipped: false,
      data: {
        category: "magic",
        requiresAttunement: true,
        attuned: true,
        grants: { ability: "wisdom", skillExpertise: ["perception"] },
      },
    })
    expect(item.requiresAttunement).toBe(true)
    expect(item.attuned).toBe(true)
    expect(item.grants).toEqual({ ability: "wisdom", skillExpertise: ["perception"] })

    const data = itemToStoredData(item)
    expect(data.requiresAttunement).toBe(true)
    expect(data.attuned).toBe(true)
    expect(data.grants).toEqual({ ability: "wisdom", skillExpertise: ["perception"] })
    // Row-level fields must never leak back into the stored data blob.
    const raw = data as unknown as Record<string, unknown>
    expect(raw.id).toBeUndefined()
    expect(raw.name).toBeUndefined()
    expect(raw.equipped).toBeUndefined()
  })
})
