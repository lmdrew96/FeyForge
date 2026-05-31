import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import type { Id } from "./_generated/dataModel"
import { ensureCampaignSetup } from "./campaignMembers"
import { resolveActiveCampaignId, setActiveCampaignForUser } from "./users"
import { getMembership, getMembershipBySession, requireDm } from "./lib/auth"

export const getActiveSession = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    // Campaign-scoped read — members only.
    const m = await getMembership(ctx, args.campaignId)
    if (!m) return null
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
    // Session-scoped read — members of the session's campaign only.
    const m = await getMembershipBySession(ctx, args.sessionId)
    if (!m) return []
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
    const userId = identity.tokenIdentifier

    // Resolve the campaign the caller is currently working in.
    let campaignId = await resolveActiveCampaignId(ctx, userId)

    // A live session must run in a campaign the caller DMs. If the resolved
    // campaign isn't one they DM, fall back to one they own.
    let ownsResolved = false
    if (campaignId) {
      const membership = await ctx.db
        .query("campaignMembers")
        .withIndex("by_campaignId_and_userId", (q) =>
          q.eq("campaignId", campaignId as Id<"campaigns">).eq("userId", userId)
        )
        .first()
      ownsResolved = membership?.role === "dm"
    }

    if (!ownsResolved) {
      const owned = await ctx.db
        .query("campaigns")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first()

      if (owned) {
        campaignId = owned._id
      } else {
        // No owned campaign. Only auto-create for a genuinely new user (zero
        // memberships) — that's real first-time-DM onboarding. A user who is
        // already a member somewhere (e.g. a player in someone else's campaign)
        // must create a campaign explicitly: we never create a phantom campaign
        // and flip their active campaign to it as a side effect of landing on a
        // DM tool. (This was the v0.52.0-era active-campaign-flip bug.)
        const memberships = await ctx.db
          .query("campaignMembers")
          .withIndex("by_userId", (q) => q.eq("userId", userId))
          .take(1)
        if (memberships.length > 0) {
          throw new Error(
            "You don't have a campaign to DM yet. Create one from the Campaigns page first."
          )
        }
        campaignId = await ctx.db.insert("campaigns", {
          userId,
          name: "My Campaign",
          isActive: true,
          updatedAt: Date.now(),
        })
      }
    }

    // campaignId is guaranteed set past this point (resolved-and-owned, owned, or created).
    const resolvedCampaignId = campaignId as Id<"campaigns">

    // Ensure the DM membership + invite code exist (covers pre-membership campaigns too).
    await ensureCampaignSetup(ctx, resolvedCampaignId, userId)

    // Self-heal: persist the campaign we're actually running so the invite button
    // and player-side resolution agree on the active campaign.
    await setActiveCampaignForUser(ctx, userId, resolvedCampaignId)

    // Get or create active session
    const activeSession = await ctx.db
      .query("partySessions")
      .withIndex("by_campaignId_and_isActive", (q) =>
        q.eq("campaignId", resolvedCampaignId).eq("isActive", true)
      )
      .first()

    if (activeSession) {
      return { campaignId: resolvedCampaignId, sessionId: activeSession._id }
    }

    const sessionId = await ctx.db.insert("partySessions", {
      campaignId: resolvedCampaignId,
      dmUserId: userId,
      activeScene: "",
      isActive: true,
      startedAt: Date.now(),
    })

    return { campaignId: resolvedCampaignId, sessionId }
  },
})

export const startSession = mutation({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args): Promise<Id<"partySessions">> => {
    const userId = await requireDm(ctx, args.campaignId, "Only the DM can start a session")

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
      dmUserId: userId,
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
    // Resolves full character sheets — members of the session's campaign only.
    const m = await getMembershipBySession(ctx, args.sessionId)
    if (!m) return []
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
    // Only a member of the session's campaign may register in its live session.
    const m = await getMembershipBySession(ctx, args.sessionId)
    if (!m) throw new Error("Not a member of this campaign")
    const { session, userId } = m
    if (!session.isActive) throw new Error("Session not active")

    // The character must belong to the joining user (matches joinByCode).
    const character = await ctx.db.get(args.characterId)
    if (!character || character.userId !== userId) throw new Error("Character not found")

    const existing = await ctx.db
      .query("partyMembers")
      .withIndex("by_sessionId_and_userId", (q) =>
        q.eq("sessionId", args.sessionId).eq("userId", userId)
      )
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, { characterId: args.characterId })
      return existing._id
    }

    return await ctx.db.insert("partyMembers", {
      sessionId: args.sessionId,
      campaignId: session.campaignId,
      userId,
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
