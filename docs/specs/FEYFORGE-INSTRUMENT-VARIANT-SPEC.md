# FEYFORGE-INSTRUMENT-VARIANT-SPEC.md

> **v3 — replaces the stem window model.** Each instrument now has up to 5
> discrete variants, one per intensity level. The engine crossfades between
> adjacent variants of the same instrument as the DM moves the intensity
> slider.

---

## Overview

For each scene + mode, a composer (currently Ashley) produces multiple
**instruments** (strings, percussion, brass, pads, choir, etc.). Each
instrument has up to 5 **variants** — one for each intensity level on the
1–5 slider. As the DM moves the slider, the engine plays the variant matching
the current intensity for each instrument. When intensity changes, the old
variant fades out while the new variant fades in over `STEM_FADE_MS`.

This replaces the previous window-based system (`intensityMin` / `intensityMax`)
with a per-variant intensity value. The composition is more expressive: each
instrument *evolves* through the energy curve rather than just fading in and out.

---

## Core concepts

### Variants

A **variant** is one audio file representing one instrument at one intensity
level. Example for Forest Combat → Strings:

| intensity | variant character |
|-----------|-------------------|
| 1 | sustained, sparse notes |
| 2 | slow legato phrases |
| 3 | rhythmic eighth-note ostinato |
| 4 | aggressive tremolo |
| 5 | full driving spiccato runs |

The composer chooses how each variant evolves. The engine doesn't care about
the musical content — it just plays whatever file is assigned to a given
instrument + intensity slot.

### Optional gaps

Not every instrument needs all 5 variants. Ashley might compose:

```
Forest Combat:
  Pads:        variants 1, 2, 3        (no 4, 5 — pads drop out at high energy)
  Strings:     variants 1, 2, 3, 4, 5  (full presence across the range)
  Brass:       variants 3, 4, 5         (only joins at mid-high intensity)
  Percussion:  variants 2, 3, 4, 5      (no 1 — silence at lowest)
```

When intensity changes and a slot is empty, that instrument fades to silence.
This is a feature, not a bug — it lets the composer use absence intentionally.

### Crossfade behavior

When the DM moves the slider (e.g. 3 → 4):
1. For each instrument: identify the variant that matches the new intensity
2. If the same instrument was playing a different variant: fade out the old,
   fade in the new (crossfade) over `STEM_FADE_MS`
3. If the instrument has no variant at the new intensity: fade out only
4. If the instrument had no variant at the old intensity but has one at the
   new: fade in only

Crossfades are sample-perfect because both variants are scheduled against
the same `AudioContext.currentTime` (same engine pattern as v2).

---

## Schema

### Replace the existing `musicStems` table

The old `musicStems` table (with `intensityMin`, `intensityMax`, `name`) is
removed. Replace with:

```ts
musicStems: defineTable({
  userId: v.string(),
  campaignId: v.optional(v.id("campaigns")),
  sceneName: v.string(),
  mode: v.union(
    v.literal("explore"),
    v.literal("combat"),
    v.literal("victory")
  ),
  instrument: v.string(),       // free-text, e.g. "Strings", "Ritual Drums"
  intensity: v.number(),        // 1–5
  trackId: v.id("audioTracks"),
  sortOrder: v.number(),        // for UI display
  createdAt: v.number(),
})
  .index("by_campaignId_and_sceneName", ["campaignId", "sceneName"])
  .index("by_campaignId_sceneName_and_mode", ["campaignId", "sceneName", "mode"])
  .index("by_scene_mode_instrument", ["sceneName", "mode", "instrument"]),
```

**Migration note:** This is a breaking change. Existing rows under the old
schema (with `intensityMin`/`intensityMax`/`name`) must be migrated or deleted.
Since the app isn't in production yet, **delete and re-seed** is the right call.

### `partySessions`

No changes from v2. The session still tracks `musicMode`, `musicIntensity`,
and `victoryCuedAt`.

---

## Backend: `convex/audio.ts`

### Queries

Update `listMusicStems` to return rows grouped by instrument:

```ts
listMusicStems({ campaignId, sceneName, mode? })
// Returns flat array of all musicStem rows for the scene+mode.
// The engine groups by `instrument` client-side.
```

Add:

```ts
getInstrumentVariants({ campaignId, sceneName, mode, instrument })
// Returns all variants of a single instrument for a scene+mode.
// Useful for the stem manager UI when editing one instrument's variants.
```

### Mutations

Update `createMusicStem` and `updateMusicStem` to use the new fields:

