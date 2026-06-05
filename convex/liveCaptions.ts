import { v } from "convex/values"
import { action, internalQuery, mutation, query } from "./_generated/server"
import type { MutationCtx } from "./_generated/server"
import { internal } from "./_generated/api"
import type { Doc, Id } from "./_generated/dataModel"
import { getMembershipBySession, requireDm } from "./lib/auth"
import { isPremiumActive } from "./premiumStatus"

// Shared write-path gate: the caller must be the DM of the session's campaign AND
// premium. Fail-closed — a write path must never trust the client. Returns the
// session so callers have campaignId without re-fetching.
async function requireCaptioningDm(
  ctx: MutationCtx,
  sessionId: Id<"partySessions">,
): Promise<Doc<"partySessions">> {
  const session = await ctx.db.get(sessionId)
  if (!session) throw new Error("Session not found")
  const userId = await requireDm(ctx, session.campaignId, "Only the DM can send captions.")
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", userId))
    .unique()
  if (!user || !isPremiumActive(user)) {
    throw new Error("Live captions are a premium feature.")
  }
  return session
}

// The session's single in-progress partial row, if any.
async function getPartialRow(ctx: MutationCtx, sessionId: Id<"partySessions">) {
  return await ctx.db
    .query("liveCaptions")
    .withIndex("by_sessionId_and_isPartial", (q) =>
      q.eq("sessionId", sessionId).eq("isPartial", true),
    )
    .unique()
}

// Live captions: one-way DM speech → players during a live session, via
// AssemblyAI v3 streaming. The DM's browser mints a token (getStreamingToken),
// opens a WebSocket, and pushes each finalized line (pushLine). Players read the
// reactive listRecent query — the same real-time pattern as sessionBroadcasts.
//
// Access model (decided with Nae): a PREMIUM DM unlocks captions for the whole
// table — every player in the session reads them free. The recurring AssemblyAI
// cost (~$0.15/hr, one mic stream per session) follows the paying DM.

// Internal gate: the caller must be the DM of the session's campaign AND have an
// active premium entitlement. Throws a user-facing message on failure (the
// calling action lets it bubble to the client). Returns the campaignId so the
// caller has it without re-fetching.
export const assertDmCanCaption = internalQuery({
  args: { sessionId: v.id("partySessions") },
  handler: async (ctx, args): Promise<{ campaignId: Id<"campaigns"> }> => {
    const m = await getMembershipBySession(ctx, args.sessionId)
    if (!m || m.member.role !== "dm") {
      throw new Error("Only the DM can start live captions.")
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", m.userId))
      .unique()
    if (!user || !isPremiumActive(user)) {
      throw new Error("Live captions are a premium feature.")
    }
    return { campaignId: m.session.campaignId }
  },
})

// Mint a short-lived AssemblyAI v3 streaming token for the DM's browser to open
// a transcription WebSocket. Gated to the premium DM of the session. Runs in the
// default Convex runtime — fetch() is available, no "use node" needed. Auth
// propagates from the authenticated client through to the internal gate query.
export const getStreamingToken = action({
  args: { sessionId: v.id("partySessions") },
  handler: async (ctx, args): Promise<{ token: string }> => {
    await ctx.runQuery(internal.liveCaptions.assertDmCanCaption, {
      sessionId: args.sessionId,
    })

    const apiKey = process.env.ASSEMBLYAI_API_KEY
    if (!apiKey) {
      throw new Error("Live captions are not configured (missing API key).")
    }

    const res = await fetch(
      "https://streaming.assemblyai.com/v3/token?expires_in_seconds=480",
      { method: "GET", headers: { Authorization: apiKey } },
    )
    if (!res.ok) {
      const detail = await res.text()
      throw new Error(`Failed to get caption token: ${res.statusText} — ${detail}`)
    }
    const data = (await res.json()) as { token: string }
    return { token: data.token }
  },
})

// Append one FINALIZED caption line (end of a speech turn) and clear the live
// partial, which has now resolved into this line. Skips empty lines.
export const pushLine = mutation({
  args: { sessionId: v.id("partySessions"), text: v.string() },
  handler: async (ctx, args): Promise<null> => {
    const text = args.text.trim()
    if (!text) return null

    const session = await requireCaptioningDm(ctx, args.sessionId)
    await ctx.db.insert("liveCaptions", {
      sessionId: args.sessionId,
      campaignId: session.campaignId,
      text,
      createdAt: Date.now(),
      isPartial: false,
    })

    const partial = await getPartialRow(ctx, args.sessionId)
    if (partial) await ctx.db.delete(partial._id)
    return null
  },
})

// Upsert the session's single in-progress partial line (the current turn as it's
// being spoken). Called throttled from the DM client so players see words appear
// continuously instead of waiting for the turn to finalize. Empty text clears it.
export const setLivePartial = mutation({
  args: { sessionId: v.id("partySessions"), text: v.string() },
  handler: async (ctx, args): Promise<null> => {
    const session = await requireCaptioningDm(ctx, args.sessionId)
    const text = args.text.trim()
    const existing = await getPartialRow(ctx, args.sessionId)

    if (!text) {
      if (existing) await ctx.db.delete(existing._id)
      return null
    }
    if (existing) {
      await ctx.db.patch(existing._id, { text, createdAt: Date.now() })
    } else {
      await ctx.db.insert("liveCaptions", {
        sessionId: args.sessionId,
        campaignId: session.campaignId,
        text,
        createdAt: Date.now(),
        isPartial: true,
      })
    }
    return null
  },
})

// Recent finalized lines (oldest→newest) plus the current partial, for the
// overlay. The client time-windows these so they age out after silence and don't
// resurrect on refresh. Members only (returns empty to non-members so the
// reactive query never throws on the client).
export const listRecent = query({
  args: { sessionId: v.id("partySessions") },
  handler: async (
    ctx,
    args,
  ): Promise<{ lines: Doc<"liveCaptions">[]; partial: Doc<"liveCaptions"> | null }> => {
    const m = await getMembershipBySession(ctx, args.sessionId)
    if (!m) return { lines: [], partial: null }

    const finals = await ctx.db
      .query("liveCaptions")
      .withIndex("by_sessionId_and_isPartial", (q) =>
        q.eq("sessionId", args.sessionId).eq("isPartial", false),
      )
      .order("desc")
      .take(6)
    const partial = await ctx.db
      .query("liveCaptions")
      .withIndex("by_sessionId_and_isPartial", (q) =>
        q.eq("sessionId", args.sessionId).eq("isPartial", true),
      )
      .unique()

    return { lines: finals.reverse(), partial }
  },
})
