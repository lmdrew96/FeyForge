import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import type { Doc } from "./_generated/dataModel"

const baseAbilitiesValidator = v.object({
  strength: v.number(),
  dexterity: v.number(),
  constitution: v.number(),
  intelligence: v.number(),
  wisdom: v.number(),
  charisma: v.number(),
})

const racialBonusesValidator = v.optional(v.object({
  strength: v.optional(v.number()),
  dexterity: v.optional(v.number()),
  constitution: v.optional(v.number()),
  intelligence: v.optional(v.number()),
  wisdom: v.optional(v.number()),
  charisma: v.optional(v.number()),
}))

const hitPointsValidator = v.object({
  current: v.number(),
  max: v.number(),
  temp: v.number(),
})

const hitDiceValidator = v.array(v.object({
  diceSize: v.number(),
  total: v.number(),
  used: v.number(),
}))

const deathSavesValidator = v.object({
  successes: v.number(),
  failures: v.number(),
})

const currencyValidator = v.object({
  cp: v.number(),
  sp: v.number(),
  ep: v.number(),
  gp: v.number(),
  pp: v.number(),
})

const spellSlotsValidator = v.array(v.object({
  level: v.number(),
  total: v.number(),
  used: v.number(),
}))

const spellcastingValidator = v.optional(v.object({
  ability: v.string(),
  spellSaveDC: v.number(),
  spellAttackBonus: v.number(),
  spellSlots: spellSlotsValidator,
  cantripsKnown: v.number(),
  spellsKnown: v.optional(v.number()),
  spellsPrepared: v.optional(v.number()),
}))

// ── Characters ────────────────────────────────────────────────────────────────

export const get = query({
  args: { id: v.id("characters") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    const character = await ctx.db.get(args.id)
    if (!character || character.userId !== identity.tokenIdentifier) return null
    return character
  },
})

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []
    return await ctx.db
      .query("characters")
      .withIndex("by_userId", (q) => q.eq("userId", identity.tokenIdentifier))
      .order("asc")
      .take(200)
  },
})

export const listAllProperties = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []
    const chars = await ctx.db
      .query("characters")
      .withIndex("by_userId", (q) => q.eq("userId", identity.tokenIdentifier))
      .take(200)
    const allProps = []
    for (const char of chars) {
      const props = await ctx.db
        .query("characterProperties")
        .withIndex("by_characterId", (q) => q.eq("characterId", char._id))
        .order("asc")
        .take(500)
      allProps.push(...props)
    }
    return allProps
  },
})

export const create = mutation({
  args: {
    campaignId: v.optional(v.id("campaigns")),
    name: v.string(),
    playerName: v.optional(v.string()),
    race: v.string(),
    subrace: v.optional(v.string()),
    characterClass: v.string(),
    subclass: v.optional(v.string()),
    level: v.number(),
    experiencePoints: v.number(),
    background: v.optional(v.string()),
    alignment: v.optional(v.string()),
    age: v.optional(v.string()),
    height: v.optional(v.string()),
    weight: v.optional(v.string()),
    eyes: v.optional(v.string()),
    skin: v.optional(v.string()),
    hair: v.optional(v.string()),
    size: v.optional(v.string()),
    baseAbilities: baseAbilitiesValidator,
    racialBonuses: racialBonusesValidator,
    hitPoints: hitPointsValidator,
    hitDice: hitDiceValidator,
    deathSaves: deathSavesValidator,
    speed: v.number(),
    darkvision: v.optional(v.number()),
    inspiration: v.boolean(),
    savingThrowProficiencies: v.array(v.string()),
    skillProficiencies: v.array(v.string()),
    skillExpertise: v.array(v.string()),
    armorProficiencies: v.array(v.string()),
    weaponProficiencies: v.array(v.string()),
    toolProficiencies: v.array(v.string()),
    languages: v.array(v.string()),
    currency: currencyValidator,
    spellcasting: spellcastingValidator,
    personalityTraits: v.optional(v.string()),
    ideals: v.optional(v.string()),
    bonds: v.optional(v.string()),
    flaws: v.optional(v.string()),
    backstory: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    return await ctx.db.insert("characters", {
      userId: identity.tokenIdentifier,
      ...args,
      updatedAt: Date.now(),
    })
  },
})