```ts
createMusicStem({
  campaignId, sceneName, mode,
  instrument, intensity,
  trackId, sortOrder
})
// Validates intensity is 1–5.
// Validates trackId exists in audioTracks.
// Enforces uniqueness: only one stem per (sceneName, mode, instrument, intensity)

updateMusicStem({
  stemId,
  instrument?, intensity?, trackId?, sortOrder?
})
// Ownership check. Re-validates uniqueness on intensity/instrument change.
```

Delete and other mutations unchanged.

### `approveAndAssignStems` mutation (from admin spec)

Update the `stems` arg shape:

```ts
stems: v.array(v.object({
  sceneName: v.string(),
  mode: v.union(v.literal("explore"), v.literal("combat"), v.literal("victory")),
  instrument: v.string(),
  intensity: v.number(),  // 1–5
})),
```

Each slot creates one musicStem row at the specified intensity. The same
track can be assigned to multiple intensities (rare, but allowed — e.g.
the same drum loop at intensities 4 and 5).

`sortOrder` is auto-assigned as `intensity` server-side.

---

## Audio engine: `hooks/use-audio-engine.ts`

### Type changes

Update `MusicStem`:

```ts
export type MusicStem = {
  _id: string
  instrument: string
  intensity: number       // 1–5
  trackId: string         // or whatever id type
  r2Url: string
  sortOrder: number
}
```

Update `AudioEngineState`:

```ts
export type AudioEngineState = {
  // ... existing ambience fields unchanged ...
  musicMode: "explore" | "combat" | "off"
  musicIntensity: number  // 1–5
  exploreStems: MusicStem[]
  combatStems: MusicStem[]
  victoryStems: MusicStem[]
  victoryCuedAt?: number | null
}
```

### New ref: `stemNodes` keyed by instrument

The Web Audio engine from v2 stays, but the playback model shifts. Instead
of `stemNodes` keyed by stem `_id`, key it by `instrument`:

```ts
type InstrumentNode = {
  gainNode: GainNode
  source: AudioBufferSourceNode | null
  currentStemId: string | null  // which variant is playing
  buffer: AudioBuffer | null
}

const instrumentNodes = useRef<Map<string, InstrumentNode>>(new Map())
const stemBufferCache = useRef<Map<string, AudioBuffer>>(new Map())
// Cache by stemId — multiple instruments may reference different stems,
// and the same stem might be reused across modes
```

Why keyed by instrument: when intensity changes, we need to know "what's
currently playing for Strings?" so we can crossfade to the new variant.
Keying by `_id` would require lookups every time.

---

### Helper: resolve current variant per instrument

```ts
function resolveVariants(
  stems: MusicStem[],
  intensity: number
): Map<string, MusicStem | null> {
  // Group by instrument
  const byInstrument = new Map<string, MusicStem[]>()
  for (const stem of stems) {
    if (!byInstrument.has(stem.instrument)) byInstrument.set(stem.instrument, [])
    byInstrument.get(stem.instrument)!.push(stem)
  }

  // For each instrument, pick the variant matching current intensity (or null)
  const resolved = new Map<string, MusicStem | null>()
  for (const [instrument, variants] of byInstrument.entries()) {
    const match = variants.find((v) => v.intensity === intensity) ?? null
    resolved.set(instrument, match)
  }

  return resolved
}
```

---

### Mode activation

```ts
async function activateMode(stems: MusicStem[], intensity: number, masterVolume: number) {
  if (!audioContext.current || !mounted.current) return
  ensureContextRunning()

  const variants = resolveVariants(stems, intensity)

  // Preload all buffers (only the ones that will actually play)
  const toLoad = Array.from(variants.values()).filter((v): v is MusicStem => v !== null)
  await preloadStems(toLoad)
  if (!mounted.current) return

  const ctx = audioContext.current
  const startTime = ctx.currentTime + START_BUFFER_S
  const targetGain = masterVolume / 100

  for (const [instrument, variant] of variants.entries()) {
    if (!variant) continue
    const buffer = stemBufferCache.current.get(variant._id)
    if (!buffer) continue

    const gainNode = ctx.createGain()
    gainNode.gain.setValueAtTime(0, startTime)
    gainNode.gain.linearRampToValueAtTime(targetGain, startTime + STEM_FADE_MS / 1000)
    gainNode.connect(ctx.destination)

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.connect(gainNode)
    source.start(startTime)

    instrumentNodes.current.set(instrument, {
      gainNode,
      source,
      currentStemId: variant._id,
      buffer,
    })
  }
}
```

