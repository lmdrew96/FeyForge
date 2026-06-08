import { describe, it, expect } from "vitest"
import { v2CreatureToMonster, stripSrdMarkdown } from "./open5e-api"
import { parseMonsterAttacks } from "./monster-attacks"

// A trimmed but realistic v2 /creatures payload (shapes verified live against the
// SRD-2014 set). Note the structured attack fields are intentionally the BROKEN
// values v2 actually returns (damage_type "Thunder", no bonus, no rider) — the
// point of this test is that we IGNORE them and parse the correct prose instead.
const v2BlackDragon = {
  key: "srd_adult-black-dragon",
  name: "Adult Black Dragon",
  size: { name: "Huge", key: "huge" },
  type: { name: "Dragon", key: "dragon" },
  alignment: "chaotic evil",
  challenge_rating: 14.0,
  armor_class: 19,
  armor_detail: "natural armor",
  hit_points: 195,
  hit_dice: "17d12+85",
  speed: { unit: "feet", walk: 40, swim: 40, fly: 80, burrow: 0 },
  ability_scores: { strength: 23, dexterity: 14, constitution: 21, intelligence: 14, wisdom: 13, charisma: 17 },
  saving_throws: { dexterity: 7, constitution: 10, wisdom: 6, charisma: 8 },
  passive_perception: 21,
  darkvision_range: 120,
  blindsight_range: 60,
  resistances_and_immunities: { damage_immunities_display: "acid", condition_immunities_display: "" },
  languages: { as_string: "Common, Draconic" },
  document: { key: "srd-2014", name: "System Reference Document 5.1" },
  actions: [
    {
      name: "Multiattack",
      action_type: "ACTION",
      desc: "The dragon can use its Frightful Presence. It then makes three attacks: one with its bite and two with its claws.",
      attacks: [],
    },
    {
      name: "Bite",
      action_type: "ACTION",
      // Structured fields are the broken v2 values; prose is correct.
      desc: "Melee Weapon Attack: +11 to hit, reach 10 ft., one target. Hit: 17 (2d10 + 6) piercing damage plus 4 (1d8) acid damage.",
      attacks: [{ to_hit_mod: 11, damage_die_count: 2, damage_die_type: "D10", damage_bonus: null, damage_type: { name: "Thunder" } }],
    },
    {
      name: "Acid Breath",
      action_type: "ACTION",
      desc: "**Acid Breath.** The dragon exhales acid in a 60-foot line that is 5 feet wide. Each creature in that line must make a DC 18 Dexterity saving throw, taking 54 (12d8) acid damage on a failed save, or half as much on a successful one.",
      attacks: [],
    },
    {
      name: "Tail Attack",
      action_type: "LEGENDARY_ACTION",
      desc: "The dragon makes a tail attack.",
      attacks: [],
    },
  ],
}

describe("v2CreatureToMonster", () => {
  const m = v2CreatureToMonster(v2BlackDragon as never)

  it("maps the creature-level fields from v2's nested shape", () => {
    expect(m.slug).toBe("srd_adult-black-dragon")
    expect(m.size).toBe("Huge")
    expect(m.type).toBe("Dragon")
    expect(m.armor_class).toBe(19)
    expect(m.hit_points).toBe(195)
    expect(m.challenge_rating).toBe("14")
    expect(m.strength).toBe(23)
    expect(m.constitution_save).toBe(10)
    expect(m.damage_immunities).toBe("acid")
    expect(m.languages).toBe("Common, Draconic")
    expect(m.senses).toContain("darkvision 120 ft.")
    expect(m.speed).toEqual({ walk: 40, swim: 40, fly: 80 }) // unit dropped, 0s dropped
  })

  it("splits actions by action_type", () => {
    expect(m.actions?.map((a) => a.name)).toEqual(["Multiattack", "Bite", "Acid Breath"])
    expect(m.legendary_actions?.map((a) => a.name)).toEqual(["Tail Attack"])
  })

  it("recovers correct damage from PROSE — bonus + type + rider that v2's structured fields drop", () => {
    const attacks = parseMonsterAttacks(m.actions)
    const bite = attacks.find((a) => a.name === "Bite")!
    expect(bite.rollable).toBe(true)
    expect(bite.kind).toBe("melee")
    expect(bite.toHit).toBe(11)
    // Structured v2 said: 2d10, no bonus, "Thunder", no rider. Prose gives the truth:
    expect(bite.damage).toEqual([
      { count: 2, sides: 10, bonus: 6, type: "piercing" },
      { count: 1, sides: 8, bonus: 0, type: "acid" },
    ])
  })

  it("parses save-based breath weapons after stripping markdown", () => {
    const breath = parseMonsterAttacks(m.actions).find((a) => a.name === "Acid Breath")!
    expect(breath.desc).not.toContain("**")
    expect(breath.save).toEqual({ dc: 18, ability: "Dexterity" })
    expect(breath.damage).toEqual([{ count: 12, sides: 8, bonus: 0, type: "acid" }])
    expect(breath.rollable).toBe(true)
    expect(breath.kind).toBe("area")
  })

  it("keeps non-attack actions (Multiattack) as info-only", () => {
    const multi = parseMonsterAttacks(m.actions).find((a) => a.name === "Multiattack")!
    expect(multi.rollable).toBe(false)
    expect(multi.toHit).toBeNull()
  })
})

describe("stripSrdMarkdown", () => {
  it("removes bold/italic/bullets but preserves damage prose", () => {
    expect(stripSrdMarkdown("**Fire Breath.** deals 54 (12d8) fire damage")).toBe(
      "Fire Breath. deals 54 (12d8) fire damage",
    )
    expect(stripSrdMarkdown("- *one* item")).toBe("one item")
  })
})
