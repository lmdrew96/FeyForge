import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

const combatantValidator = v.object({
  id: v.string(),
  name: v.string(),
  type: v.union(v.literal("pc"), v.literal("npc"), v.literal("monster")),
  initiative: v.number(),
  initiativeBonus: v.number(),
  armorClass: v.number(),
  hitPoints: v.object({
    current: v.number(),
    max: v.number(),
    temp: v.number(),
  }),
  conditions: v.array(v.string()),
  deathSaves: v.optional(v.object({
    successes: v.number(),
    failures: v.number(),
  })),
  notes: v.string(),
  isActive: v.boolean(),
  characterId: v.optional(v.string()),
})

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []
    return await ctx.db
      .query("savedEncounters")
      .withIndex("by_userId", (q) => q.eq("userId", identity.tokenIdentifier))
      .order("asc")
      .take(200)
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    combatants: v.array(combatantValidator),
    round: v.number(),
    campaignId: v.optional(v.id("campaigns")),
    details: v.optional(v.object({
      readAloud: v.optional(v.string()),
      setup: v.optional(v.string()),
      scaling: v.optional(v.string()),
      treasure: v.optional(v.string()),
      difficulty: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    return await ctx.db.insert("savedEncounters", {
      userId: identity.tokenIdentifier,
      ...args,
    })
  },
})

export const remove = mutation({
  args: { id: v.id("savedEncounters") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const encounter = await ctx.db.get(args.id)
    if (!encounter || encounter.userId !== identity.tokenIdentifier) throw new Error("Encounter not found")
    await ctx.db.delete(args.id)
  },
})
