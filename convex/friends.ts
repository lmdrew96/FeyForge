import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import type { Doc } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { requireDm } from "./lib/auth"
import { createNotification } from "./lib/notify"

// ── Friends system ────────────────────────────────────────────────────────────
// The friend graph + discovery. Everything keys on clerkId (tokenIdentifier)
// strings, matching campaignMembers. Discovery is intentionally limited to
// shared-campaign suggestions + a per-user friend code — NO open username search
// (enumeration/harassment vector for a vulnerable userbase). See the friendships
// table comment in schema.ts.

type AnyCtx = QueryCtx | MutationCtx

// A friend's public-facing card. displayName/avatarUrl come from the user row;
// they backfill on the owner's next sign-in (upsertUser), so a freshly-migrated
// user may briefly read as "Adventurer".
type FriendCard = {
  friendshipId: string
  userId: string
  displayName: string
  avatarUrl: string | null
}

// An accepted friend, plus their last heartbeat (null if they've never been seen).
// "Online" is derived client-side from lastSeenAt — see app/friends.
type FriendWithPresence = FriendCard & { lastSeenAt: number | null }

// Resolves a clerkId to its display card, with a stable fallback label so the
// client never has to special-case a missing profile.
async function resolveProfile(
  ctx: AnyCtx,
  userId: string,
): Promise<{ displayName: string; avatarUrl: string | null }> {
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", userId))
    .unique()
  return {
    displayName: user?.displayName?.trim() || "Adventurer",
    avatarUrl: user?.avatarUrl ?? null,
  }
}

// The single row (if any) between two users, regardless of who requested whom.
async function findRelationship(
  ctx: AnyCtx,
  a: string,
  b: string,
): Promise<Doc<"friendships"> | null> {
  const ab = await ctx.db
    .query("friendships")
    .withIndex("by_requester_and_addressee", (q) =>
      q.eq("requesterId", a).eq("addresseeId", b),
    )
    .first()
  if (ab) return ab
  return await ctx.db
    .query("friendships")
    .withIndex("by_requester_and_addressee", (q) =>
      q.eq("requesterId", b).eq("addresseeId", a),
    )
    .first()
}

// ── Reads ─────────────────────────────────────────────────────────────────────

// The caller's accepted friends. A friendship is symmetric, so we union the rows
// where I'm the requester with those where I'm the addressee.
export const listFriends = query({
  args: {},
  handler: async (ctx): Promise<FriendWithPresence[]> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []
    const me = identity.tokenIdentifier

    const asRequester = await ctx.db
      .query("friendships")
      .withIndex("by_requester", (q) => q.eq("requesterId", me))
      .take(500)
    const asAddressee = await ctx.db
      .query("friendships")
      .withIndex("by_addressee", (q) => q.eq("addresseeId", me))
      .take(500)

    const accepted = [...asRequester, ...asAddressee].filter(
      (f) => f.status === "accepted",
    )

    const cards = await Promise.all(
      accepted.map(async (f) => {
        const otherId = f.requesterId === me ? f.addresseeId : f.requesterId
        const profile = await resolveProfile(ctx, otherId)
        const presence = await ctx.db
          .query("presence")
          .withIndex("by_userId", (q) => q.eq("userId", otherId))
          .unique()
        return {
          friendshipId: f._id as string,
          userId: otherId,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          lastSeenAt: presence?.lastSeenAt ?? null,
        }
      }),
    )
    return cards.sort((a, b) => a.displayName.localeCompare(b.displayName))
  },
})

// The caller's pending requests, split into ones to act on (incoming) and ones
// awaiting the other person (outgoing).
export const listPendingRequests = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ incoming: FriendCard[]; outgoing: FriendCard[] }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return { incoming: [], outgoing: [] }
    const me = identity.tokenIdentifier

    const incomingRows = await ctx.db
      .query("friendships")
      .withIndex("by_addressee", (q) => q.eq("addresseeId", me))
      .take(200)
    const outgoingRows = await ctx.db
      .query("friendships")
      .withIndex("by_requester", (q) => q.eq("requesterId", me))
      .take(200)

    const incoming = await Promise.all(
      incomingRows
        .filter((f) => f.status === "pending")
        .map(async (f) => {
          const profile = await resolveProfile(ctx, f.requesterId)
          return {
            friendshipId: f._id as string,
            userId: f.requesterId,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
          }
        }),
    )
    const outgoing = await Promise.all(
      outgoingRows
        .filter((f) => f.status === "pending")
        .map(async (f) => {
          const profile = await resolveProfile(ctx, f.addresseeId)
          return {
            friendshipId: f._id as string,
            userId: f.addresseeId,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
          }
        }),
    )
    return { incoming, outgoing }
  },
})

