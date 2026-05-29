import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import type { MutationCtx } from "./_generated/server"

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

    // Prefer the campaign that currently has a live session (most-recently started
    // if the user belongs to several with active sessions).
    let live: {
      campaignId: Id<"campaigns">
      role: "dm" | "player"
      session: Doc<"partySessions">
    } | null = null

    for (const m of memberships) {
      const active = await ctx.db
        .query("partySessions")
        .withIndex("by_campaignId_and_isActive", (q) =>
          q.eq("campaignId", m.campaignId).eq("isActive", true)
        )
        .first()
      if (active && (!live || (live.session && active.startedAt > live.session.startedAt))) {
        live = { campaignId: m.campaignId, role: m.role, session: active }
      }
    }

    if (live) {
      return { campaignId: live.campaignId, role: live.role, session: live.session }
    }

    // No live session anywhere — fall back to the DM membership (so the DM lands on
    // the "ready to start" view), else the most recent membership.
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