All variants for all instruments start at the exact same `startTime`. Sample-
perfect sync across all instruments.

---

### Intensity change — the crossfade

This is the meaningful new logic:

```ts
async function updateIntensity(stems: MusicStem[], intensity: number, masterVolume: number) {
  if (!audioContext.current) return
  ensureContextRunning()
  const ctx = audioContext.current

  const nextVariants = resolveVariants(stems, intensity)
  const targetGain = masterVolume / 100
  const fadeDuration = STEM_FADE_MS / 1000

  // Preload any new variants we don't have buffers for yet
  const toLoad = Array.from(nextVariants.values()).filter(
    (v): v is MusicStem => v !== null && !stemBufferCache.current.has(v._id)
  )
  if (toLoad.length > 0) await preloadStems(toLoad)
  if (!mounted.current) return

  const now = ctx.currentTime
  const startTime = now + START_BUFFER_S

  // Walk every instrument that's currently playing OR has a new variant
  const allInstruments = new Set<string>([
    ...instrumentNodes.current.keys(),
    ...nextVariants.keys(),
  ])

  for (const instrument of allInstruments) {
    const currentNode = instrumentNodes.current.get(instrument)
    const nextVariant = nextVariants.get(instrument) ?? null

    // Case 1: No change — same variant still playing
    if (currentNode && nextVariant && currentNode.currentStemId === nextVariant._id) {
      continue
    }

    // Case 2: Fade out current (if any)
    if (currentNode) {
      const currentGain = currentNode.gainNode.gain.value
      currentNode.gainNode.gain.cancelScheduledValues(now)
      currentNode.gainNode.gain.setValueAtTime(currentGain, now)
      currentNode.gainNode.gain.linearRampToValueAtTime(0, now + fadeDuration)

      const srcToStop = currentNode.source
      const gainToDisconnect = currentNode.gainNode
      setTimeout(() => {
        try { srcToStop?.stop() } catch { /* already stopped */ }
        gainToDisconnect.disconnect()
      }, STEM_FADE_MS + 100)

      instrumentNodes.current.delete(instrument)
    }

    // Case 3: Fade in new variant (if any)
    if (nextVariant) {
      const buffer = stemBufferCache.current.get(nextVariant._id)
      if (!buffer) continue

      const gainNode = ctx.createGain()
      gainNode.gain.setValueAtTime(0, startTime)
      gainNode.gain.linearRampToValueAtTime(targetGain, startTime + fadeDuration)
      gainNode.connect(ctx.destination)

      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.loop = true
      source.connect(gainNode)
      source.start(startTime)

      instrumentNodes.current.set(instrument, {
        gainNode,
        source,
        currentStemId: nextVariant._id,
        buffer,
      })
    }
  }

  currentStems.current = stems
}
```

This handles all four cases: no change, instrument going silent, new
instrument entering, and crossfade between variants. The crossfade IS just
fade-out + fade-in at the same time — both happen between `now` and
`now + fadeDuration` against the shared AudioContext clock.

---

### Loop sync consideration

When crossfading between two variants of the same instrument (e.g. Strings
intensity 3 → 4), they start at different positions in their loops because
the new variant starts at `startTime`, not at the same playback position as
the outgoing variant.

