import { mutation } from "./_generated/server"

// Deletes all data for the authenticated user across all tables.
// Called from the delete-account API route via ConvexHttpClient with user's Clerk token.
export const deleteAllUserData = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthorized")
    const userId = identity.tokenIdentifier

    // Tables that carry a `by_userId` index (owner-scoped rows).
    const userScopedTables = [
      "campaigns",
      "characters",
      "npcs",
      "gameSessions",
      "plotThreads",
      "wikiEntries",
      "savedEncounters",
      "dmConversations",
    ] as const

    for (const table of userScopedTables) {
      const docs = await ctx.db
        .query(table)
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect()
      for (const doc of docs) {
        await ctx.db.delete(doc._id)
      }
    }

    // World map tables are campaign-scoped, not user-scoped (no by_userId index
    // after the world-map reshape). Delete the maps this user authored via
    // createdBy, and cascade their locations through the by_worldMap index.
    const myMaps = await ctx.db.query("worldMaps").collect()
    for (const map of myMaps) {
      if (map.createdBy !== userId) continue
      const locs = await ctx.db
        .query("mapLocations")
        .withIndex("by_worldMap", (q) => q.eq("worldMapId", map._id))
        .collect()
      for (const loc of locs) await ctx.db.delete(loc._id)
      await ctx.db.delete(map._id)
    }
    // Sweep any remaining locations this user created (e.g. orphaned rows).
    const myLocations = await ctx.db.query("mapLocations").collect()
    for (const loc of myLocations) {
      if (loc.createdBy === userId) await ctx.db.delete(loc._id)
    }

    // characterProperties are indexed by characterId, not userId — cascade via characters deletion
    // but characters were already deleted above so their properties become orphans; clean them up
    const allProperties = await ctx.db.query("characterProperties").collect()
    for (const prop of allProperties) {
      const char = await ctx.db.get(prop.characterId)
      if (!char) await ctx.db.delete(prop._id)
    }
  },
})
