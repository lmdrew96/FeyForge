# FEYFORGE-MUSIC-MIXING-SPEC.md

## Overview

Replaces FeyForge's single-track-per-mode music system with an adaptive vertical
remix engine. Each scene+mode combination holds three tracks (low, medium, high
intensity). The DM controls a 1–5 intensity slider. Odd values play a single
track; even values blend two adjacent tracks simultaneously at equal volumes,
creating a musically coherent mix — not a crossfade between different songs, but
a blend of the same piece at different arrangement densities.

---

## Content contract (important — read before uploading tracks)

The three tracks assigned to any given scene+mode slot **must be versions of the
same musical piece** at different arrangement densities:

- **Low** — sparse, atmospheric. Minimal instrumentation. e.g. solo piano or
  ambient pads only.
- **Med** — fuller. Add rhythm, melody, more instruments.
- **High** — complete arrangement. Full energy.

They must share:
- The same BPM
- The same loop length (or a clean multiple)
- The same key

If these constraints aren't met, even-intensity blends will sound like two songs
fighting each other. This is a curation requirement, not something the engine can
enforce.

---

## Blend math

All three tracks in the active set run simultaneously at all times. Intensity
controls their volumes only — tracks are never stopped or restarted mid-session
except on a mode switch.

| Intensity | Low vol | Med vol | High vol |
|-----------|---------|---------|----------|
| 1         | 100%    | 0%      | 0%       |
| 2         | 50%     | 50%     | 0%       |
| 3         | 0%      | 100%    | 0%       |
| 4         | 0%      | 50%     | 50%      |
| 5         | 0%      | 0%      | 100%     |

All percentages are multiplied by `masterMusicVolume` before being passed to
Howler.

```ts
const INTENSITY_MIX: Record<number, [number, number, number]> = {
  1: [1.0, 0.0, 0.0],
  2: [0.5, 0.5, 0.0],
  3: [0.0, 1.0, 0.0],
  4: [0.0, 0.5, 0.5],
  5: [0.0, 0.0, 1.0],
}

function resolveVolumes(intensity: number, masterVolume: number) {
  const [low, med, high] = INTENSITY_MIX[intensity]
  return {
    low:  low  * (masterVolume / 100),
    med:  med  * (masterVolume / 100),
    high: high * (masterVolume / 100),
  }
}
```

---

## Mode switch behavior

When the DM switches modes (e.g. Explore → Combat):

1. **Immediately** start all three tracks of the incoming mode at position 0,
   volumes set to the current intensity mix
2. **Simultaneously** begin fading out all three tracks of the outgoing mode
3. Fade duration: `MUSIC_CROSSFADE_MS = 2000` (2 seconds, defined as a constant
   — adjustable later)
4. After fade-out completes, destroy the outgoing Howl instances

No loop-boundary waiting. The switch happens the moment the DM taps the button.

```ts
const MUSIC_CROSSFADE_MS = 2000
```

---

## Victory behavior

Victory is a **one-shot**, not a looping mode. It does not replace the current
mode — it plays over it.

When the DM hits Cue Victory:
1. Fade out all current mode tracks over `MUSIC_CROSSFADE_MS`
2. Start the appropriate Victory tracks at position 0, volumes set to current
   intensity mix (same INTENSITY_MIX table applies)
3. Victory tracks play **without looping** (`loop: false` in Howler)
4. When the highest-volume Victory track ends (use Howler's `onend` callback on
   the loudest track), crossfade back to the previous mode at the current
   intensity
5. Resume the previous mode's tracks from position 0 (not from where they were
   — they were destroyed on the Victory cue)

The DM's `musicMode` state does not change during Victory. Store the pre-victory
mode in a `previousMusicMode` ref so the engine knows where to return.

---

## Schema additions

### New table: `sceneMusicSets`

One row per scene+mode combination. All track slots are optional — a set with no
tracks assigned is valid and the engine falls back to silence for that mode.

Add to `convex/schema.ts`:

```ts
sceneMusicSets: defineTable({
  userId: v.string(),
  campaignId: v.id("campaigns"),
  sceneName: v.string(),
  mode: v.union(
    v.literal("explore"),
    v.literal("combat"),
    v.literal("victory")
  ),
  lowTrackId:  v.optional(v.id("audioTracks")),
  medTrackId:  v.optional(v.id("audioTracks")),
  highTrackId: v.optional(v.id("audioTracks")),
  createdAt: v.number(),
})
  .index("by_campaignId_and_sceneName", ["campaignId", "sceneName"])
  .index("by_campaignId_sceneName_and_mode", ["campaignId", "sceneName", "mode"]),
```

### Existing tables

