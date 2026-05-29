import { mutation } from "./_generated/server"
import { ensureCampaignSetup } from "./campaignMembers"

// One-time backfill for the membership model. Idempotent — every existing campaign
// gets a DM membership for its owner and a join code if it doesn't already have them.
// Run once with: npx convex run migrations:backfillMemberships
// Safe to delete this file after it has been run in every environment.
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
