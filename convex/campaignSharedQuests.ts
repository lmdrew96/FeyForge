import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { getMembership, requireDm } from "./lib/auth"

// Campaign Hub quests v2: DM-authored party objectives that reveal to players.
// Distinct from the personal `campaignQuests` checklist — these are campaign-owned
// and reveal-gated, mirroring the wiki/sessionBroadcast isRevealed convention.
// Reads are membership-gated (the DM sees all, players see only revealed ones);
// every write is DM-gated via requireDm.

// Shared quests for a campaign + whether the caller is the DM (so the Hub can
// show authoring controls without a second round-trip). DM sees all; players see
// only revealed ones. Non-members get an empty, non-DM result.
export const listShared = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const m = await getMembership(ctx, args.campaignId)
    if (!m) return { isDm: false, quests: [] }
    const isDm = m.member.role === "dm"

    const all = await ctx.db
      .query("campaignSharedQuests")
      .withIndex("by_campaignId", (q) => q.eq("campaignId", args.campaignId))
      .collect()

    const visible = isDm ? all : all.filter((q) => q.isRevealed === true)
    return { isDm, quests: visible.sort((a, b) => a.orderIndex - b.orderIndex) }
  },
})

export const createShared = mutation({
  args: {
    campaignId: v.id("campaigns"),
    title: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireDm(ctx, args.campaignId, "Only the DM can author party objectives")

    const title = args.title.trim()
    if (!title) throw new Error("Quest title is required")

    // Append after the campaign's current shared quests.
    const existing = await ctx.db
      .query("campaignSharedQuests")
      .withIndex("by_campaignId", (q) => q.eq("campaignId", args.campaignId))
      .collect()
    const nextIndex = existing.reduce((max, q) => Math.max(max, q.orderIndex), -1) + 1

    return await ctx.db.insert("campaignSharedQuests", {
      campaignId: args.campaignId,
      title,
      description: args.description?.trim() || undefined,
      // Authored hidden — nothing reaches players without an explicit reveal tap.
      status: "active",
      isRevealed: false,
      orderIndex: nextIndex,
      updatedAt: Date.now(),
    })
  },
})

export const updateShared = mutation({
  args: {
    id: v.id("campaignSharedQuests"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("completed"))),
  },
  handler: async (ctx, args) => {
    const quest = await ctx.db.get(args.id)
    if (!quest) throw new Error("Quest not found")
    await requireDm(ctx, quest.campaignId, "Only the DM can edit party objectives")

    const patch: Record<string, unknown> = { updatedAt: Date.now() }
    if (args.title !== undefined) {
      const t = args.title.trim()
      if (!t) throw new Error("Quest title is required")
      patch.title = t
    }
    if (args.description !== undefined) patch.description = args.description.trim() || undefined
    if (args.status !== undefined) patch.status = args.status
    await ctx.db.patch(args.id, patch)
  },
})

// The reveal primitive: flip whether players can see this objective.
export const setRevealed = mutation({
  args: { id: v.id("campaignSharedQuests"), isRevealed: v.boolean() },
  handler: async (ctx, args) => {
    const quest = await ctx.db.get(args.id)
    if (!quest) throw new Error("Quest not found")
    await requireDm(ctx, quest.campaignId, "Only the DM can reveal party objectives")
    await ctx.db.patch(args.id, { isRevealed: args.isRevealed, updatedAt: Date.now() })
  },
})

export const removeShared = mutation({
  args: { id: v.id("campaignSharedQuests") },
  handler: async (ctx, args) => {
    const quest = await ctx.db.get(args.id)
    if (!quest) return
    await requireDm(ctx, quest.campaignId, "Only the DM can delete party objectives")
    await ctx.db.delete(args.id)
  },
})
