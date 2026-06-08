import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { getMembership } from "./lib/auth"

// The Player Campaign Hub journal: one continuous markdown notebook per member
// per campaign, persisting across sessions (unlike the per-live-session notes
// board). A journal is PRIVATE to its author — there is no cross-member read —
// and every entry point is membership-gated (campaign-scoped reads must check
// membership, not just scope; see convex/lib/auth.ts).

// The caller's own journal for a campaign, or null if they have none yet.
// Returns null (never throws) for non-members so the reactive query stays alive.
export const get = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const m = await getMembership(ctx, args.campaignId)
    if (!m) return null

    return await ctx.db
      .query("campaignJournal")
      .withIndex("by_campaignId_and_userId", (q) =>
        q.eq("campaignId", args.campaignId).eq("userId", m.userId),
      )
      .first()
  },
})

// Save the caller's journal for a campaign (create on first save, patch after).
export const upsert = mutation({
  args: {
    campaignId: v.id("campaigns"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const m = await getMembership(ctx, args.campaignId)
    if (!m) throw new Error("Not a member of this campaign")

    const existing = await ctx.db
      .query("campaignJournal")
      .withIndex("by_campaignId_and_userId", (q) =>
        q.eq("campaignId", args.campaignId).eq("userId", m.userId),
      )
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, { content: args.content, updatedAt: Date.now() })
    } else {
      await ctx.db.insert("campaignJournal", {
        campaignId: args.campaignId,
        userId: m.userId,
        content: args.content,
        updatedAt: Date.now(),
      })
    }
  },
})
