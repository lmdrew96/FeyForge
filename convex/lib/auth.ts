import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"

// ── Campaign authorization helpers ────────────────────────────────────────────
// Authorization for campaign-scoped endpoints is gated by the caller's role in
// the *specific* campaign, never a global mode — a user can be DM of one
// campaign and a player in another.
//
// Convention:
//   • Campaign-scoped READS use getMembership / getMembershipBySession and
//     return [] / null to non-members (never throw — a thrown error would break
//     the reactive query on the client).
//   • Campaign-scoped WRITES use the require* variants, which throw.
//
// Reference call sites: convex/wiki.ts, convex/worldMap.ts.

type AnyCtx = QueryCtx | MutationCtx

export type Membership = {
  member: Doc<"campaignMembers">
  userId: string
}

// The caller's membership in a campaign, or null if unauthenticated or not a
// member. Safe in queries — never throws.
export async function getMembership(
  ctx: AnyCtx,
  campaignId: Id<"campaigns">,
): Promise<Membership | null> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null
  const member = await ctx.db
    .query("campaignMembers")
    .withIndex("by_campaignId_and_userId", (q) =>
      q.eq("campaignId", campaignId).eq("userId", identity.tokenIdentifier),
    )
    .first()
  return member ? { member, userId: identity.tokenIdentifier } : null
}

// Membership resolved from a party-session id (loads the session, then checks
// membership in its campaign). Returns the session alongside the membership so
// callers don't re-fetch it. Null if the session is missing or the caller isn't
// a member. Safe in queries.
export async function getMembershipBySession(
  ctx: AnyCtx,
  sessionId: Id<"partySessions">,
): Promise<(Membership & { session: Doc<"partySessions"> }) | null> {
  const session = await ctx.db.get(sessionId)
  if (!session) return null
  const m = await getMembership(ctx, session.campaignId)
  if (!m) return null
  return { ...m, session }
}

// Mutation guard: throws unless the caller is the DM of the campaign. Returns
// the caller's userId.
export async function requireDm(
  ctx: MutationCtx,
  campaignId: Id<"campaigns">,
  errorMessage = "Only the DM can do that",
): Promise<string> {
  const m = await getMembership(ctx, campaignId)
  if (!m || m.member.role !== "dm") throw new Error(errorMessage)
  return m.userId
}

// True if the caller is a platform admin. Safe in queries (returns false rather
// than throwing) so admin-only reads can fall back to a non-admin view.
export async function isAdmin(ctx: AnyCtx): Promise<boolean> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return false
  const me = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.tokenIdentifier))
    .unique()
  return me?.role === "admin"
}
