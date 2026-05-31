import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { requireDm } from "./lib/auth"

export const list = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []
    // Scenes are DM tooling — only campaign members may read them.
    const member = await ctx.db
      .query("campaignMembers")
      .withIndex("by_campaignId_and_userId", (q) =>
        q.eq("campaignId", args.campaignId).eq("userId", identity.tokenIdentifier)
      )
      .first()
    if (!member) return []
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
    // Scenes are DM tooling — only the campaign's DM may create them.
    const userId = await requireDm(ctx, args.campaignId, "Only the DM can add scenes")
    return await ctx.db.insert("campaignScenes", {
      campaignId: args.campaignId,
      name: args.name,
      bg: args.bg,
      surface: args.surface,
      accent: args.accent,
      highlight: args.highlight,
      createdBy: userId,
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
