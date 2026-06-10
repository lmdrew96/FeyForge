import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import type { Doc } from "./_generated/dataModel"
import { getMembershipBySession } from "./lib/auth"

// Live shared roll feed for a live session. Any MEMBER (player or DM) can push a
// roll; all members read it. Mirrors the liveCaptions real-time pattern — see the
// sessionRolls table in schema.ts. The display payload is computed client-side
// (lib/session-rolls.ts rollToFeedArgs); userId + campaignId + createdAt are
// stamped here so the client can't spoof who rolled.

// Append one roll to the session's live feed. Membership-gated — a non-member
// can't inject rolls into someone else's session.
export const pushRoll = mutation({
  args: {
    sessionId: v.id("partySessions"),
    rollerName: v.string(),
    label: v.optional(v.string()),
    expression: v.string(),
    total: v.number(),
    dice: v.array(v.number()),
    dropped: v.optional(v.array(v.number())),
    modifier: v.number(),
    mode: v.optional(v.union(v.literal("advantage"), v.literal("disadvantage"))),
    isCrit: v.optional(v.boolean()),
    isD20: v.boolean(),
  },
  handler: async (ctx, args): Promise<null> => {
    const m = await getMembershipBySession(ctx, args.sessionId)
    if (!m) throw new Error("Only session members can roll to the table.")
    const { sessionId, ...roll } = args
    await ctx.db.insert("sessionRolls", {
      sessionId,
      campaignId: m.session.campaignId,
      userId: m.userId,
      ...roll,
      createdAt: Date.now(),
    })
    return null
  },
})

// The most recent rolls for the feed, newest first. Members only (returns [] to
// non-members so the reactive query never throws on the client). The client caps
// what it renders; 15 is plenty for a glanceable "who just rolled what" strip.
export const listRecent = query({
  args: { sessionId: v.id("partySessions") },
  handler: async (ctx, args): Promise<Doc<"sessionRolls">[]> => {
    const m = await getMembershipBySession(ctx, args.sessionId)
    if (!m) return []
    return await ctx.db
      .query("sessionRolls")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(15)
  },
})
