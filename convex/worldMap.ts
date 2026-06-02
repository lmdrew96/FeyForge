import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import type { Id } from "./_generated/dataModel"
import type { MutationCtx } from "./_generated/server"
import { getMembership, requireDm as requireCampaignDm } from "./lib/auth"

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

// POI subtype (mirrors PoiKind in lib/worldMap/azgaar-map.ts + the mapLocations
// schema). Set at import from the Azgaar marker type; drives the pin icon + action.
const poiKindV = v.union(
  v.literal("dungeon"),
  v.literal("ruin"),
  v.literal("monster"),
  v.literal("encounter"),
  v.literal("tavern"),
  v.literal("landmark"),
)

// Settlement gazetteer block (mirrors TownMeta in lib/worldMap/azgaar-map.ts + the
// mapLocations schema). Display-only, non-secret; threaded through every pin-write
// path. ⚠️ Must stay on BOTH location-array validators or a reseed/import THROWS.
const townV = v.object({
  population: v.optional(v.number()),
  coa: v.optional(v.string()),
  realm: v.optional(v.string()),
  government: v.optional(v.string()),
  culture: v.optional(v.string()),
  features: v.optional(v.array(v.string())),
})

// Named active world events (Azgaar zones). World-level, DM-only — getMap strips
// it for non-DM members. Mirrors ZoneInfo in lib/worldMap/azgaar-map.ts.
// An event's affected settlement — a full pin payload so the DM can mint a real
// pin from it ("+ add to map"); a non-preset town exists nowhere else in Convex.
const eventPlaceV = v.object({
  name: v.string(),
  x: v.number(),
  y: v.number(),
  drillDownUrl: v.optional(v.string()),
  town: v.optional(townV),
})
const worldEventsV = v.array(
  v.object({
    name: v.string(),
    type: v.string(),
    places: v.optional(v.array(eventPlaceV)),
  }),
)

// Premium-picker vibe validators (mirror lib/worldMap/vibe.ts + the worldMaps
// schema). Shared by seedPreset (writes them) and listPremiumPresets (filters).
const vibeShapeV = v.union(
  v.literal("archipelago"),
  v.literal("scattered"),
  v.literal("continents"),
  v.literal("pangaea"),
)
const vibeClimateV = v.union(
  v.literal("frozen"),
  v.literal("temperate"),
  v.literal("arid"),
  v.literal("tropical"),
)
const vibeCivilizationV = v.union(v.literal("wild"), v.literal("settled"), v.literal("crowded"))
const vibeScaleV = v.union(v.literal("region"), v.literal("world"))

// Membership/role helpers live in ./lib/auth (shared with wiki, liveSessions,
// etc.). World-map writes are DM-only; this local alias supplies the world-map
// error message so every call site stays unchanged.
const requireDm = (ctx: MutationCtx, campaignId: Id<"campaigns">) =>
  requireCampaignDm(ctx, campaignId, "Only the DM can edit the world map")

// Pin-density caps. Free tier tops out at MANY; "a bunch"/"mega" are premium.
// Hard ceiling MAX_PINS so a preset never floods a campaign (or the DM map).
const FREE_MAX_PINS = 40
const MAX_PINS = 100

// Deterministic per-campaign pin selection. We seed a tiny PRNG from
// campaignId+presetId so a given campaign always gets the SAME world (re-adopt
// is reproducible, and bumping density only ADDS pins), while different
// campaigns get different subsets of the same preset.
function seedFromString(s: string): number {
  let h = 1779033703 ^ s.length
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return h >>> 0
}
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── Map (one active map per campaign) ────────────────────────────────────────

export const getMap = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const m = await getMembership(ctx, args.campaignId)
    if (!m) return null
    const map = await ctx.db
      .query("worldMaps")
      .withIndex("by_campaignId", (q) => q.eq("campaignId", args.campaignId))
      .first()
    if (!map) return null
    // World events are DM plot — strip them for players (a brewing invasion isn't
    // common knowledge). Everything else on the row is player-safe (image, fog,
    // scale). Set to undefined (not omit) so the return type stays a clean Doc and
    // the array still never reaches the player's wire.
    if (m.member.role !== "dm") return { ...map, worldEvents: undefined }
    return map
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

