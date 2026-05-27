# FEYFORGE-MUSIC-MIXING-SPEC.md

> **v2 — replaces the previous spec entirely.** The three-track Low/Med/High
> vertical remix model has been replaced with a dynamic stem window system.

---

## Overview

Each scene+mode has a set of **4–5 stems**. Every stem has a presence window
defined by `intensityMin` and `intensityMax` on a 1–5 scale. The DM controls a
single intensity slider. As the slider moves, the engine fades stems in and out
based on whether the current intensity falls within each stem's window. Stems can
overlap freely — the engine handles the mix. The DM never thinks about any of
this.

---

## Core concepts

### Stem presence windows

Each stem defines the intensity range where it should be audible:

```
intensityMin  — intensity at which the stem is fully faded in
intensityMax  — intensity at which the stem is fully faded out
```

A stem is **fully audible** when the slider is within its window, and
**silent** when the slider is outside it. The engine fades between these states
over `STEM_FADE_MS` whenever the slider changes.

### Example stem layout for Town → Explore

| Stem | Role | intensityMin | intensityMax | Audible at |
|------|------|-------------|-------------|------------|
| Pads | Atmosphere, foundation | 1 | 3 | 1–3, fading out by 3 |
| Soft melody | Melodic thread | 1 | 4 | 1–4 |
| Rhythm | Adds momentum | 2 | 5 | 2–5 |
| Lead strings | Upper energy layer | 3 | 5 | 3–5 |
| Full percussion | High energy only | 4 | 5 | 4–5 |

At intensity 1: pads + soft melody only. Sparse, atmospheric.
At intensity 3: all five stems briefly overlap at the crossover point.
At intensity 5: rhythm + lead strings + full percussion. Pads and soft melody
gone. Full energy.

### Volume computation

For a given stem at current intensity `I`:

```ts
function stemVolume(stem: MusicStem, intensity: number, masterVolume: number): number {
  const { intensityMin, intensityMax } = stem

  // Fully outside window — silent
  if (intensity < intensityMin || intensity > intensityMax) return 0

  // Fade in zone: approaching intensityMin from below
  // (handled by the engine's fade, not by volume scaling)

  // Within window — full volume
  return masterVolume / 100
}
```

Volume is binary (full or zero) within/outside the window. The 3–5 second fade
IS the transition — no additional volume curve math needed. This keeps the engine
simple and the transitions organic.

### Fade behavior

```ts
const STEM_FADE_MS = 4000 // 4 seconds — center of the 3–5s range
```

When the slider moves and a stem's target volume changes:
- If stem should now be audible and currently isn't → fade in over `STEM_FADE_MS`
- If stem should now be silent and currently isn't → fade out over `STEM_FADE_MS`
- If stem's target volume is unchanged → do nothing

Use Howler's `.fade(from, to, duration)`. Never stop or restart a Howl
mid-session — only adjust volume.

**Debounce slider input** — the slider fires continuously as the DM drags.
Debounce volume recomputation by ~150ms so the engine isn't triggering
overlapping fades on every pixel of drag.

---

## Victory behavior

Victory is a **one-shot event**, not a persistent mode. It does not change
`musicMode`.

When the DM hits Cue Victory:
1. Fade out all current mode stems over `STEM_FADE_MS`
2. Start the Victory stem set at position 0, at current intensity volumes
3. Victory stems play with `loop: false`
4. When the loudest Victory stem ends (Howler `onend` callback), crossfade back
   to the previous mode's stems from position 0 at current intensity
5. `musicMode` in `partySessions` never changes during Victory — store the
   pre-victory Howl state in a `previousModeHowls` ref

Trigger mechanism: `victoryCuedAt: v.optional(v.number())` timestamp on
`partySessions`. Engine watches for changes.

---

## Mode switch behavior

When the DM switches modes (e.g. Explore → Combat):
1. Fade out all current mode stems over `STEM_FADE_MS`
2. Start all Combat stems simultaneously from position 0
3. Each Combat stem fades in to its target volume based on current intensity
4. Destroy outgoing Howls after fade completes

```ts
const MUSIC_CROSSFADE_MS = STEM_FADE_MS // same duration, consistent feel
```

---

## Schema

### `musicStems` table

The stem-based mixer schema:

