import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import type { Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"

// ── World Map: campaign-scoped, Player/DM-gated ──────────────────────────────
// Per docs/specs/feyforge-world-map-spec.md. Mirrors the wiki.ts Player/DM
// pattern: membership-gated reads (DM sees all, players see revealed only),
// DM-only writes, a setRevealed primitive. Presets are global template rows
// (campaignId undefined) that adoptPreset clones into a campaign so reveal
// state is always per-campaign.
//
// Replaces the legacy user-scoped convex/world.ts (now deleted).

const locationType = v.union(
  v.literal("settlement"),
  v.literal("poi"),
  v.literal("natural"),
  v.literal("water"),
  v.literal("region"),
)

async function getMembership(ctx: QueryCtx | MutationCtx, campaignId: Id<"campaigns">) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null
  const member = await ctx.db
    .query("campaignMembers")
    .withIndex("by_campaignId_and_userId", (q) =>
      q.eq("campaignId", campaignId).eq("userId", identity.tokenIdentifier)
    )
    .first()
  return member ? { member, userId: identity.tokenIdentifier } : null
}

// Throws unless the caller is the DM of this campaign; returns their userId.
async function requireDm(ctx: MutationCtx, campaignId: Id<"campaigns">): Promise<string> {
  const m = await getMembership(ctx, campaignId)
  if (!m || m.member.role !== "dm") throw new Error("Only the DM can edit the world map")
  return m.userId
}

// ── Map (one active map per campaign) ────────────────────────────────────────

export const getMap = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const m = await getMembership(ctx, args.campaignId)
    if (!m) return null
    return await ctx.db
      .query("worldMaps")
      .withIndex("by_campaignId", (q) => q.eq("campaignId", args.campaignId))
      .first()
  },
})

// DM creates or replaces their campaign's map from an uploaded R2 image.
// One active map per campaign — replacing drops the old map + its locations.
export const setCampaignMap = mutation({
  args: {
    campaignId: v.id("campaigns"),
    name: v.optional(v.string()),
    imageStorageKey: v.string(),
    width: v.number(),
    height: v.number(),
    scaleMilesPerPx: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Id<"worldMaps">> => {
    const userId = await requireDm(ctx, args.campaignId)

    const existingMaps = await ctx.db
      .query("worldMaps")
      .withIndex("by_campaignId", (q) => q.eq("campaignId", args.campaignId))
      .collect()
    for (const m of existingMaps) {
      const locs = await ctx.db
        .query("mapLocations")
        .withIndex("by_worldMap", (q) => q.eq("worldMapId", m._id))
        .collect()
      for (const loc of locs) await ctx.db.delete(loc._id)
      await ctx.db.delete(m._id)
    }

    return await ctx.db.insert("worldMaps", {
      campaignId: args.campaignId,
      name: args.name ?? "World Map",
      imageStorageKey: args.imageStorageKey,
      width: args.width,
      height: args.height,
      scaleMilesPerPx: args.scaleMilesPerPx,
      source: "upload",
      createdBy: userId,
      updatedAt: Date.now(),
    })
  },
})

// Update only the campaign map's metadata (name, scale) without replacing it.
export const updateCampaignMap = mutation({
  args: {
    campaignId: v.id("campaigns"),
    name: v.optional(v.string()),
    scaleMilesPerPx: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireDm(ctx, args.campaignId)
    const map = await ctx.db
      .query("worldMaps")
      .withIndex("by_campaignId", (q) => q.eq("campaignId", args.campaignId))
      .first()
    if (!map) throw new Error("No map to update")
    const patch: Record<string, unknown> = { updatedAt: Date.now() }
    if (args.name !== undefined) patch.name = args.name
    if (args.scaleMilesPerPx !== undefined) patch.scaleMilesPerPx = args.scaleMilesPerPx
    await ctx.db.patch(map._id, patch)
  },
})

// ── Presets (global templates) ───────────────────────────────────────────────
// Readable by any authenticated user so the free-tier picker can list them.

export const listPresets = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []
    return await ctx.db
      .query("worldMaps")
      .withIndex("by_source", (q) => q.eq("source", "preset"))
      .collect()
  },
})