// Premium import: replace the campaign map with a DM's OWN Azgaar world, pins
// included. The browser parses the .map (dodging Vercel's 4.5MB body cap) and
// sends the already-normalized locations here. Premium/admin only — enforced
// server-side, mirroring the upload route + adoptPreset's tier gate.
export const setCampaignMapWithPins = mutation({
  args: {
    campaignId: v.id("campaigns"),
    name: v.optional(v.string()),
    imageStorageKey: v.string(),
    width: v.number(),
    height: v.number(),
    scaleMilesPerPx: v.optional(v.number()),
    locations: v.array(
      v.object({
        type: locationType,
        name: v.string(),
        x: v.number(),
        y: v.number(),
        dmNotes: v.optional(v.string()),
        drillDownUrl: v.optional(v.string()),
        poiKind: v.optional(poiKindV),
        town: v.optional(townV),
        prominence: v.optional(v.number()),
      }),
    ),
    worldEvents: v.optional(worldEventsV),
  },
  handler: async (ctx, args): Promise<Id<"worldMaps">> => {
    const userId = await requireDm(ctx, args.campaignId)

    const identity = await ctx.auth.getUserIdentity()
    const user = identity
      ? await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.tokenIdentifier))
          .unique()
      : null
    const isPremium = !!user && (user.isPremium || user.role === "admin")
    if (!isPremium) throw new Error("Importing your own world is a premium feature.")

    // Replace any existing campaign map + its locations (one active map per campaign).
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

    const newMapId = await ctx.db.insert("worldMaps", {
      campaignId: args.campaignId,
      name: args.name ?? "World Map",
      imageStorageKey: args.imageStorageKey,
      width: args.width,
      height: args.height,
      scaleMilesPerPx: args.scaleMilesPerPx,
      source: "import",
      worldEvents: args.worldEvents,
      createdBy: userId,
      updatedAt: Date.now(),
    })

    // Hard-cap server-side (the client trims too, but never trust it) so an import
    // can't flood the campaign — or the DM map — past the render ceiling.
    const capped = args.locations.slice(0, MAX_PINS)
    for (const loc of capped) {
      await ctx.db.insert("mapLocations", {
        worldMapId: newMapId,
        campaignId: args.campaignId,
        type: loc.type,
        name: loc.name,
        x: loc.x,
        y: loc.y,
        revealed: false,
        dmNotes: loc.dmNotes,
        drillDownUrl: loc.drillDownUrl,
        poiKind: loc.poiKind,
        town: loc.town,
        prominence: loc.prominence,
        createdBy: userId,
      })
    }

    return newMapId
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

// Fog of war settings on the campaign map. DM-only. Affects the player view only
// (DM always sees the full map). fogEnabled toggles the shroud; fogRevealRadius
// is the clearing radius as a % of the map's shorter side. Radius is clamped to
// FOG_MIN_RADIUS–FOG_MAX_RADIUS so a clearing is never too tight to read the
// settlement under it. Auto-clearings track the existing per-pin reveal state, so
// there's no new reveal primitive here — see worldMap.setRevealed.
const FOG_MIN_RADIUS = 5
const FOG_MAX_RADIUS = 30
export const setFogSettings = mutation({
  args: {
    campaignId: v.id("campaigns"),
    fogEnabled: v.optional(v.boolean()),
    fogRevealRadius: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireDm(ctx, args.campaignId)
    const map = await ctx.db
      .query("worldMaps")
      .withIndex("by_campaignId", (q) => q.eq("campaignId", args.campaignId))
      .first()
    if (!map) throw new Error("No map to update")
    const patch: Record<string, unknown> = { updatedAt: Date.now() }
    if (args.fogEnabled !== undefined) patch.fogEnabled = args.fogEnabled
    if (args.fogRevealRadius !== undefined) {
      patch.fogRevealRadius = Math.max(
        FOG_MIN_RADIUS,
        Math.min(FOG_MAX_RADIUS, args.fogRevealRadius),
      )
    }
    await ctx.db.patch(map._id, patch)
  },
})

// Manual fog brush (Phase 2). DM-only. Stores the painted-open mask on the
// campaign map row; it ships to every member via getMap, so cap the length
// (a well-formed 64×36 base64 bitmask is ~384 chars) to stop a client bug from
// parking a huge blob that fans out to all players. Empty string clears it.
const FOG_MASK_MAX_LEN = 1024
export const paintFog = mutation({
  args: {
    campaignId: v.id("campaigns"),
    fogMask: v.string(),
  },
  handler: async (ctx, args) => {
    await requireDm(ctx, args.campaignId)
    if (args.fogMask.length > FOG_MASK_MAX_LEN) {
      throw new Error("Fog mask too large")
    }
    const map = await ctx.db
      .query("worldMaps")
      .withIndex("by_campaignId", (q) => q.eq("campaignId", args.campaignId))
      .first()
    if (!map) throw new Error("No map to update")
    await ctx.db.patch(map._id, {
      fogMask: args.fogMask === "" ? undefined : args.fogMask,
      updatedAt: Date.now(),
    })
  },
})

// ── Presets (global templates) ───────────────────────────────────────────────
// Readable by any authenticated user so the free-tier picker can list them.

export const listPresets = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []
    // Only GLOBAL presets (campaignId undefined). Adopted campaign maps also carry
    // source:"preset" (so reveal-cloning works), so without this filter a campaign's
    // own map shows up as a duplicate "preset" in the picker.
    const presets = await ctx.db
      .query("worldMaps")
      .withIndex("by_source", (q) => q.eq("source", "preset"))
      .collect()
    return presets.filter((m) => m.campaignId === undefined)
  },
})

