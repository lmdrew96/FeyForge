import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import type { Id } from "./_generated/dataModel"
import { requireDm } from "./lib/auth"
import { statblockRefValidator } from "./schema"

const npcStatsValidator = v.object({
  cr: v.string(),
  ac: v.number(),
  hp: v.number(),
  abilities: v.object({
    str: v.number(),
    dex: v.number(),
    con: v.number(),
    int: v.number(),
    wis: v.number(),
    cha: v.number(),
  }),
})

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []
    return await ctx.db
      .query("npcs")
      .withIndex("by_userId", (q) => q.eq("userId", identity.tokenIdentifier))
      .order("asc")
      .take(500)
  },
})

export const create = mutation({
  args: {
    campaignId: v.id("campaigns"),
    name: v.string(),
    race: v.string(),
    occupation: v.string(),
    age: v.string(),
    gender: v.string(),
    alignment: v.string(),
    appearance: v.string(),
    personality: v.array(v.string()),
    mannerisms: v.string(),
    voiceDescription: v.string(),
    motivation: v.string(),
    secret: v.string(),
    backstory: v.string(),
    location: v.string(),
    faction: v.optional(v.string()),
    relationship: v.string(),
    status: v.string(),
    tags: v.array(v.string()),
    notes: v.optional(v.string()),
    stats: v.optional(npcStatsValidator),
    statblockRef: v.optional(statblockRefValidator),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    return await ctx.db.insert("npcs", {
      userId: identity.tokenIdentifier,
      ...args,
      updatedAt: Date.now(),
    })
  },
})

// Save a map "npc" pin's dealt NPC into the campaign's roster. DM-gated on the
// pin's campaign. Idempotent: re-saving the same pin (matched by name within the
// campaign) returns the existing roster entry instead of duplicating. Maps the
// lean pool bio → the fuller roster shape, defaulting the fields the pool omits.
export const saveFromMapPin = mutation({
  args: { locationId: v.id("mapLocations") },
  handler: async (ctx, args): Promise<{ id: Id<"npcs">; alreadyExisted: boolean }> => {
    const loc = await ctx.db.get(args.locationId)
    if (!loc || !loc.campaignId || loc.poiKind !== "npc" || !loc.npc) {
      throw new Error("Not an NPC encounter pin")
    }
    const userId = await requireDm(ctx, loc.campaignId, "Only the DM can save NPCs")

    // Dedup by name within the campaign so a second click doesn't clone the NPC.
    const existing = await ctx.db
      .query("npcs")
      .withIndex("by_campaignId", (q) => q.eq("campaignId", loc.campaignId!))
      .collect()
    const dup = existing.find((n) => n.name === loc.name)
    if (dup) return { id: dup._id, alreadyExisted: true }

    const npc = loc.npc
    const id = await ctx.db.insert("npcs", {
      userId,
      campaignId: loc.campaignId,
      name: loc.name,
      race: npc.race,
      occupation: npc.occupation,
      age: "Unknown",
      gender: "Unknown",
      alignment: npc.alignment,
      appearance: npc.appearance,
      personality: npc.personality,
      mannerisms: npc.mannerisms,
      voiceDescription: npc.voice,
      motivation: npc.motivation,
      secret: npc.secret,
      backstory: npc.hook, // the pool's roleplay hook is the closest narrative seed
      location: "Wilderness encounter",
      relationship: "neutral",
      status: "alive",
      tags: ["encounter"],
      updatedAt: Date.now(),
    })
    return { id, alreadyExisted: false }
  },
})

export const update = mutation({
  args: {
    id: v.id("npcs"),
    name: v.optional(v.string()),
    race: v.optional(v.string()),
    occupation: v.optional(v.string()),
    age: v.optional(v.string()),
    gender: v.optional(v.string()),
    alignment: v.optional(v.string()),
    appearance: v.optional(v.string()),
    personality: v.optional(v.array(v.string())),
    mannerisms: v.optional(v.string()),
    voiceDescription: v.optional(v.string()),
    motivation: v.optional(v.string()),
    secret: v.optional(v.string()),
    backstory: v.optional(v.string()),
    location: v.optional(v.string()),
    faction: v.optional(v.string()),
    relationship: v.optional(v.string()),
    status: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
    stats: v.optional(npcStatsValidator),
    statblockRef: v.optional(statblockRefValidator),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const npc = await ctx.db.get(args.id)
    if (!npc || npc.userId !== identity.tokenIdentifier) throw new Error("NPC not found")
    const { id, ...fields } = args
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() })
  },
})

export const remove = mutation({
  args: { id: v.id("npcs") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const npc = await ctx.db.get(args.id)
    if (!npc || npc.userId !== identity.tokenIdentifier) throw new Error("NPC not found")
    await ctx.db.delete(args.id)
  },
})
