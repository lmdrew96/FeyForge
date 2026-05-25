import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"
import { internalMutation } from "./_generated/server"

// Expire premium for subscribers whose last Ko-fi payment was >35 days ago.
// Ko-fi doesn't send cancellation webhooks — each payment renews premiumExpiresAt.
// Lapsed subscribers are caught here on the next daily run.
export const expireLapsedPremium = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    const premiumUsers = await ctx.db
      .query("users")
      .withIndex("by_isPremium", (q) => q.eq("isPremium", true))
      .take(200)

    for (const user of premiumUsers) {
      if (user.premiumExpiresAt !== undefined && user.premiumExpiresAt < now) {
        await ctx.db.patch(user._id, { isPremium: false, premiumExpiresAt: undefined })
      }
    }
  },
})

const crons = cronJobs()

crons.interval(
  "expire lapsed premium subscribers",
  { hours: 24 },
  internal.crons.expireLapsedPremium,
  {}
)

export default crons
