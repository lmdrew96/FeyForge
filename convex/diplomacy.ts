import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import type { Id } from "./_generated/dataModel"
import { getMembership, requireDm } from "./lib/auth"
import { DIPLOMACY_STATUSES, NEUTRAL, autoHeadline, pairKey } from "../lib/worldMap/diplomacy"

// ── Living Diplomacy — campaign-scoped diplomacy overrides + World News ───────
// A DM-editable overlay on the base map's realm relations (worldMaps.realms[].relations).
// The merge (player sees revealed-only, DM sees truth) lives in the shared pure module
// lib/worldMap/diplomacy.ts and is applied by worldMap.getWorldbuilding. This file owns
// the writes (DM-only) + the role-aware feed (DM shift timeline / player World News).
// Reads are membership-gated; writes go through requireDm. Keyed by realm NAME so the
// overlay survives a map re-import (Azgaar indices scramble). See convex/schema.ts.

const revealV = v.union(
  v.literal("pending"),
  v.literal("revealed"),
  v.literal("held"),
  v.literal("private"),
)

// Allowed statuses: the symmetric editor set + the Neutral "clear" sentinel.
const ALLOWED_STATUSES = new Set<string>([...DIPLOMACY_STATUSES, NEUTRAL])

// Current base-map relation between two realms (either direction), if any. Used to seed
// an accurate `from` on the first override of a pair (before any override exists).
function baseRelationStatus(
  realms: { name: string; relations?: { relation: string; realm: string }[] }[] | undefined,
  a: string,
  b: string,
): string | undefined {
  if (!realms) return undefined
  const ra = realms.find((r) => r.name === a)
  const fromA = ra?.relations?.find((rel) => rel.realm === b)?.relation
  if (fromA) return fromA
  const rb = realms.find((r) => r.name === b)
  return rb?.relations?.find((rel) => rel.realm === a)?.relation
}

// ── Reads ────────────────────────────────────────────────────────────────────

// Role-aware diplomacy feed for the Realms & Faiths panel.
//   DM     → the full shift timeline (newest first) + held/pending counts + the
//            global World-News toggle state, so the panel can drive the Held tray.
//   player → the World News feed: revealed headlines only, and only when the campaign's
//            global toggle is on (off → silent; shifts still log, players see nothing).
// Returns null for non-members.
export const feed = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const m = await getMembership(ctx, args.campaignId)
    if (!m) return null

    const rows = await ctx.db
      .query("diplomacyOverrides")
      .withIndex("by_campaignId", (q) => q.eq("campaignId", args.campaignId))
      .take(500)

    const campaign = await ctx.db.get(args.campaignId)
    const worldNewsEnabled = campaign?.worldNewsEnabled ?? false

    if (m.member.role === "dm") {
      const shifts = rows
        .flatMap((r) =>
          r.log.map((e, entryIndex) => ({
            overrideId: r._id,
            entryIndex,
            realmA: r.realmA,
            realmB: r.realmB,
            currentStatus: r.status,
            ...e,
          })),
        )
        .sort((a, b) => b.changedAt - a.changedAt)
      return {
        role: "dm" as const,
        shifts,
        heldCount: shifts.filter((s) => s.reveal === "held").length,
        pendingCount: shifts.filter((s) => s.reveal === "pending").length,
        worldNewsEnabled,
      }
    }

    // Player view.
    if (!worldNewsEnabled) return { role: "player" as const, news: [], worldNewsEnabled: false }
    const news = rows
      .flatMap((r) =>
        r.log
          .filter((e) => e.reveal === "revealed")
          .map((e) => ({
            realmA: r.realmA,
            realmB: r.realmB,
            // Headline is set at reveal time; fall back to a generated line defensively.
            headline: e.headline ?? autoHeadline(r.realmA, r.realmB, e.to, e.from),
            // Held items surface as FRESH news at revealedAt even though changedAt is older.
            revealedAt: e.revealedAt ?? e.changedAt,
          })),
      )
      .sort((a, b) => b.revealedAt - a.revealedAt)
    return { role: "player" as const, news, worldNewsEnabled: true }
  },
})

// The world's realm names, for the DM's "+ add relationship" picker. Membership-gated.
export const realmNames = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const m = await getMembership(ctx, args.campaignId)
    if (!m) return []
    const map = await ctx.db
      .query("worldMaps")
      .withIndex("by_campaignId", (q) => q.eq("campaignId", args.campaignId))
      .first()
    return (map?.realms ?? []).map((r) => r.name)
  },
})

