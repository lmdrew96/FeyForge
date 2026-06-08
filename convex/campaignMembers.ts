import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import type { Id } from "./_generated/dataModel"
import type { MutationCtx } from "./_generated/server"
import { resolveActiveCampaignId, setActiveCampaignForUser } from "./users"

// ── Join code generation ────────────────────────────────────────────────────
// Charset excludes ambiguous glyphs (0/O, 1/I/L) so codes are easy to read aloud.
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
const CODE_LENGTH = 5

function randomCode(): string {
  let body = ""
  for (let i = 0; i < CODE_LENGTH; i++) {
    body += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return `FEY-${body}`
}

// Generates a join code guaranteed unique against existing campaigns.
export async function generateUniqueJoinCode(ctx: MutationCtx): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = randomCode()
    const clash = await ctx.db
      .query("campaigns")
      .withIndex("by_joinCode", (q) => q.eq("joinCode", code))
      .first()
    if (!clash) return code
  }
  throw new Error("Could not generate a unique join code — please try again")
}

// Ensures a campaign has a DM membership for its owner and a join code.
// Idempotent: safe to call on every campaign-creation path.
export async function ensureCampaignSetup(
  ctx: MutationCtx,
  campaignId: Id<"campaigns">,
  ownerUserId: string
): Promise<void> {
  const existingDm = await ctx.db
    .query("campaignMembers")
    .withIndex("by_campaignId_and_userId", (q) =>
      q.eq("campaignId", campaignId).eq("userId", ownerUserId)
    )
    .first()
  if (!existingDm) {
    await ctx.db.insert("campaignMembers", {
      campaignId,
      userId: ownerUserId,
      role: "dm",
      joinedAt: Date.now(),
    })
  }

  const campaign = await ctx.db.get(campaignId)
  if (campaign && !campaign.joinCode) {
    await ctx.db.patch(campaignId, { joinCode: await generateUniqueJoinCode(ctx) })
  }
}

// ── Context resolution ──────────────────────────────────────────────────────
// Replaces the old getMyDefaultCampaign / getAnyActiveSession / isDM=!!myCampaign
// tangle. Resolves which campaign + role + live session the current user is in.
export const getMyCampaignContext = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const memberships = await ctx.db
      .query("campaignMembers")
      .withIndex("by_userId", (q) => q.eq("userId", identity.tokenIdentifier))
      .collect()
    if (memberships.length === 0) return null

    // The user's active campaign is the primary context. resolveActiveCampaignId
    // guarantees a returned id is one the user belongs to.
    const activeId = await resolveActiveCampaignId(ctx, identity.tokenIdentifier)
    const activeMembership = activeId
      ? memberships.find((m) => m.campaignId === activeId) ?? null
      : null

    // Prefer a live session in the active campaign.
    if (activeMembership) {
      const session = await ctx.db
        .query("partySessions")
        .withIndex("by_campaignId_and_isActive", (q) =>
          q.eq("campaignId", activeMembership.campaignId).eq("isActive", true)
        )
        .first()
      if (session) {
        return { campaignId: activeMembership.campaignId, role: activeMembership.role, session }
      }
    }

    // No live session in the selected campaign. Honor the explicit selection
    // rather than pulling the user into a DIFFERENT campaign's session — doing so
    // surfaced the DM Conductor to someone who had selected a campaign where they
    // are only a player (a user who DMs one campaign but plays in another saw the
    // other campaign's DM view). A DM sees their "ready to start" view here; a
    // player sees the waiting/empty state. The campaign switcher is how the user
    // moves between campaigns, and both join paths keep activeCampaignId current
    // (setupDMSession + joinByCode call setActiveCampaignForUser), so any live
    // session you belong to stays reachable by selecting its campaign.
    if (activeMembership) {
      return { campaignId: activeMembership.campaignId, role: activeMembership.role, session: null }
    }

    // Defensive only: resolveActiveCampaignId returns a membership id whenever the
    // user has any, so activeMembership is set above. Prefer a DM campaign, else
    // the most recent.
    const dm = memberships.find((m) => m.role === "dm")
    const chosen = dm ?? memberships[memberships.length - 1]
    return { campaignId: chosen.campaignId, role: chosen.role, session: null }
  },
})

// Returns the current user's role in a specific campaign (or null if not a member).
export const getMyRole = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    const member = await ctx.db
      .query("campaignMembers")
      .withIndex("by_campaignId_and_userId", (q) =>
        q.eq("campaignId", args.campaignId).eq("userId", identity.tokenIdentifier)
      )
      .first()
    return member?.role ?? null
  },
})

// All campaigns the current user belongs to, with their per-campaign role —
// powers the nav campaign switcher. Membership-based, so it includes both
// campaigns the user owns (they are the "dm" member) and ones they joined as a
// player. Sorted by name for a stable, scannable list.
export const listMyCampaigns = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const memberships = await ctx.db
      .query("campaignMembers")
      .withIndex("by_userId", (q) => q.eq("userId", identity.tokenIdentifier))
      .take(100)

    const resolved = await Promise.all(
      memberships.map(async (m) => {
        const campaign = await ctx.db.get(m.campaignId)
        if (!campaign) return null
        return { campaignId: m.campaignId, name: campaign.name, role: m.role }
      })
    )

    return resolved
      .filter(
        (c): c is { campaignId: Id<"campaigns">; name: string; role: "dm" | "player" } =>
          c !== null
      )
      .sort((a, b) => a.name.localeCompare(b.name))
  },
})

