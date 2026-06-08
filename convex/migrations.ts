import { mutation } from "./_generated/server"
import { ensureCampaignSetup } from "./campaignMembers"
import { BACKGROUNDS, dedupeToolProficiencies } from "../lib/character/character-data"

// One-time backfill for the membership model. Idempotent — every existing campaign
// gets a DM membership for its owner and a join code if it doesn't already have them.
// Run once with: npx convex run migrations:backfillMemberships
// Safe to delete this file after it has been run in every environment.
// One-time backfill for the tool-proficiency creation bug (fixed v0.135.1):
// existing characters were created with their CLASS tools only — the background's
// tools were dropped — so the sheet's Tools card stayed empty. This merges each
// character's background tool proficiencies into its stored list. Additive +
// idempotent (only adds, dedupes case-insensitively; re-running is a no-op).
// Run once with: npx convex run migrations:backfillToolProficiencies
// Safe to delete after it has run in every environment.
export const backfillToolProficiencies = mutation({
  args: {},
  handler: async (ctx) => {
    // background name (lowercased) → granted tools, curated + homebrew.
    const toolsByBackground = new Map<string, string[]>()
    for (const bg of BACKGROUNDS) {
      if (bg.toolProficiencies.length) {
        toolsByBackground.set(bg.name.trim().toLowerCase(), bg.toolProficiencies)
      }
    }
    // Homebrew backgrounds (no by_kind index → scan + filter; fine for a one-off).
    const homebrew = await ctx.db.query("homebrew").collect()
    for (const row of homebrew) {
      if (row.kind !== "background") continue
      const tools = (row.data as { toolProficiencies?: string[] }).toolProficiencies
      if (tools && tools.length) toolsByBackground.set(row.name.trim().toLowerCase(), tools)
    }

    const characters = await ctx.db.query("characters").collect()
    let updated = 0
    for (const char of characters) {
      const bgName = (char.background ?? "").trim().toLowerCase()
      if (!bgName) continue
      const bgTools = toolsByBackground.get(bgName)
      if (!bgTools || bgTools.length === 0) continue
      const merged = dedupeToolProficiencies(char.toolProficiencies, bgTools)
      // Merge only adds, so a length change means new tools were gained.
      if (merged.length !== char.toolProficiencies.length) {
        await ctx.db.patch(char._id, { toolProficiencies: merged })
        updated++
      }
    }
    return { charactersProcessed: characters.length, updated }
  },
})

export const backfillMemberships = mutation({
  args: {},
  handler: async (ctx) => {
    const campaigns = await ctx.db.query("campaigns").collect()
    let dmMembersBefore = 0
    for (const campaign of campaigns) {
      const had = await ctx.db
        .query("campaignMembers")
        .withIndex("by_campaignId_and_userId", (q) =>
          q.eq("campaignId", campaign._id).eq("userId", campaign.userId)
        )
        .first()
      if (had) dmMembersBefore++
      await ensureCampaignSetup(ctx, campaign._id, campaign.userId)
    }
    return {
      campaignsProcessed: campaigns.length,
      dmMembersCreated: campaigns.length - dmMembersBefore,
    }
  },
})
