# FEYFORGE-AMBIENCE-LAYERS-SPEC.md

## Overview

Replaces FeyForge's single ambience track slot with a full layered ambient mixer,
inspired by Pocket Bard's per-layer I/II/III intensity system. DMs can build named
sound presets (variations) for each scene, composed of individual named layers.
During a live session, each layer can be toggled on at one of three intensity tiers
or turned off entirely.

**MVP decision:** Tiers use volume scaling, not separate audio files.
- Tier I   = 33% of ambienceVolume
- Tier II  = 66% of ambienceVolume
- Tier III = 100% of ambienceVolume

Per-tier separate R2 files deferred to a future patch.

---

## Patch order

1. Schema (`convex/schema.ts`)
2. Backend (`convex/audio.ts`)
3. Audio engine (`hooks/use-audio-engine.ts`)
4. Panel (`components/session/audio-panel.tsx`)

Do them in order — each step depends on the last.

---

## 1. convex/schema.ts

### New tables

Add after the `audioTracks` table:

```ts
ambienceLayers: defineTable({
  userId: v.string(),
  campaignId: v.optional(v.id("campaigns")),
  name: v.string(),
  category: v.string(), // "environment" | "weather" | "action" | "creature"
  icon: v.optional(v.string()), // tabler icon slug e.g. "cloud-rain", "wind"
  trackId: v.id("audioTracks"), // must be type: "ambience"
  isShared: v.optional(v.boolean()),
  createdAt: v.number(),
})
  .index("by_userId", ["userId"])
  .index("by_campaignId", ["campaignId"]),

ambiencePresets: defineTable({
  userId: v.string(),
  campaignId: v.optional(v.id("campaigns")),
  sceneName: v.string(),
  variationName: v.string(),
  layers: v.array(v.object({
    layerId: v.id("ambienceLayers"),
    defaultTier: v.optional(v.union(v.literal("i"), v.literal("ii"), v.literal("iii"))),
  })),
  createdAt: v.number(),
})
  .index("by_userId", ["userId"])
  .index("by_campaignId_and_sceneName", ["campaignId", "sceneName"]),
```

### partySessions additions

Add inside the existing `partySessions` defineTable, after `victoryDurationMs`:

```ts
activePresetId: v.optional(v.id("ambiencePresets")),
activeLayers: v.optional(v.array(v.object({
  layerId: v.id("ambienceLayers"),
  tier: v.union(v.literal("i"), v.literal("ii"), v.literal("iii"), v.literal("off")),
}))),
```

**Do not remove `activeAmbienceTrackId`** — kept for backwards compat.

---

## 2. convex/audio.ts

Append to the bottom of the file. Full code in the Coru session from 2026-05-25.

### Queries to add
- `listAmbienceLayers({ campaignId? })` — returns campaign layers + global shared layers, deduped
- `listAmbiencePresets({ campaignId?, sceneName? })` — filtered presets
- `getAmbiencePreset({ presetId })` — single preset doc

### Mutations to add
- `createAmbienceLayer` — validates trackId is type "ambience"
- `updateAmbienceLayer` — ownership check on userId
- `deleteAmbienceLayer` — ownership check
- `createAmbiencePreset`
- `updateAmbiencePreset` — ownership check
- `deleteAmbiencePreset` — ownership check
- `updateSessionLayers({ sessionId, activeLayers })` — dmUserId auth check
- `loadPreset({ sessionId, presetId })` — sets activePresetId + copies defaultTiers into activeLayers

---

## 3. hooks/use-audio-engine.ts

### What to change

The engine currently accepts:
```ts
ambienceUrl: string | null
ambienceVolume: number
```

Update `engineState` type to also accept:
```ts
activeLayers?: Array<{ url: string; volume: number }>
```

Where each layer's volume is pre-computed by the panel before passing in:
```ts
const TIER_MULTIPLIERS = { i: 0.33, ii: 0.66, iii: 1.0, off: 0 }

const resolvedLayers = (sessionRef.activeLayers ?? [])
  .filter((l) => l.tier !== "off")
  .map((l) => ({
    url: layerTrackMap[l.layerId]?.r2Url ?? "",
    volume: TIER_MULTIPLIERS[l.tier] * (ambienceVolume / 100),
  }))
  .filter((l) => l.url !== "")
```

