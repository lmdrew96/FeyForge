import { mutation, query } from "./_generated/server"
import type { Doc } from "./_generated/dataModel"
import { v } from "convex/values"

// helper: whether a track is sufficiently complete to show to non-admin users
function isPubliclyVisible(track: Doc<"audioTracks">) {
  // must be approved and have an r2 URL
  if (!track.approved) return false
  if (!track.r2Url) return false
  if (!track.sceneTag || track.sceneTag.trim().length === 0) return false

  // SFX do NOT require intensity metadata
  if (track.type === "sfx") return true

  // For music tracks require intensityTier & intensityRank (explore/combat)
  if (track.type === "music") {
    if (!track.intensityTier) return false
    return typeof track.intensityRank === "number"
  }

  // default conservative: require r2Url & approved
  return true
}

// ── Queries ────────────────────────────────────────────────────────────────

export const listAudioTracks = query({
  args: {
    type: v.optional(v.union(v.literal("ambience"), v.literal("music"), v.literal("sfx"))),
    sceneTag: v.optional(v.string()),
    intensityTier: v.optional(v.union(v.literal("explore"), v.literal("combat"))),
    includeUnapproved: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query("audioTracks")

    // When type+sceneTag are provided, use the index
    if (args.type && args.sceneTag) {
      let tracks = await q
        .withIndex("by_type_and_sceneTag", (idx) =>
          idx.eq("type", args.type!).eq("sceneTag", args.sceneTag)
        )
        .take(200)

      if (!args.includeUnapproved) tracks = tracks.filter(isPubliclyVisible)
      return tracks
    }

    if (args.type) {
      let tracks = await q
        .withIndex("by_type", (idx) => idx.eq("type", args.type!))
        .take(200)
      if (args.intensityTier) {
        tracks = tracks.filter((t) => t.intensityTier === args.intensityTier)
      }
      if (!args.includeUnapproved) tracks = tracks.filter(isPubliclyVisible)
      return tracks
    }

    let tracks = await q.take(200)
    let filtered = tracks.filter((t) => {
      if (args.type && t.type !== args.type) return false
      if (args.intensityTier && t.intensityTier !== args.intensityTier) return false
      if (args.sceneTag && t.sceneTag !== args.sceneTag) return false
      return true
    })

    // By default we only return tracks that are approved and have required metadata.
    // Admins (includeUnapproved=true) can see everything.
    if (!args.includeUnapproved) {
      filtered = filtered.filter(isPubliclyVisible)
    }

    return filtered
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
    intensityRank: v.optional(v.number()),
    sceneTag: v.optional(v.string()),
    r2Key: v.string(),
    r2Url: v.string(),
    duration: v.number(),
    sourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    // New uploads require admin approval by default
    return await ctx.db.insert("audioTracks", {
      ...args,
      uploadedBy: identity.tokenIdentifier,
      createdAt: Date.now(),
      approved: false,
    })
  },
})

export const updateAudioTrack = mutation({
  args: {
    trackId: v.id("audioTracks"),
    name: v.optional(v.string()),
    type: v.optional(v.union(v.literal("ambience"), v.literal("music"), v.literal("sfx"))),
    intensityTier: v.optional(v.union(v.literal("explore"), v.literal("combat"), v.null())),
    intensityRank: v.optional(v.number()),
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

// Admin: approve or update any audio track
export const approveAudioTrack = mutation({
  args: { trackId: v.id("audioTracks"), approved: v.boolean() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    // Check admin role in users table
    const me = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.tokenIdentifier))
      .unique()
    if (!me || me.role !== "admin") throw new Error("Not authorized")

    const track = await ctx.db.get(args.trackId)
    if (!track) throw new Error("Track not found")

    if (args.approved) {
      if (!track.sceneTag || track.sceneTag.trim().length === 0) {
        throw new Error("Set a scene tag before approving this track")
      }
    }

    await ctx.db.patch(args.trackId, { approved: args.approved })
  },
})

export const adminUpdateAudioTrack = mutation({
  args: {
    trackId: v.id("audioTracks"),
    name: v.optional(v.string()),
    type: v.optional(v.union(v.literal("ambience"), v.literal("music"), v.literal("sfx"))),
    intensityTier: v.optional(v.union(v.literal("explore"), v.literal("combat"), v.null())),
    intensityRank: v.optional(v.number()),
    sceneTag: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    approved: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const me = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.tokenIdentifier))
      .unique()
    if (!me || me.role !== "admin") throw new Error("Not authorized")

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
    activeVictoryTrackId: v.optional(v.id("audioTracks")),
    activeCombatTrackId: v.optional(v.id("audioTracks")),
    // intensity is musicLevel (0-100)
    intensity: v.optional(v.number()),
    musicMode: v.optional(v.union(v.literal("explore"), v.literal("combat"), v.literal("off"), v.literal("blend"))),
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
    // allow setting activeVictoryTrackId and musicMode as part of session audio updates
    await ctx.db.patch(sessionId, updates)
  },
})

export const insertAudioTrackSeed = mutation({
  args: {
    seedSecret: v.string(),
    name: v.string(),
    type: v.union(v.literal("ambience"), v.literal("music"), v.literal("sfx")),
    intensityTier: v.union(v.literal("explore"), v.literal("combat"), v.null()),
    sceneTag: v.optional(v.string()),
    r2Key: v.string(),
    r2Url: v.string(),
    duration: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.seedSecret !== process.env.SEED_SECRET) throw new Error("Unauthorized")
    const { seedSecret, ...trackData } = args
    // Upsert by r2Key so re-runs update the URL without creating duplicates
    const existing = await ctx.db
      .query("audioTracks")
      .filter((q) => q.eq(q.field("r2Key"), trackData.r2Key))
      .unique()
    if (existing) {
      await ctx.db.patch(existing._id, { r2Url: trackData.r2Url, name: trackData.name })
      return existing._id
    }
    return await ctx.db.insert("audioTracks", {
      ...trackData,
      uploadedBy: "seed",
      createdAt: Date.now(),
      approved: true,
    })
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

export const triggerVictoryCue = mutation({
  args: {
    sessionId: v.id("partySessions"),
    trackId: v.optional(v.id("audioTracks")),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const session = await ctx.db.get(args.sessionId)
    if (!session) throw new Error("Session not found")
    if (session.dmUserId !== identity.tokenIdentifier) throw new Error("Not authorized")

    const patch: Record<string, unknown> = {
      victoryTriggeredAt: Date.now(),
    }
    if (args.trackId !== undefined) patch.activeVictoryTrackId = args.trackId
    if (args.durationMs !== undefined) patch.victoryDurationMs = args.durationMs

    await ctx.db.patch(args.sessionId, patch)
  },
})

