import { query } from "./_generated/server"
import { v } from "convex/values"
import { getMembership } from "./lib/auth"

// ── Religion Surfacing (Slice B) — faith ↔ character ─────────────────────────
// Reads for the faith picker (the world's pantheon) and the faith card's Followers
// section (campaign PCs grouped by the faith they follow). Membership-gated like the
// rest of the campaign-scoped reads. Faith link is by NAME (snapshot pattern), so the
// follower match is a plain name compare — survives a map re-import.

// The world's pantheon for the faith picker: faith names (+ deity, when the faith has
// one) from the campaign's map. Empty when the campaign has no map / no faiths → the
// picker falls back to free-text. Membership-gated.
export const pantheon = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const m = await getMembership(ctx, args.campaignId)
    if (!m) return []
    const map = await ctx.db
      .query("worldMaps")
      .withIndex("by_campaignId", (q) => q.eq("campaignId", args.campaignId))
      .first()
    return (map?.faiths ?? []).map((f) => ({ name: f.name, deity: f.deity }))
  },
})

// Campaign PCs grouped by the faith they follow → the faith card's Followers section.
// Returns Record<faithName, {name, className}[]>. Membership-gated. Keyed by the trimmed
// faith name so it matches the FaithInfo.name the card renders.
export const followersByFaith = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const m = await getMembership(ctx, args.campaignId)
    if (!m) return {}
    const chars = await ctx.db
      .query("characters")
      .withIndex("by_campaignId", (q) => q.eq("campaignId", args.campaignId))
      .take(200)
    const out: Record<string, { name: string; className?: string }[]> = {}
    for (const c of chars) {
      const faithName = c.faith?.name?.trim()
      if (!faithName) continue
      ;(out[faithName] ??= []).push({ name: c.name, className: c.characterClass })
    }
    return out
  },
})
