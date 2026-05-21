import { mutation } from "./_generated/server"

// Deletes all data for the authenticated user across all tables.
// Called from the delete-account API route via ConvexHttpClient with user's Clerk token.
export const deleteAllUserData = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthorized")
    const userId = identity.tokenIdentifier

    const tables = [
      "campaigns",
      "characters",
      "npcs",
      "gameSessions",
      "plotThreads",
      "wikiEntries",
      "worldMaps",
      "mapLocations",
      "savedEncounters",
      "dmConversations",
    ] as const

    for (const table of tables) {
      const docs = await ctx.db
        .query(table)
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect()
      for (const doc of docs) {
        await ctx.db.delete(doc._id)
      }
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
