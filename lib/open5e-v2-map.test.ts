import { describe, it, expect } from "vitest"
import {
  v2SpellToSpell,
  v2WeaponToWeapon,
  v2ArmorToArmor,
  v2MagicItemToItem,
  v2ConditionToCondition,
} from "./open5e-api"

// Fixtures are trimmed but REAL v2 payload shapes (verified live against srd-2024).
// The point is to check mapped VALUES, not just schema — v2 nests/booleans things the
// consumers read as flat strings, and the edition mixes 3pp + 2014 + 2024.

describe("v2SpellToSpell (Fireball)", () => {
  const s = v2SpellToSpell({
    key: "srd-2024_fireball",
    name: "Fireball",
    desc: "A bright streak…",
    higher_level: "…increases by 1d6…",
    level: 3,
    school: { name: "Evocation", key: "evocation" },
    classes: [
      { name: "Sorcerer", key: "srd_sorcerer" },
      { name: "Wizard", key: "srd_wizard" },
    ],
    casting_time: "action",
    range_text: "150 feet",
    duration: "instantaneous",
    concentration: false,
    ritual: false,
    verbal: true,
    somatic: true,
    material: true,
    material_specified: "a ball of bat guano and sulfur",
    document: { key: "srd-2024", name: "SRD 5.2" },
  } as never)

  it("flattens nested + boolean fields to the Open5eSpell contract", () => {
    expect(s.level_int).toBe(3)
    expect(s.level).toBe("3")
    expect(s.school).toBe("Evocation")
    expect(s.dnd_class).toBe("Sorcerer, Wizard")
    expect(s.range).toBe("150 feet")
    expect(s.components).toBe("V, S, M")
    expect(s.material).toBe("a ball of bat guano and sulfur")
    expect(s.concentration).toBe("no") // codex checks === "yes"
    expect(s.ritual).toBe("no")
  })
})

describe("v2WeaponToWeapon", () => {
  it("Longsword: drops Mastery props, keeps versatile damage, melee category", () => {
    const w = v2WeaponToWeapon({
      key: "srd-2024_longsword",
      name: "Longsword",
      damage_dice: "1d8",
      damage_type: { name: "Slashing", key: "slashing" },
      range: 0,
      long_range: 0,
      is_simple: false,
      properties: [
        { property: { name: "Sap", type: "Mastery" }, detail: null },
        { property: { name: "Versatile", type: null }, detail: "1d10" },
      ],
      document: { key: "srd-2024" },
    } as never)
    expect(w.category).toBe("Martial Melee Weapon")
    expect(w.damage_dice).toBe("1d8")
    expect(w.damage_type).toBe("Slashing")
    expect(w.properties).toEqual(["versatile (1d10)"]) // Sap (Mastery) filtered out
  })

  it("a bow (Ammunition) maps to a ranged category with parsed range", () => {
    const w = v2WeaponToWeapon({
      key: "srd-2024_longbow",
      name: "Longbow",
      damage_dice: "1d8",
      damage_type: { name: "Piercing" },
      range: 150,
      long_range: 600,
      is_simple: false,
      properties: [{ property: { name: "Ammunition", type: null }, detail: null }],
      document: { key: "srd-2024" },
    } as never)
    expect(w.category).toBe("Martial Ranged Weapon")
    expect(w.properties).toEqual(["ammunition (range 150/600)"])
  })
})

describe("v2ArmorToArmor", () => {
  it("Chain Mail: heavy, base AC, stealth + str requirement", () => {
    const a = v2ArmorToArmor({
      key: "srd-2024_chain-mail",
      name: "Chain Mail",
      category: "heavy",
      ac_display: "16",
      ac_base: 16,
      grants_stealth_disadvantage: true,
      strength_score_required: 13,
      document: { key: "srd-2024" },
    } as never)
    expect(a.category).toBe("heavy")
    expect(a.ac_string).toBe("16")
    expect(a.stealth_disadvantage).toBe(true)
    expect(a.strength_requirement).toBe("13")
  })

  it("Shield: detected by name despite v2 filing it under 'heavy'", () => {
    const a = v2ArmorToArmor({
      key: "srd-2024_shield",
      name: "Shield",
      category: "heavy",
      ac_display: "2",
      ac_base: 2,
      grants_stealth_disadvantage: false,
      strength_score_required: null,
      document: { key: "srd-2024" },
    } as never)
    expect(a.category).toBe("shield")
    expect(a.ac_string).toBe("2")
    expect(a.strength_requirement).toBeUndefined()
  })
})

describe("v2MagicItemToItem (Amulet of Health)", () => {
  const m = v2MagicItemToItem({
    key: "srd-2024_amulet-of-health",
    name: "Amulet of Health",
    desc: "Your Constitution is 19…",
    category: { name: "Wondrous Item", key: "wondrous-item" },
    rarity: { name: "Rare", key: "rare" },
    requires_attunement: true,
    attunement_detail: null,
    document: { key: "srd-2024" },
  } as never)

  it("flattens category/rarity and builds the v1-style attunement string", () => {
    expect(m.type).toBe("Wondrous Item")
    expect(m.rarity).toBe("Rare")
    expect(m.requires_attunement).toBe("requires attunement")
  })
})

describe("v2ConditionToCondition (Prone)", () => {
  it("picks the 2024 5e description out of the per-gamesystem array (not a5e)", () => {
    const c = v2ConditionToCondition({
      key: "core_prone",
      name: "Prone",
      descriptions: [
        { gamesystem: "a5e", desc: "A5E prone text" },
        { gamesystem: "5e-2014", desc: "2014 prone text" },
        { gamesystem: "5e-2024", desc: "2024 prone text" },
      ],
      document: { key: "core" },
    } as never)
    expect(c.name).toBe("Prone")
    expect(c.desc).toBe("2024 prone text")
  })
})