// ── Invite flow ──────────────────────────────────────────────────────────────
// Minimal public-facing lookup for the join landing page. Auth required so we
// never expose campaign existence to anonymous probing.
export const resolveJoinCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const campaign = await ctx.db
      .query("campaigns")
      .withIndex("by_joinCode", (q) => q.eq("joinCode", args.code))
      .first()
    if (!campaign) return null

    const existingMembership = await ctx.db
      .query("campaignMembers")
      .withIndex("by_campaignId_and_userId", (q) =>
        q.eq("campaignId", campaign._id).eq("userId", identity.tokenIdentifier)
      )
      .first()

    const activeSession = await ctx.db
      .query("partySessions")
      .withIndex("by_campaignId_and_isActive", (q) =>
        q.eq("campaignId", campaign._id).eq("isActive", true)
      )
      .first()

    return {
      campaignId: campaign._id,
      campaignName: campaign.name,
      description: campaign.description ?? null,
      alreadyMember: existingMembership !== null,
      myRole: existingMembership?.role ?? null,
      sessionLive: activeSession !== null,
    }
  },
})

// Joins the current user to a campaign as a player via its invite code.
// Idempotent on membership; stamps the chosen character to the campaign and,
// if a session is live, registers the player in it.
export const joinByCode = mutation({
  args: { code: v.string(), characterId: v.id("characters") },
  handler: async (ctx, args): Promise<{ campaignId: Id<"campaigns"> }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const campaign = await ctx.db
      .query("campaigns")
      .withIndex("by_joinCode", (q) => q.eq("joinCode", args.code))
      .first()
    if (!campaign) throw new Error("Invalid invite code")

    // The character must belong to the joining user.
    const character = await ctx.db.get(args.characterId)
    if (!character || character.userId !== identity.tokenIdentifier) {
      throw new Error("Character not found")
    }

    // Create or update the player membership (idempotent).
    const existing = await ctx.db
      .query("campaignMembers")
      .withIndex("by_campaignId_and_userId", (q) =>
        q.eq("campaignId", campaign._id).eq("userId", identity.tokenIdentifier)
      )
      .first()

    if (existing) {
      // Don't demote a DM who follows their own link; just update the character.
      await ctx.db.patch(existing._id, { characterId: args.characterId })
    } else {
      await ctx.db.insert("campaignMembers", {
        campaignId: campaign._id,
        userId: identity.tokenIdentifier,
        role: "player",
        characterId: args.characterId,
        joinedAt: Date.now(),
      })
    }

    // Associate the character with this campaign so it shows in the roster.
    await ctx.db.patch(args.characterId, { campaignId: campaign._id })

    // The campaign you just joined becomes your active one, so the session view
    // resolves to it instead of a stale prior campaign.
    await setActiveCampaignForUser(ctx, identity.tokenIdentifier, campaign._id)

    // If a session is live, register the player in it now (mirrors joinSession).
    const activeSession = await ctx.db
      .query("partySessions")
      .withIndex("by_campaignId_and_isActive", (q) =>
        q.eq("campaignId", campaign._id).eq("isActive", true)
      )
      .first()

    if (activeSession) {
      const existingPartyMember = await ctx.db
        .query("partyMembers")
        .withIndex("by_sessionId_and_userId", (q) =>
          q.eq("sessionId", activeSession._id).eq("userId", identity.tokenIdentifier)
        )
        .first()
      if (existingPartyMember) {
        await ctx.db.patch(existingPartyMember._id, { characterId: args.characterId })
      } else {
        await ctx.db.insert("partyMembers", {
          sessionId: activeSession._id,
          campaignId: campaign._id,
          userId: identity.tokenIdentifier,
          characterId: args.characterId,
          joinedAt: Date.now(),
          conditions: [],
        })
      }
    }

    return { campaignId: campaign._id }
  },
})

// ── DM management ─────────────────────────────────────────────────────────────
async function requireDm(
  ctx: MutationCtx,
  campaignId: Id<"campaigns">,
  userId: string
): Promise<void> {
  const member = await ctx.db
    .query("campaignMembers")
    .withIndex("by_campaignId_and_userId", (q) =>
      q.eq("campaignId", campaignId).eq("userId", userId)
    )
    .first()
  if (!member || member.role !== "dm") {
    throw new Error("Only the DM can manage this campaign")
  }
}

export const regenerateJoinCode = mutation({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args): Promise<string> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    await requireDm(ctx, args.campaignId, identity.tokenIdentifier)

    const code = await generateUniqueJoinCode(ctx)
    await ctx.db.patch(args.campaignId, { joinCode: code })
    return code
  },
})

export const listMembers = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    // Only members of the campaign can see the roster.
    const me = await ctx.db
      .query("campaignMembers")
      .withIndex("by_campaignId_and_userId", (q) =>
        q.eq("campaignId", args.campaignId).eq("userId", identity.tokenIdentifier)
      )
      .first()
    if (!me) return []

    const members = await ctx.db
      .query("campaignMembers")
      .withIndex("by_campaignId", (q) => q.eq("campaignId", args.campaignId))
      .collect()

    return await Promise.all(
      members.map(async (m) => ({
        ...m,
        character: m.characterId ? await ctx.db.get(m.characterId) : null,
        isMe: m.userId === identity.tokenIdentifier,
      }))
    )
  },
})

export const removeMember = mutation({
  args: { memberId: v.id("campaignMembers") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const member = await ctx.db.get(args.memberId)
    if (!member) return
    await requireDm(ctx, member.campaignId, identity.tokenIdentifier)

    if (member.role === "dm") {
      throw new Error("Can't remove the DM from their own campaign")
    }
    await ctx.db.delete(args.memberId)
  },
})