export const update = mutation({
  args: {
    id: v.id("characters"),
    campaignId: v.optional(v.id("campaigns")),
    name: v.optional(v.string()),
    playerName: v.optional(v.string()),
    race: v.optional(v.string()),
    subrace: v.optional(v.string()),
    characterClass: v.optional(v.string()),
    subclass: v.optional(v.string()),
    level: v.optional(v.number()),
    experiencePoints: v.optional(v.number()),
    background: v.optional(v.string()),
    alignment: v.optional(v.string()),
    age: v.optional(v.string()),
    height: v.optional(v.string()),
    weight: v.optional(v.string()),
    eyes: v.optional(v.string()),
    skin: v.optional(v.string()),
    hair: v.optional(v.string()),
    size: v.optional(v.string()),
    baseAbilities: v.optional(baseAbilitiesValidator),
    racialBonuses: racialBonusesValidator,
    hitPoints: v.optional(hitPointsValidator),
    hitDice: v.optional(hitDiceValidator),
    deathSaves: v.optional(deathSavesValidator),
    speed: v.optional(v.number()),
    darkvision: v.optional(v.number()),
    inspiration: v.optional(v.boolean()),
    savingThrowProficiencies: v.optional(v.array(v.string())),
    skillProficiencies: v.optional(v.array(v.string())),
    skillExpertise: v.optional(v.array(v.string())),
    armorProficiencies: v.optional(v.array(v.string())),
    weaponProficiencies: v.optional(v.array(v.string())),
    toolProficiencies: v.optional(v.array(v.string())),
    languages: v.optional(v.array(v.string())),
    currency: v.optional(currencyValidator),
    spellcasting: spellcastingValidator,
    personalityTraits: v.optional(v.string()),
    ideals: v.optional(v.string()),
    bonds: v.optional(v.string()),
    flaws: v.optional(v.string()),
    backstory: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const character = await ctx.db.get(args.id)
    if (!character || character.userId !== identity.tokenIdentifier) throw new Error("Character not found")
    const { id, ...fields } = args
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() })
  },
})

export const updateHp = mutation({
  args: {
    id: v.id("characters"),
    delta: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const character = await ctx.db.get(args.id)
    if (!character || character.userId !== identity.tokenIdentifier) throw new Error("Character not found")
    const newCurrent = Math.max(0, Math.min(character.hitPoints.max, character.hitPoints.current + args.delta))
    // Regaining any HP from 0 ends the dying state — clear death saves (RAW).
    const revived = character.hitPoints.current === 0 && newCurrent > 0
    await ctx.db.patch(args.id, {
      hitPoints: { ...character.hitPoints, current: newCurrent },
      ...(revived ? { deathSaves: { successes: 0, failures: 0 } } : {}),
      updatedAt: Date.now(),
    })
  },
})

// Set death-save tallies directly from the sheet. Both counts clamp to 0–3
// (three of either ends the dying state per RAW). Focused setter like updateHp;
// combatant death saves in the combat tracker are a separate concern.
export const setDeathSaves = mutation({
  args: {
    id: v.id("characters"),
    successes: v.number(),
    failures: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const character = await ctx.db.get(args.id)
    if (!character || character.userId !== identity.tokenIdentifier) throw new Error("Character not found")
    const clamp = (n: number) => Math.max(0, Math.min(3, Math.round(n)))
    await ctx.db.patch(args.id, {
      deathSaves: { successes: clamp(args.successes), failures: clamp(args.failures) },
      updatedAt: Date.now(),
    })
  },
})

