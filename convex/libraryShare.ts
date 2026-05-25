import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}

export const createShareToken = mutation({
  args: {
    filterType: v.optional(v.union(v.literal("ambience"), v.literal("music"), v.literal("sfx"))),
    filterSceneTag: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const token = generateToken()
    await ctx.db.insert("libraryShareTokens", {
      token,
      ownerId: identity.tokenIdentifier,
      filterType: args.filterType,
      filterSceneTag: args.filterSceneTag,
      createdAt: Date.now(),
    })
    return token
  },
})

export const getShareToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("libraryShareTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique()
  },
})

export const listMyShareTokens = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []
    return await ctx.db
      .query("libraryShareTokens")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", identity.tokenIdentifier))
      .take(20)
  },
})

export const deleteShareToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const doc = await ctx.db
      .query("libraryShareTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique()
    if (!doc) return
    if (doc.ownerId !== identity.tokenIdentifier) throw new Error("Not authorized")
    await ctx.db.delete(doc._id)
  },
})

export const addReviewComment = mutation({
  args: {
    token: v.string(),
    trackId: v.id("audioTracks"),
    reaction: v.union(v.literal("yes"), v.literal("no"), v.literal("maybe")),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify token exists
    const tokenDoc = await ctx.db
      .query("libraryShareTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique()
    if (!tokenDoc) throw new Error("Invalid share token")

    // Upsert: one comment per token+track (replace if exists)
    const existing = await ctx.db
      .query("libraryReviewComments")
      .withIndex("by_token_and_trackId", (q) => q.eq("token", args.token).eq("trackId", args.trackId))
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, {
        reaction: args.reaction,
        comment: args.comment,
        createdAt: Date.now(),
      })
    } else {
      await ctx.db.insert("libraryReviewComments", {
        token: args.token,
        trackId: args.trackId,
        reaction: args.reaction,
        comment: args.comment,
        createdAt: Date.now(),
      })
    }
  },
})

export const listCommentsByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("libraryReviewComments")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .take(200)
  },
})

export const listMyTrackComments = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const myTokens = await ctx.db
      .query("libraryShareTokens")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", identity.tokenIdentifier))
      .take(20)

    const results: Array<{ token: string; trackId: string; reaction: string; comment?: string }> = []
    for (const t of myTokens) {
      const comments = await ctx.db
        .query("libraryReviewComments")
        .withIndex("by_token", (q) => q.eq("token", t.token))
        .take(200)
      for (const c of comments) {
        results.push({ token: t.token, trackId: c.trackId, reaction: c.reaction, comment: c.comment })
      }
    }
    return results
  },
})
