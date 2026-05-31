import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { isAdmin } from "./lib/auth"

// ── Review Comments (auth-based, no token needed) ──────────────────────────

export const addReviewComment = mutation({
  args: {
    trackId: v.id("audioTracks"),
    reaction: v.union(v.literal("yes"), v.literal("no"), v.literal("maybe")),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const existing = await ctx.db
      .query("libraryReviewComments")
      .withIndex("by_userId_and_trackId", (q) =>
        q.eq("userId", identity.tokenIdentifier).eq("trackId", args.trackId)
      )
      .unique()

    const reviewerName = identity.name ?? undefined

    if (existing) {
      await ctx.db.patch(existing._id, {
        reaction: args.reaction,
        comment: args.comment,
        reviewerName,
        createdAt: Date.now(),
      })
    } else {
      await ctx.db.insert("libraryReviewComments", {
        userId: identity.tokenIdentifier,
        reviewerName,
        trackId: args.trackId,
        reaction: args.reaction,
        comment: args.comment,
        createdAt: Date.now(),
      })
    }
  },
})

export const listAllReviewComments = query({
  args: {},
  handler: async (ctx) => {
    // Cross-user review board — admin-only (the audio review tool).
    if (!(await isAdmin(ctx))) return []
    return await ctx.db.query("libraryReviewComments").take(500)
  },
})

export const listMyReviewComments = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []
    return await ctx.db
      .query("libraryReviewComments")
      .withIndex("by_userId", (q) => q.eq("userId", identity.tokenIdentifier))
      .take(200)
  },
})

export const deleteReviewComment = mutation({
  args: { trackId: v.id("audioTracks") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const existing = await ctx.db
      .query("libraryReviewComments")
      .withIndex("by_userId_and_trackId", (q) =>
        q.eq("userId", identity.tokenIdentifier).eq("trackId", args.trackId)
      )
      .unique()
    if (existing) await ctx.db.delete(existing._id)
  },
})
