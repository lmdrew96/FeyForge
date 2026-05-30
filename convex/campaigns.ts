import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { ensureCampaignSetup } from "./campaignMembers"

const editionValidator = v.union(v.literal("2014"), v.literal("2024"))

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

// Single campaign by id, gated to members (so the invite dialog can resolve a
// campaign's name + join code from a live-session context that only has the id).
export const get = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const member = await ctx.db
      .query("campaignMembers")
      .withIndex("by_campaignId_and_userId", (q) =>
        q.eq("campaignId", args.campaignId).eq("userId", identity.tokenIdentifier)
      )
      .first()
    if (!member) return null

    return await ctx.db.get(args.campaignId)
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    edition: v.optional(editionValidator),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const campaignId = await ctx.db.insert("campaigns", {
      userId: identity.tokenIdentifier,
      name: args.name,
      description: args.description,
      isActive: args.isActive ?? false,
      edition: args.edition ?? "2024",
      updatedAt: Date.now(),
    })
    // Owner becomes the campaign's DM member; campaign gets an invite code.
    await ensureCampaignSetup(ctx, campaignId, identity.tokenIdentifier)
    return campaignId
  },
})

export const update = mutation({
  args: {
    id: v.id("campaigns"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    edition: v.optional(editionValidator),
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
    // Clean up memberships so they don't dangle.
    const members = await ctx.db
      .query("campaignMembers")
      .withIndex("by_campaignId", (q) => q.eq("campaignId", args.id))
      .collect()
    for (const m of members) {
      await ctx.db.delete(m._id)
    }
    await ctx.db.delete(args.id)
  },
})