// "People you've played with" — members of the caller's campaigns who aren't
// already a friend / pending / blocked. The natural, privacy-preserving discovery
// surface for a D&D app (the data already exists in campaignMembers).
export const listSuggestions = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<Array<FriendCard & { viaCampaign: string }>> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []
    const me = identity.tokenIdentifier

    const myMemberships = await ctx.db
      .query("campaignMembers")
      .withIndex("by_userId", (q) => q.eq("userId", me))
      .take(100)

    // candidate userId -> the name of a campaign we share (the "via" label)
    const candidates = new Map<string, string>()
    for (const m of myMemberships) {
      const campaign = await ctx.db.get(m.campaignId)
      const members = await ctx.db
        .query("campaignMembers")
        .withIndex("by_campaignId", (q) => q.eq("campaignId", m.campaignId))
        .take(200)
      for (const other of members) {
        if (other.userId === me) continue
        if (!candidates.has(other.userId)) {
          candidates.set(other.userId, campaign?.name ?? "a shared campaign")
        }
      }
      if (candidates.size >= 50) break // bound the fan-out
    }

    const out: Array<FriendCard & { viaCampaign: string }> = []
    for (const [userId, viaCampaign] of candidates) {
      const existing = await findRelationship(ctx, me, userId)
      if (existing) continue // already friends / pending / blocked
      const profile = await resolveProfile(ctx, userId)
      out.push({
        friendshipId: "", // no row yet; "Add" creates one
        userId,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        viaCampaign,
      })
    }
    return out.sort((a, b) => a.displayName.localeCompare(b.displayName))
  },
})

// ── Request lifecycle ─────────────────────────────────────────────────────────

// Shared send logic. If the target has already sent ME a pending request, this
// accepts it (the natural "you both added each other" case) instead of erroring.
async function doSendRequest(
  ctx: MutationCtx,
  me: string,
  target: string,
): Promise<{ status: "sent" | "accepted" }> {
  if (target === me) throw new Error("You can't add yourself")

  const existing = await findRelationship(ctx, me, target)
  const myProfile = await resolveProfile(ctx, me)

  if (existing) {
    if (existing.status === "accepted") throw new Error("You're already friends")
    // Don't reveal a block — same opaque message as a generic failure.
    if (existing.status === "blocked") throw new Error("Unable to send a request")
    // status === "pending"
    if (existing.requesterId === me) throw new Error("Request already sent")
    // The target already requested me → accept it.
    await ctx.db.patch(existing._id, { status: "accepted", updatedAt: Date.now() })
    await createNotification(ctx, target, "friend_accepted", {
      fromUserId: me,
      fromName: myProfile.displayName,
      fromAvatarUrl: myProfile.avatarUrl ?? undefined,
      friendshipId: existing._id,
    })
    return { status: "accepted" }
  }

  const now = Date.now()
  const friendshipId = await ctx.db.insert("friendships", {
    requesterId: me,
    addresseeId: target,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  })
  await createNotification(ctx, target, "friend_request", {
    fromUserId: me,
    fromName: myProfile.displayName,
    fromAvatarUrl: myProfile.avatarUrl ?? undefined,
    friendshipId,
  })
  return { status: "sent" }
}

// Send a friend request by the recipient's friend code (case-insensitive).
export const sendRequestByCode = mutation({
  args: { code: v.string() },
  handler: async (ctx, args): Promise<{ status: "sent" | "accepted" }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const code = args.code.trim().toUpperCase()
    if (!code) throw new Error("Enter a friend code")

    const target = await ctx.db
      .query("users")
      .withIndex("by_friendCode", (q) => q.eq("friendCode", code))
      .unique()
    if (!target) throw new Error("No one found with that friend code")

    return await doSendRequest(ctx, identity.tokenIdentifier, target.clerkId)
  },
})

// Send a friend request to a specific user (used by the shared-campaign
// suggestions, where the userId is already known).
export const sendRequestToUser = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args): Promise<{ status: "sent" | "accepted" }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    return await doSendRequest(ctx, identity.tokenIdentifier, args.userId)
  },
})

// Accept or decline an incoming request. Only the addressee can respond.
export const respondToRequest = mutation({
  args: { friendshipId: v.id("friendships"), accept: v.boolean() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const me = identity.tokenIdentifier

    const row = await ctx.db.get(args.friendshipId)
    if (!row || row.addresseeId !== me || row.status !== "pending") {
      throw new Error("Request not found")
    }

    if (args.accept) {
      await ctx.db.patch(args.friendshipId, {
        status: "accepted",
        updatedAt: Date.now(),
      })
      const myProfile = await resolveProfile(ctx, me)
      await createNotification(ctx, row.requesterId, "friend_accepted", {
        fromUserId: me,
        fromName: myProfile.displayName,
        fromAvatarUrl: myProfile.avatarUrl ?? undefined,
        friendshipId: row._id,
      })
    } else {
      // Decline simply removes the request so the requester can try again later.
      await ctx.db.delete(args.friendshipId)
    }
  },
})

