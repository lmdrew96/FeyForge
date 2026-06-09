import { mutation } from "./_generated/server"

// ── Presence (Friends system) ─────────────────────────────────────────────────
// The client calls heartbeat() on an interval (and on tab-focus) while the app is
// open and visible. We only store the last-seen timestamp; "online" is derived
// client-side against a freshness threshold (see app/friends), so there's no
// stored online flag to go stale and no expiry job to run. One row per user.

export const heartbeat = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return
    const me = identity.tokenIdentifier

    const existing = await ctx.db
      .query("presence")
      .withIndex("by_userId", (q) => q.eq("userId", me))
      .unique()

    const now = Date.now()
    if (existing) {
      await ctx.db.patch(existing._id, { lastSeenAt: now })
    } else {
      await ctx.db.insert("presence", { userId: me, lastSeenAt: now })
    }
  },
})
