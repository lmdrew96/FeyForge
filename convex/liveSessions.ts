import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import type { Id } from "./_generated/dataModel"
import { ensureCampaignSetup } from "./campaignMembers"
import { resolveActiveCampaignId, setActiveCampaignForUser } from "./users"

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

// Idempotent — gets or creates the DM's active campaign and an active session.
// Called once on mount by DM tools that need a live session context. Runs the
// session in the DM's *active* campaign (the one they selected/invited from), so
// the campaign players join matches the campaign the session lands in.
export const setupDMSession = mutation({
  args: {},
  handler: async (ctx): Promise<{ campaignId: Id<"campaigns">; sessionId: Id<"partySessions"> }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    // Resolve the campaign the DM is currently working in.
    let campaignId = await resolveActiveCampaignId(ctx, identity.tokenIdentifier)

    // A live session must run in a campaign the DM owns. If the resolved campaign
    // isn't one they DM (player-only, or none yet), fall back to a get-or-create
    // owned campaign.
    let ownsResolved = false
    if (campaignId) {
      const membership = await ctx.db
        .query("campaignMembers")
        .withIndex("by_campaignId_and_userId", (q) =>
          q.eq("campaignId", campaignId as Id<"campaigns">).eq("userId", identity.tokenIdentifier)
        )
        .first()
      ownsResolved = membership?.role === "dm"
    }

    if (!campaignId || !ownsResolved) {
      const existing = await ctx.db
        .query("campaigns")
        .withIndex("by_userId", (q) => q.eq("userId", identity.tokenIdentifier))
        .first()
      campaignId = existing
        ? existing._id
        : await ctx.db.insert("campaigns", {
            userId: identity.tokenIdentifier,
            name: "My Campaign",
            isActive: true,
            updatedAt: Date.now(),
          })
    }

    // Ensure the DM membership + invite code exist (covers pre-membership campaigns too).
    await ensureCampaignSetup(ctx, campaignId, identity.tokenIdentifier)

    // Self-heal: persist the campaign we're actually running so the invite button
    // and player-side resolution agree on the active campaign.
    await setActiveCampaignForUser(ctx, identity.tokenIdentifier, campaignId)

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

    // Reuse the active session if one already exists for this campaign. Ending +
    // recreating would orphan the partyMembers already joined under it, forcing
    // players to re-pick their character.
    const existing = await ctx.db
      .query("partySessions")
      .withIndex("by_campaignId_and_isActive", (q) =>
        q.eq("campaignId", args.campaignId).eq("isActive", true)
      )
      .first()

    if (existing) return existing._id

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

const paletteValidator = v.object({
  bg: v.string(),
  surface: v.string(),
  accent: v.string(),
  highlight: v.string(),
})

export const activateScene = mutation({
  args: {
    sessionId: v.id("partySessions"),
    scene: v.string(),
    palette: v.optional(paletteValidator),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const session = await ctx.db.get(args.sessionId)
    if (!session) throw new Error("Session not found")
    if (session.dmUserId !== identity.tokenIdentifier) throw new Error("Not authorized")

    const patch: Record<string, unknown> = { activeScene: args.scene }
    if (args.palette) patch.activeScenePalette = args.palette

    // Auto-load audio bindings for this scene
    const sceneAudio = await ctx.db
      .query("campaignSceneAudio")
      .withIndex("by_campaignId_and_sceneName", (q) =>
        q.eq("campaignId", session.campaignId).eq("sceneName", args.scene)
      )
      .unique()

    if (sceneAudio) {
      if (sceneAudio.ambienceTrackId !== undefined) patch.activeAmbienceTrackId = sceneAudio.ambienceTrackId
      if (sceneAudio.exploreTrackId !== undefined) patch.activeExploreTrackId = sceneAudio.exploreTrackId
      if (sceneAudio.combatTrackId !== undefined) patch.activeCombatTrackId = sceneAudio.combatTrackId
    }

    await ctx.db.patch(args.sessionId, patch)
  },
})

export const setSceneTime = mutation({
  args: {
    sessionId: v.id("partySessions"),
    sceneTime: v.union(v.literal("day"), v.literal("night")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const session = await ctx.db.get(args.sessionId)
    if (!session) throw new Error("Session not found")
    if (session.dmUserId !== identity.tokenIdentifier) throw new Error("Not authorized")

    await ctx.db.patch(args.sessionId, { sceneTime: args.sceneTime })
  },
})

export const getMyPartyMember = query({
  args: { sessionId: v.id("partySessions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const member = await ctx.db
      .query("partyMembers")
      .withIndex("by_sessionId_and_userId", (q) =>
        q.eq("sessionId", args.sessionId).eq("userId", identity.tokenIdentifier)
      )
      .first()

    if (!member) return null
    const character = await ctx.db.get(member.characterId)
    return { ...member, character }
  },
})

export const getPartyMembers = query({
  args: { sessionId: v.id("partySessions") },
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query("partyMembers")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .take(20)

    return await Promise.all(
      members.map(async (member) => {
        const character = await ctx.db.get(member.characterId)
        return { ...member, character }
      })
    )
  },
})

export const joinSession = mutation({
  args: {
    sessionId: v.id("partySessions"),
    characterId: v.id("characters"),
  },
  handler: async (ctx, args): Promise<Id<"partyMembers">> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const session = await ctx.db.get(args.sessionId)
    if (!session || !session.isActive) throw new Error("Session not active")

    const existing = await ctx.db
      .query("partyMembers")
      .withIndex("by_sessionId_and_userId", (q) =>
        q.eq("sessionId", args.sessionId).eq("userId", identity.tokenIdentifier)
      )
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, { characterId: args.characterId })
      return existing._id
    }

    return await ctx.db.insert("partyMembers", {
      sessionId: args.sessionId,
      campaignId: session.campaignId,
      userId: identity.tokenIdentifier,
      characterId: args.characterId,
      joinedAt: Date.now(),
      conditions: [],
    })
  },
})

export const toggleCondition = mutation({
  args: {
    sessionId: v.id("partySessions"),
    condition: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const member = await ctx.db
      .query("partyMembers")
      .withIndex("by_sessionId_and_userId", (q) =>
        q.eq("sessionId", args.sessionId).eq("userId", identity.tokenIdentifier)
      )
      .first()

    if (!member) throw new Error("Not in this session")

    const conditions = member.conditions.includes(args.condition)
      ? member.conditions.filter((c) => c !== args.condition)
      : [...member.conditions, args.condition]

    await ctx.db.patch(member._id, { conditions })
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
      v.literal("custom"),
      v.literal("web_node")
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
