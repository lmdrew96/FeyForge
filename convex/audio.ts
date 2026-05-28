import { mutation, query } from "./_generated/server"
import type { MutationCtx } from "./_generated/server"
import type { Doc, Id } from "./_generated/dataModel"
import { v } from "convex/values"

function isValidIntensityRank(intensityRank: number): boolean {
  return Number.isInteger(intensityRank) && intensityRank >= 1 && intensityRank <= 5
}

function isValidAmbienceRank(rank: number): boolean {
  return Number.isInteger(rank) && rank >= 1 && rank <= 3
}

// helper: whether a track is sufficiently complete to show to non-admin users
function isPubliclyVisible(track: Doc<"audioTracks">) {
  if (!track.approved) return false
  if (!track.r2Url) return false
  if (!track.sceneTag || track.sceneTag.length === 0) return false
  return true
}

// ── Queries ────────────────────────────────────────────────────────────────

export const listAudioTracks = query({
  args: {
    type: v.optional(v.union(v.literal("ambience"), v.literal("music"), v.literal("sfx"))),
    sceneTag: v.optional(v.string()),
    intensityTier: v.optional(v.union(v.literal("explore"), v.literal("combat"))),
    tier: v.optional(v.union(v.literal("free"), v.literal("premium"))),
    includeUnapproved: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let tracks: Doc<"audioTracks">[]

    if (args.type) {
      tracks = await ctx.db
        .query("audioTracks")
        .withIndex("by_type", (idx) => idx.eq("type", args.type!))
        .take(200)
    } else {
      tracks = await ctx.db.query("audioTracks").take(200)
    }

    tracks = tracks.filter((t) => {
      if (args.type && t.type !== args.type) return false
      if (args.intensityTier && t.intensityTier !== args.intensityTier) return false
      if (args.sceneTag && !(t.sceneTag ?? []).includes(args.sceneTag)) return false
      if (args.tier && t.tier !== args.tier) return false
      return true
    })

    if (!args.includeUnapproved) {
      tracks = tracks.filter(isPubliclyVisible)
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
    intensityRank: v.optional(v.number()),
    sceneTag: v.optional(v.array(v.string())),
    r2Key: v.string(),
    r2Url: v.string(),
    duration: v.number(),
    sourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    if (args.intensityRank !== undefined && !isValidIntensityRank(args.intensityRank)) {
      throw new Error("Intensity rank must be an integer from 1 to 5")
    }

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
    sceneTag: v.optional(v.array(v.string())),
    sourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    if (args.intensityRank !== undefined && !isValidIntensityRank(args.intensityRank)) {
      throw new Error("Intensity rank must be an integer from 1 to 5")
    }

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

    const me = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.tokenIdentifier))
      .unique()
    if (!me || me.role !== "admin") throw new Error("Not authorized")

    const track = await ctx.db.get(args.trackId)
    if (!track) throw new Error("Track not found")

    if (args.approved) {
      if (!track.sceneTag || track.sceneTag.length === 0) {
        throw new Error("Set at least one scene tag before approving this track")
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
    sceneTag: v.optional(v.array(v.string())),
    tier: v.optional(v.union(v.literal("free"), v.literal("premium"))),
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

    if (args.intensityRank !== undefined) {
      const track = await ctx.db.get(args.trackId)
      const effectiveType = args.type ?? track?.type
      if (effectiveType === "ambience") {
        if (!isValidAmbienceRank(args.intensityRank)) {
          throw new Error("Ambience intensity rank must be an integer from 1 to 3")
        }
      } else if (!isValidIntensityRank(args.intensityRank)) {
        throw new Error("Music intensity rank must be an integer from 1 to 5")
      }
    }

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
    await ctx.db.patch(sessionId, updates)
  },
})

export const insertAudioTrackSeed = mutation({
  args: {
    seedSecret: v.string(),
    name: v.string(),
    type: v.union(v.literal("ambience"), v.literal("music"), v.literal("sfx")),
    intensityTier: v.union(v.literal("explore"), v.literal("combat"), v.null()),
    sceneTag: v.optional(v.array(v.string())),
    r2Key: v.string(),
    r2Url: v.string(),
    duration: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.seedSecret !== process.env.SEED_SECRET) throw new Error("Unauthorized")
    const { seedSecret, ...trackData } = args
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
      tier: "free",
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

export const listAmbienceLayers = query({
  args: {
    campaignId: v.optional(v.id("campaigns")),
  },
  handler: async (ctx, args): Promise<Array<Doc<"ambienceLayers"> & { r2Url: string; trackType: string | null }>> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const allLayers = await ctx.db.query("ambienceLayers").take(200)

    const campaignLayers = args.campaignId
      ? allLayers.filter((layer) => layer.campaignId === args.campaignId)
      : []

    const globalSharedLayers = allLayers.filter((layer) => layer.campaignId === undefined && layer.isShared)

    const visibleCampaignLayers = campaignLayers.filter(
      (layer) => layer.userId === identity.tokenIdentifier || layer.isShared
    )
    const visibleGlobalLayers = globalSharedLayers.filter((layer) => layer.isShared)

    const deduped = new Map<string, Doc<"ambienceLayers">>()
    for (const layer of [...visibleCampaignLayers, ...visibleGlobalLayers]) {
      deduped.set(layer._id, layer)
    }

    const resolved: Array<Doc<"ambienceLayers"> & { r2Url: string; trackType: string | null }> = []
    for (const layer of deduped.values()) {
      const track = await ctx.db.get(layer.trackId)
      resolved.push({
        ...layer,
        r2Url: track?.r2Url ?? "",
        trackType: track?.type ?? null,
      })
    }

    return resolved
  },
})

export const listAmbiencePresets = query({
  args: {
    campaignId: v.optional(v.id("campaigns")),
    sceneName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const allPresets = await ctx.db.query("ambiencePresets").take(200)

    return allPresets.filter((preset) => {
      if (preset.userId !== identity.tokenIdentifier) return false
      if (args.campaignId && preset.campaignId !== args.campaignId) return false
      if (!args.campaignId && preset.campaignId !== undefined) return false
      if (args.sceneName && preset.sceneName !== args.sceneName) return false
      return true
    })
  },
})

export const getAmbiencePreset = query({
  args: {
    presetId: v.id("ambiencePresets"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const preset = await ctx.db.get(args.presetId)
    if (!preset) return null
    if (preset.userId !== identity.tokenIdentifier) throw new Error("Not authorized")

    return preset
  },
})

export const createAmbienceLayer = mutation({
  args: {
    campaignId: v.optional(v.id("campaigns")),
    name: v.string(),
    category: v.string(),
    icon: v.optional(v.string()),
    trackId: v.id("audioTracks"),
    isShared: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const track = await ctx.db.get(args.trackId)
    if (!track) throw new Error("Track not found")
    if (track.type !== "ambience") throw new Error("Ambience layer track must have type ambience")

    return await ctx.db.insert("ambienceLayers", {
      userId: identity.tokenIdentifier,
      campaignId: args.campaignId,
      name: args.name,
      category: args.category,
      icon: args.icon,
      trackId: args.trackId,
      isShared: args.isShared,
      createdAt: Date.now(),
    })
  },
})

export const updateAmbienceLayer = mutation({
  args: {
    layerId: v.id("ambienceLayers"),
    name: v.optional(v.string()),
    category: v.optional(v.string()),
    icon: v.optional(v.string()),
    trackId: v.optional(v.id("audioTracks")),
    isShared: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const layer = await ctx.db.get(args.layerId)
    if (!layer) throw new Error("Layer not found")
    if (layer.userId !== identity.tokenIdentifier) throw new Error("Not authorized")

    if (args.trackId) {
      const track = await ctx.db.get(args.trackId)
      if (!track) throw new Error("Track not found")
      if (track.type !== "ambience") throw new Error("Ambience layer track must have type ambience")
    }

    const { layerId, ...updates } = args
    await ctx.db.patch(layerId, updates)
  },
})

export const deleteAmbienceLayer = mutation({
  args: {
    layerId: v.id("ambienceLayers"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const layer = await ctx.db.get(args.layerId)
    if (!layer) throw new Error("Layer not found")
    if (layer.userId !== identity.tokenIdentifier) throw new Error("Not authorized")

    await ctx.db.delete(args.layerId)
  },
})

export const createAmbiencePreset = mutation({
  args: {
    campaignId: v.optional(v.id("campaigns")),
    sceneName: v.string(),
    variationName: v.string(),
    layers: v.array(
      v.object({
        layerId: v.id("ambienceLayers"),
        defaultTier: v.optional(v.union(v.literal("i"), v.literal("ii"), v.literal("iii"))),
      })
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    for (const layerDef of args.layers) {
      const layer = await ctx.db.get(layerDef.layerId)
      if (!layer) throw new Error("Layer not found")
      if (layer.userId !== identity.tokenIdentifier && !layer.isShared) {
        throw new Error("Cannot include a private layer you do not own")
      }
    }

    return await ctx.db.insert("ambiencePresets", {
      userId: identity.tokenIdentifier,
      campaignId: args.campaignId,
      sceneName: args.sceneName,
      variationName: args.variationName,
      layers: args.layers,
      createdAt: Date.now(),
    })
  },
})

export const updateAmbiencePreset = mutation({
  args: {
    presetId: v.id("ambiencePresets"),
    sceneName: v.optional(v.string()),
    variationName: v.optional(v.string()),
    layers: v.optional(
      v.array(
        v.object({
          layerId: v.id("ambienceLayers"),
          defaultTier: v.optional(v.union(v.literal("i"), v.literal("ii"), v.literal("iii"))),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const preset = await ctx.db.get(args.presetId)
    if (!preset) throw new Error("Preset not found")
    if (preset.userId !== identity.tokenIdentifier) throw new Error("Not authorized")

    if (args.layers) {
      for (const layerDef of args.layers) {
        const layer = await ctx.db.get(layerDef.layerId)
        if (!layer) throw new Error("Layer not found")
        if (layer.userId !== identity.tokenIdentifier && !layer.isShared) {
          throw new Error("Cannot include a private layer you do not own")
        }
      }
    }

    const { presetId, ...updates } = args
    await ctx.db.patch(presetId, updates)
  },
})

export const deleteAmbiencePreset = mutation({
  args: {
    presetId: v.id("ambiencePresets"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const preset = await ctx.db.get(args.presetId)
    if (!preset) throw new Error("Preset not found")
    if (preset.userId !== identity.tokenIdentifier) throw new Error("Not authorized")

    await ctx.db.delete(args.presetId)
  },
})

export const updateSessionLayers = mutation({
  args: {
    sessionId: v.id("partySessions"),
    activeLayers: v.array(
      v.object({
        layerId: v.id("ambienceLayers"),
        tier: v.union(v.literal("i"), v.literal("ii"), v.literal("iii"), v.literal("off")),
      })
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const session = await ctx.db.get(args.sessionId)
    if (!session) throw new Error("Session not found")
    if (session.dmUserId !== identity.tokenIdentifier) throw new Error("Not authorized")

    await ctx.db.patch(args.sessionId, { activeLayers: args.activeLayers })
  },
})

export const loadPreset = mutation({
  args: {
    sessionId: v.id("partySessions"),
    presetId: v.id("ambiencePresets"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const session = await ctx.db.get(args.sessionId)
    if (!session) throw new Error("Session not found")
    if (session.dmUserId !== identity.tokenIdentifier) throw new Error("Not authorized")

    const preset = await ctx.db.get(args.presetId)
    if (!preset) throw new Error("Preset not found")
    if (preset.userId !== identity.tokenIdentifier) throw new Error("Not authorized")
    if (preset.campaignId && preset.campaignId !== session.campaignId) {
      throw new Error("Preset campaign does not match session campaign")
    }

    const activeLayers = preset.layers.map((layer) => ({
      layerId: layer.layerId,
      tier: (layer.defaultTier ?? "off") as "off" | "i" | "ii" | "iii",
    })) as Array<{ layerId: typeof preset.layers[number]["layerId"]; tier: "off" | "i" | "ii" | "iii" }>

    await ctx.db.patch(args.sessionId, {
      activePresetId: args.presetId,
      activeLayers,
    })

    return { activeLayers }
  },
})

export const pauseAudio = mutation({
  args: {
    sessionId: v.id("partySessions"),
    paused: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const session = await ctx.db.get(args.sessionId)
    if (!session) throw new Error("Session not found")
    if (session.dmUserId !== identity.tokenIdentifier) throw new Error("Not authorized")

    await ctx.db.patch(args.sessionId, { audioPaused: args.paused })
  },
})

export const updateSessionMusicMode = mutation({
  args: {
    sessionId: v.id("partySessions"),
    musicMode: v.union(v.literal("explore"), v.literal("combat"), v.literal("off")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const session = await ctx.db.get(args.sessionId)
    if (!session) throw new Error("Session not found")
    if (session.dmUserId !== identity.tokenIdentifier) throw new Error("Not authorized")

    await ctx.db.patch(args.sessionId, { musicMode: args.musicMode })
  },
})

export const updateSessionMusicIntensity = mutation({
  args: {
    sessionId: v.id("partySessions"),
    musicIntensity: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    if (!Number.isInteger(args.musicIntensity) || args.musicIntensity < 1 || args.musicIntensity > 5) {
      throw new Error("musicIntensity must be an integer between 1 and 5")
    }

    const session = await ctx.db.get(args.sessionId)
    if (!session) throw new Error("Session not found")
    if (session.dmUserId !== identity.tokenIdentifier) throw new Error("Not authorized")

    await ctx.db.patch(args.sessionId, { musicIntensity: args.musicIntensity })
  },
})

// ── Music Stems ───────────────────────────────────────────────────────────────

export const listMusicStemsResolved = query({
  args: {
    campaignId: v.id("campaigns"),
    sceneName: v.string(),
    mode: v.union(v.literal("explore"), v.literal("combat"), v.literal("victory")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    // Campaign-specific stems
    const campaignStems = await ctx.db
      .query("musicStems")
      .withIndex("by_campaignId_sceneName_and_mode", (idx) =>
        idx.eq("campaignId", args.campaignId).eq("sceneName", args.sceneName).eq("mode", args.mode)
      )
      .take(100)

    // Global stems (campaignId = undefined) — shared across all sessions
    const globalStems = await ctx.db
      .query("musicStems")
      .withIndex("by_sceneName_mode_and_campaignId", (idx) =>
        idx.eq("sceneName", args.sceneName).eq("mode", args.mode).eq("campaignId", undefined)
      )
      .take(100)

    const seen = new Set<string>()
    const resolved: Array<{
      _id: string
      instrument: string
      intensity: number
      sortOrder: number
      r2Url: string
    }> = []

    for (const stem of [...campaignStems, ...globalStems]) {
      if (seen.has(stem._id)) continue
      seen.add(stem._id)
      const track = await ctx.db.get(stem.trackId)
      if (!track?.r2Url) continue
      resolved.push({
        _id: stem._id,
        instrument: stem.instrument,
        intensity: stem.intensity,
        sortOrder: stem.sortOrder,
        r2Url: track.r2Url,
      })
    }

    return resolved.sort((a, b) => a.sortOrder - b.sortOrder)
  },
})

// Distinct instrument names already assigned at the global scope for a given
// (scene, mode). Used by the admin review UI to autocomplete instrument names
// as Ashley adds more variants for the same scene.
export const listGlobalInstrumentsForSlot = query({
  args: {
    sceneName: v.string(),
    mode: v.union(v.literal("explore"), v.literal("combat"), v.literal("victory")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const rows = await ctx.db
      .query("musicStems")
      .withIndex("by_sceneName_mode_and_campaignId", (idx) =>
        idx.eq("sceneName", args.sceneName).eq("mode", args.mode).eq("campaignId", undefined)
      )
      .take(200)
    return Array.from(new Set(rows.map((r) => r.instrument))).sort()
  },
})

export const getInstrumentVariants = query({
  args: {
    campaignId: v.id("campaigns"),
    sceneName: v.string(),
    mode: v.union(v.literal("explore"), v.literal("combat"), v.literal("victory")),
    instrument: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const rows = await ctx.db
      .query("musicStems")
      .withIndex("by_scene_mode_instrument", (idx) =>
        idx.eq("sceneName", args.sceneName).eq("mode", args.mode).eq("instrument", args.instrument)
      )
      .take(20)

    // Merge: keep campaign-specific rows + global rows (campaignId === undefined)
    return rows
      .filter((stem) => stem.campaignId === args.campaignId || stem.campaignId === undefined)
      .sort((a, b) => a.intensity - b.intensity)
  },
})

export const listMusicStems = query({
  args: {
    campaignId: v.id("campaigns"),
    sceneName: v.string(),
    mode: v.optional(v.union(v.literal("explore"), v.literal("combat"), v.literal("victory"))),
  },
  handler: async (ctx, args) => {
    if (args.mode) {
      return ctx.db
        .query("musicStems")
        .withIndex("by_campaignId_sceneName_and_mode", (idx) =>
          idx.eq("campaignId", args.campaignId).eq("sceneName", args.sceneName).eq("mode", args.mode!)
        )
        .take(50)
    }
    return ctx.db
      .query("musicStems")
      .withIndex("by_campaignId_and_sceneName", (idx) =>
        idx.eq("campaignId", args.campaignId).eq("sceneName", args.sceneName)
      )
      .take(50)
  },
})

export const getMusicStem = query({
  args: { stemId: v.id("musicStems") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.stemId)
  },
})

// Check whether a (campaignId, scene, mode, instrument, intensity) slot is already taken.
// excludeStemId lets updateMusicStem skip self-collision.
async function isSlotTaken(
  ctx: MutationCtx,
  scope: {
    campaignId: Id<"campaigns"> | undefined
    sceneName: string
    mode: "explore" | "combat" | "victory"
    instrument: string
    intensity: number
  },
  excludeStemId?: Id<"musicStems">,
): Promise<boolean> {
  const candidates = await ctx.db
    .query("musicStems")
    .withIndex("by_scene_mode_instrument", (idx) =>
      idx.eq("sceneName", scope.sceneName).eq("mode", scope.mode).eq("instrument", scope.instrument)
    )
    .take(20)
  return candidates.some(
    (s) =>
      s._id !== excludeStemId &&
      s.campaignId === scope.campaignId &&
      s.intensity === scope.intensity,
  )
}

export const createMusicStem = mutation({
  args: {
    campaignId: v.id("campaigns"),
    sceneName: v.string(),
    mode: v.union(v.literal("explore"), v.literal("combat"), v.literal("victory")),
    instrument: v.string(),
    intensity: v.number(),
    trackId: v.id("audioTracks"),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    if (!Number.isInteger(args.intensity) || args.intensity < 1 || args.intensity > 5) {
      throw new Error("intensity must be an integer between 1 and 5")
    }
    if (args.instrument.trim() === "") {
      throw new Error("instrument is required")
    }

    const track = await ctx.db.get(args.trackId)
    if (!track) throw new Error("Track not found")

    const taken = await isSlotTaken(ctx, {
      campaignId: args.campaignId,
      sceneName: args.sceneName,
      mode: args.mode,
      instrument: args.instrument,
      intensity: args.intensity,
    })
    if (taken) {
      throw new Error(
        `Slot already exists for ${args.sceneName}/${args.mode}/${args.instrument} at intensity ${args.intensity}`,
      )
    }

    return ctx.db.insert("musicStems", {
      userId: identity.tokenIdentifier,
      campaignId: args.campaignId,
      sceneName: args.sceneName,
      mode: args.mode,
      instrument: args.instrument,
      intensity: args.intensity,
      trackId: args.trackId,
      sortOrder: args.sortOrder ?? args.intensity,
      createdAt: Date.now(),
    })
  },
})

export const updateMusicStem = mutation({
  args: {
    stemId: v.id("musicStems"),
    instrument: v.optional(v.string()),
    intensity: v.optional(v.number()),
    trackId: v.optional(v.id("audioTracks")),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const stem = await ctx.db.get(args.stemId)
    if (!stem) throw new Error("Stem not found")
    if (stem.userId !== identity.tokenIdentifier) throw new Error("Not authorized")

    const nextIntensity = args.intensity ?? stem.intensity
    const nextInstrument = args.instrument ?? stem.instrument

    if (args.intensity !== undefined) {
      if (!Number.isInteger(args.intensity) || args.intensity < 1 || args.intensity > 5) {
        throw new Error("intensity must be an integer between 1 and 5")
      }
    }
    if (args.instrument !== undefined && args.instrument.trim() === "") {
      throw new Error("instrument is required")
    }

    if (args.trackId !== undefined) {
      const track = await ctx.db.get(args.trackId)
      if (!track) throw new Error("Track not found")
    }

    if (args.instrument !== undefined || args.intensity !== undefined) {
      const taken = await isSlotTaken(
        ctx,
        {
          campaignId: stem.campaignId,
          sceneName: stem.sceneName,
          mode: stem.mode,
          instrument: nextInstrument,
          intensity: nextIntensity,
        },
        args.stemId,
      )
      if (taken) {
        throw new Error(
          `Slot already exists for ${stem.sceneName}/${stem.mode}/${nextInstrument} at intensity ${nextIntensity}`,
        )
      }
    }

    const { stemId, ...updates } = args
    await ctx.db.patch(stemId, updates)
  },
})

export const deleteMusicStem = mutation({
  args: { stemId: v.id("musicStems") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const stem = await ctx.db.get(args.stemId)
    if (!stem) throw new Error("Stem not found")
    if (stem.userId !== identity.tokenIdentifier) throw new Error("Not authorized")

    await ctx.db.delete(args.stemId)
  },
})

// ── Admin: bulk upload + approve+assign ───────────────────────────────────────

/**
 * Called by scripts/audio-pipeline/upload.ts — uses SEED_SECRET env var for
 * auth instead of Clerk (CLI scripts can't do headless Clerk auth).
 * Creates one pending audioTrack per file; deduplicates by r2Key.
 */
export const createAudioTrackBulk = mutation({
  args: {
    bulkSecret: v.string(),
    originalFilename: v.string(),
    type: v.union(v.literal("music"), v.literal("ambience")),
    r2Key: v.string(),
    r2Url: v.string(),
    duration: v.number(),
    tier: v.optional(v.union(v.literal("free"), v.literal("premium"))),
  },
  handler: async (ctx, args) => {
    if (args.bulkSecret !== process.env.SEED_SECRET) throw new Error("Unauthorized")

    // Dedup by r2Key — skip if this file was already uploaded
    const existing = await ctx.db
      .query("audioTracks")
      .withIndex("by_r2Key", (q) => q.eq("r2Key", args.r2Key))
      .unique()
    if (existing) return { id: existing._id, skipped: true }

    const id = await ctx.db.insert("audioTracks", {
      name: args.originalFilename,
      originalFilename: args.originalFilename,
      type: args.type,
      intensityTier: null,
      r2Key: args.r2Key,
      r2Url: args.r2Url,
      duration: args.duration,
      tier: args.tier ?? "free",
      status: "pending",
      approved: false,
      uploadedBy: "bulk-upload",
      createdAt: Date.now(),
    })
    return { id, skipped: false }
  },
})

/**
 * Combined approve + variant-assign for music tracks.
 * Each stem slot is one variant: (sceneName, mode, instrument, intensity).
 * Inserts are SERIALIZED (not Promise.all) so uniqueness checks earlier in the
 * loop are visible to later iterations — avoids two slots in one call racing
 * past validation onto the same (scene, mode, instrument, intensity).
 */
export const approveAndAssignStems = mutation({
  args: {
    trackId: v.id("audioTracks"),
    tier: v.union(v.literal("free"), v.literal("premium")),
    stems: v.array(
      v.object({
        sceneName: v.string(),
        mode: v.union(
          v.literal("explore"),
          v.literal("combat"),
          v.literal("victory"),
        ),
        instrument: v.string(),
        intensity: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const me = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.tokenIdentifier))
      .unique()
    if (!me || me.role !== "admin") throw new Error("Not authorized")

    const track = await ctx.db.get(args.trackId)
    if (!track) throw new Error("Track not found")
    if (track.type !== "music") throw new Error("approveAndAssignStems is for music tracks only")
    if (args.stems.length === 0) throw new Error("At least one stem slot is required")

    // Validate each slot first (cheap, no DB writes)
    for (const stem of args.stems) {
      if (!Number.isInteger(stem.intensity) || stem.intensity < 1 || stem.intensity > 5)
        throw new Error(`Invalid intensity (must be integer 1–5): ${stem.intensity}`)
      if (stem.instrument.trim() === "")
        throw new Error("instrument is required for every slot")
    }

    // Detect duplicates within this single submission
    const slotKeys = new Set<string>()
    for (const stem of args.stems) {
      const key = `${stem.sceneName}|${stem.mode}|${stem.instrument}|${stem.intensity}`
      if (slotKeys.has(key)) {
        throw new Error(
          `Duplicate slot in submission: ${stem.sceneName}/${stem.mode}/${stem.instrument} @${stem.intensity}`,
        )
      }
      slotKeys.add(key)
    }

    // Approve the track
    await ctx.db.patch(args.trackId, {
      status: "approved",
      approved: true,
      tier: args.tier,
      approvedAt: Date.now(),
      approvedBy: identity.tokenIdentifier,
    })

    // Insert each variant — serialized so collision checks see prior inserts
    for (const stem of args.stems) {
      const taken = await isSlotTaken(ctx, {
        campaignId: undefined,
        sceneName: stem.sceneName,
        mode: stem.mode,
        instrument: stem.instrument,
        intensity: stem.intensity,
      })
      if (taken) {
        throw new Error(
          `Slot already exists for ${stem.sceneName}/${stem.mode}/${stem.instrument} @${stem.intensity}`,
        )
      }
      await ctx.db.insert("musicStems", {
        userId: identity.tokenIdentifier,
        campaignId: undefined, // global — not campaign-scoped
        sceneName: stem.sceneName,
        mode: stem.mode,
        instrument: stem.instrument,
        intensity: stem.intensity,
        trackId: args.trackId,
        sortOrder: stem.intensity,
        createdAt: Date.now(),
      })
    }
  },
})

