import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const list = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []
    return await ctx.db
      .query("campaignScenes")
      .withIndex("by_campaignId", (q) => q.eq("campaignId", args.campaignId))
      .order("desc")
      .take(20)
  },
})

export const create = mutation({
  args: {
    campaignId: v.id("campaigns"),
    name: v.string(),
    bg: v.string(),
    surface: v.string(),
    accent: v.string(),
    highlight: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    return await ctx.db.insert("campaignScenes", {
      campaignId: args.campaignId,
      name: args.name,
      bg: args.bg,
      surface: args.surface,
      accent: args.accent,
      highlight: args.highlight,
      createdBy: identity.tokenIdentifier,
      createdAt: Date.now(),
    })
  },
})

export const remove = mutation({
  args: { id: v.id("campaignScenes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const scene = await ctx.db.get(args.id)
    if (!scene) throw new Error("Scene not found")
    if (scene.createdBy !== identity.tokenIdentifier) throw new Error("Not authorized")
    await ctx.db.delete(args.id)
  },
})
