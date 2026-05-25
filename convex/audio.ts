import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

// ── Queries ────────────────────────────────────────────────────────────────

export const listAudioTracks = query({
  args: {
    type: v.optional(v.union(v.literal("ambience"), v.literal("music"), v.literal("sfx"))),
    sceneTag: v.optional(v.string()),
    intensityTier: v.optional(v.union(v.literal("explore"), v.literal("combat"))),
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query("audioTracks")

    if (args.type && args.sceneTag) {
      return await q
        .withIndex("by_type_and_sceneTag", (idx) =>
          idx.eq("type", args.type!).eq("sceneTag", args.sceneTag)
        )
        .take(200)
    }

    if (args.type) {
      const tracks = await q
        .withIndex("by_type", (idx) => idx.eq("type", args.type!))
        .take(200)
      if (args.intensityTier) {
        return tracks.filter((t) => t.intensityTier === args.intensityTier)
      }
      return tracks
    }

    const tracks = await q.take(200)
    if (args.type || args.intensityTier) {
      return tracks.filter((t) => {
        if (args.type && t.type !== args.type) return false
        if (args.intensityTier && t.intensityTier !== args.intensityTier) return false
        return true
      })
    }
    return tracks
  },
})

export const getAudioTrack = query({
  args: { trackId: v.id("audioTracks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.trackId)
  },
})

export const getSceneAudio = query({
  args: {
    campaignId: v.id("campaigns"),
    sceneName: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("campaignSceneAudio")
      .withIndex("by_campaignId_and_sceneName", (q) =>
        q.eq("campaignId", args.campaignId).eq("sceneName", args.sceneName)
      )
      .unique()
  },
})

export const getSessionAudio = query({
  args: { sessionId: v.id("partySessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sessionId)
  },
})

export const listSceneAudio = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("campaignSceneAudio")
      .withIndex("by_campaignId", (q) => q.eq("campaignId", args.campaignId))
      .take(50)
  },
})

// ── Mutations ──────────────────────────────────────────────────────────────

export const createAudioTrack = mutation({
  args: {
    name: v.string(),
    type: v.union(v.literal("ambience"), v.literal("music"), v.literal("sfx")),
    intensityTier: v.union(v.literal("explore"), v.literal("combat"), v.null()),
    sceneTag: v.optional(v.string()),
    r2Key: v.string(),
    r2Url: v.string(),
    duration: v.number(),
    sourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    return await ctx.db.insert("audioTracks", {
      ...args,
      uploadedBy: identity.tokenIdentifier,
      createdAt: Date.now(),
    })
  },
})

export const updateAudioTrack = mutation({
  args: {
    trackId: v.id("audioTracks"),
    name: v.optional(v.string()),
    type: v.optional(v.union(v.literal("ambience"), v.literal("music"), v.literal("sfx"))),
    intensityTier: v.optional(v.union(v.literal("explore"), v.literal("combat"), v.null())),
    sceneTag: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const track = await ctx.db.get(args.trackId)
    if (!track) throw new Error("Track not found")
    if (track.uploadedBy !== identity.tokenIdentifier) throw new Error("Not authorized")

    const { trackId, ...updates } = args
    await ctx.db.patch(trackId, updates)
  },
})

export const deleteAudioTrack = mutation({
  args: { trackId: v.id("audioTracks") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const track = await ctx.db.get(args.trackId)
    if (!track) throw new Error("Track not found")
    if (track.uploadedBy !== identity.tokenIdentifier) throw new Error("Not authorized")

    await ctx.db.delete(args.trackId)
    return track.r2Key
  },
})

export const setSceneAudio = mutation({
  args: {
    campaignId: v.id("campaigns"),
    sceneName: v.string(),
    slot: v.union(v.literal("ambience"), v.literal("explore"), v.literal("combat")),
    trackId: v.optional(v.id("audioTracks")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const existing = await ctx.db
      .query("campaignSceneAudio")
      .withIndex("by_campaignId_and_sceneName", (q) =>
        q.eq("campaignId", args.campaignId).eq("sceneName", args.sceneName)
      )
      .unique()

    const slotField =
      args.slot === "ambience"
        ? "ambienceTrackId"
        : args.slot === "explore"
          ? "exploreTrackId"
          : "combatTrackId"

    if (existing) {
      await ctx.db.patch(existing._id, { [slotField]: args.trackId })
    } else {
      await ctx.db.insert("campaignSceneAudio", {
        campaignId: args.campaignId,
        sceneName: args.sceneName,
        [slotField]: args.trackId,
      })
    }
  },
})

export const updateSessionAudio = mutation({
  args: {
    sessionId: v.id("partySessions"),
    activeAmbienceTrackId: v.optional(v.id("audioTracks")),
    activeExploreTrackId: v.optional(v.id("audioTracks")),
    activeCombatTrackId: v.optional(v.id("audioTracks")),
    intensity: v.optional(v.number()),
    ambienceVolume: v.optional(v.number()),
    masterVolume: v.optional(v.number()),
    audioSyncEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const session = await ctx.db.get(args.sessionId)
    if (!session) throw new Error("Session not found")
    if (session.dmUserId !== identity.tokenIdentifier) throw new Error("Not authorized")

    const { sessionId, ...updates } = args
    await ctx.db.patch(sessionId, updates)
  },
})

export const updateSessionIntensity = mutation({
  args: {
    sessionId: v.id("partySessions"),
    intensity: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const session = await ctx.db.get(args.sessionId)
    if (!session) throw new Error("Session not found")
    if (session.dmUserId !== identity.tokenIdentifier) throw new Error("Not authorized")

    await ctx.db.patch(args.sessionId, { intensity: args.intensity })
  },
})
