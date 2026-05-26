# FEYFORGE-AMBIENCE-LAYERS-SPEC.md

## Overview

Reworks FeyForge's DM audio panel in two areas:

1. **Ambience** — replaces the single ambience track slot with a full layered
   ambient mixer, inspired by Pocket Bard's per-layer I/II/III intensity system.
   DMs can build named sound presets (variations) per scene, each composed of
   individually toggleable named layers.

2. **Music** — redesigns the music mode strip and intensity control for faster,
   lower-friction DM use during live sessions.

---

## Patch order

1. Schema (`convex/schema.ts`)
2. Backend (`convex/audio.ts`)
3. Audio engine (`hooks/use-audio-engine.ts`)
4. Panel (`components/session/audio-panel.tsx`)

Do them in order — each step depends on the last.

---

## Part 1 — Ambience layer system

### MVP decisions

Tiers use volume scaling, not separate audio files.

| Tier | Volume multiplier |
|------|-------------------|
| I    | 33% of ambienceVolume |
| II   | 66% of ambienceVolume |
| III  | 100% of ambienceVolume |
| off  | 0 |

Per-tier separate R2 files deferred to a future patch.

---

### 1. convex/schema.ts

#### New tables

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

#### partySessions additions

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

### 2. convex/audio.ts

Append to the bottom of the file. Follows all existing auth/pattern conventions.

#### Queries to add

- `listAmbienceLayers({ campaignId? })` — returns campaign layers + global shared
  layers, deduped by `_id`
- `listAmbiencePresets({ campaignId?, sceneName? })` — filtered presets
- `getAmbiencePreset({ presetId })` — single preset doc

#### Mutations to add

- `createAmbienceLayer` — validates `trackId` is type `"ambience"`
- `updateAmbienceLayer` — ownership check on `userId`
- `deleteAmbienceLayer` — ownership check
- `createAmbiencePreset`
- `updateAmbiencePreset` — ownership check
- `deleteAmbiencePreset` — ownership check
- `updateSessionLayers({ sessionId, activeLayers })` — `dmUserId` auth check
- `loadPreset({ sessionId, presetId })` — sets `activePresetId` + copies
  `defaultTier` values into `activeLayers`

Full implementation code is in the Coru brainstorm session (2026-05-25).

---

### 3. hooks/use-audio-engine.ts

#### Type change

The engine currently accepts:

```ts
ambienceUrl: string | null
ambienceVolume: number
```

Update `engineState` to also accept:

```ts
activeLayers?: Array<{ url: string; volume: number }>
```

Volume per layer is pre-computed by the caller before passing in:

```ts
const TIER_MULTIPLIERS = { i: 0.33, ii: 0.66, iii: 1.0, off: 0 } as const

const resolvedLayers = (session.activeLayers ?? [])
  .filter((l) => l.tier !== "off")
  .map((l) => ({
    url: layerTrackMap[l.layerId]?.r2Url ?? "",
    volume: TIER_MULTIPLIERS[l.tier] * (ambienceVolume / 100),
  }))
  .filter((l) => l.url !== "")
```

#### Howl management

Each active layer gets its own looping `Howl` instance. Maintain a
`Map<string, Howl>` keyed by `layerId`. On each state change:

- **New** `layerId` in `activeLayers` → create `Howl`, fade in
- **Removed** `layerId` → fade out, destroy
- **Tier changed** → call `.volume()` on existing `Howl`, no restart needed
- **Backwards compat** — if `ambienceUrl` is provided and `activeLayers` is
  empty/undefined, keep the existing single `ambienceHowl` path working

---

### 4a. components/session/audio-panel.tsx — Ambiences tab

#### Replace ambience TrackSlot with `AmbienceLayerMixer`

New component. Props:

```ts
{
  sessionId: Id<"partySessions">
  campaignId: Id<"campaigns">
  activeScene: string
  activeLayers: Array<{ layerId: Id<"ambienceLayers">; tier: "i"|"ii"|"iii"|"off" }>
  ambienceVolume: number
}
```

Internal structure:

**Variation dropdown**
- `useQuery(api.audio.listAmbiencePresets, { campaignId, sceneName: activeScene })`
- Selecting a preset calls `loadPreset` mutation
- Shows "No preset" placeholder when none active

**Layer rows**
- `useQuery(api.audio.listAmbienceLayers, { campaignId })`
- Grouped by `category` with a small category label above each group
- Per row: icon (`ti ti-{layer.icon}` with generic fallback) + layer name +
  I / II / III buttons
