import { mutation, query, type QueryCtx } from "./_generated/server"
import { v } from "convex/values"
import type { Doc } from "./_generated/dataModel"
import { homebrewData } from "./lib/homebrewValidators"
import { getMembership } from "./lib/auth"

// A homebrew row plus, for entries you don't own, the creator's display name —
// so shared content can be attributed ("Shared by …") in the builder/Codex.
export type SharedHomebrew = Doc<"homebrew"> & { ownerName?: string }

// The current user's accepted friends' tokenIdentifiers (friendship is symmetric,
// so union both directions). Mirrors friends.listFriends' acceptance filter.
async function getAcceptedFriendIds(ctx: QueryCtx, me: string): Promise<string[]> {
  const asRequester = await ctx.db
    .query("friendships")
    .withIndex("by_requester", (q) => q.eq("requesterId", me))
    .take(500)
  const asAddressee = await ctx.db
    .query("friendships")
    .withIndex("by_addressee", (q) => q.eq("addresseeId", me))
    .take(500)
  const ids = new Set<string>()
  for (const f of [...asRequester, ...asAddressee]) {
    if (f.status !== "accepted") continue
    ids.add(f.requesterId === me ? f.addresseeId : f.requesterId)
  }
  return [...ids]
}

// Display name for a clerkId, with the same stable fallback friends.ts uses.
async function resolveDisplayName(ctx: QueryCtx, userId: string): Promise<string> {
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", userId))
    .unique()
  return user?.displayName?.trim() || "Adventurer"
}

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

// Everything the current user can BUILD with: their own homebrew, anything
// published to a campaign they belong to, and anything an accepted friend has
// shared with friends. De-duplicated (a user's own shared entry shows once).
// Entries you don't own carry `ownerName` for attribution. Powers the builder's
// race/background pickers and the Codex Homebrew tab.
export const listForBuilder = query({
  args: {},
  handler: async (ctx): Promise<SharedHomebrew[]> => {
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

    // Friends' libraries, kept to only the entries they've shared with friends.
    const friendIds = await getAcceptedFriendIds(ctx, userId)
    const friendLists = await Promise.all(
      friendIds.map((fid) =>
        ctx.db
          .query("homebrew")
          .withIndex("by_userId", (q) => q.eq("userId", fid))
          .collect(),
      ),
    )
    const friendShared = friendLists.flat().filter((h) => h.sharedWithFriends === true)

    const seen = new Set(own.map((h) => h._id))
    const merged: Doc<"homebrew">[] = [...own]
    for (const h of [...sharedLists.flat(), ...friendShared]) {
      if (!seen.has(h._id)) {
        seen.add(h._id)
        merged.push(h)
      }
    }

    // Attribute every entry you don't own — resolve each owner's name once.
    const otherOwnerIds = [
      ...new Set(merged.filter((h) => h.userId !== userId).map((h) => h.userId)),
    ]
    const nameById = new Map<string, string>()
    await Promise.all(
      otherOwnerIds.map(async (oid) => nameById.set(oid, await resolveDisplayName(ctx, oid))),
    )
    return merged.map((h) =>
      h.userId === userId ? h : { ...h, ownerName: nameById.get(h.userId) },
    )
  },
})

// Reject a `data` blob whose shape doesn't match the declared kind. The union
// validator accepts either shape, so this guards against a "race" row carrying
// background data (or vice versa) — discriminate on a field unique to each.
function assertDataMatchesKind(
  kind: "race" | "background" | "item" | "class" | "monster",
  data: Record<string, unknown>,
) {
  const looksLikeRace = "size" in data && "traits" in data
  const looksLikeBackground = "feature" in data && "skillProficiencies" in data
  const looksLikeItem = "category" in data
  const looksLikeClass = "hitDie" in data && "primaryAbility" in data
  const looksLikeMonster = "armorClass" in data && "challengeRating" in data
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
  if (kind === "monster" && !looksLikeMonster) {
    throw new Error("Monster homebrew is missing stat-block fields")
  }
}

export const create = mutation({
  args: {
    kind: v.union(
      v.literal("race"),
      v.literal("background"),
      v.literal("item"),
      v.literal("class"),
      v.literal("monster"),
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

// Toggle whether this entry is shared with the owner's accepted friends. Only
// the owner may set it. Independent of campaign sharing.
export const setShareFriends = mutation({
  args: {
    id: v.id("homebrew"),
    shared: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const row = await ctx.db.get(args.id)
    if (!row || row.userId !== identity.tokenIdentifier) {
      throw new Error("Homebrew not found")
    }
    await ctx.db.patch(args.id, {
      sharedWithFriends: args.shared ? true : undefined,
      updatedAt: Date.now(),
    })
  },
})
