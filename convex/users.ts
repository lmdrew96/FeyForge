import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    return await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.tokenIdentifier))
      .unique()
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
    })
  },
})

export const setPremiumByClerkId = mutation({
  args: {
    clerkId: v.string(),
    isPremium: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", args.clerkId))
      .unique()

    if (user) {
      await ctx.db.patch(user._id, {
        isPremium: args.isPremium,
        premiumSince: args.isPremium ? (user.premiumSince ?? Date.now()) : undefined,
      })
    }
    // If user hasn't logged in yet, we can't pre-create their record without tokenIdentifier
  },
})
