import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import type { Doc, Id } from "./_generated/dataModel"
import type { QueryCtx, MutationCtx } from "./_generated/server"
import { getMembershipBySession } from "./lib/auth"

// Live in-session chat. Any session member (player or DM) can post to the group
// or send a private 1:1 to another participant. Membership-gated end to end;
// sender identity is stamped server-side (no spoofing), and a private message is
// only ever returned to its two participants — see listMessages. Mirrors the
// sessionRolls real-time feed; the sessionMessages table lives in schema.ts.

const MAX_BODY = 2000

type Participant = { userId: string; name: string; isDm: boolean }

// A user's display name (social profile), falling back to a supplied default.
async function resolveName(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  fallback: string,
): Promise<string> {
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", userId))
    .unique()
  return user?.displayName?.trim() || fallback
}

// Everyone who can chat in a session: the DM plus each joined party member. Names
// prefer the social display name, falling back to the character name (players) or
// a generic label. Used for the recipient picker and for stamping sender names.
async function getParticipants(
  ctx: QueryCtx | MutationCtx,
  session: Doc<"partySessions">,
): Promise<Participant[]> {
  const members = await ctx.db
    .query("partyMembers")
    .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
    .take(20)

  const players: Participant[] = await Promise.all(
    members.map(async (m) => {
      const character = await ctx.db.get(m.characterId)
      const name = await resolveName(ctx, m.userId, character?.name ?? "Player")
      return { userId: m.userId, name, isDm: false }
    }),
  )

  const dm: Participant = {
    userId: session.dmUserId,
    name: await resolveName(ctx, session.dmUserId, "DM"),
    isDm: true,
  }

  // The DM may also have joined as a player (DMPC etc.) — dedupe on userId, DM wins.
  const seen = new Set<string>([dm.userId])
  return [dm, ...players.filter((p) => !seen.has(p.userId) && (seen.add(p.userId), true))]
}

// Post a message to the session. recipientUserId unset = group; set = a private
// 1:1 to that participant. Membership-gated; the body is trimmed + length-capped
// and the recipient (if any) must be a real participant other than the sender.
export const send = mutation({
  args: {
    sessionId: v.id("partySessions"),
    body: v.string(),
    recipientUserId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<null> => {
    const m = await getMembershipBySession(ctx, args.sessionId)
    if (!m) throw new Error("Only session members can chat.")

    const body = args.body.trim().slice(0, MAX_BODY)
    if (!body) throw new Error("Message is empty.")

    let recipientUserId: string | undefined
    let recipientName: string | undefined
    if (args.recipientUserId) {
      if (args.recipientUserId === m.userId) {
        throw new Error("You can't whisper to yourself.")
      }
      const participants = await getParticipants(ctx, m.session)
      const recipient = participants.find((p) => p.userId === args.recipientUserId)
      if (!recipient) throw new Error("That player isn't in this session.")
      recipientUserId = recipient.userId
      recipientName = recipient.name
    }

    const role = m.member.role === "dm" ? "DM" : "Player"
    const senderName = await resolveName(ctx, m.userId, role)

    await ctx.db.insert("sessionMessages", {
      sessionId: args.sessionId,
      campaignId: m.session.campaignId,
      senderUserId: m.userId,
      senderName,
      body,
      recipientUserId,
      recipientName,
      createdAt: Date.now(),
    })
    return null
  },
})

// The session's chat, oldest→newest, capped to the recent window. Membership-
// gated (returns [] to non-members so the reactive query never throws client-
// side). A private message is filtered out unless the caller is its sender or
// recipient — a whisper is never visible to anyone else, the game DM included.
export const listMessages = query({
  args: { sessionId: v.id("partySessions") },
  handler: async (ctx, args): Promise<Doc<"sessionMessages">[]> => {
    const m = await getMembershipBySession(ctx, args.sessionId)
    if (!m) return []
    const me = m.userId
    const recent = await ctx.db
      .query("sessionMessages")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(100)
    const visible = recent.filter(
      (msg) =>
        msg.recipientUserId === undefined ||
        msg.senderUserId === me ||
        msg.recipientUserId === me,
    )
    return visible.reverse() // chronological for reading
  },
})

// The participants a player can whisper to (everyone but themselves). Returns []
// to non-members. `isDm` lets the UI flag the DM in the picker.
export const listParticipants = query({
  args: { sessionId: v.id("partySessions") },
  handler: async (
    ctx,
    args,
  ): Promise<{ userId: string; name: string; isDm: boolean }[]> => {
    const m = await getMembershipBySession(ctx, args.sessionId)
    if (!m) return []
    const participants = await getParticipants(ctx, m.session)
    return participants.filter((p) => p.userId !== m.userId)
  },
})
