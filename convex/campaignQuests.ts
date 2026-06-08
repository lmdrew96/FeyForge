import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { getMembership } from "./lib/auth"

// Player Campaign Hub quest log (v1): a member's PRIVATE personal checklist for
// a campaign. Listing/creating is membership-gated; per-row edits are gated by
// authorship (you can only touch your own quests). v2 (DM-shared quests via
// plotThreads + isRevealed) is a separate feature.

// The caller's quests for a campaign, oldest-added first. Empty for non-members.
export const list = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const m = await getMembership(ctx, args.campaignId)
    if (!m) return []

    const quests = await ctx.db
      .query("campaignQuests")
      .withIndex("by_campaignId_and_userId", (q) =>
        q.eq("campaignId", args.campaignId).eq("userId", m.userId),
      )
      .collect()

    return quests.sort((a, b) => a.orderIndex - b.orderIndex)
  },
})

export const add = mutation({
  args: { campaignId: v.id("campaigns"), text: v.string() },
  handler: async (ctx, args) => {
    const m = await getMembership(ctx, args.campaignId)
    if (!m) throw new Error("Not a member of this campaign")

    const text = args.text.trim()
    if (!text) throw new Error("Quest text is required")

    // Append after the caller's current quests (one stable ordering per author).
    const existing = await ctx.db
      .query("campaignQuests")
      .withIndex("by_campaignId_and_userId", (q) =>
        q.eq("campaignId", args.campaignId).eq("userId", m.userId),
      )
      .collect()
    const nextIndex = existing.reduce((max, q) => Math.max(max, q.orderIndex), -1) + 1

    return await ctx.db.insert("campaignQuests", {
      campaignId: args.campaignId,
      userId: m.userId,
      text,
      done: false,
      orderIndex: nextIndex,
      updatedAt: Date.now(),
    })
  },
})

export const toggle = mutation({
  args: { id: v.id("campaignQuests") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const quest = await ctx.db.get(args.id)
    if (!quest || quest.userId !== identity.tokenIdentifier) throw new Error("Quest not found")
    await ctx.db.patch(args.id, { done: !quest.done, updatedAt: Date.now() })
  },
})

export const update = mutation({
  args: { id: v.id("campaignQuests"), text: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const quest = await ctx.db.get(args.id)
    if (!quest || quest.userId !== identity.tokenIdentifier) throw new Error("Quest not found")
    const text = args.text.trim()
    if (!text) throw new Error("Quest text is required")
    await ctx.db.patch(args.id, { text, updatedAt: Date.now() })
  },
})

export const remove = mutation({
  args: { id: v.id("campaignQuests") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const quest = await ctx.db.get(args.id)
    if (!quest || quest.userId !== identity.tokenIdentifier) throw new Error("Quest not found")
    await ctx.db.delete(args.id)
  },
})