**This is correct.** If they share BPM and loop length (which Ashley will
ensure since she's composing both), the rhythmic grid stays aligned even
though they're at different positions in the loop. The DM hears a smooth
transition, not a beat skip.

If down the road this turns out to be a problem (e.g. the new variant
needs to enter on a downbeat), we can add loop-position preservation, but
that's premature for MVP.

---

## Mode switch behavior (hard switch by design)

When the DM switches modes (e.g. Explore → Combat), the engine performs a
**hard switch**: all current mode instruments fade out, all new mode
instruments start from position 0 of their loops, fading in.

Even if both modes have an instrument named "Strings", they are treated as
**independent instances** during the switch. The Explore Strings end. The
Combat Strings begin. This is intentional — mode changes in tabletop are
narratively meaningful moments ("roll initiative"), and the music should
reset to mark them.

Do NOT optimize by reusing instrument nodes across modes. The clean teardown
+ rebuild is the desired behavior.

---

## Victory return target

Victory **always returns to Explore**, never to the pre-Victory mode.

The narrative logic: Victory is "the fight is over, the day is won." Returning
to Combat music after the cue would feel wrong. Returning to Exploration
music says "the danger has passed."

This means the engine does NOT need to track `victoryPrevStems`. The return
target is always `state.exploreStems` regardless of what was playing before
the cue.

In practice the flow is:
- Combat playing → DM cues Victory → Combat fades out, Victory plays
- Victory's loudest stem ends → Victory fades out, **Explore stems activate**

If Explore was already playing when Victory was cued, the same return happens
— it re-activates Explore from position 0 with current intensity.

**Engine implementation note:** Inside the `source.onended` callback for the
loudest victory stem, the closure captures `state.exploreStems` at the time
the callback is created. If `state.exploreStems` could change between
`triggerVictory` being called and the victory track ending (unlikely but
possible), use a ref pattern instead:

```ts
const exploreStemsRef = useRef(state.exploreStems)
exploreStemsRef.current = state.exploreStems
// inside onended:
activateMode(exploreStemsRef.current, intensityRef.current, masterVolumeRef.current)
```

---

## UI: `components/session/audio-panel.tsx`

### Audible track display

The "active track display" now shows audible **instruments**, not stem names:

```tsx
const audibleInstruments = Array.from(
  resolveVariants(currentStems, currentIntensity).entries()
)
  .filter(([_, variant]) => variant !== null)
  .map(([instrument]) => instrument)
  .join(" · ")
```

e.g. "Strings · Brass · Percussion" at intensity 4.

Everything else in the panel unchanged.

---

## Stem manager (admin)

Significant changes to make Ashley's life easy.

### Grouped by instrument

Instead of a flat list of stem slots, the stem manager groups variants by
instrument:

```
Forest Combat
├── Strings
│   ├── intensity 1: forest-combat-strings-1.mp3
│   ├── intensity 2: forest-combat-strings-2.mp3
│   ├── intensity 3: forest-combat-strings-3.mp3
│   ├── intensity 4: forest-combat-strings-4.mp3
│   └── intensity 5: forest-combat-strings-5.mp3
├── Brass
│   ├── intensity 3: forest-combat-brass-3.mp3
│   ├── intensity 4: forest-combat-brass-4.mp3
│   └── intensity 5: forest-combat-brass-5.mp3
└── Percussion
    └── ...
```

Each instrument row has 5 slots (one per intensity). Empty slots are visibly
empty — the admin can drag a track onto an empty slot to assign it, or
delete an existing variant.

### Bulk assign UI

When approving an upload, admin specifies instrument + intensity per row.
Multiple rows in one approval to handle Ashley's typical workflow:

```
Approve: forest-combat-strings-3.mp3
  ├── Scene: forest
  ├── Mode: combat
  ├── Instrument: Strings    [free-text input with autocomplete from
  │                            existing instruments in this scene+mode]
  └── Intensity: 3
```

### Validation

- (sceneName, mode, instrument, intensity) is unique — duplicates rejected
- intensity must be 1–5
- instrument is non-empty
- At least one stem assignment required to approve a music track

---

## Curation guide impact

Update `FEYFORGE-AUDIO-CURATION-GUIDE.md` significantly:

- New section explaining the variant model
- Per-scene composition checklist: "for each instrument you compose, decide
  which intensity levels it appears at (you don't have to fill all 5)"
- File naming convention: `<scene>-<mode>-<instrument>-<intensity>.mp3`
- The normalize script still applies per-file; no cross-file matching needed
- BPM and loop length consistency requirement: variants of the *same instrument*
  must share BPM and loop length, but different instruments within the same
  scene+mode also need to share BPM (they all play simultaneously when their
  intensity slots align)

---

## Migration plan

1. Land the schema change (delete old `musicStems` rows since none are
   in production)
2. Land backend mutations
3. Land engine changes — including:
   - Replace `stemNodes` keyed by stemId with `instrumentNodes` keyed by instrument
   - Add `resolveVariants` helper and rewrite intensity update for crossfades
   - **Remove `victoryPrevStems` ref entirely** — victory now always returns
     to `state.exploreStems`, no need to track pre-victory state
   - In `triggerVictory`'s `source.onended` callback, call
     `activateMode(state.exploreStems, intensityRef.current, masterVolumeRef.current)`
     instead of restoring from `victoryPrevStems.current`
4. Land admin UI changes
5. Ashley uploads her first scene's variants for end-to-end test

---

## Out of scope (MVP)

- Loop-position preservation across crossfades (start at 0 each time for now)
- Per-instrument volume trim (normalize at upload, trust the composer)
- Variant preview in the stem manager (just upload and test in session)
- Stem reordering by drag-and-drop (sortOrder is auto-assigned for now)
