import { mutation, query } from "./_generated/server"
import type { Doc } from "./_generated/dataModel"
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

export const insertMusicSetLibrarySeed = mutation({
  args: {
    seedSecret: v.string(),
    name: v.string(),
    intensityTier: v.union(v.literal("explore"), v.literal("combat")),
    lowTrackId: v.id("audioTracks"),
    medTrackId: v.id("audioTracks"),
    highTrackId: v.id("audioTracks"),
    sceneTag: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    if (args.seedSecret !== process.env.SEED_SECRET) throw new Error("Unauthorized")
    const { seedSecret, ...setData } = args
    const existing = await ctx.db
      .query("musicSetLibrary")
      .filter((q) => q.eq(q.field("name"), setData.name))
      .unique()
    if (existing) {
      await ctx.db.patch(existing._id, {
        lowTrackId: setData.lowTrackId,
        medTrackId: setData.medTrackId,
        highTrackId: setData.highTrackId,
      })
      return existing._id
    }
    return await ctx.db.insert("musicSetLibrary", {
      ...setData,
      tier: "free",
      approved: true,
      uploadedBy: "seed",
      createdAt: Date.now(),
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

// ── Music Set Library + Scene Music Sets ─────────────────────────────────────

export const listMusicSetLibrary = query({
  args: {
    intensityTier: v.optional(v.union(v.literal("explore"), v.literal("combat"))),
  },
  handler: async (ctx, args) => {
    if (args.intensityTier) {
      return ctx.db
        .query("musicSetLibrary")
        .withIndex("by_intensityTier", (idx) => idx.eq("intensityTier", args.intensityTier!))
        .collect()
    }
    return ctx.db.query("musicSetLibrary").collect()
  },
})

export const getSceneMusicSet = query({
  args: {
    campaignId: v.id("campaigns"),
    sceneName: v.string(),
    mode: v.union(v.literal("explore"), v.literal("combat"), v.literal("victory")),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("sceneMusicSets")
      .withIndex("by_campaignId_sceneName_and_mode", (idx) =>
        idx.eq("campaignId", args.campaignId).eq("sceneName", args.sceneName).eq("mode", args.mode)
      )
      .unique()
  },
})

export const listSceneMusicSets = query({
  args: {
    campaignId: v.id("campaigns"),
    sceneName: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("sceneMusicSets")
      .withIndex("by_campaignId_and_sceneName", (idx) =>
        idx.eq("campaignId", args.campaignId).eq("sceneName", args.sceneName)
      )
      .collect()
  },
})

export const upsertSceneMusicSet = mutation({
  args: {
    campaignId: v.id("campaigns"),
    sceneName: v.string(),
    mode: v.union(v.literal("explore"), v.literal("combat"), v.literal("victory")),
    musicSetLibraryId: v.optional(v.id("musicSetLibrary")),
    lowTrackId: v.optional(v.id("audioTracks")),
    medTrackId: v.optional(v.id("audioTracks")),
    highTrackId: v.optional(v.id("audioTracks")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const existing = await ctx.db
      .query("sceneMusicSets")
      .withIndex("by_campaignId_sceneName_and_mode", (idx) =>
        idx.eq("campaignId", args.campaignId).eq("sceneName", args.sceneName).eq("mode", args.mode)
      )
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, {
        musicSetLibraryId: args.musicSetLibraryId,
        lowTrackId: args.lowTrackId,
        medTrackId: args.medTrackId,
        highTrackId: args.highTrackId,
      })
      return existing._id
    }

    return ctx.db.insert("sceneMusicSets", {
      userId: identity.tokenIdentifier,
      campaignId: args.campaignId,
      sceneName: args.sceneName,
      mode: args.mode,
      musicSetLibraryId: args.musicSetLibraryId,
      lowTrackId: args.lowTrackId,
      medTrackId: args.medTrackId,
      highTrackId: args.highTrackId,
      createdAt: Date.now(),
    })
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

export const createMusicStem = mutation({
  args: {
    campaignId: v.id("campaigns"),
    sceneName: v.string(),
    mode: v.union(v.literal("explore"), v.literal("combat"), v.literal("victory")),
    name: v.string(),
    trackId: v.id("audioTracks"),
    intensityMin: v.number(),
    intensityMax: v.number(),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    if (args.intensityMin < 1 || args.intensityMin > 5 || args.intensityMax < 1 || args.intensityMax > 5) {
      throw new Error("intensityMin and intensityMax must be between 1 and 5")
    }
    if (args.intensityMin > args.intensityMax) {
      throw new Error("intensityMin must be <= intensityMax")
    }

    const track = await ctx.db.get(args.trackId)
    if (!track) throw new Error("Track not found")

    return ctx.db.insert("musicStems", {
      userId: identity.tokenIdentifier,
      campaignId: args.campaignId,
      sceneName: args.sceneName,
      mode: args.mode,
      name: args.name,
      trackId: args.trackId,
      intensityMin: args.intensityMin,
      intensityMax: args.intensityMax,
      sortOrder: args.sortOrder,
      createdAt: Date.now(),
    })
  },
})

export const updateMusicStem = mutation({
  args: {
    stemId: v.id("musicStems"),
    name: v.optional(v.string()),
    trackId: v.optional(v.id("audioTracks")),
    intensityMin: v.optional(v.number()),
    intensityMax: v.optional(v.number()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const stem = await ctx.db.get(args.stemId)
    if (!stem) throw new Error("Stem not found")
    if (stem.userId !== identity.tokenIdentifier) throw new Error("Not authorized")

    if (args.intensityMin !== undefined || args.intensityMax !== undefined) {
      const nextMin = args.intensityMin ?? stem.intensityMin
      const nextMax = args.intensityMax ?? stem.intensityMax
      if (nextMin < 1 || nextMin > 5 || nextMax < 1 || nextMax > 5) {
        throw new Error("intensityMin and intensityMax must be between 1 and 5")
      }
      if (nextMin > nextMax) throw new Error("intensityMin must be <= intensityMax")
    }

    if (args.trackId !== undefined) {
      const track = await ctx.db.get(args.trackId)
      if (!track) throw new Error("Track not found")
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

