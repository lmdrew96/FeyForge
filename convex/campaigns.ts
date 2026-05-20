import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []
    return await ctx.db
      .query("campaigns")
      .withIndex("by_userId", (q) => q.eq("userId", identity.tokenIdentifier))
      .order("desc")
      .take(100)
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    return await ctx.db.insert("campaigns", {
      userId: identity.tokenIdentifier,
      name: args.name,
      description: args.description,
      isActive: args.isActive ?? false,
      updatedAt: Date.now(),
    })
  },
})

export const update = mutation({
  args: {
    id: v.id("campaigns"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const campaign = await ctx.db.get(args.id)
    if (!campaign || campaign.userId !== identity.tokenIdentifier) {
      throw new Error("Campaign not found")
    }
    const { id, ...fields } = args
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() })
  },
})

export const remove = mutation({
  args: { id: v.id("campaigns") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const campaign = await ctx.db.get(args.id)
    if (!campaign || campaign.userId !== identity.tokenIdentifier) {
      throw new Error("Campaign not found")
    }
    await ctx.db.delete(args.id)
  },
})
