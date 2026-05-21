import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

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
    await ctx.db.patch(id, fields)
  },
})

export const removeProperty = mutation({
  args: { id: v.id("characterProperties") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    await ctx.db.delete(args.id)
  },
})
