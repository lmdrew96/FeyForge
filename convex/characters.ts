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
    await ctx.db.patch(args.id, {
      hitPoints: { ...character.hitPoints, current: newCurrent },
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

    await ctx.db.patch(args.id, {
      hitPoints: { ...character.hitPoints, current: newCurrent },
      hitDice,
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
