# FEYFORGE-STEM-ENGINE-WEBAUDIO-SPEC.md

## Overview

Replaces the Howler-based stem playback engine in `hooks/use-audio-engine.ts`
with a Web Audio API implementation for sample-perfect stem synchronization.

**Root cause of the sync problem:** Cody used `html5: true` on all Howl
instances, which routes audio through HTML5 `<audio>` elements instead of
the Web Audio API. These elements have no shared clock and no precise scheduling
mechanism. Even without `html5: true`, Howler's `howl.play()` fires
asynchronously inside individual `once("load")` callbacks — each stem loads
at a different time and starts whenever it's ready.

**The fix:** One `AudioContext` with one clock. All stems are decoded into
`AudioBuffer`s (in-memory), then all `AudioBufferSourceNode`s are scheduled
to start at exactly `audioContext.currentTime + START_BUFFER_S`. No load
callbacks, no race conditions.

---

## What changes vs. what stays

| Component | Change |
|-----------|--------|
| Stem playback (music mode) | **Replace with Web Audio API** |
| Ambience layers (`layerRefs`) | **Keep Howler** — sync doesn't matter, streaming preferred |
| Legacy single ambience (`ambienceRef`) | **Keep Howler** |
| SFX one-shots (`playSfx`) | **Keep Howler** |
| All constants, interfaces, `AudioEngineState` | Unchanged |
| Victory, mode switch, intensity debounce logic | Rewritten for Web Audio, same behavior |

Remove `html5: true` from **all** Howler instances while you're in here —
it's unnecessary overhead for ambience/SFX and was only added out of caution.

---

## Core Web Audio concepts used

**`AudioContext`** — the engine. One shared instance per hook. Has a
high-precision clock (`audioContext.currentTime`) that all nodes share.

**`AudioBuffer`** — a decoded, in-memory audio file. Created once per stem
via `fetch` + `audioContext.decodeAudioData`. Reused across mode switches.

**`AudioBufferSourceNode`** — a single-use playback node connected to an
`AudioBuffer`. Can only be played once — create a new one each time you need
to (re)start a stem.

**`GainNode`** — volume control. One per stem, persists across source node
recreation. Connected between the source node and `audioContext.destination`.

---

## New data structures

Replace `stemHowls: Map<string, Howl>` with:

```ts
type StemNode = {
  gainNode: GainNode
  source: AudioBufferSourceNode | null  // null when stem is silent/not started
  buffer: AudioBuffer
  playing: boolean
}

const stemNodes = useRef<Map<string, StemNode>>(new Map())
const audioContext = useRef<AudioContext | null>(null)
const stemBufferCache = useRef<Map<string, AudioBuffer>>(new Map())
// Cache persists across mode switches so we don't re-fetch the same file
```

---

## Constants

Keep existing constants. Add:

```ts
const START_BUFFER_S = 0.1   // 100ms scheduling buffer — gives browser time to prepare
```

---

## AudioContext lifecycle

Create once on mount, suspend/resume on enabled toggle, close on unmount.

```ts
// On mount (inside the existing mount useEffect):
audioContext.current = new AudioContext()

// On unmount:
audioContext.current?.close()
audioContext.current = null
stemNodes.current.forEach((node) => {
  node.source?.stop()
  node.gainNode.disconnect()
})
stemNodes.current.clear()
stemBufferCache.current.clear()
```

**Tab visibility / AudioContext suspension:**
Browsers auto-suspend `AudioContext` when a tab loses focus. Add a resume
guard at the top of any function that calls `audioContext.current`:

```ts
function ensureContextRunning() {
  if (audioContext.current?.state === "suspended") {
    audioContext.current.resume()
  }
}
```

Call this at the start of `activateMode`, `updateStemVolumes`, and
`triggerVictory`.

---

## Pre-loading stems

Fetch and decode stems into `AudioBuffer`s *before* scheduling playback.
This is what makes same-time-start possible — no "load when ready" race.

```ts
async function loadStemBuffer(stem: MusicStem): Promise<AudioBuffer> {
  const ctx = audioContext.current!
  const cached = stemBufferCache.current.get(stem._id)
  if (cached) return cached

  const response = await fetch(stem.r2Url)
  const arrayBuffer = await response.arrayBuffer()
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
  stemBufferCache.current.set(stem._id, audioBuffer)
  return audioBuffer
}

async function preloadStems(stems: MusicStem[]): Promise<void> {
  await Promise.all(stems.map(loadStemBuffer))
}
```

---

## Mode activation

Replace the Howler `once("load")` loop in the music mode `useEffect` with:

