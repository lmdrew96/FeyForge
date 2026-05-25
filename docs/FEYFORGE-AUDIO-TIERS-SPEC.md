# FeyForge — Tiered Audio Library Spec
**Version:** 1.0  
**Date:** 2026-05-25  
**Status:** Active  
**Depends on:** FEYFORGE-AUDIO-SPEC.md (audio system must be complete)

---

## Overview

FeyForge's audio library operates on a two-tier model. All users get a curated base library — enough to run a real session across all 10 scenes. Ko-fi subscribers unlock the full extended library.

The tiers are backed entirely by Cloudflare R2. No third-party audio APIs at runtime. No external dependencies during a session. Audio is just files — always fast, always available.

---

## The Tiers

### Free Tier — "The Essentials"
~30–50 hand-picked tracks covering all 10 prebuilt scenes:
- At minimum: 1 ambience + 1 explore music + 1 combat music per scene
- A core SFX set: ~20 one-shot effects covering the most common moments (door creak, thunder, sword clash, crowd gasp, spell cast, etc.)
- Enough to run a complete session without needing anything else

### Subscriber Tier — "The Full Library" ⭐ Ko-fi
Everything in the free tier, plus:
- Extended scene coverage (multiple ambience + music options per scene)
- Niche/atmospheric tracks (Feywild, Shadowfell, Celestial deep cuts)
- Expanded SFX board (more categories, more options per category)
- New additions as Nae curates more tracks over time — subscribers get them automatically

---

## Data Model

### `audioTracks` — addition to existing schema

Add one field to the existing `audioTracks` Convex table:

```ts
tier: "free" | "premium"  // "free" = available to all, "premium" = subscribers only
```

That's it. The library query filters by this field based on the user's `isPremium` status.

### Convex query pattern

```ts
// In convex/audioTracks.ts
export const getLibrary = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    
    // Curated tracks — tier-gated
    const curatedTracks = await ctx.db
      .query("audioTracks")
      .filter(q =>
        user.isPremium
          ? q.or(
              q.eq(q.field("tier"), "free"),
              q.eq(q.field("tier"), "premium")
            )
          : q.eq(q.field("tier"), "free")
      )
      .collect()

    return [...curatedTracks]
  }
})
```

---

## R2 Structure

Curated tracks (both tiers) live under the shared `feyforge/audio/` prefix, same as the existing audio spec. Tier is determined by the Convex document, not the R2 path — no need for separate bucket prefixes.

---

## The `/dm/library` UI — Tiered Display

### For free users

- Curated library shows free tracks normally
- Premium tracks are visible but visually dimmed with a ⭐ badge and a lock icon
- Hovering/tapping a locked track shows: *"Unlock 40+ additional tracks with Ko-fi ☕"* + CTA button
- The locked tracks being *visible* (not hidden) is intentional — it shows the value before the gate, not after

### For subscribers

- All tracks visible and accessible
- Small ⭐ badge on premium tracks so subscribers know what they unlocked
- No friction, no upsell banners

### Filter state

The existing filter (type, scene tag, tier) gets a new tier filter option:
- All / Free / Premium / Favorites

---

## Curation Guidelines

When adding tracks to the curated library, follow these rules:

**License requirements:**
- CC0 (public domain) — always safe, preferred
- CC BY — safe, requires attribution stored in `sourceUrl` field
- CC BY-NC — **do not use** in the curated library (non-commercial only, FeyForge may go paid)
- CC BY-SA — use with caution (share-alike can be complex)

**Quality bar:**
- No obvious compression artifacts
- Loops must be seamless (start and end points match)
- Music tracks: minimum 90 seconds (loops well in session)
- Ambience tracks: minimum 60 seconds
- SFX: clean, no background noise

**Scene fit:**
- Each track should be tagged to at least one scene
- Tracks that work across multiple scenes get multiple tags
- When in doubt, tag generously — DMs can filter

**Tier assignment:**
- Free tier: one clear representative track per slot per scene. The "obvious choice."
- Premium tier: everything else. Variety, depth, unusual atmospheres.

---

## Ko-fi Integration

### Existing infrastructure (already specced in FEYFORGE-AUDIO-SPEC.md)
- Ko-fi webhook at `/api/webhooks/kofi`
- `isPremium: boolean` on Convex user record
- Premium gate on URL import (already built)

### What this spec adds
- `tier` field on `audioTracks` — the query-level gate
- Locked track UI in `/dm/library` (dimmed + ⭐ + CTA)

No new webhook infrastructure needed. The existing `isPremium` flag drives everything.

---

## Curation Workflow (Nae's process)

1. Browse Freesound / Pixabay, find a track worth adding
2. Download the full file locally
3. Run the seed script to upload to R2 and create Convex document with metadata (including `tier`)
4. Set `tier: "free"` or `tier: "premium"` in the metadata form
5. Track is immediately available to all users at the appropriate tier

For bulk additions: a simple admin script can batch-upload files to R2 and write Convex documents directly. Worth building once the library exceeds ~50 tracks.

---

## Acceptance Criteria

**Data model**
- [ ] `tier` field added to `audioTracks` Convex schema
- [ ] Library query correctly filters curated tracks by tier based on `isPremium`

**UI — free users**
- [ ] Free tracks display normally
- [ ] Premium tracks visible but dimmed with ⭐ lock badge
- [ ] Hovering/tapping locked track shows Ko-fi CTA

**UI — subscribers**
- [ ] All tracks accessible with no friction
- [ ] Premium tracks show ⭐ badge (subtle, not intrusive)
- [ ] No upsell banners shown to subscribers

**Filters**
- [ ] Tier filter added: All / Free / Premium / Favorites
- [ ] Existing type + scene tag filters still work correctly

---

## Out of Scope

- Per-track purchase (one tier only — subscribe or don't)
- Trial access to premium tracks
- Gifting subscriptions
- Admin dashboard for curation (use the existing DM import flow)
- Bulk upload UI (script-based for now)
- Track licensing/attribution display in the player (stored in DB, surface later)