// Set a character's full coin purse from the sheet. Each denomination clamps to
// a non-negative integer.
export const setCurrency = mutation({
  args: {
    id: v.id("characters"),
    currency: currencyValidator,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const character = await ctx.db.get(args.id)
    if (!character || character.userId !== identity.tokenIdentifier) throw new Error("Character not found")
    const clamp = (n: number) => Math.max(0, Math.round(n))
    const { currency } = args
    await ctx.db.patch(args.id, {
      currency: {
        cp: clamp(currency.cp),
        sp: clamp(currency.sp),
        ep: clamp(currency.ep),
        gp: clamp(currency.gp),
        pp: clamp(currency.pp),
      },
      updatedAt: Date.now(),
    })
  },
})

// ── Rest mechanics ───────────────────────────────────────────────────────────

// CON modifier from base score + racial bonus: floor((score - 10) / 2).
function conModifier(character: Doc<"characters">): number {
  const score =
    character.baseAbilities.constitution +
    (character.racialBonuses?.constitution ?? 0)
  return Math.floor((score - 10) / 2)
}

// Short rest: spend ONE hit die from a chosen pool (by die size). Rolls the die
// server-side, adds the CON modifier (min 1 HP per die per 2024 RAW), heals up to
// max, and marks the die used. Returns what was rolled so the UI can surface it.
export const spendHitDie = mutation({
  args: { id: v.id("characters"), diceSize: v.number() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const character = await ctx.db.get(args.id)
    if (!character || character.userId !== identity.tokenIdentifier) {
      throw new Error("Character not found")
    }

    const poolIndex = character.hitDice.findIndex(
      (d) => d.diceSize === args.diceSize
    )
    if (poolIndex === -1) throw new Error("No such hit die pool")
    const pool = character.hitDice[poolIndex]
    if (pool.used >= pool.total) throw new Error("No hit dice of that size remain")

    const roll = Math.floor(Math.random() * args.diceSize) + 1
    const healed = Math.max(1, roll + conModifier(character))
    const newCurrent = Math.min(
      character.hitPoints.max,
      character.hitPoints.current + healed
    )

    const hitDice = character.hitDice.map((d, i) =>
      i === poolIndex ? { ...d, used: d.used + 1 } : d
    )

    // Healing off 0 HP ends the dying state — clear death saves (RAW).
    const revived = character.hitPoints.current === 0 && newCurrent > 0
    await ctx.db.patch(args.id, {
      hitPoints: { ...character.hitPoints, current: newCurrent },
      hitDice,
      ...(revived ? { deathSaves: { successes: 0, failures: 0 } } : {}),
      updatedAt: Date.now(),
    })

    return { roll, conMod: conModifier(character), healed, diceSize: args.diceSize }
  },
})

// Long rest: restore HP to max, clear temp HP, reset all spell slots, reset death
// saves, and regain spent hit dice up to half the character's total (min 1).
export const longRest = mutation({
  args: { id: v.id("characters") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const character = await ctx.db.get(args.id)
    if (!character || character.userId !== identity.tokenIdentifier) {
      throw new Error("Character not found")
    }

    const totalDice = character.hitDice.reduce((sum, d) => sum + d.total, 0)
    let toRegain = Math.max(1, Math.floor(totalDice / 2))

    // Distribute regained dice across pools (largest die first is conventional).
    const pools = character.hitDice
      .map((d, i) => ({ d, i }))
      .sort((a, b) => b.d.diceSize - a.d.diceSize)
    const hitDice = character.hitDice.map((d) => ({ ...d }))
    for (const { i } of pools) {
      if (toRegain <= 0) break
      const recoverable = Math.min(hitDice[i].used, toRegain)
      hitDice[i].used -= recoverable
      toRegain -= recoverable
    }

    const spellcasting = character.spellcasting
      ? {
          ...character.spellcasting,
          spellSlots: character.spellcasting.spellSlots.map((s) => ({
            ...s,
            used: 0,
          })),
        }
      : undefined

    await ctx.db.patch(args.id, {
      hitPoints: { ...character.hitPoints, current: character.hitPoints.max, temp: 0 },
      hitDice,
      deathSaves: { successes: 0, failures: 0 },
      ...(spellcasting ? { spellcasting } : {}),
      updatedAt: Date.now(),
    })
  },
})

