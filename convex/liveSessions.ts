import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import type { Id } from "./_generated/dataModel"

export const getMyDefaultCampaign = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    return await ctx.db
      .query("campaigns")
      .withIndex("by_userId", (q) => q.eq("userId", identity.tokenIdentifier))
      .first()
  },
})

export const getActiveSession = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("partySessions")
      .withIndex("by_campaignId_and_isActive", (q) =>
        q.eq("campaignId", args.campaignId).eq("isActive", true)
      )
      .first()
  },
})

export const getAnyActiveSession = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("partySessions")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .order("desc")
      .first()
  },
})

export const listBroadcasts = query({
  args: { sessionId: v.id("partySessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessionBroadcasts")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(50)
  },
})

// Idempotent — gets or creates the DM's default campaign and an active session.
// Called once on mount by DM tools that need a live session context.
export const setupDMSession = mutation({
  args: {},
  handler: async (ctx): Promise<{ campaignId: Id<"campaigns">; sessionId: Id<"partySessions"> }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    // Get or create default campaign
    let existing = await ctx.db
      .query("campaigns")
      .withIndex("by_userId", (q) => q.eq("userId", identity.tokenIdentifier))
      .first()

    let campaignId: Id<"campaigns">
    if (existing) {
      campaignId = existing._id
    } else {
      campaignId = await ctx.db.insert("campaigns", {
        userId: identity.tokenIdentifier,
        name: "My Campaign",
        isActive: true,
        updatedAt: Date.now(),
      })
    }

    // Get or create active session
    const activeSession = await ctx.db
      .query("partySessions")
      .withIndex("by_campaignId_and_isActive", (q) =>
        q.eq("campaignId", campaignId).eq("isActive", true)
      )
      .first()

    if (activeSession) {
      return { campaignId, sessionId: activeSession._id }
    }

    const sessionId = await ctx.db.insert("partySessions", {
      campaignId,
      dmUserId: identity.tokenIdentifier,
      activeScene: "",
      isActive: true,
      startedAt: Date.now(),
    })

    return { campaignId, sessionId }
  },
})

export const startSession = mutation({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args): Promise<Id<"partySessions">> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    // End any existing active session
    const existing = await ctx.db
      .query("partySessions")
      .withIndex("by_campaignId_and_isActive", (q) =>
        q.eq("campaignId", args.campaignId).eq("isActive", true)
      )
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, { isActive: false, endedAt: Date.now() })
    }

    return await ctx.db.insert("partySessions", {
      campaignId: args.campaignId,
      dmUserId: identity.tokenIdentifier,
      activeScene: "",
      isActive: true,
      startedAt: Date.now(),
    })
  },
})

export const endSession = mutation({
  args: { sessionId: v.id("partySessions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const session = await ctx.db.get(args.sessionId)
    if (!session) throw new Error("Session not found")
    if (session.dmUserId !== identity.tokenIdentifier) throw new Error("Not authorized")

    await ctx.db.patch(args.sessionId, { isActive: false, endedAt: Date.now() })
  },
})

export const activateScene = mutation({
  args: {
    sessionId: v.id("partySessions"),
    scene: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const session = await ctx.db.get(args.sessionId)
    if (!session) throw new Error("Session not found")
    if (session.dmUserId !== identity.tokenIdentifier) throw new Error("Not authorized")

    await ctx.db.patch(args.sessionId, { activeScene: args.scene })
  },
})

export const broadcastReveal = mutation({
  args: {
    sessionId: v.id("partySessions"),
    campaignId: v.id("campaigns"),
    type: v.union(
      v.literal("npc"),
      v.literal("location"),
      v.literal("scene"),
      v.literal("custom")
    ),
    title: v.string(),
    body: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const session = await ctx.db.get(args.sessionId)
    if (!session) throw new Error("Session not found")
    if (session.dmUserId !== identity.tokenIdentifier) throw new Error("Not authorized")

    return await ctx.db.insert("sessionBroadcasts", {
      sessionId: args.sessionId,
      campaignId: args.campaignId,
      type: args.type,
      title: args.title,
      body: args.body,
      imageUrl: args.imageUrl,
      isRevealed: true,
      revealedAt: Date.now(),
    })
  },
})