// Adopt a preset into a campaign: clone the map row + all its locations so the
// campaign gets independent, all-hidden reveal state. DM-only. Replaces any
// existing campaign map (one active map per campaign).
export const adoptPreset = mutation({
  args: { campaignId: v.id("campaigns"), presetId: v.id("worldMaps") },
  handler: async (ctx, args): Promise<Id<"worldMaps">> => {
    const userId = await requireDm(ctx, args.campaignId)

    const preset = await ctx.db.get(args.presetId)
    if (!preset || preset.source !== "preset") throw new Error("Preset not found")

    // Remove any current campaign map + its locations first.
    const existingMaps = await ctx.db
      .query("worldMaps")
      .withIndex("by_campaignId", (q) => q.eq("campaignId", args.campaignId))
      .collect()
    for (const m of existingMaps) {
      const locs = await ctx.db
        .query("mapLocations")
        .withIndex("by_worldMap", (q) => q.eq("worldMapId", m._id))
        .collect()
      for (const loc of locs) await ctx.db.delete(loc._id)
      await ctx.db.delete(m._id)
    }

    // Clone the preset map row into the campaign.
    const newMapId = await ctx.db.insert("worldMaps", {
      campaignId: args.campaignId,
      name: preset.name,
      imageStorageKey: preset.imageStorageKey,
      width: preset.width,
      height: preset.height,
      scaleMilesPerPx: preset.scaleMilesPerPx,
      source: "preset",
      presetSourceId: preset._id,
      createdBy: userId,
      updatedAt: Date.now(),
    })

    // Clone the preset's locations, hidden by default.
    const presetLocations = await ctx.db
      .query("mapLocations")
      .withIndex("by_worldMap", (q) => q.eq("worldMapId", preset._id))
      .collect()
    for (const loc of presetLocations) {
      await ctx.db.insert("mapLocations", {
        worldMapId: newMapId,
        campaignId: args.campaignId,
        type: loc.type,
        name: loc.name,
        x: loc.x,
        y: loc.y,
        revealed: false,
        dmNotes: loc.dmNotes,
        playerNotes: loc.playerNotes,
        createdBy: userId,
      })
    }

    return newMapId
  },
})

// Promote a campaign's map (+ its locations, as templates) to a global preset.
// Admin-only — presets ship to the free tier, so this is curation, not DM authoring.
// Cloned locations keep their notes but reset reveal state (presets are templates).
export const saveAsPreset = mutation({
  args: {
    campaignId: v.id("campaigns"),
    presetName: v.string(),
    isPremiumPreset: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Id<"worldMaps">> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.tokenIdentifier))
      .first()
    if (user?.role !== "admin") throw new Error("Only admins can publish presets")

    const map = await ctx.db
      .query("worldMaps")
      .withIndex("by_campaignId", (q) => q.eq("campaignId", args.campaignId))
      .first()
    if (!map) throw new Error("No campaign map to publish")

    const presetId = await ctx.db.insert("worldMaps", {
      campaignId: undefined,
      name: args.presetName,
      imageStorageKey: map.imageStorageKey,
      width: map.width,
      height: map.height,
      scaleMilesPerPx: map.scaleMilesPerPx,
      source: "preset",
      isPremiumPreset: args.isPremiumPreset ?? false,
      createdBy: identity.tokenIdentifier,
      updatedAt: Date.now(),
    })

    const locations = await ctx.db
      .query("mapLocations")
      .withIndex("by_worldMap", (q) => q.eq("worldMapId", map._id))
      .collect()
    for (const loc of locations) {
      await ctx.db.insert("mapLocations", {
        worldMapId: presetId,
        campaignId: undefined,
        type: loc.type,
        name: loc.name,
        x: loc.x,
        y: loc.y,
        revealed: false,
        dmNotes: loc.dmNotes,
        playerNotes: loc.playerNotes,
        createdBy: identity.tokenIdentifier,
      })
    }

    return presetId
  },
})

