import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { getMembership } from "./lib/auth"

const objectiveValidator = v.object({
  id: v.string(),
  text: v.string(),
  completed: v.boolean(),
  priority: v.union(v.literal("primary"), v.literal("secondary"), v.literal("optional")),
})

const plannedEncounterValidator = v.object({
  id: v.string(),
  name: v.string(),
  description: v.optional(v.string()),
  difficulty: v.union(
    v.literal("trivial"),
    v.literal("easy"),
    v.literal("medium"),
    v.literal("hard"),
    v.literal("deadly"),
  ),
  monsterSlugs: v.array(v.string()),
  status: v.union(v.literal("planned"), v.literal("completed"), v.literal("skipped")),
  notes: v.optional(v.string()),
  xpReward: v.optional(v.number()),
})

// ── Game Sessions ─────────────────────────────────────────────────────────────

export const listSessions = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []
    return await ctx.db
      .query("gameSessions")
      .withIndex("by_userId", (q) => q.eq("userId", identity.tokenIdentifier))
      .order("asc")
      .take(500)
  },
})

// Player-facing recaps for a campaign. listSessions is DM-userId-scoped, so
// players (who don't own the gameSessions rows) can't use it. This read is
// MEMBERSHIP-gated instead — any member of the campaign sees the DM-authored
// recaps for completed sessions, projected to a player-safe shape (never
// prepNotes / objectives / plannedEncounters / etc.). Sessions without a
// playerRecap are omitted (nothing to read yet).
export const listRecapsForCampaign = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const m = await getMembership(ctx, args.campaignId)
    if (!m) return []

    const sessions = await ctx.db
      .query("gameSessions")
      .withIndex("by_campaignId", (q) => q.eq("campaignId", args.campaignId))
      .collect()

    return sessions
      .filter((s) => s.status === "completed" && !!s.playerRecap?.trim())
      .sort((a, b) => a.number - b.number)
      .map((s) => ({
        _id: s._id,
        number: s.number,
        title: s.title,
        date: s.date,
        summary: s.summary ?? null,
        playerRecap: s.playerRecap as string,
      }))
  },
})

export const createSession = mutation({
  args: {
    campaignId: v.id("campaigns"),
    number: v.number(),
    title: v.string(),
    date: v.number(),
    scheduledDate: v.optional(v.number()),
    duration: v.optional(v.number()),
    status: v.union(v.literal("planned"), v.literal("completed"), v.literal("cancelled")),
    summary: v.optional(v.string()),
    plotThreads: v.array(v.string()),
    highlights: v.array(v.string()),
    loot: v.array(v.string()),
    npcsEncountered: v.array(v.string()),
    locationsVisited: v.array(v.string()),
    prepNotes: v.optional(v.string()),
    playerRecap: v.optional(v.string()),
    objectives: v.array(objectiveValidator),
    plannedEncounters: v.array(plannedEncounterValidator),
    plannedNPCs: v.array(v.string()),
    xpAwarded: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    return await ctx.db.insert("gameSessions", {
      userId: identity.tokenIdentifier,
      ...args,
      updatedAt: Date.now(),
    })
  },
})

export const updateSession = mutation({
  args: {
    id: v.id("gameSessions"),
    number: v.optional(v.number()),
    title: v.optional(v.string()),
    date: v.optional(v.number()),
    scheduledDate: v.optional(v.number()),
    duration: v.optional(v.number()),
    status: v.optional(v.union(v.literal("planned"), v.literal("completed"), v.literal("cancelled"))),
    summary: v.optional(v.string()),
    plotThreads: v.optional(v.array(v.string())),
    highlights: v.optional(v.array(v.string())),
    loot: v.optional(v.array(v.string())),
    npcsEncountered: v.optional(v.array(v.string())),
    locationsVisited: v.optional(v.array(v.string())),
    prepNotes: v.optional(v.string()),
    playerRecap: v.optional(v.string()),
    objectives: v.optional(v.array(objectiveValidator)),
    plannedEncounters: v.optional(v.array(plannedEncounterValidator)),
    plannedNPCs: v.optional(v.array(v.string())),
    xpAwarded: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const session = await ctx.db.get(args.id)
    if (!session || session.userId !== identity.tokenIdentifier) throw new Error("Session not found")
    const { id, ...fields } = args
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() })
  },
})

export const removeSession = mutation({
  args: { id: v.id("gameSessions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const session = await ctx.db.get(args.id)
    if (!session || session.userId !== identity.tokenIdentifier) throw new Error("Session not found")
    await ctx.db.delete(args.id)
  },
})

export const addNote = mutation({
  args: {
    sessionId: v.id("gameSessions"),
    content: v.string(),
    type: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const session = await ctx.db.get(args.sessionId)
    if (!session || session.userId !== identity.tokenIdentifier) {
      throw new Error("Session not found")
    }
    return await ctx.db.insert("gameSessionNotes", {
      sessionId: args.sessionId,
      content: args.content,
      type: args.type,
      timestamp: Date.now(),
    })
  },
})

// ── Plot Threads ──────────────────────────────────────────────────────────────

export const listPlotThreads = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []
    return await ctx.db
      .query("plotThreads")
      .withIndex("by_userId", (q) => q.eq("userId", identity.tokenIdentifier))
      .order("asc")
      .take(500)
  },
})

export const createPlotThread = mutation({
  args: {
    campaignId: v.id("campaigns"),
    title: v.string(),
    description: v.string(),
    status: v.string(),
    importance: v.string(),
    relatedNPCs: v.optional(v.array(v.string())),
    relatedLocations: v.optional(v.array(v.string())),
    resolvedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    return await ctx.db.insert("plotThreads", {
      userId: identity.tokenIdentifier,
      ...args,
    })
  },
})

export const updatePlotThread = mutation({
  args: {
    id: v.id("plotThreads"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
    importance: v.optional(v.string()),
    relatedNPCs: v.optional(v.array(v.string())),
    relatedLocations: v.optional(v.array(v.string())),
    resolvedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const thread = await ctx.db.get(args.id)
    if (!thread || thread.userId !== identity.tokenIdentifier) throw new Error("Thread not found")
    const { id, ...fields } = args
    await ctx.db.patch(id, fields)
  },
})

export const removePlotThread = mutation({
  args: { id: v.id("plotThreads") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const thread = await ctx.db.get(args.id)
    if (!thread || thread.userId !== identity.tokenIdentifier) throw new Error("Thread not found")
    await ctx.db.delete(args.id)
  },
})
