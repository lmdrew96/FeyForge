import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import type { Doc } from "./_generated/dataModel"
import { homebrewData } from "./lib/homebrewValidators"
import { getMembership } from "./lib/auth"

// ── Homebrew library ──────────────────────────────────────────────────────────
// User-authored races/backgrounds that merge into the character builder. Owned by
// the creator; optionally published to one campaign so its members can use it too.
// Reads return [] to non-members / unauthenticated (never throw — these feed
// reactive client queries); writes are owner-gated and throw.

// The current user's own homebrew. Powers the /homebrew management page.
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []
    return await ctx.db
      .query("homebrew")
      .withIndex("by_userId", (q) => q.eq("userId", identity.tokenIdentifier))
      .collect()
  },
})

// Everything the current user can BUILD with: their own homebrew plus any homebrew
// published to a campaign they belong to. De-duplicated (a user's own shared entry
// shows once). Powers the builder's race/background pickers.
export const listForBuilder = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []
    const userId = identity.tokenIdentifier

    const own = await ctx.db
      .query("homebrew")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect()

    const memberships = await ctx.db
      .query("campaignMembers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(100)

    const sharedLists = await Promise.all(
      memberships.map((m) =>
        ctx.db
          .query("homebrew")
          .withIndex("by_sharedCampaignId", (q) =>
            q.eq("sharedCampaignId", m.campaignId),
          )
          .collect(),
      ),
    )

    const seen = new Set(own.map((h) => h._id))
    const merged: Doc<"homebrew">[] = [...own]
    for (const h of sharedLists.flat()) {
      if (!seen.has(h._id)) {
        seen.add(h._id)
        merged.push(h)
      }
    }
    return merged
  },
})

// Reject a `data` blob whose shape doesn't match the declared kind. The union
// validator accepts either shape, so this guards against a "race" row carrying
// background data (or vice versa) — discriminate on a field unique to each.
function assertDataMatchesKind(
  kind: "race" | "background" | "item" | "class",
  data: Record<string, unknown>,
) {
  const looksLikeRace = "size" in data && "traits" in data
  const looksLikeBackground = "feature" in data && "skillProficiencies" in data
  const looksLikeItem = "category" in data
  const looksLikeClass = "hitDie" in data && "primaryAbility" in data
  if (kind === "race" && !looksLikeRace) {
    throw new Error("Race homebrew is missing race fields")
  }
  if (kind === "background" && !looksLikeBackground) {
    throw new Error("Background homebrew is missing background fields")
  }
  if (kind === "item" && !looksLikeItem) {
    throw new Error("Item homebrew is missing a category")
  }
  if (kind === "class" && !looksLikeClass) {
    throw new Error("Class homebrew is missing class fields")
  }
}

export const create = mutation({
  args: {
    kind: v.union(
      v.literal("race"),
      v.literal("background"),
      v.literal("item"),
      v.literal("class"),
    ),
    name: v.string(),
    data: homebrewData,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const name = args.name.trim()
    if (!name) throw new Error("Name is required")
    assertDataMatchesKind(args.kind, args.data as Record<string, unknown>)

    // No two of your own homebrew of the same kind may share a name (case-
    // insensitive) — resolution downstream is name-keyed.
    const existing = await ctx.db
      .query("homebrew")
      .withIndex("by_userId", (q) => q.eq("userId", identity.tokenIdentifier))
      .collect()
    if (
      existing.some(
        (h) => h.kind === args.kind && h.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      throw new Error(`You already have a homebrew ${args.kind} named "${name}"`)
    }

    return await ctx.db.insert("homebrew", {
      userId: identity.tokenIdentifier,
      kind: args.kind,
      name,
      data: args.data,
      updatedAt: Date.now(),
    })
  },
})

export const update = mutation({
  args: {
    id: v.id("homebrew"),
    name: v.string(),
    data: homebrewData,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const row = await ctx.db.get(args.id)
    if (!row || row.userId !== identity.tokenIdentifier) {
      throw new Error("Homebrew not found")
    }

    const name = args.name.trim()
    if (!name) throw new Error("Name is required")
    assertDataMatchesKind(row.kind, args.data as Record<string, unknown>)

    const others = await ctx.db
      .query("homebrew")
      .withIndex("by_userId", (q) => q.eq("userId", identity.tokenIdentifier))
      .collect()
    if (
      others.some(
        (h) =>
          h._id !== args.id &&
          h.kind === row.kind &&
          h.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      throw new Error(`You already have a homebrew ${row.kind} named "${name}"`)
    }

    await ctx.db.patch(args.id, { name, data: args.data, updatedAt: Date.now() })
  },
})

export const remove = mutation({
  args: { id: v.id("homebrew") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const row = await ctx.db.get(args.id)
    if (!row || row.userId !== identity.tokenIdentifier) {
      throw new Error("Homebrew not found")
    }
    await ctx.db.delete(args.id)
  },
})

// Publish (campaignId) or unpublish (null) a homebrew entry to a campaign. Only
// the owner may share, and only to a campaign they belong to.
export const setShare = mutation({
  args: {
    id: v.id("homebrew"),
    campaignId: v.union(v.id("campaigns"), v.null()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const row = await ctx.db.get(args.id)
    if (!row || row.userId !== identity.tokenIdentifier) {
      throw new Error("Homebrew not found")
    }

    if (args.campaignId !== null) {
      const membership = await getMembership(ctx, args.campaignId)
      if (!membership) throw new Error("You're not a member of that campaign")
    }

    await ctx.db.patch(args.id, {
      sharedCampaignId: args.campaignId ?? undefined,
      updatedAt: Date.now(),
    })
  },
})