`audioTracks` — no changes needed. Tracks assigned to music sets do not need a
specific `type` value but should use `type: "music"` by convention.

`partySessions` — add the following fields:

```ts
musicMode:       v.optional(v.union(v.literal("off"), v.literal("explore"), v.literal("combat"))),
musicIntensity:  v.optional(v.number()), // 1–5, default 3
activeMusicSet:  v.optional(v.id("sceneMusicSets")), // per-mode, updated on mode switch
```

Note: `musicMode` does not include `"victory"` — Victory is a momentary cue, not
a persistent mode state.

---

## Backend: `convex/audio.ts` additions

### Queries

```ts
getSceneMusicSet({ campaignId, sceneName, mode })
// Returns the sceneMusicSets row for the given scene+mode, or null.

listSceneMusicSets({ campaignId, sceneName })
// Returns all three mode rows for a scene (for the track assignment UI).
```

### Mutations

```ts
upsertSceneMusicSet({ campaignId, sceneName, mode, lowTrackId?, medTrackId?, highTrackId? })
// Creates or updates the row. Uses an index lookup then insert-or-patch.
// Validates that any provided trackId exists in audioTracks.

updateSessionMusicMode({ sessionId, musicMode })
// Updates partySessions.musicMode. dmUserId auth check.

updateSessionMusicIntensity({ sessionId, intensity })
// Updates partySessions.musicIntensity. Validates 1–5. dmUserId auth check.

triggerVictoryCue({ sessionId })
// Does not change musicMode. Players observe this via a separate field or
// a Convex action that fires a transient event. See Victory behavior above.
// Simplest approach: add a `victoryCuedAt: v.optional(v.number())` timestamp
// field to partySessions. Engine watches for changes and triggers the sequence.
```

---

## Audio engine: `hooks/use-audio-engine.ts`

### Howl structure

Maintain three Howl refs per active music set:

```ts
const musicHowls = useRef<{
  low:  Howl | null
  med:  Howl | null
  high: Howl | null
}>({ low: null, med: null, high: null })
```

### On mode activation

```ts
function activateMusicSet(set: SceneMusicSet, intensity: number, masterVolume: number) {
  const volumes = resolveVolumes(intensity, masterVolume)
  const slots = [
    { key: "low",  trackUrl: set.lowTrackUrl,  volume: volumes.low  },
    { key: "med",  trackUrl: set.medTrackUrl,  volume: volumes.med  },
    { key: "high", trackUrl: set.highTrackUrl, volume: volumes.high },
  ]

  for (const { key, trackUrl, volume } of slots) {
    if (!trackUrl) continue
    const howl = new Howl({
      src: [trackUrl],
      loop: true,
      volume: 0,
    })
    howl.play()
    howl.fade(0, volume, MUSIC_CROSSFADE_MS)
    musicHowls.current[key] = howl
  }
}
```

### On intensity change

```ts
function updateIntensityVolumes(intensity: number, masterVolume: number) {
  const volumes = resolveVolumes(intensity, masterVolume)
  const howls = musicHowls.current

  if (howls.low)  howls.low.volume(volumes.low)
  if (howls.med)  howls.med.volume(volumes.med)
  if (howls.high) howls.high.volume(volumes.high)
}
```

No restart. Volume updates are immediate.

### On mode switch

```ts
function switchMode(
  outgoing: typeof musicHowls.current,
  incoming: SceneMusicSet,
  intensity: number,
  masterVolume: number
) {
  // Fade out all outgoing Howls
  for (const howl of Object.values(outgoing)) {
    if (!howl) continue
    howl.fade(howl.volume(), 0, MUSIC_CROSSFADE_MS)
    setTimeout(() => howl.unload(), MUSIC_CROSSFADE_MS + 100)
  }

  // Reset ref before activating incoming
  musicHowls.current = { low: null, med: null, high: null }
  activateMusicSet(incoming, intensity, masterVolume)
}
```

### On Victory cue

The engine watches `session.victoryCuedAt`. When it changes:

