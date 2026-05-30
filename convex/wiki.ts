import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import type { Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"

// ── Per-campaign role helpers ────────────────────────────────────────────────
// The wiki is gated by the caller's role in the *specific* campaign, never a
// global mode — a user can be DM of one campaign and a player in another.

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
async function requireWikiDm(ctx: MutationCtx, campaignId: Id<"campaigns">): Promise<string> {
  const m = await getMembership(ctx, campaignId)
  if (!m || m.member.role !== "dm") throw new Error("Only the DM can edit the campaign wiki")
  return m.userId
}

// ── Reads ────────────────────────────────────────────────────────────────────
// DM sees every entry; players see only revealed ones. Non-members see nothing.

export const list = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const m = await getMembership(ctx, args.campaignId)
    if (!m) return []
    const entries = await ctx.db
      .query("wikiEntries")
      .withIndex("by_campaignId", (q) => q.eq("campaignId", args.campaignId))
      .collect()
    const visible = m.member.role === "dm" ? entries : entries.filter((e) => e.isRevealed === true)
    return visible.sort((a, b) => a.name.localeCompare(b.name))
  },
})

export const get = query({
  args: { entryId: v.id("wikiEntries") },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.entryId)
    if (!entry) return null
    const m = await getMembership(ctx, entry.campaignId)
    if (!m) return null
    // Players can only read revealed entries.
    if (m.member.role !== "dm" && entry.isRevealed !== true) return null
    return entry
  },
})

// ── Writes (DM-only) ─────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    campaignId: v.id("campaigns"),
    type: v.string(),
    name: v.string(),
    content: v.optional(v.string()),
    description: v.optional(v.string()),
    isRevealed: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Id<"wikiEntries">> => {
    const userId = await requireWikiDm(ctx, args.campaignId)
    return await ctx.db.insert("wikiEntries", {
      userId,
      campaignId: args.campaignId,
      type: args.type,
      name: args.name,
      content: args.content,
      description: args.description,
      isRevealed: args.isRevealed ?? false,
      updatedAt: Date.now(),
    })
  },
})

export const update = mutation({
  args: {
    entryId: v.id("wikiEntries"),
    type: v.optional(v.string()),
    name: v.optional(v.string()),
    content: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.entryId)
    if (!entry) throw new Error("Entry not found")
    await requireWikiDm(ctx, entry.campaignId)

    const patch: Record<string, unknown> = { updatedAt: Date.now() }
    if (args.type !== undefined) patch.type = args.type
    if (args.name !== undefined) patch.name = args.name
    if (args.content !== undefined) patch.content = args.content
    if (args.description !== undefined) patch.description = args.description
    await ctx.db.patch(args.entryId, patch)
  },
})

// The player/DM reveal primitive: flip whether players can see this entry.
export const setRevealed = mutation({
  args: { entryId: v.id("wikiEntries"), isRevealed: v.boolean() },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.entryId)
    if (!entry) throw new Error("Entry not found")
    await requireWikiDm(ctx, entry.campaignId)
    await ctx.db.patch(args.entryId, { isRevealed: args.isRevealed })
  },
})

export const remove = mutation({
  args: { entryId: v.id("wikiEntries") },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.entryId)
    if (!entry) return
    await requireWikiDm(ctx, entry.campaignId)
    await ctx.db.delete(args.entryId)
  },
})