### Howl management

Each active layer needs its own looping Howl instance. Use a `Map<string, Howl>`
keyed by layerId. On each render:
- New layerId in activeLayers → create Howl, fade in
- Removed layerId → fade out, destroy
- Tier changed → call `.volume()` on existing Howl, no restart needed
- Keep the existing single `ambienceHowl` path working for backwards compat
  (the old `ambienceUrl` prop, if provided and no activeLayers, still works)

---

## 4. components/session/audio-panel.tsx

### Changes

#### A. Ambiences | One-shots tab strip
Add a tab strip above the ambience content area. Two tabs: **Ambiences** and
**One-shots**. The existing `SfxBoard` moves entirely into the One-shots tab.
Remove the old collapsed toggle for SFX.

#### B. Replace ambience TrackSlot with AmbienceLayerMixer
New component. Props:
```ts
{
  sessionId: SessionId
  campaignId: Id<"campaigns">
  activeScene: string
  activeLayers: Array<{ layerId: Id<"ambienceLayers">; tier: "i"|"ii"|"iii"|"off" }>
  onLayerChange: (layerId, tier) => void
  ambienceVolume: number
}
```

Internal structure:
1. **Variation dropdown** — `useQuery(api.audio.listAmbiencePresets, { campaignId, sceneName: activeScene })`. Selecting a preset calls `loadPreset` mutation.
2. **Layer rows** — `useQuery(api.audio.listAmbienceLayers, { campaignId })`. Group by `category`. For each layer, render:
    - Icon (`<i class="ti ti-{layer.icon}">` or fallback)
    - Layer name
    - I / II / III buttons — active tier highlighted in scene accent, others muted
    - Clicking an already-active tier turns it off (sets to "off")
3. Calls `updateSessionLayers` on every tier change (optimistic local state first).

#### C. Dual-zone intensity slider
Replace the plain `<input type="range">` for intensity with a styled version:

```tsx
<div className="relative">
  <div
    className="absolute inset-0 rounded-full pointer-events-none"
    style={{
      background: `linear-gradient(to right,
        var(--scene-surface) 0%,
        var(--scene-surface) ${intensity}%,
        var(--scene-accent) ${intensity}%,
        var(--scene-accent) 100%
      )`,
      opacity: 0.35,
    }}
  />
  <input type="range" min={0} max={100} value={intensity} ... />
</div>
```

The dark zone (left of thumb) = current intensity, warm zone (right) = headroom.
Visually communicates "how loud is loud" on the energy spectrum.

#### D. Victory Cue deduplication
The Victory Cue button currently appears:
- In the mode strip (as a "Victory" mode button)
- Again inside the sync row as a standalone "Cue Victory" button

Remove the standalone button from the sync row entirely. Keep only the mode strip
version. The `triggerVictoryCue` call stays in the mode strip onClick.

#### E. PlayerAudioReceiver
Pass resolved `activeLayers` (with computed volumes) to `useAudioEngine` the same
way the DM panel does. The receiver reads `sessionRef.activeLayers`, resolves each
`layerId` to a track URL, computes volume from tier + `sessionRef.ambienceVolume`.

---

## Data flow summary

DM picks preset (variation dropdown)
→ loadPreset mutation
→ partySessions.activePresetId = presetId
→ partySessions.activeLayers = preset.layers with defaultTiers
DM toggles a layer tier
→ updateSessionLayers mutation
→ partySessions.activeLayers updated
useAudioEngine (DM + Player)
→ reads activeLayers from session
→ resolves each layerId to audioTrack.r2Url
→ computes volume: TIER_MULTIPLIERS[tier] * ambienceVolume
→ maintains Map<layerId, Howl> — add/update/remove reactively

---

## What's intentionally out of scope (MVP)

- Per-tier separate R2 audio files (just volume scaling for now)
- Layer builder UI (/dm/library → "Create Layer" flow)
- Preset builder UI (/dm/scenes → "Add Variation" flow)
- Sharing presets across campaigns
- Global curated preset library

These can be patched once the core mixer is working and tested.