// ── Writes (DM-only) ─────────────────────────────────────────────────────────

// Set the relationship between two realms and append a shift to the change log with a
// reveal disposition (the inline "make this news?" outcome): revealed / held / private /
// pending. The diplomacy CHANGE always happens + logs (the truth); reveal only controls
// what players see. Pair names are sorted so each pair has exactly one row.
export const setRelation = mutation({
  args: {
    campaignId: v.id("campaigns"),
    realmA: v.string(),
    realmB: v.string(),
    status: v.string(),
    reveal: revealV,
    headline: v.optional(v.string()),
    dmNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireDm(ctx, args.campaignId, "Only the DM can change diplomacy")
    if (!ALLOWED_STATUSES.has(args.status)) throw new Error(`Invalid status: ${args.status}`)
    const [realmA, realmB] = pairKey(args.realmA.trim(), args.realmB.trim())
    if (!realmA || !realmB || realmA === realmB) throw new Error("Two distinct realms required")

    const now = Date.now()
    const existing = await ctx.db
      .query("diplomacyOverrides")
      .withIndex("by_campaignId_and_pair", (q) =>
        q.eq("campaignId", args.campaignId).eq("realmA", realmA).eq("realmB", realmB),
      )
      .unique()

    // Accurate `from`: the existing override status, else the base-map relation, else Neutral.
    let from: string
    if (existing) {
      from = existing.status
    } else {
      const map = await ctx.db
        .query("worldMaps")
        .withIndex("by_campaignId", (q) => q.eq("campaignId", args.campaignId))
        .first()
      from = baseRelationStatus(map?.realms, realmA, realmB) ?? NEUTRAL
    }
    if (from === args.status) return // no-op: relationship unchanged

    const headline = args.headline?.trim() || undefined
    const entry = {
      changedAt: now,
      from,
      to: args.status,
      ...(args.dmNote?.trim() ? { dmNote: args.dmNote.trim() } : {}),
      reveal: args.reveal,
      ...(headline ? { headline } : {}),
      ...(args.reveal === "revealed" ? { revealedAt: now } : {}),
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        log: [...existing.log, entry],
        updatedAt: now,
      })
    } else {
      await ctx.db.insert("diplomacyOverrides", {
        campaignId: args.campaignId,
        realmA,
        realmB,
        status: args.status,
        log: [entry],
        updatedAt: now,
      })
    }
  },
})

// Re-triage an existing shift: reveal a held/pending entry (with an editable headline),
// hold it for later, or mark it private. Only the reveal lifecycle changes — `status`
// (the truth) is untouched. The log is append-only, so entryIndex is stable.
export const setShiftDisposition = mutation({
  args: {
    overrideId: v.id("diplomacyOverrides"),
    entryIndex: v.number(),
    reveal: revealV,
    headline: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.overrideId)
    if (!row) throw new Error("Shift not found")
    await requireDm(ctx, row.campaignId, "Only the DM can change diplomacy")
    if (args.entryIndex < 0 || args.entryIndex >= row.log.length) throw new Error("Bad shift index")

    const now = Date.now()
    const log = row.log.map((e, i) => {
      if (i !== args.entryIndex) return e
      const headline = args.headline?.trim()
      return {
        ...e,
        reveal: args.reveal,
        ...(headline !== undefined ? { headline: headline || undefined } : {}),
        // Stamp a fresh revealedAt on reveal (held → revealed surfaces as new news now).
        ...(args.reveal === "revealed" ? { revealedAt: now } : {}),
      }
    })
    await ctx.db.patch(args.overrideId, { log, updatedAt: now })
  },
})

// Global per-campaign World-News toggle. Off = the player feed never surfaces (shifts
// still log silently). DM-only.
export const setWorldNewsEnabled = mutation({
  args: { campaignId: v.id("campaigns"), enabled: v.boolean() },
  handler: async (ctx, args) => {
    await requireDm(ctx, args.campaignId, "Only the DM can change diplomacy")
    await ctx.db.patch(args.campaignId, { worldNewsEnabled: args.enabled })
  },
})

// Re-export the id type for callers that thread it through (kept local to avoid a wider
// import surface in the panel).
export type DiplomacyOverrideId = Id<"diplomacyOverrides">