// The premium "vibe" library: global source:"premium-preset" rows, optionally
// filtered by any of the 4 vibe axes (undefined = "any" on that axis). ~120 rows,
// so we scan the by_source bucket and filter in memory (no vibe index). Listing
// is open to any authenticated user (it's just template metadata + public R2
// images); ADOPTION is the gated action (see adoptPreset). The picker renders
// this only for premium/admin DMs.
export const listPremiumPresets = query({
  args: {
    vibeShape: v.optional(vibeShapeV),
    vibeClimate: v.optional(vibeClimateV),
    vibeCivilization: v.optional(vibeCivilizationV),
    vibeScale: v.optional(vibeScaleV),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []
    const rows = await ctx.db
      .query("worldMaps")
      .withIndex("by_source", (q) => q.eq("source", "premium-preset"))
      .collect()
    return rows.filter(
      (m) =>
        m.campaignId === undefined &&
        (args.vibeShape === undefined || m.vibeShape === args.vibeShape) &&
        (args.vibeClimate === undefined || m.vibeClimate === args.vibeClimate) &&
        (args.vibeCivilization === undefined || m.vibeCivilization === args.vibeCivilization) &&
        (args.vibeScale === undefined || m.vibeScale === args.vibeScale),
    )
  },
})

// Adopt a preset into a campaign: clone the map row + a per-campaign random
// subset of its locations (campaign gets independent, all-hidden reveal state).
// DM-only. Replaces any existing campaign map (one active map per campaign).
// `limit` is the pin-density cap: free tier ≤ FREE_MAX_PINS; larger needs premium.
export const adoptPreset = mutation({
  args: {
    campaignId: v.id("campaigns"),
    presetId: v.id("worldMaps"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Id<"worldMaps">> => {
    const userId = await requireDm(ctx, args.campaignId)

    // Must be a GLOBAL preset (free OR premium-library) — never a campaign-scoped
    // map (adopting one onto itself would delete its own locations before the
    // clone reads them → 0 pins).
    const preset = await ctx.db.get(args.presetId)
    if (
      !preset ||
      (preset.source !== "preset" && preset.source !== "premium-preset") ||
      preset.campaignId !== undefined
    ) {
      throw new Error("Preset not found")
    }

    // Resolve the density cap, then gate server-side (the UI hides these too, but
    // never trust the client for entitlement). TWO premium triggers:
    //   1. a large density tier (> FREE_MAX_PINS), OR
    //   2. a premium-library map — adopting one is itself a premium action, so
    //      gate it even at ≤ FREE_MAX_PINS (the gate isn't only about pin count).
    const limit = Math.max(1, Math.min(MAX_PINS, Math.round(args.limit ?? FREE_MAX_PINS)))
    const needsPremium = limit > FREE_MAX_PINS || preset.source === "premium-preset"
    if (needsPremium) {
      const identity = await ctx.auth.getUserIdentity()
      const user = identity
        ? await ctx.db
            .query("users")
            .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.tokenIdentifier))
            .unique()
        : null
      const isPremium = !!user && (user.isPremium || user.role === "admin")
      if (!isPremium) {
        throw new Error(
          preset.source === "premium-preset"
            ? "Premium worlds are a premium feature."
            : "Larger maps are a premium feature.",
        )
      }
    }

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
      worldEvents: preset.worldEvents,
      createdBy: userId,
      updatedAt: Date.now(),
    })

    // Pick which pins this campaign gets: weighted-random without replacement
    // (Efraimidis–Spirakis: key = u^(1/weight), keep the largest), weight =
    // prominence so capitals/POIs are favored but the set still varies per
    // campaign. Seeded by campaignId+presetId → reproducible, and a bigger
    // `limit` is a superset of a smaller one (bumping density adds pins).
    const presetLocations = await ctx.db
      .query("mapLocations")
      .withIndex("by_worldMap", (q) => q.eq("worldMapId", preset._id))
      .collect()
    const rng = mulberry32(seedFromString(`${args.campaignId}:${args.presetId}`))
    const chosen = presetLocations
      .map((loc) => {
        const weight = Math.max(loc.prominence ?? 1, 0.0001)
        return { loc, key: Math.pow(rng(), 1 / weight) }
      })
      .sort((a, b) => b.key - a.key)
      .slice(0, limit)
      .map((entry) => entry.loc)

    for (const loc of chosen) {
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
        // Carry the preset pin's local map + MFCG city link so free-tier drill-down works.
        drillDownImageKey: loc.drillDownImageKey,
        drillDownUrl: loc.drillDownUrl,
        poiKind: loc.poiKind,
        town: loc.town,
        prominence: loc.prominence,
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
      worldEvents: map.worldEvents,
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
        // Preserve local maps + MFCG city links when promoting a campaign map to a preset.
        drillDownImageKey: loc.drillDownImageKey,
        drillDownUrl: loc.drillDownUrl,
        poiKind: loc.poiKind,
        town: loc.town,
        createdBy: identity.tokenIdentifier,
      })
    }

    return presetId
  },
})