// ── Locations (pins) ──────────────────────────────────────────────────────────
// DM sees every location; players see only revealed ones. Non-members see none.

export const listLocations = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const m = await getMembership(ctx, args.campaignId)
    if (!m) return []
    const locations = await ctx.db
      .query("mapLocations")
      .withIndex("by_campaignId", (q) => q.eq("campaignId", args.campaignId))
      .collect()
    const visible = m.member.role === "dm" ? locations : locations.filter((l) => l.revealed === true)
    // Players never receive dmNotes — strip server-side so it isn't on the wire.
    const sanitized =
      m.member.role === "dm" ? visible : visible.map(({ dmNotes: _dm, ...rest }) => rest)
    return sanitized.sort((a, b) => a.name.localeCompare(b.name))
  },
})

export const createLocation = mutation({
  args: {
    campaignId: v.id("campaigns"),
    worldMapId: v.id("worldMaps"),
    type: locationType,
    name: v.string(),
    x: v.number(),
    y: v.number(),
    dmNotes: v.optional(v.string()),
    playerNotes: v.optional(v.string()),
    revealed: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Id<"mapLocations">> => {
    const userId = await requireDm(ctx, args.campaignId)
    return await ctx.db.insert("mapLocations", {
      worldMapId: args.worldMapId,
      campaignId: args.campaignId,
      type: args.type,
      name: args.name,
      x: args.x,
      y: args.y,
      revealed: args.revealed ?? false,
      dmNotes: args.dmNotes,
      playerNotes: args.playerNotes,
      createdBy: userId,
    })
  },
})

export const updateLocation = mutation({
  args: {
    locationId: v.id("mapLocations"),
    type: v.optional(locationType),
    name: v.optional(v.string()),
    x: v.optional(v.number()),
    y: v.optional(v.number()),
    dmNotes: v.optional(v.string()),
    playerNotes: v.optional(v.string()),
    drillDownMapId: v.optional(v.id("worldMaps")),
  },
  handler: async (ctx, args) => {
    const loc = await ctx.db.get(args.locationId)
    if (!loc) throw new Error("Location not found")
    if (!loc.campaignId) throw new Error("Location is not campaign-scoped")
    await requireDm(ctx, loc.campaignId)

    const patch: Record<string, unknown> = {}
    if (args.type !== undefined) patch.type = args.type
    if (args.name !== undefined) patch.name = args.name
    if (args.x !== undefined) patch.x = args.x
    if (args.y !== undefined) patch.y = args.y
    if (args.dmNotes !== undefined) patch.dmNotes = args.dmNotes
    if (args.playerNotes !== undefined) patch.playerNotes = args.playerNotes
    if (args.drillDownMapId !== undefined) patch.drillDownMapId = args.drillDownMapId
    await ctx.db.patch(args.locationId, patch)
  },
})

// The player/DM reveal primitive: flip whether players can see this location.
export const setRevealed = mutation({
  args: { locationId: v.id("mapLocations"), revealed: v.boolean() },
  handler: async (ctx, args) => {
    const loc = await ctx.db.get(args.locationId)
    if (!loc) throw new Error("Location not found")
    if (!loc.campaignId) throw new Error("Location is not campaign-scoped")
    await requireDm(ctx, loc.campaignId)
    await ctx.db.patch(args.locationId, { revealed: args.revealed })
  },
})

export const removeLocation = mutation({
  args: { locationId: v.id("mapLocations") },
  handler: async (ctx, args) => {
    const loc = await ctx.db.get(args.locationId)
    if (!loc) return
    if (!loc.campaignId) throw new Error("Location is not campaign-scoped")
    await requireDm(ctx, loc.campaignId)
    await ctx.db.delete(args.locationId)
  },
})