```ts
musicStems: defineTable({
  userId: v.string(),
  campaignId: v.id("campaigns"),
  sceneName: v.string(),
  mode: v.union(
    v.literal("explore"),
    v.literal("combat"),
    v.literal("victory")
  ),
  name: v.string(),           // e.g. "Pads", "Soft Melody", "Full Percussion"
  trackId: v.id("audioTracks"),
  intensityMin: v.number(),   // 1–5
  intensityMax: v.number(),   // 1–5, must be >= intensityMin
  sortOrder: v.number(),      // display order in the stem manager UI
  createdAt: v.number(),
})
  .index("by_campaignId_and_sceneName", ["campaignId", "sceneName"])
  .index("by_campaignId_sceneName_and_mode", ["campaignId", "sceneName", "mode"]),
```

### `partySessions` fields

```ts
musicMode:      v.optional(v.union(v.literal("off"), v.literal("explore"), v.literal("combat"))),
musicIntensity: v.optional(v.number()),   // 1–5, default 3
victoryCuedAt:  v.optional(v.number()),   // timestamp, watched by engine
```

Note: `musicMode` does not include `"victory"` — Victory is momentary, not a
persistent mode state.

---

## Backend: `convex/audio.ts`

### Queries

```ts
listMusicStems({ campaignId, sceneName, mode? })
// Returns all stems for a scene, optionally filtered by mode.
// Used by the engine to load the active stem set on mode switch.

getMusicStem({ stemId })
// Single stem doc.
```

### Mutations

```ts
createMusicStem({
  campaignId, sceneName, mode,
  name, trackId,
  intensityMin, intensityMax,
  sortOrder
})
// Validates intensityMin <= intensityMax, both 1–5.
// Validates trackId exists in audioTracks.

updateMusicStem({
  stemId,
  name?, trackId?, intensityMin?, intensityMax?, sortOrder?
})
// Ownership check. Re-validates intensity range if either field changes.

deleteMusicStem({ stemId })
// Ownership check.

updateSessionMusicMode({ sessionId, musicMode })
// dmUserId auth check.

updateSessionMusicIntensity({ sessionId, intensity })
// Validates 1–5. dmUserId auth check.

triggerVictoryCue({ sessionId })
// Sets victoryCuedAt = Date.now(). dmUserId auth check.
```

---

## Audio engine: `hooks/use-audio-engine.ts`

### Howl structure

```ts
// Map of stemId → Howl instance. Maintained for the active mode.
const stemHowls = useRef<Map<string, Howl>>(new Map())

// Ref to pre-victory Howl state for return after Victory ends
const previousModeHowls = useRef<Map<string, Howl>>(new Map())
```

### Volume computation

```ts
const STEM_FADE_MS = 4000

function targetVolume(stem: MusicStem, intensity: number, masterVolume: number): number {
  if (intensity < stem.intensityMin || intensity > stem.intensityMax) return 0
  return masterVolume / 100
}
```

### On mode activation

```ts
function activateMode(stems: MusicStem[], intensity: number, masterVolume: number) {
  for (const stem of stems) {
    const track = resolveTrack(stem.trackId) // get r2Url
    if (!track) continue

    const target = targetVolume(stem, intensity, masterVolume)
    const howl = new Howl({ src: [track.r2Url], loop: true, volume: 0 })
    howl.play()
    if (target > 0) howl.fade(0, target, STEM_FADE_MS)
    stemHowls.current.set(stem._id, howl)
  }
}
```

### On intensity change (debounced)

```ts
// Debounce by 150ms before computing
function updateStemVolumes(stems: MusicStem[], intensity: number, masterVolume: number) {
  for (const stem of stems) {
    const howl = stemHowls.current.get(stem._id)
    if (!howl) continue

    const current = howl.volume()
    const target = targetVolume(stem, intensity, masterVolume)
    if (Math.abs(current - target) < 0.01) continue // no meaningful change

    howl.fade(current, target, STEM_FADE_MS)
  }
}
```

### On mode switch

```ts
function switchMode(
  outgoingHowls: Map<string, Howl>,
  incomingStems: MusicStem[],
  intensity: number,
  masterVolume: number
) {
  // Fade out and destroy outgoing
  for (const howl of outgoingHowls.values()) {
    howl.fade(howl.volume(), 0, STEM_FADE_MS)
    setTimeout(() => howl.unload(), STEM_FADE_MS + 100)
  }

  // Reset and activate incoming
  stemHowls.current = new Map()
  activateMode(incomingStems, intensity, masterVolume)
}
```

### On Victory cue

