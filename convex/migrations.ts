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

// One-time backfill for the dual-wield bug (fixed v0.136.2): weapons granted in
// pairs (two shortswords, two handaxes, two daggers) were stored as a single
// quantity-2 item row, which carries one Equip toggle — so the second weapon
// could never be wielded as its own attack. Split every quantity-2 weapon row
// into two discrete, independently-equippable rows. Idempotent: after running,
// no quantity-2 weapon rows remain, so a re-run is a no-op.
// Run once with: npx convex run migrations:splitWeaponPairs
// Safe to delete after it has run in every environment.
export const splitWeaponPairs = mutation({
  args: {},
  handler: async (ctx) => {
    const props = await ctx.db.query("characterProperties").collect()
    let weaponsSplit = 0
    for (const p of props) {
      if (p.type !== "item") continue
      const data = (p.data ?? {}) as { category?: string; quantity?: number }
      if (data.category !== "weapon" || data.quantity !== 2) continue
      const single = { ...data }
      delete single.quantity
      // Shrink the original to a single, then clone a second discrete row. The
      // clone copies every field of the original (minus the db-managed _id /
      // _creationTime), so equipped/active/orderIndex/tags carry over verbatim.
      await ctx.db.patch(p._id, { data: single })
      const { _id, _creationTime, ...rest } = p
      await ctx.db.insert("characterProperties", { ...rest, data: { ...single } })
      weaponsSplit++
    }
    return { propertiesScanned: props.length, weaponsSplit }
  },
})
