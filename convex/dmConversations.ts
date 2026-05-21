import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

const messageValidator = v.object({
  id: v.string(),
  role: v.union(v.literal("user"), v.literal("assistant")),
  content: v.string(),
  timestamp: v.string(),
})

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []
    return await ctx.db
      .query("dmConversations")
      .withIndex("by_userId", (q) => q.eq("userId", identity.tokenIdentifier))
      .order("desc")
      .take(200)
  },
})

export const create = mutation({
  args: {
    campaignId: v.id("campaigns"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    return await ctx.db.insert("dmConversations", {
      userId: identity.tokenIdentifier,
      campaignId: args.campaignId,
      title: args.title,
      messages: [],
      updatedAt: Date.now(),
    })
  },
})

export const update = mutation({
  args: {
    id: v.id("dmConversations"),
    title: v.optional(v.string()),
    messages: v.optional(v.array(messageValidator)),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const convo = await ctx.db.get(args.id)
    if (!convo || convo.userId !== identity.tokenIdentifier) throw new Error("Conversation not found")
    const { id, ...fields } = args
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() })
  },
})

export const remove = mutation({
  args: { id: v.id("dmConversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const convo = await ctx.db.get(args.id)
    if (!convo || convo.userId !== identity.tokenIdentifier) throw new Error("Conversation not found")
    await ctx.db.delete(args.id)
  },
})