```ts
function triggerVictory(
  victoryStems: MusicStem[],
  intensity: number,
  masterVolume: number
) {
  // Store current mode for return
  previousModeHowls.current = new Map(stemHowls.current)

  // Fade out current mode
  for (const howl of stemHowls.current.values()) {
    howl.fade(howl.volume(), 0, STEM_FADE_MS)
    setTimeout(() => howl.unload(), STEM_FADE_MS + 100)
  }
  stemHowls.current = new Map()

  // Find the loudest victory stem (for onend callback)
  const loudestStem = victoryStems.reduce((a, b) =>
    targetVolume(b, intensity, masterVolume) >= targetVolume(a, intensity, masterVolume) ? b : a
  )

  for (const stem of victoryStems) {
    const track = resolveTrack(stem.trackId)
    if (!track) continue

    const target = targetVolume(stem, intensity, masterVolume)
    if (target === 0) continue

    const howl = new Howl({
      src: [track.r2Url],
      loop: false,
      volume: 0,
      onend: stem._id === loudestStem._id ? () => returnToPreviousMode() : undefined,
    })
    howl.play()
    howl.fade(0, target, STEM_FADE_MS)
    stemHowls.current.set(stem._id, howl)
  }
}

function returnToPreviousMode() {
  // Fade out victory stems
  for (const howl of stemHowls.current.values()) {
    howl.fade(howl.volume(), 0, STEM_FADE_MS)
    setTimeout(() => howl.unload(), STEM_FADE_MS + 100)
  }
  stemHowls.current = new Map()

  // Re-activate previous mode from position 0
  // (previousModeHowls are already unloaded — re-fetch stems and activateMode)
  activateMode(previousModeStems, currentIntensity, currentMasterVolume)
}
```

### PlayerAudioReceiver

Mirrors the DM engine exactly. Reads `musicMode`, `musicIntensity`,
`victoryCuedAt` from the Convex session ref. Players hear the same mix in
real time.

---

## UI: `components/session/audio-panel.tsx`

### Unchanged from previous spec

- Mode strip: **Off** | **Explore** | **Combat**
- Intensity slider: 1–5, dual-zone visual fill, rank labels I–V
- Victory Cue: standalone gold-accent button, disabled when no Victory stems exist
- Active track display: show names of stems currently audible at this intensity

### Stem manager (DM library view, not the session panel)

A separate UI (outside the live session panel) for configuring stems per
scene+mode. Per stem row:

- Name field
- Track picker (from audioTracks where type = "music")
- Intensity range: two-handle range slider for `intensityMin` / `intensityMax`
- Sort order drag handle
- Delete button

This is a pre-session configuration tool, not a live session control.

---

## Curation guide impact

The audio curation workflow changes significantly for the better:

- **No more Low/Med/High full mixes** — each stem is a single instrument group
  exported as its own loop (e.g. just the pads, just the strings, just the drums)
- **GarageBand workflow**: one project per scene+mode, export each track/group
  separately rather than three mixed-down versions
- **Stems are much easier to produce**: mute everything except the target
  instrument group, export, done
- **The normalize script still applies** — normalize each stem individually
  before uploading, but duration matching between stems is no longer required
  (each stem loops independently)

Update `FEYFORGE-AUDIO-CURATION-GUIDE.md` to reflect this.

---

## Data flow summary

```
── Intensity change ─────────────────────────────────────────────
DM moves slider to intensity I
  → debounce 150ms
  → updateSessionMusicIntensity mutation
  → engine calls updateStemVolumes()
  → for each stem: compute targetVolume(stem, I, masterVolume)
  → if changed: howl.fade(current, target, STEM_FADE_MS)
  → stems outside their window fade out over 4s
  → stems entering their window fade in over 4s

── Mode switch ──────────────────────────────────────────────────
DM taps Explore / Combat / Off
  → updateSessionMusicMode mutation
  → engine calls switchMode()
  → outgoing stems fade out over STEM_FADE_MS, destroyed after
  → incoming stems start at position 0, fade to intensity volumes

── Victory cue ──────────────────────────────────────────────────
DM taps Cue Victory
  → triggerVictoryCue mutation → victoryCuedAt = Date.now()
  → engine detects change, calls triggerVictory()
  → current mode stems fade out
  → victory stems start (loop: false) at intensity volumes
  → loudest stem onend → returnToPreviousMode()

── Player receiver ──────────────────────────────────────────────
Reads musicMode, musicIntensity, victoryCuedAt from session
  → mirrors DM engine exactly
```

---

## Out of scope (MVP)

- Per-stem volume trim offset (normalize at upload time instead)
- BPM sync / beat-matched crossfades
- Configurable fade duration per scene or per stem
- Playlist / stem rotation
- Stem preview in the stem manager UI