- Active tier: highlighted in `--scene-accent`; inactive: muted
- Clicking the already-active tier toggles it off (sets tier to `"off"`)
- Calls `updateSessionLayers` on every change (optimistic local state first —
  don't wait for Convex round-trip before reflecting in UI)

---

## Part 2 — Music panel rework

### Context

The intensity slider controls the energy level of the *currently active music
mode* (Explore or Combat). It does **not** blend between modes. Intensity maps to
`intensityRank` (1–5) on `audioTracks` — the engine selects whichever approved
track matches the active mode and rank closest to the slider value.

The current panel has two problems:
1. The slider is a plain `<input type="range">` with no visual communication of
   what "intensity" means — it just looks like a volume knob
2. Victory Cue is duplicated: it appears in the mode strip AND as a standalone
   button in the sync row

---

### 4b. components/session/audio-panel.tsx — Music section

#### Mode strip

Buttons: **Off** | **Explore** | **Combat**

Victory is **not** a persistent mode. Remove it from the mode strip entirely.
It is a momentary cue — see Victory Cue section below.

Active mode button: `--scene-accent` background, full opacity.
Inactive: muted, border only.

```tsx
const MUSIC_MODES = ["off", "explore", "combat"] as const
```

#### Dual-zone intensity slider

Replace the plain range input with a visually split version. The left zone
(dark, `--scene-surface`) represents the intensity already applied. The right
zone (warm, `--scene-accent`) represents remaining headroom. The thumb sits at
the boundary.

```tsx
<div className="relative h-2">
  <div
    className="absolute inset-0 rounded-full pointer-events-none"
    style={{
      background: `linear-gradient(to right,
        var(--scene-surface) 0%,
        var(--scene-surface) ${intensity * 20}%,
        var(--scene-accent) ${intensity * 20}%,
        var(--scene-accent) 100%
      )`,
      opacity: 0.45,
    }}
  />
  <input
    type="range"
    min={1}
    max={5}
    step={1}
    value={intensity}
    onChange={(e) => onIntensityChange(Number(e.target.value))}
    className="relative w-full appearance-none bg-transparent"
  />
</div>
```

Note: `intensity * 20` converts the 1–5 rank to a 20–100% fill percentage.

Show the current rank as a small label next to the slider — `I` through `V` —
so the DM always knows where they are without reading a number.

```tsx
const RANK_LABELS = { 1: "I", 2: "II", 3: "III", 4: "IV", 5: "V" }
```

Slider is only visible/interactive when `musicMode !== "off"`.

#### Active track display

Below the mode strip, show the name of the currently active music track for the
selected mode. Small, muted text — this is ambient info, not a primary control.

```tsx
{musicMode !== "off" && activeTrackName && (
  <p className="text-xs text-muted truncate">{activeTrackName}</p>
)}
```

#### Victory Cue button

Standalone button, separate from the mode strip. Positioned below the music
controls, above the volume sliders. Visually distinct — use `--scene-highlight`
or a gold accent to signal "this is a one-time dramatic action."

```tsx
<button
  onClick={onVictoryCue}
  className="w-full py-1.5 rounded-md text-sm font-medium
             bg-[--scene-highlight]/20 text-[--scene-highlight]
             border border-[--scene-highlight]/40
             hover:bg-[--scene-highlight]/30 transition-colors"
>
  🏆 Cue Victory
</button>
```

Calls `triggerVictoryCue` mutation. Does **not** change `musicMode` —
Victory plays over whatever is currently running, then the engine returns to
the previous mode when it ends.

Remove the duplicate "Cue Victory" button from the sync row entirely.

---

## Tab structure (final)

The full audio panel tab layout:

```
[ Ambiences ]  [ One-shots ]
```

- **Ambiences tab**: variation dropdown + AmbienceLayerMixer + ambience volume
  slider
- **One-shots tab**: existing SfxBoard component (moved here from its current
  collapsed toggle — the toggle is removed)

Music mode strip, intensity slider, Victory Cue, master volume, and sync toggle
live **outside** the tabs — always visible regardless of which tab is active.

---

## Data flow summary

```
── Ambience ──────────────────────────────────────────────
DM picks preset (variation dropdown)
  → loadPreset mutation
  → partySessions.activePresetId = presetId
  → partySessions.activeLayers  = preset.layers with defaultTiers

DM toggles a layer tier
  → optimistic local update (immediate)
  → updateSessionLayers mutation
  → partySessions.activeLayers updated

useAudioEngine (DM + Player receiver)
  → reads activeLayers from session
  → resolves each layerId → audioTrack.r2Url
  → volume = TIER_MULTIPLIERS[tier] * ambienceVolume
  → maintains Map<layerId, Howl> reactively

── Music ─────────────────────────────────────────────────
DM selects mode (Explore / Combat / Off)
  → updateSessionAudio({ musicMode })
  → engine crossfades to matching track for mode + intensity

DM moves intensity slider
  → updateSessionIntensity({ intensity })
  → engine calls .volume() on active music Howl
  → dual-zone slider fill updates via inline style

DM hits Cue Victory
  → triggerVictoryCue mutation
  → engine plays victory track once, returns to previous mode
```

---

## Out of scope (MVP)

- Per-tier separate R2 audio files (volume scaling only for now)
- Layer builder UI (`/dm/library` → "Create Layer" flow)
- Preset builder UI (`/dm/scenes` → "Add Variation" flow)
- Sharing presets across campaigns
- Global curated preset library

These can be patched once the core mixer is working and tested.
