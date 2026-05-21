import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const list = query({
  args: { sessionId: v.id("partySessions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    const userId = identity?.tokenIdentifier

    const notes = await ctx.db
      .query("sessionNotes")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .take(50)

    return notes.map((note) => ({
      ...note,
      isMyNote: note.userId === userId,
    }))
  },
})

export const upsert = mutation({
  args: {
    sessionId: v.id("partySessions"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const session = await ctx.db.get(args.sessionId)
    if (!session) throw new Error("Session not found")

    const isDM = session.dmUserId === identity.tokenIdentifier

    const existing = await ctx.db
      .query("sessionNotes")
      .withIndex("by_sessionId_and_userId", (q) =>
        q.eq("sessionId", args.sessionId).eq("userId", identity.tokenIdentifier)
      )
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, { content: args.content, updatedAt: Date.now() })
    } else {
      await ctx.db.insert("sessionNotes", {
        sessionId: args.sessionId,
        campaignId: session.campaignId,
        userId: identity.tokenIdentifier,
        isDM,
        content: args.content,
        updatedAt: Date.now(),
      })
    }
  },
})
