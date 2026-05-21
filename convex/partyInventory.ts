import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const list = query({
  args: { sessionId: v.id("partySessions") },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("partyInventory")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .take(100)

    return await Promise.all(
      items.map(async (item) => {
        const character = item.assignedToCharacterId
          ? await ctx.db.get(item.assignedToCharacterId)
          : null
        return {
          ...item,
          assignedToCharacterName: character?.name ?? null,
        }
      })
    )
  },
})

export const add = mutation({
  args: {
    sessionId: v.id("partySessions"),
    campaignId: v.id("campaigns"),
    name: v.string(),
    description: v.optional(v.string()),
    quantity: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const session = await ctx.db.get(args.sessionId)
    if (!session || session.dmUserId !== identity.tokenIdentifier) throw new Error("Not authorized")

    return await ctx.db.insert("partyInventory", {
      sessionId: args.sessionId,
      campaignId: args.campaignId,
      addedByUserId: identity.tokenIdentifier,
      name: args.name,
      description: args.description,
      quantity: args.quantity,
      addedAt: Date.now(),
    })
  },
})

export const assign = mutation({
  args: {
    itemId: v.id("partyInventory"),
    characterId: v.optional(v.id("characters")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const item = await ctx.db.get(args.itemId)
    if (!item) throw new Error("Item not found")

    const session = await ctx.db.get(item.sessionId)
    if (!session || session.dmUserId !== identity.tokenIdentifier) throw new Error("Not authorized")

    await ctx.db.patch(args.itemId, { assignedToCharacterId: args.characterId })
  },
})

export const remove = mutation({
  args: { itemId: v.id("partyInventory") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const item = await ctx.db.get(args.itemId)
    if (!item) throw new Error("Item not found")

    const session = await ctx.db.get(item.sessionId)
    if (!session || session.dmUserId !== identity.tokenIdentifier) throw new Error("Not authorized")

    await ctx.db.delete(args.itemId)
  },
})