```ts
async function activateMode(stems: MusicStem[], intensity: number, masterVolume: number) {
  if (!audioContext.current || !mounted.current) return
  ensureContextRunning()

  // Pre-load all buffers — they may already be cached
  await preloadStems(stems)
  if (!mounted.current) return  // component unmounted during async load

  const startTime = audioContext.current.currentTime + START_BUFFER_S

  for (const stem of stems) {
    const buffer = stemBufferCache.current.get(stem._id)
    if (!buffer) continue

    const gainNode = audioContext.current.createGain()
    const target = stemTargetVolume(stem, intensity, masterVolume)

    gainNode.gain.setValueAtTime(0, startTime)
    if (target > 0) {
      gainNode.gain.linearRampToValueAtTime(target, startTime + STEM_FADE_MS / 1000)
    }
    gainNode.connect(audioContext.current.destination)

    const source = audioContext.current.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.connect(gainNode)
    source.start(startTime)  // all stems: exact same startTime

    stemNodes.current.set(stem._id, { gainNode, source, buffer, playing: true })
  }

  currentStems.current = stems
}
```

**The key:** every `source.start(startTime)` uses the same value. All stems
begin playing at the exact same moment on the audio clock.

---

## Deactivating a mode (fade out + stop)

```ts
function deactivateCurrentStems(fadeMs: number = STEM_FADE_MS) {
  if (!audioContext.current) return
  const ctx = audioContext.current
  const now = ctx.currentTime

  for (const [stemId, node] of stemNodes.current.entries()) {
    const currentGain = node.gainNode.gain.value
    node.gainNode.gain.cancelScheduledValues(now)
    node.gainNode.gain.setValueAtTime(currentGain, now)
    node.gainNode.gain.linearRampToValueAtTime(0, now + fadeMs / 1000)

    const src = node.source
    if (src) {
      setTimeout(() => {
        try { src.stop() } catch { /* already stopped */ }
        node.gainNode.disconnect()
      }, fadeMs + 100)
    }
    stemNodes.current.delete(stemId)
  }

  stemNodes.current = new Map()
  currentStems.current = []
}
```

---

## Mode switch

Replace the mode switch logic in the music mode `useEffect`:

```ts
// Fade out current stems
deactivateCurrentStems(STEM_FADE_MS)

// Start new mode (async, but stems won't play until startTime)
if (mode !== "off" && activeStems.length > 0) {
  activateMode(activeStems, intensityRef.current, masterVolumeRef.current)
}
```

