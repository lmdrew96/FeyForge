import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import type { Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"

// ── Active campaign (server-side, cross-device) ──────────────────────────────
// The "active campaign" is the one the user is currently working in. Storing it
// on the user record (rather than only client-side) lets it follow the DM/player
// across devices and gives the live-session machinery a single source of truth.

// Resolves the user's active campaign, validated against current membership.
// Read-only (safe in queries). Falls back to a DM membership, else the most
// recent membership, else null. Does not persist — mutation-context callers that
// want to self-heal should follow up with setActiveCampaignForUser.
export async function resolveActiveCampaignId(
  ctx: QueryCtx | MutationCtx,
  userId: string
): Promise<Id<"campaigns"> | null> {
  const memberships = await ctx.db
    .query("campaignMembers")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect()
  if (memberships.length === 0) return null

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", userId))
    .unique()

  // Honor the stored choice if it's still a campaign the user belongs to.
  if (user?.activeCampaignId) {
    const stillMember = memberships.some((m) => m.campaignId === user.activeCampaignId)
    if (stillMember) return user.activeCampaignId
  }

  // Fallback: prefer a DM membership, else the most recent membership.
  const dm = memberships.find((m) => m.role === "dm")
  const chosen = dm ?? memberships[memberships.length - 1]
  return chosen.campaignId
}

// Persists the user's active campaign. No-ops if the user record doesn't exist
// yet or the value is unchanged.
export async function setActiveCampaignForUser(
  ctx: MutationCtx,
  userId: string,
  campaignId: Id<"campaigns">
): Promise<void> {
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", userId))
    .unique()
  if (user && user.activeCampaignId !== campaignId) {
    await ctx.db.patch(user._id, { activeCampaignId: campaignId })
  }
}

// Player/DM picks their current campaign. Only campaigns the user belongs to are
// allowed, so this can't be used to point at someone else's campaign.
export const setActiveCampaign = mutation({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const member = await ctx.db
      .query("campaignMembers")
      .withIndex("by_campaignId_and_userId", (q) =>
        q.eq("campaignId", args.campaignId).eq("userId", identity.tokenIdentifier)
      )
      .first()
    if (!member) throw new Error("Not a member of this campaign")

    await setActiveCampaignForUser(ctx, identity.tokenIdentifier, args.campaignId)
  },
})

export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.tokenIdentifier))
      .unique()
    if (!user) return null
    // Admins get premium access at zero cost
    return { ...user, isPremium: user.isPremium || user.role === "admin" }
  },
})

export const upsertUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.tokenIdentifier))
      .unique()

    if (existing) return existing._id

    return await ctx.db.insert("users", {
      clerkId: identity.tokenIdentifier,
      clerkUserId: identity.subject,
      isPremium: false,
      role: "user",
    })
  },
})

// Called by Ko-fi webhook on each subscription payment. Ko-fi does not send
// cancellation events, so we set premiumExpiresAt 35 days out and let the
// daily expiry cron flip isPremium:false for lapsed subscribers.
const PREMIUM_GRACE_MS = 35 * 24 * 60 * 60 * 1000 // 35 days (monthly + 5-day grace)

export const setPremiumByClerkId = mutation({
  args: {
    clerkId: v.string(),
    isPremium: v.boolean(),
    webhookSecret: v.string(),
  },
  handler: async (ctx, args) => {
    // Shared-secret gate: this public mutation is only legitimately called by the
    // Ko-fi webhook, which passes KOFI_VERIFICATION_TOKEN. Without this, any client
    // could grant themselves premium by calling the mutation directly.
    if (!process.env.KOFI_VERIFICATION_TOKEN || args.webhookSecret !== process.env.KOFI_VERIFICATION_TOKEN) {
      throw new Error("Unauthorized")
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", args.clerkId))
      .unique()

    if (user) {
      await ctx.db.patch(user._id, {
        isPremium: args.isPremium,
        premiumSince: args.isPremium ? (user.premiumSince ?? Date.now()) : undefined,
        premiumExpiresAt: args.isPremium ? Date.now() + PREMIUM_GRACE_MS : undefined,
      })
    }
  },
})

export const setRole = mutation({
  args: {
    targetClerkUserId: v.string(),
    role: v.union(v.literal("admin"), v.literal("user")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const me = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.tokenIdentifier))
      .unique()
    if (me?.role !== "admin") throw new Error("Not authorized")

    const target = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", args.targetClerkUserId))
      .unique()
    if (!target) throw new Error("User not found")

    await ctx.db.patch(target._id, { role: args.role })
  },
})

export const listAllUsers = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const me = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.tokenIdentifier))
      .unique()
    if (me?.role !== "admin") return []

    return await ctx.db.query("users").take(100)
  },
})
