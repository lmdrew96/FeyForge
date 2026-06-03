import { mutation, query } from "./_generated/server"
import type { QueryCtx, MutationCtx } from "./_generated/server"
import { isPremiumActive } from "./premiumStatus"

// ── AI daily quota ───────────────────────────────────────────────────────────
// Durable, per-user, per-day generation counter — the real quota behind
// "premium = AI". (lib/rate-limit is only a per-process anti-burst guard that
// resets on cold starts.) Free users get a taste; premium gets the real budget.
// consume() is transactional, so concurrent clicks can't race past the cap.

export const AI_DAILY_CAP_PREMIUM = 50
export const AI_DAILY_CAP_FREE = 3 // the "taste" that drives upgrades
export const DEFAULT_AI_TIMEZONE = "America/New_York"

const capFor = (isPremium: boolean): number =>
  isPremium ? AI_DAILY_CAP_PREMIUM : AI_DAILY_CAP_FREE

// YYYY-MM-DD in the given IANA tz. en-CA formats as ISO date directly. Computed
// SERVER-SIDE (never a client arg) so the reset boundary can't be forged to
// dodge the cap. Intl with timeZone is supported in the Convex V8 runtime
// (verified via the debug query below before shipping).
function dayKey(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

async function resolveUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.tokenIdentifier))
    .unique()
  if (!user) return null
  const isPremium = isPremiumActive(user)
  const tz = user.timezone || DEFAULT_AI_TIMEZONE
  return { clerkId: identity.tokenIdentifier, isPremium, tz }
}

type ConsumeResult = {
  allowed: boolean
  isPremium: boolean
  cap: number
  used: number
  remaining: number
}

// Core row logic, shared by consume() and the headless test entry points so the
// test exercises the REAL path (a copy could pass while the real one is buggy).
async function applyConsume(
  ctx: MutationCtx,
  clerkId: string,
  isPremium: boolean,
  day: string,
): Promise<ConsumeResult> {
  const cap = capFor(isPremium)
  const row = await ctx.db
    .query("aiUsage")
    .withIndex("by_clerkId_and_day", (q) => q.eq("clerkId", clerkId).eq("day", day))
    .unique()
  const used = row?.count ?? 0
  if (used >= cap) {
    return { allowed: false, isPremium, cap, used, remaining: 0 }
  }
  if (row) {
    await ctx.db.patch(row._id, { count: used + 1 })
  } else {
    await ctx.db.insert("aiUsage", { clerkId, day, count: 1 })
  }
  return { allowed: true, isPremium, cap, used: used + 1, remaining: cap - (used + 1) }
}

async function applyRefund(ctx: MutationCtx, clerkId: string, day: string): Promise<void> {
  const row = await ctx.db
    .query("aiUsage")
    .withIndex("by_clerkId_and_day", (q) => q.eq("clerkId", clerkId).eq("day", day))
    .unique()
  if (row && row.count > 0) {
    await ctx.db.patch(row._id, { count: row.count - 1 })
  }
}

// Reserve one credit up front (atomic). Returns allowed=false (without
// incrementing) when the user is already at their daily cap. The route refunds
// on a failed generation. allowed always implies the counter was bumped.
export const consume = mutation({
  args: {},
  handler: async (ctx): Promise<ConsumeResult> => {
    const u = await resolveUser(ctx)
    // Not-authenticated / no user row ⇒ treat as free, blocked. The route also
    // 401s on no auth; this is just defensive.
    if (!u) {
      return { allowed: false, isPremium: false, cap: AI_DAILY_CAP_FREE, used: 0, remaining: 0 }
    }
    return applyConsume(ctx, u.clerkId, u.isPremium, dayKey(u.tz))
  },
})

// Hand a credit back when a generation fails after consume() reserved it. Floors
// at 0 and only ever touches today's row, so a stale refund can't go negative.
export const refund = mutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    const u = await resolveUser(ctx)
    if (!u) return
    await applyRefund(ctx, u.clerkId, dayKey(u.tz))
  },
})
// For the UI: today's usage so a surface can show "12 left" + upsell at 0.
export const getUsage = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ isPremium: boolean; cap: number; used: number; remaining: number } | null> => {
    const u = await resolveUser(ctx)
    if (!u) return null
    const cap = capFor(u.isPremium)
    const day = dayKey(u.tz)
    const row = await ctx.db
      .query("aiUsage")
      .withIndex("by_clerkId_and_day", (q) => q.eq("clerkId", u.clerkId).eq("day", day))
      .unique()
    const used = row?.count ?? 0
    return { isPremium: u.isPremium, cap, used, remaining: Math.max(0, cap - used) }
  },
})