Note: `activateMode` is async but mode switches don't need to await it.
The `startTime = currentTime + START_BUFFER_S` gives enough runway for the
async fetch/decode to complete before audio needs to play. For stems that
are already cached (mode you've visited before), this is essentially instant.

---

## Intensity update

Replace the Howler `.fade()` calls in the intensity `useEffect`:

```ts
// (debounced — keep existing 150ms debounce)
function updateStemVolumes(intensity: number, masterVolume: number) {
  if (!audioContext.current) return
  ensureContextRunning()
  const ctx = audioContext.current
  const now = ctx.currentTime
  const fadeDuration = STEM_FADE_MS / 1000

  for (const stem of currentStems.current) {
    const node = stemNodes.current.get(stem._id)
    if (!node) continue

    const target = stemTargetVolume(stem, intensity, masterVolume)
    const current = node.gainNode.gain.value

    if (Math.abs(current - target) < 0.01) continue

    node.gainNode.gain.cancelScheduledValues(now)
    node.gainNode.gain.setValueAtTime(current, now)
    node.gainNode.gain.linearRampToValueAtTime(target, now + fadeDuration)
  }
}
```

---

## Victory cue

Same logic as before, rewritten for Web Audio:

```ts
async function triggerVictory(
  victoryStems: MusicStem[],
  intensity: number,
  masterVolume: number
) {
  if (!audioContext.current || !mounted.current) return
  ensureContextRunning()

  const audibleStems = victoryStems.filter(
    (s) => stemTargetVolume(s, intensity, masterVolume) > 0
  )
  if (audibleStems.length === 0) return

  // Store current mode stems for restore
  victoryPrevStems.current = [...currentStems.current]

  // Fade out current mode
  deactivateCurrentStems(STEM_FADE_MS)

  // Pre-load victory buffers
  await preloadStems(victoryStems)
  if (!mounted.current) return

  const ctx = audioContext.current
  const startTime = ctx.currentTime + START_BUFFER_S

  // Loudest stem gets the ended callback
  const loudestStem = audibleStems.reduce((a, b) =>
    stemTargetVolume(b, intensity, masterVolume) >= stemTargetVolume(a, intensity, masterVolume) ? b : a
  )

  for (const stem of victoryStems) {
    const target = stemTargetVolume(stem, intensity, masterVolume)
    if (target === 0) continue

    const buffer = stemBufferCache.current.get(stem._id)
    if (!buffer) continue

    const gainNode = ctx.createGain()
    gainNode.gain.setValueAtTime(0, startTime)
    gainNode.gain.linearRampToValueAtTime(target, startTime + VICTORY_FADE_MS / 1000)
    gainNode.connect(ctx.destination)

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = false   // Victory plays once
    source.connect(gainNode)
    source.start(startTime)

    if (stem._id === loudestStem._id) {
      source.onended = () => {
        if (!mounted.current) return
        // Fade out victory stems
        deactivateCurrentStems(VICTORY_FADE_MS)
        // Re-activate previous mode
        const prevStems = victoryPrevStems.current
        if (prevStems.length > 0) {
          activateMode(prevStems, intensityRef.current, masterVolumeRef.current)
        }
      }
    }

    stemNodes.current.set(stem._id, { gainNode, source, buffer, playing: true })
  }

  currentStems.current = audibleStems
}
```

---

## Pause / resume

Replace the Howler pause/resume for stems in the `enabled` useEffect:

```ts
// stems
if (!enabled) {
  audioContext.current?.suspend()
} else {
  audioContext.current?.resume()
}

// ambience and layers — keep existing Howler pause/play calls, unchanged
```

`AudioContext.suspend()` pauses the entire context clock cleanly. All stem
nodes pause simultaneously. This is better than pausing individual Howls.

---

## Full music mode useEffect (rewritten)

This replaces the existing music mode + intensity effects entirely:

```ts
// ── Music mode ────────────────────────────────────────────────────────────
useEffect(() => {
  if (!enabled) return

  const mode = state.musicMode
  const activeStems =
    mode === "explore" ? state.exploreStems
    : mode === "combat" ? state.combatStems
    : []

  const newKey = `${mode}:${activeStems.map((s) => s._id).join(",")}`
  if (newKey === currentModeKey.current) return
  currentModeKey.current = newKey

  deactivateCurrentStems(STEM_FADE_MS)

  if (mode !== "off" && activeStems.length > 0) {
    activateMode(activeStems, intensityRef.current, masterVolumeRef.current)
  }
}, [state.musicMode, state.exploreStems, state.combatStems, enabled])

// ── Intensity (debounced) ─────────────────────────────────────────────────
useEffect(() => {
  if (!enabled) return
  const timer = setTimeout(() => {
    updateStemVolumes(
      Math.max(1, Math.min(5, state.musicIntensity)),
      state.masterVolume
    )
  }, INTENSITY_DEBOUNCE_MS)
  return () => clearTimeout(timer)
}, [state.musicIntensity, state.masterVolume, enabled])
```

---

## Preload on hover / scene change (optional optimization)

The 100ms `START_BUFFER_S` is enough for cached buffers. But on first mode
switch to a new scene, `fetch` + `decodeAudioData` takes longer — you may
hear a short delay before stems start if the files are large.

Optional: call `preloadStems(exploreStems)` and `preloadStems(combatStems)`
when the session first loads the scene, before the DM has switched modes.
This warms the cache so all subsequent switches are instant.

---

## What NOT to change

- `layerRefs` (ambience layers) — keep Howler, remove `html5: true`
- `ambienceRef` (legacy ambience) — keep Howler, remove `html5: true`
- `playSfx` — keep Howler, remove `html5: true`
- `AudioEngineState` type — unchanged
- `MusicStem` type — unchanged
- All existing ambience useEffects — unchanged
- `FADE_MS`, `LAYER_FADE_MS`, `STEM_FADE_MS`, `VICTORY_FADE_MS`,
  `INTENSITY_DEBOUNCE_MS` — unchanged

---

## Migration checklist for Cody

- [ ] Add `AudioContext` ref, `stemNodes` Map, `stemBufferCache` Map
- [ ] Add `loadStemBuffer`, `preloadStems`, `ensureContextRunning` helpers
- [ ] Add `activateMode` (async, Web Audio)
- [ ] Add `deactivateCurrentStems` (replaces Howler fade-out loops)
- [ ] Add `updateStemVolumes` (replaces Howler `.fade()` in intensity effect)
- [ ] Rewrite music mode `useEffect`
- [ ] Rewrite intensity `useEffect`
- [ ] Rewrite victory `useEffect` (`triggerVictory` async)
- [ ] Rewrite `enabled` effect — `AudioContext.suspend/resume` for stems,
      keep Howler pause/play for ambience
- [ ] Update mount `useEffect` — create `AudioContext` on mount, close on
      unmount
- [ ] Remove `html5: true` from all remaining Howler instances
- [ ] Remove `stemHowls` ref (replaced by `stemNodes`)
