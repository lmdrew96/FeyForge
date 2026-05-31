import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { getMembershipBySession } from "./lib/auth"

export const list = query({
  args: { sessionId: v.id("partySessions") },
  handler: async (ctx, args) => {
    // The party notes board is shared within the session (the UI shows each
    // member's note with a DM/Player badge), so members see all notes — but a
    // non-member must not be able to read the board by passing a session id.
    const m = await getMembershipBySession(ctx, args.sessionId)
    if (!m) return []
    const { userId } = m

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
    // Only a member of the session's campaign may post to its notes board.
    const m = await getMembershipBySession(ctx, args.sessionId)
    if (!m) throw new Error("Not a member of this campaign")
    const { session, userId } = m

    const isDM = session.dmUserId === userId

    const existing = await ctx.db
      .query("sessionNotes")
      .withIndex("by_sessionId_and_userId", (q) =>
        q.eq("sessionId", args.sessionId).eq("userId", userId)
      )
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, { content: args.content, updatedAt: Date.now() })
    } else {
      await ctx.db.insert("sessionNotes", {
        sessionId: args.sessionId,
        campaignId: session.campaignId,
        userId,
        isDM,
        content: args.content,
        updatedAt: Date.now(),
      })
    }
  },
})