// Remove an accepted friend (either side may do this). Deletes the row.
export const removeFriend = mutation({
  args: { friendshipId: v.id("friendships") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const me = identity.tokenIdentifier

    const row = await ctx.db.get(args.friendshipId)
    if (!row || (row.requesterId !== me && row.addresseeId !== me)) {
      throw new Error("Friendship not found")
    }
    await ctx.db.delete(args.friendshipId)
  },
})

// Block a user: collapse any existing relationship into a single blocked row
// owned by the blocker, or create one. A blocked pair can't be friend-requested
// (doSendRequest rejects it) and is excluded from friends/suggestions.
export const blockUser = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const me = identity.tokenIdentifier
    if (args.userId === me) throw new Error("You can't block yourself")

    const existing = await findRelationship(ctx, me, args.userId)
    const now = Date.now()
    if (existing) {
      await ctx.db.patch(existing._id, {
        requesterId: me, // blocker owns the row
        addresseeId: args.userId,
        status: "blocked",
        updatedAt: now,
      })
    } else {
      await ctx.db.insert("friendships", {
        requesterId: me,
        addresseeId: args.userId,
        status: "blocked",
        createdAt: now,
        updatedAt: now,
      })
    }
  },
})

// ── Campaign invite ───────────────────────────────────────────────────────────
// Direct-add a friend to a campaign the caller DMs: creates the player membership
// outright (no code-sharing round-trip) and notifies them. DM-gated; the target
// must be an accepted friend (so this can't be used to add arbitrary users).
export const inviteFriendToCampaign = mutation({
  args: { campaignId: v.id("campaigns"), friendUserId: v.string() },
  handler: async (ctx, args) => {
    const me = await requireDm(
      ctx,
      args.campaignId,
      "Only the DM can invite players to this campaign",
    )

    const rel = await findRelationship(ctx, me, args.friendUserId)
    if (!rel || rel.status !== "accepted") {
      throw new Error("You can only invite your friends")
    }

    const already = await ctx.db
      .query("campaignMembers")
      .withIndex("by_campaignId_and_userId", (q) =>
        q.eq("campaignId", args.campaignId).eq("userId", args.friendUserId),
      )
      .first()
    if (already) throw new Error("They're already in this campaign")

    await ctx.db.insert("campaignMembers", {
      campaignId: args.campaignId,
      userId: args.friendUserId,
      role: "player",
      joinedAt: Date.now(),
    })

    const campaign = await ctx.db.get(args.campaignId)
    const myProfile = await resolveProfile(ctx, me)
    await createNotification(ctx, args.friendUserId, "campaign_invite", {
      fromUserId: me,
      fromName: myProfile.displayName,
      fromAvatarUrl: myProfile.avatarUrl ?? undefined,
      campaignId: args.campaignId,
      campaignName: campaign?.name ?? "a campaign",
    })
  },
})

// ── Session "join now" invite (3b) ────────────────────────────────────────────
// Time-sensitive ping: the DM of a campaign with a LIVE session nudges an online
// friend to jump in right now. Ensures the friend is a campaign member first (so
// joinSession will admit them — see convex/liveSessions.ts), then fires a
// session_invite notification that deep-links them to /session. Surfaced only for
// online friends in the live-session invite dialog.
export const inviteFriendToSession = mutation({
  args: { campaignId: v.id("campaigns"), friendUserId: v.string() },
  handler: async (ctx, args) => {
    const me = await requireDm(
      ctx,
      args.campaignId,
      "Only the DM can invite players to this session",
    )

    const session = await ctx.db
      .query("partySessions")
      .withIndex("by_campaignId_and_isActive", (q) =>
        q.eq("campaignId", args.campaignId).eq("isActive", true),
      )
      .first()
    if (!session) throw new Error("No live session is running")

    const rel = await findRelationship(ctx, me, args.friendUserId)
    if (!rel || rel.status !== "accepted") {
      throw new Error("You can only invite your friends")
    }

    // Ensure they're a member so joinSession admits them; harmless if already one.
    const member = await ctx.db
      .query("campaignMembers")
      .withIndex("by_campaignId_and_userId", (q) =>
        q.eq("campaignId", args.campaignId).eq("userId", args.friendUserId),
      )
      .first()
    if (!member) {
      await ctx.db.insert("campaignMembers", {
        campaignId: args.campaignId,
        userId: args.friendUserId,
        role: "player",
        joinedAt: Date.now(),
      })
    }

    const campaign = await ctx.db.get(args.campaignId)
    const myProfile = await resolveProfile(ctx, me)
    await createNotification(ctx, args.friendUserId, "session_invite", {
      fromUserId: me,
      fromName: myProfile.displayName,
      fromAvatarUrl: myProfile.avatarUrl ?? undefined,
      campaignId: args.campaignId,
      campaignName: campaign?.name ?? "a campaign",
    })
  },
})
