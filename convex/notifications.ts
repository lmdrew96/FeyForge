import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

// ── Notifications (Friends system) ────────────────────────────────────────────
// User-scoped: every read/write is gated to the caller's own clerkId
// (tokenIdentifier). Writes into this table happen via the createNotification
// helper (convex/lib/notify.ts) from the feature that triggers them; this file
// only exposes the recipient-facing read + read-state mutations that power the
// app-shell notification bell.

const FEED_LIMIT = 40
const UNREAD_CAP = 50 // badge shows "50+" past this; keeps the count bounded

// The caller's most-recent notifications, newest first. Empty if unauthenticated.
export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []
    return await ctx.db
      .query("notifications")
      .withIndex("by_userId", (q) => q.eq("userId", identity.tokenIdentifier))
      .order("desc")
      .take(FEED_LIMIT)
  },
})

// Count of the caller's unread notifications, for the bell badge. Bounded read:
// unread rows are readAt === undefined (indexed), capped at UNREAD_CAP so the
// query never scans an unbounded set.
export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return 0
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_userId_and_readAt", (q) =>
        q.eq("userId", identity.tokenIdentifier).eq("readAt", undefined),
      )
      .take(UNREAD_CAP)
    return unread.length
  },
})

// Marks a single notification read. No-op if it isn't the caller's.
export const markRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const notif = await ctx.db.get(args.id)
    if (!notif || notif.userId !== identity.tokenIdentifier) return
    if (notif.readAt === undefined) {
      await ctx.db.patch(args.id, { readAt: Date.now() })
    }
  },
})

// Marks all of the caller's unread notifications read. Batched against the
// unread index so it stays within a single transaction's limits.
export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const now = Date.now()
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_userId_and_readAt", (q) =>
        q.eq("userId", identity.tokenIdentifier).eq("readAt", undefined),
      )
      .take(200)
    for (const n of unread) {
      await ctx.db.patch(n._id, { readAt: now })
    }
  },
})
