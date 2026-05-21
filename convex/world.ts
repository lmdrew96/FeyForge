import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []
    return await ctx.db
      .query("mapLocations")
      .withIndex("by_userId", (q) => q.eq("userId", identity.tokenIdentifier))
      .order("asc")
      .take(500)
  },
})

export const create = mutation({
  args: {
    campaignId: v.optional(v.id("campaigns")),
    name: v.string(),
    type: v.string(),
    description: v.string(),
    notes: v.string(),
    x: v.number(),
    y: v.number(),
    visited: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    return await ctx.db.insert("mapLocations", {
      userId: identity.tokenIdentifier,
      campaignId: args.campaignId,
      name: args.name,
      type: args.type,
      description: args.description,
      notes: args.notes,
      x: args.x,
      y: args.y,
      visited: args.visited ?? false,
    })
  },
})

export const update = mutation({
  args: {
    id: v.id("mapLocations"),
    campaignId: v.optional(v.id("campaigns")),
    name: v.optional(v.string()),
    type: v.optional(v.string()),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
    x: v.optional(v.number()),
    y: v.optional(v.number()),
    visited: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const loc = await ctx.db.get(args.id)
    if (!loc || loc.userId !== identity.tokenIdentifier) throw new Error("Location not found")
    const { id, ...fields } = args
    await ctx.db.patch(id, fields)
  },
})

export const remove = mutation({
  args: { id: v.id("mapLocations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const loc = await ctx.db.get(args.id)
    if (!loc || loc.userId !== identity.tokenIdentifier) throw new Error("Location not found")
    await ctx.db.delete(args.id)
  },
})

export const toggleVisited = mutation({
  args: { id: v.id("mapLocations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const loc = await ctx.db.get(args.id)
    if (!loc || loc.userId !== identity.tokenIdentifier) throw new Error("Location not found")
    await ctx.db.patch(args.id, { visited: !loc.visited })
  },
})