// Roll a death saving throw (d20), server-side, per RAW. Only valid while dying
// (0 HP). 1 = two failures; 2–9 = one failure; 10–19 = one success; 20 = regain
// 1 HP (conscious again, death saves reset). Three successes = stable; three
// failures = dead. Returns the roll + resulting outcome so the UI can narrate it.
export const rollDeathSave = mutation({
  args: { id: v.id("characters") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const character = await ctx.db.get(args.id)
    if (!character || character.userId !== identity.tokenIdentifier) {
      throw new Error("Character not found")
    }
    if (character.hitPoints.current > 0) {
      throw new Error("Death saves only apply while dying (0 HP)")
    }
    let { successes, failures } = character.deathSaves
    if (successes >= 3) throw new Error("Already stable")
    if (failures >= 3) throw new Error("Already dead")

    const roll = Math.floor(Math.random() * 20) + 1

    // Natural 20: snap back to consciousness at 1 HP, death saves wiped.
    if (roll === 20) {
      await ctx.db.patch(args.id, {
        hitPoints: { ...character.hitPoints, current: 1 },
        deathSaves: { successes: 0, failures: 0 },
        updatedAt: Date.now(),
      })
      return { roll, outcome: "revived" as const, successes: 0, failures: 0 }
    }

    if (roll === 1) failures = Math.min(3, failures + 2)
    else if (roll >= 10) successes = Math.min(3, successes + 1)
    else failures = Math.min(3, failures + 1)

    await ctx.db.patch(args.id, {
      deathSaves: { successes, failures },
      updatedAt: Date.now(),
    })

    const outcome =
      failures >= 3
        ? ("dead" as const)
        : successes >= 3
          ? ("stable" as const)
          : roll >= 10
            ? ("success" as const)
            : ("failure" as const)

    return { roll, outcome, successes, failures }
  },
})

export const remove = mutation({
  args: { id: v.id("characters") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const character = await ctx.db.get(args.id)
    if (!character || character.userId !== identity.tokenIdentifier) throw new Error("Character not found")
    await ctx.db.delete(args.id)
  },
})

// ── Character Properties ──────────────────────────────────────────────────────

export const addProperty = mutation({
  args: {
    characterId: v.id("characters"),
    type: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    source: v.optional(v.string()),
    active: v.boolean(),
    equipped: v.optional(v.boolean()),
    tags: v.optional(v.array(v.string())),
    orderIndex: v.number(),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const character = await ctx.db.get(args.characterId)
    if (!character || character.userId !== identity.tokenIdentifier) {
      throw new Error("Character not found")
    }
    return await ctx.db.insert("characterProperties", args)
  },
})

export const updateProperty = mutation({
  args: {
    id: v.id("characterProperties"),
    type: v.optional(v.string()),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    source: v.optional(v.string()),
    active: v.optional(v.boolean()),
    equipped: v.optional(v.boolean()),
    tags: v.optional(v.array(v.string())),
    orderIndex: v.optional(v.number()),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const { id, ...fields } = args
    const property = await ctx.db.get(id)
    if (!property) throw new Error("Property not found")
    const character = await ctx.db.get(property.characterId)
    if (!character || character.userId !== identity.tokenIdentifier) {
      throw new Error("Property not found")
    }
    await ctx.db.patch(id, fields)
  },
})

export const removeProperty = mutation({
  args: { id: v.id("characterProperties") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const property = await ctx.db.get(args.id)
    if (!property) throw new Error("Property not found")
    const character = await ctx.db.get(property.characterId)
    if (!character || character.userId !== identity.tokenIdentifier) {
      throw new Error("Property not found")
    }
    await ctx.db.delete(args.id)
  },
})