// Seed (or re-seed) a global preset from a parsed Azgaar export. Called by
// scripts/seed-presets.ts — uses SEED_SECRET instead of Clerk auth (CLI scripts
// can't do headless Clerk auth; same pattern as audio.createAudioTrackBulk).
// The image is already in R2 by the time this runs; we store the key only.
// UPSERT by imageStorageKey: if this preset already exists it's deleted (row +
// its locations) and rebuilt, so re-running the script retunes presets in place.
// Already-adopted campaigns are independent clones and are unaffected.
export const seedPreset = mutation({
  args: {
    seedSecret: v.string(),
    name: v.string(),
    imageStorageKey: v.string(),
    width: v.number(),
    height: v.number(),
    scaleMilesPerPx: v.optional(v.number()),
    isPremiumPreset: v.optional(v.boolean()),
    // All 4 present ⇒ a premium-library map (source:"premium-preset"); absent ⇒
    // a free starter preset (source:"preset"). See scripts/bake-presets.ts.
    vibeShape: v.optional(vibeShapeV),
    vibeClimate: v.optional(vibeClimateV),
    vibeCivilization: v.optional(vibeCivilizationV),
    vibeScale: v.optional(vibeScaleV),
    locations: v.array(
      v.object({
        type: locationType,
        name: v.string(),
        x: v.number(),
        y: v.number(),
        dmNotes: v.optional(v.string()),
        drillDownImageKey: v.optional(v.string()),
        drillDownUrl: v.optional(v.string()),
        poiKind: v.optional(poiKindV),
        town: v.optional(townV),
        prominence: v.optional(v.number()),
      }),
    ),
    worldEvents: v.optional(worldEventsV),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ mapId: Id<"worldMaps">; replaced: boolean; locationCount: number }> => {
    if (args.seedSecret !== process.env.SEED_SECRET) throw new Error("Unauthorized")

    // A fully-tagged map seeds into the premium library; otherwise it's a free
    // starter preset. The source determines BOTH which bucket we upsert into and
    // which we write — they must match or a premium re-seed would scan "preset",
    // find nothing, and orphan the old premium row.
    const isPremiumLib = !!(
      args.vibeShape &&
      args.vibeClimate &&
      args.vibeCivilization &&
      args.vibeScale
    )
    const source = isPremiumLib ? "premium-preset" : "preset"

    // Upsert by imageStorageKey WITHIN that source bucket — drop any existing row
    // (+ its locations) so re-running the bake/seed retunes in place.
    const sameSource = await ctx.db
      .query("worldMaps")
      .withIndex("by_source", (q) => q.eq("source", source))
      .collect()
    const existing = sameSource.find((m) => m.imageStorageKey === args.imageStorageKey)
    if (existing) {
      const oldLocs = await ctx.db
        .query("mapLocations")
        .withIndex("by_worldMap", (q) => q.eq("worldMapId", existing._id))
        .collect()
      for (const loc of oldLocs) await ctx.db.delete(loc._id)
      await ctx.db.delete(existing._id)
    }

    const mapId = await ctx.db.insert("worldMaps", {
      campaignId: undefined,
      name: args.name,
      imageStorageKey: args.imageStorageKey,
      width: args.width,
      height: args.height,
      scaleMilesPerPx: args.scaleMilesPerPx,
      source,
      isPremiumPreset: args.isPremiumPreset ?? isPremiumLib,
      vibeShape: args.vibeShape,
      vibeClimate: args.vibeClimate,
      vibeCivilization: args.vibeCivilization,
      vibeScale: args.vibeScale,
      worldEvents: args.worldEvents,
      createdBy: "seed-script",
      updatedAt: Date.now(),
    })

    // Locations are template pins: always hidden (revealed:false) — adoptPreset
    // clones a per-campaign subset and reveal state is decided by each DM.
    for (const loc of args.locations) {
      await ctx.db.insert("mapLocations", {
        worldMapId: mapId,
        campaignId: undefined,
        type: loc.type,
        name: loc.name,
        x: loc.x,
        y: loc.y,
        revealed: false,
        dmNotes: loc.dmNotes,
        drillDownImageKey: loc.drillDownImageKey,
        drillDownUrl: loc.drillDownUrl,
        poiKind: loc.poiKind,
        town: loc.town,
        prominence: loc.prominence,
        createdBy: "seed-script",
      })
    }

    return { mapId, replaced: existing !== undefined, locationCount: args.locations.length }
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
    // Players never receive dmNotes. They also don't get a POI's drillDownUrl: those
    // are dungeon/encounter prep tools (the interior map IS the secret — revealing a
    // pin says "a ruined keep stands here," not its room-by-room layout). A
    // settlement's city link is NOT secret, so it rides through to players on reveal.
    // ⚠️ The dungeon URL ALSO appears inside dmNotes ("See [One page dungeon](…)"),
    // so the dmNotes strip is load-bearing for this secret too — never serve dmNotes
    // to players, or the drill-down leaks back through the notes.
    const sanitized =
      m.member.role === "dm"
        ? visible
        : visible.map(({ dmNotes: _dm, ...rest }) =>
            rest.type === "poi" ? (({ drillDownUrl: _d, ...keep }) => keep)(rest) : rest,
          )
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
    drillDownImageKey: v.optional(v.string()),
    // Settlement extras — set when minting a pin from a World Event's affected town
    // (the MFCG city link + gazetteer), so an added town is a first-class settlement.
    drillDownUrl: v.optional(v.string()),
    town: v.optional(townV),
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
      // Empty string ⇒ omit the field (don't store "").
      drillDownImageKey: args.drillDownImageKey || undefined,
      drillDownUrl: args.drillDownUrl,
      town: args.town,
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
    drillDownImageKey: v.optional(v.string()),
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
    // Empty string clears the drill-down (patch undefined ⇒ Convex removes the field).
    if (args.drillDownImageKey !== undefined) {
      patch.drillDownImageKey = args.drillDownImageKey === "" ? undefined : args.drillDownImageKey
    }
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