```ts
function triggerVictory(
  victorySet: SceneMusicSet,
  intensity: number,
  masterVolume: number,
  onComplete: () => void  // returns to previousMode
) {
  previousModeHowls.current = { ...musicHowls.current }

  // Fade out current mode
  for (const howl of Object.values(musicHowls.current)) {
    if (!howl) continue
    howl.fade(howl.volume(), 0, MUSIC_CROSSFADE_MS)
    setTimeout(() => howl.unload(), MUSIC_CROSSFADE_MS + 100)
  }

  musicHowls.current = { low: null, med: null, high: null }

  const volumes = resolveVolumes(intensity, masterVolume)

  // Find the loudest victory slot for onend callback
  const loudestSlot =
    volumes.high > 0 ? "high" : volumes.med > 0 ? "med" : "low"

  const slots = [
    { key: "low",  trackUrl: victorySet.lowTrackUrl,  volume: volumes.low  },
    { key: "med",  trackUrl: victorySet.medTrackUrl,  volume: volumes.med  },
    { key: "high", trackUrl: victorySet.highTrackUrl, volume: volumes.high },
  ]

  for (const { key, trackUrl, volume } of slots) {
    if (!trackUrl || volume === 0) continue
    const howl = new Howl({
      src: [trackUrl],
      loop: false,
      volume: 0,
      onend: key === loudestSlot ? onComplete : undefined,
    })
    howl.play()
    howl.fade(0, volume, MUSIC_CROSSFADE_MS)
    musicHowls.current[key] = howl
  }
}
```

`onComplete` fades out the victory Howls and re-activates the previous mode set
from position 0 at the current intensity.

### PlayerAudioReceiver

The receiver (`components/session/player-audio-receiver.tsx` or equivalent)
mirrors the DM engine exactly. It reads `session.musicMode`, `session.musicIntensity`,
`session.victoryCuedAt`, and `session.masterMusicVolume` from the Convex session
ref and drives `useAudioEngine` with the same logic. Players hear exactly what the
DM hears, in sync.

---

## UI: `components/session/audio-panel.tsx` — music section

### Mode strip

Three buttons: **Off** | **Explore** | **Combat**

Victory is not in the strip. Each button sets `musicMode` via
`updateSessionMusicMode`. Active state: `--scene-accent` background.

### Intensity slider

1–5 step range. Dual-zone visual split at current value.

```tsx
const RANK_LABELS = ["I", "II", "III", "IV", "V"]

// Fill percentage: maps 1–5 onto 0–100% in 25% increments
const fillPct = ((intensity - 1) / 4) * 100
```

Background gradient:

```tsx
style={{
  background: `linear-gradient(to right,
    var(--scene-muted) 0%,
    var(--scene-muted) ${fillPct}%,
    var(--scene-accent) ${fillPct}%,
    var(--scene-accent) 100%
  )`,
  opacity: 0.4,
}}
```

Label shows current rank (`I` – `V`) to the right of the slider. Slider is
disabled and visually muted when `musicMode === "off"`.

### Active track display

Below the mode strip, show the names of whichever 1–2 tracks are currently
audible at the current intensity. Small, muted text — ambient info only.

```tsx
// e.g. "Whispers of the Fey  ·  Tension Rising" at intensity 2
const audibleTracks = resolvedTrackNames
  .filter((_, i) => INTENSITY_MIX[intensity][i] > 0)
  .join("  ·  ")
```

### Victory Cue button

Standalone button below the music controls, above the volume sliders. Visually
distinct — gold/highlight accent. Disabled when no victory set is configured for
the current scene.

```tsx
<button
  onClick={() => triggerVictoryCue({ sessionId })}
  disabled={!victorySetExists}
  className="..."
>
  🏆 Cue Victory
</button>
```

---

## Data flow summary

```
── Intensity change ────────────────────────────────────────────
DM moves slider (1–5)
  → updateSessionMusicIntensity mutation
  → partySessions.musicIntensity updated
  → engine calls updateIntensityVolumes()
  → Howler .volume() called on each of the 3 running Howls
  → no restart, no seek — tracks stay in sync

── Mode switch ─────────────────────────────────────────────────
DM taps Explore / Combat / Off
  → updateSessionMusicMode mutation
  → engine calls switchMode()
  → outgoing Howls fade out over MUSIC_CROSSFADE_MS
  → incoming Howls start at position 0, fade in at current intensity volumes
  → outgoing Howls destroyed after fade

── Victory cue ─────────────────────────────────────────────────
DM taps Cue Victory
  → triggerVictoryCue mutation
  → partySessions.victoryCuedAt = Date.now()
  → engine detects change, calls triggerVictory()
  → current mode Howls fade out
  → victory Howls start (loop: false) at intensity volumes
  → loudest victory Howl onend → fade out victory, re-activate previous mode

── Player receiver ─────────────────────────────────────────────
Reads musicMode, musicIntensity, victoryCuedAt from session
  → mirrors DM engine exactly
  → players hear same blend in real time
```

---

## Out of scope (MVP)

- Per-track volume trim (normalize loud/quiet tracks before they go into the mix)
- BPM sync / beat-matched crossfades
- Looping from a defined loop point (currently always loops from position 0)
- Configurable crossfade duration per scene
- Playlist / track rotation (same 3 tracks loop indefinitely for now)
