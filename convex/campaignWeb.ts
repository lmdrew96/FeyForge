import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import type { Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"

// Throws unless the authenticated user owns the campaign. Campaign web editing is
// DM tooling, so it's gated to the campaign owner.
async function requireCampaignOwner(
  ctx: MutationCtx,
  campaignId: Id<"campaigns">,
  userId: string
): Promise<void> {
  const campaign = await ctx.db.get(campaignId)
  if (!campaign || campaign.userId !== userId) throw new Error("Campaign not found")
}

// True if the caller is a member of the campaign (any role). The reads below are
// DM tooling but membership-gating (not owner-gating) keeps the door open for
// future co-DMs while closing cross-campaign reads by non-members.
async function isCampaignMember(ctx: QueryCtx, campaignId: Id<"campaigns">): Promise<boolean> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return false
  const member = await ctx.db
    .query("campaignMembers")
    .withIndex("by_campaignId_and_userId", (q) =>
      q.eq("campaignId", campaignId).eq("userId", identity.tokenIdentifier)
    )
    .first()
  return member !== null
}

const entityTypeValidator = v.union(
  v.literal("npc"),
  v.literal("location"),
  v.literal("wiki"),
  v.literal("faction"),
  v.literal("plot_hook")
)

export const listNodes = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    if (!(await isCampaignMember(ctx, args.campaignId))) return []
    const nodes = await ctx.db
      .query("campaignWebNodes")
      .withIndex("by_campaignId", (q) => q.eq("campaignId", args.campaignId))
      .take(200)

    return await Promise.all(
      nodes.map(async (node) => {
        let entityName: string | null = null
        if (node.entityId) {
          if (node.entityType === "npc") {
            const npc = await ctx.db.get(node.entityId as Id<"npcs">)
            entityName = npc?.name ?? null
          } else if (node.entityType === "location") {
            const loc = await ctx.db.get(node.entityId as Id<"mapLocations">)
            entityName = loc?.name ?? null
          } else if (node.entityType === "wiki") {
            const entry = await ctx.db.get(node.entityId as Id<"wikiEntries">)
            entityName = entry?.name ?? null
          }
        }
        return { ...node, entityName }
      })
    )
  },
})

export const listEdges = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    if (!(await isCampaignMember(ctx, args.campaignId))) return []
    return await ctx.db
      .query("campaignWebEdges")
      .withIndex("by_campaignId", (q) => q.eq("campaignId", args.campaignId))
      .take(500)
  },
})

export const addNode = mutation({
  args: {
    campaignId: v.id("campaigns"),
    entityType: entityTypeValidator,
    entityId: v.optional(v.string()),
    label: v.string(),
    x: v.number(),
    y: v.number(),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"campaignWebNodes">> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    await requireCampaignOwner(ctx, args.campaignId, identity.tokenIdentifier)

    return await ctx.db.insert("campaignWebNodes", {
      campaignId: args.campaignId,
      entityType: args.entityType,
      entityId: args.entityId,
      label: args.label,
      x: args.x,
      y: args.y,
      color: args.color,
    })
  },
})

export const moveNode = mutation({
  args: {
    nodeId: v.id("campaignWebNodes"),
    x: v.number(),
    y: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const node = await ctx.db.get(args.nodeId)
    if (!node) throw new Error("Node not found")
    await requireCampaignOwner(ctx, node.campaignId, identity.tokenIdentifier)
    await ctx.db.patch(args.nodeId, { x: args.x, y: args.y })
  },
})

export const removeNode = mutation({
  args: { nodeId: v.id("campaignWebNodes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const node = await ctx.db.get(args.nodeId)
    if (!node) return
    await requireCampaignOwner(ctx, node.campaignId, identity.tokenIdentifier)

    // Delete all edges connected to this node
    const edges = await ctx.db
      .query("campaignWebEdges")
      .withIndex("by_campaignId", (q) => q.eq("campaignId", node.campaignId))
      .take(500)

    for (const edge of edges) {
      if (edge.fromNodeId === args.nodeId || edge.toNodeId === args.nodeId) {
        await ctx.db.delete(edge._id)
      }
    }

    await ctx.db.delete(args.nodeId)
  },
})

export const addEdge = mutation({
  args: {
    campaignId: v.id("campaigns"),
    fromNodeId: v.id("campaignWebNodes"),
    toNodeId: v.id("campaignWebNodes"),
    label: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"campaignWebEdges">> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    await requireCampaignOwner(ctx, args.campaignId, identity.tokenIdentifier)

    return await ctx.db.insert("campaignWebEdges", {
      campaignId: args.campaignId,
      fromNodeId: args.fromNodeId,
      toNodeId: args.toNodeId,
      label: args.label,
    })
  },
})

export const updateEdge = mutation({
  args: {
    edgeId: v.id("campaignWebEdges"),
    label: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const edge = await ctx.db.get(args.edgeId)
    if (!edge) throw new Error("Edge not found")
    await requireCampaignOwner(ctx, edge.campaignId, identity.tokenIdentifier)
    await ctx.db.patch(args.edgeId, { label: args.label })
  },
})

export const removeEdge = mutation({
  args: { edgeId: v.id("campaignWebEdges") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const edge = await ctx.db.get(args.edgeId)
    if (!edge) return
    await requireCampaignOwner(ctx, edge.campaignId, identity.tokenIdentifier)
    await ctx.db.delete(args.edgeId)
  },
})
