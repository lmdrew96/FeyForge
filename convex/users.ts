import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

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
