"use client"

import { useEffect, useRef, useCallback } from "react"
import { Howl } from "howler"

export type MusicStem = {
  _id: string
  instrument: string
  intensity: number // 1–5
  r2Url: string
  sortOrder: number
}

export type AudioEngineState = {
  // Ambience (unchanged)
  ambienceUrl: string | null
  activeLayers?: Array<{ layerId: string; url: string; volume: number }>
  ambienceVolume: number
  masterVolume: number
  // Per-instrument variant engine
  musicMode: "explore" | "combat" | "off"
  musicIntensity: number // 1–5
  exploreStems: MusicStem[]
  combatStems: MusicStem[]
  victoryStems: MusicStem[]
  // Victory cue trigger
  victoryCuedAt?: number | null
}

const FADE_MS = 500
const LAYER_FADE_MS = 800
const STEM_FADE_MS = 4000
const VICTORY_FADE_MS = 300
const INTENSITY_DEBOUNCE_MS = 150

// 100ms scheduling buffer — gives browser time to prepare nodes before startTime
const START_BUFFER_S = 0.1

// ── Variant resolution ───────────────────────────────────────────────────────

// For each instrument in `stems`, pick the variant matching `intensity` (or null
// if the composer left that slot empty). Exported so UI components can compute
// "what instruments are audible right now" without duplicating the grouping.
export function resolveVariants(
  stems: MusicStem[],
  intensity: number,
): Map<string, MusicStem | null> {
  const byInstrument = new Map<string, MusicStem[]>()
  for (const stem of stems) {
    const list = byInstrument.get(stem.instrument)
    if (list) list.push(stem)
    else byInstrument.set(stem.instrument, [stem])
  }
  const resolved = new Map<string, MusicStem | null>()
  for (const [instrument, variants] of byInstrument.entries()) {
    resolved.set(instrument, variants.find((v) => v.intensity === intensity) ?? null)
  }
  return resolved
}

// ── Web Audio per-instrument node ────────────────────────────────────────────

type InstrumentNode = {
  gainNode: GainNode
  source: AudioBufferSourceNode | null
  currentStemId: string | null
  buffer: AudioBuffer | null
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAudioEngine(state: AudioEngineState, enabled: boolean) {
  // ── Ambience (Howler — unchanged) ─────────────────────────────────────────
  const ambienceRef = useRef<Howl | null>(null)
  const layerRefs = useRef<Map<string, Howl>>(new Map())

  // ── Web Audio music engine ────────────────────────────────────────────────
  const audioContext = useRef<AudioContext | null>(null)
  // Keyed by instrument so intensity changes can crossfade in place.
  const instrumentNodes = useRef<Map<string, InstrumentNode>>(new Map())
  const stemBufferCache = useRef<Map<string, AudioBuffer>>(new Map())

  // ── Shared state refs ─────────────────────────────────────────────────────
  const currentLayers = useRef<Map<string, { url: string; volume: number }>>(new Map())
  // The pool of variants currently driving playback (full set across all intensities).
  const currentStems = useRef<MusicStem[]>([])
  // Captured at render time so the victory-return callback always uses fresh state.
  const exploreStemsRef = useRef<MusicStem[]>([])
  const combatStemsRef = useRef<MusicStem[]>([])
  const currentVictoryTrigger = useRef<number>(0)
  const currentModeKey = useRef<string>("")
  // True while a mode change is preloading + scheduling — intensity effect skips
  // during this window to avoid racing two parallel activations on the same instrument.
  const modeChangeInFlight = useRef(false)

  // Kept in sync at render time so async callbacks read current values
  const intensityRef = useRef(state.musicIntensity)
  const masterVolumeRef = useRef(state.masterVolume)
  intensityRef.current = state.musicIntensity
  masterVolumeRef.current = state.masterVolume
  exploreStemsRef.current = state.exploreStems
  combatStemsRef.current = state.combatStems

  const mounted = useRef(false)

  // ── Ambience helpers (Howler) ─────────────────────────────────────────────

  const destroyHowl = useCallback((ref: React.MutableRefObject<Howl | null>) => {
    if (ref.current) {
      ref.current.fade(ref.current.volume(), 0, FADE_MS)
      const h = ref.current
      setTimeout(() => h.unload(), FADE_MS + 50)
      ref.current = null
    }
  }, [])

  const destroyLayerHowl = useCallback((layerId: string) => {
    const howl = layerRefs.current.get(layerId)
    if (!howl) return
    howl.fade(howl.volume(), 0, LAYER_FADE_MS)
    setTimeout(() => howl.unload(), LAYER_FADE_MS + 50)
    layerRefs.current.delete(layerId)
    currentLayers.current.delete(layerId)
  }, [])

  // ── Web Audio helpers ─────────────────────────────────────────────────────

  async function ensureContextRunning(): Promise<void> {
    if (audioContext.current?.state === "suspended") {
      await audioContext.current.resume()
    }
  }

  async function loadStemBuffer(stem: MusicStem): Promise<AudioBuffer | null> {
    const ctx = audioContext.current
    if (!ctx) return null

    const cached = stemBufferCache.current.get(stem._id)
    if (cached) return cached

    try {
      const response = await fetch(stem.r2Url)
      if (!response.ok) throw new Error(`HTTP ${response.status} fetching stem ${stem._id}`)
      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
      stemBufferCache.current.set(stem._id, audioBuffer)
      return audioBuffer
    } catch (e) {
      console.error(`[AudioEngine] Failed to load stem ${stem._id}:`, e)
      return null
    }
  }

  async function preloadStems(stems: MusicStem[]): Promise<void> {
    await Promise.all(stems.map(loadStemBuffer))
  }

  function deactivateAllInstruments(fadeMs: number = STEM_FADE_MS): void {
    const ctx = audioContext.current
    if (!ctx) return
    const now = ctx.currentTime

    for (const node of instrumentNodes.current.values()) {
      const currentGain = node.gainNode.gain.value
      node.gainNode.gain.cancelScheduledValues(now)
      node.gainNode.gain.setValueAtTime(currentGain, now)
      node.gainNode.gain.linearRampToValueAtTime(0, now + fadeMs / 1000)

      const src = node.source
      const gn = node.gainNode
      setTimeout(() => {
        try { src?.stop() } catch { /* already stopped */ }
        gn.disconnect()
      }, fadeMs + 100)
    }

    instrumentNodes.current.clear()
    currentStems.current = []
  }

  async function activateMode(
    stems: MusicStem[],
    intensity: number,
    masterVolume: number,
  ): Promise<void> {
    const ctx = audioContext.current
    if (!ctx || !mounted.current) return
    modeChangeInFlight.current = true
    try {
      await ensureContextRunning()

      const variants = resolveVariants(stems, intensity)
      const toLoad = Array.from(variants.values()).filter(
        (v): v is MusicStem => v !== null,
      )
      await preloadStems(toLoad)
      if (!mounted.current) return

      const startTime = ctx.currentTime + START_BUFFER_S
      const target = masterVolume / 100

      for (const [instrument, variant] of variants.entries()) {
        if (!variant) continue
        const buffer = stemBufferCache.current.get(variant._id)
        if (!buffer) continue

        const gainNode = ctx.createGain()
        gainNode.gain.setValueAtTime(0, startTime)
        gainNode.gain.linearRampToValueAtTime(target, startTime + STEM_FADE_MS / 1000)
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

      currentStems.current = stems
    } finally {
      modeChangeInFlight.current = false
    }
  }

  // 4-case crossfade across the union of currently-playing instruments and
  // the new resolved variant set. See spec §"Intensity change — the crossfade".
  async function updateIntensity(
    stems: MusicStem[],
    intensity: number,
    masterVolume: number,
  ): Promise<void> {
    const ctx = audioContext.current
    if (!ctx || !mounted.current) return
    await ensureContextRunning()

    const nextVariants = resolveVariants(stems, intensity)
    const fadeDuration = STEM_FADE_MS / 1000
    const targetGain = masterVolume / 100

    // Preload any new variants we don't have buffers for yet
    const toLoad = Array.from(nextVariants.values()).filter(
      (v): v is MusicStem => v !== null && !stemBufferCache.current.has(v._id),
    )
    if (toLoad.length > 0) await preloadStems(toLoad)
    if (!mounted.current) return

    const now = ctx.currentTime
    const startTime = now + START_BUFFER_S

    const allInstruments = new Set<string>([
      ...instrumentNodes.current.keys(),
      ...nextVariants.keys(),
    ])

    for (const instrument of allInstruments) {
      const currentNode = instrumentNodes.current.get(instrument)
      const nextVariant = nextVariants.get(instrument) ?? null

      // Case 1: same variant still playing — adjust gain if masterVolume changed
      if (currentNode && nextVariant && currentNode.currentStemId === nextVariant._id) {
        const cur = currentNode.gainNode.gain.value
        if (Math.abs(cur - targetGain) > 0.01) {
          currentNode.gainNode.gain.cancelScheduledValues(now)
          currentNode.gainNode.gain.setValueAtTime(cur, now)
          currentNode.gainNode.gain.linearRampToValueAtTime(targetGain, now + fadeDuration)
        }
        continue
      }

      // Case 2: fade out current (going silent or being replaced)
      if (currentNode) {
        const cur = currentNode.gainNode.gain.value
        currentNode.gainNode.gain.cancelScheduledValues(now)
        currentNode.gainNode.gain.setValueAtTime(cur, now)
        currentNode.gainNode.gain.linearRampToValueAtTime(0, now + fadeDuration)
        const src = currentNode.source
        const gn = currentNode.gainNode
        setTimeout(() => {
          try { src?.stop() } catch { /* already stopped */ }
          gn.disconnect()
        }, STEM_FADE_MS + 100)
        instrumentNodes.current.delete(instrument)
      }

      // Case 3: fade in new variant
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

  // Victory ALWAYS returns to Explore — see spec §"Victory return target".
  // Holds modeChangeInFlight for the duration of the cue so the intensity
  // slider can't trigger updateIntensity mid-victory (which would replace the
  // one-shot victory sources with combat variants and break the onended return).
  async function triggerVictory(
    victoryStems: MusicStem[],
    intensity: number,
    masterVolume: number,
  ): Promise<void> {
    const ctx = audioContext.current
    if (!ctx || !mounted.current) return
    await ensureContextRunning()

    const victoryVariants = resolveVariants(victoryStems, intensity)
    const audibleVariants = Array.from(victoryVariants.entries())
      .filter((entry): entry is [string, MusicStem] => entry[1] !== null)

    if (audibleVariants.length === 0) return

    modeChangeInFlight.current = true
    deactivateAllInstruments(STEM_FADE_MS)

    await preloadStems(audibleVariants.map(([, v]) => v))
    if (!mounted.current) {
      modeChangeInFlight.current = false
      return
    }

    const startTime = ctx.currentTime + START_BUFFER_S
    const target = masterVolume / 100

    // All victory variants play at master volume; use the first instrument's
    // onended as the trigger to return to Explore.
    const triggerStemId = audibleVariants[0][1]._id

    for (const [instrument, variant] of audibleVariants) {
      const buffer = stemBufferCache.current.get(variant._id)
      if (!buffer) continue

      const gainNode = ctx.createGain()
      gainNode.gain.setValueAtTime(0, startTime)
      gainNode.gain.linearRampToValueAtTime(target, startTime + VICTORY_FADE_MS / 1000)
      gainNode.connect(ctx.destination)

      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.loop = false // victory plays once
      source.connect(gainNode)
      source.start(startTime)

      if (variant._id === triggerStemId) {
        source.onended = () => {
          if (!mounted.current) {
            modeChangeInFlight.current = false
            return
          }
          deactivateAllInstruments(VICTORY_FADE_MS)
          const returnStems = exploreStemsRef.current
          // Clear the in-flight flag before delegating to activateMode, which
          // re-asserts it for the explore activation.
          modeChangeInFlight.current = false
          if (returnStems.length > 0) {
            activateMode(returnStems, intensityRef.current, masterVolumeRef.current)
          }
        }
      }

      instrumentNodes.current.set(instrument, {
        gainNode,
        source,
        currentStemId: variant._id,
        buffer,
      })
    }

    currentStems.current = victoryStems
  }

  // ── Layered ambience sync (Howler — unchanged) ────────────────────────────

  useEffect(() => {
    if (!enabled) return

    const nextLayers = new Map(
      (state.activeLayers ?? [])
        .filter((layer) => Boolean(layer.url))
        .map((layer) => [layer.layerId, { url: layer.url, volume: layer.volume }] as const)
    )

    for (const layerId of currentLayers.current.keys()) {
      if (!nextLayers.has(layerId)) destroyLayerHowl(layerId)
    }

    for (const [layerId, next] of nextLayers.entries()) {
      const existingHowl = layerRefs.current.get(layerId)
      const previous = currentLayers.current.get(layerId)
      const targetVol = next.volume * (state.masterVolume / 100)

      if (!existingHowl || previous?.url !== next.url) {
        if (existingHowl) destroyLayerHowl(layerId)

        const howl = new Howl({ src: [next.url], loop: true, volume: 0 })
        howl.once("load", () => {
          if (!mounted.current) return
          howl.play()
          howl.fade(0, targetVol, LAYER_FADE_MS)
        })

        layerRefs.current.set(layerId, howl)
        currentLayers.current.set(layerId, next)
        continue
      }

      try {
        existingHowl.fade(existingHowl.volume(), targetVol, FADE_MS)
      } catch {
        existingHowl.volume(targetVol)
      }

      currentLayers.current.set(layerId, next)
    }
  }, [state.activeLayers, state.masterVolume, enabled, destroyLayerHowl])

  // ── Legacy single-slot ambience (Howler — unchanged) ─────────────────────

  const currentAmbienceUrl = useRef("")

  useEffect(() => {
    if (!enabled) return
    const hasLayeredAmbience = (state.activeLayers?.length ?? 0) > 0
    if (hasLayeredAmbience) {
      currentAmbienceUrl.current = ""
      destroyHowl(ambienceRef)
      return
    }

    const url = state.ambienceUrl ?? ""
    if (url === currentAmbienceUrl.current) return
    currentAmbienceUrl.current = url
    destroyHowl(ambienceRef)
    if (url) {
      const targetVol = (state.ambienceVolume / 100) * (state.masterVolume / 100)
      const h = new Howl({ src: [url], loop: true, volume: 0 })
      h.once("load", () => {
        if (!mounted.current) { h.unload(); return }
        try { h.play(); h.fade(0, targetVol, FADE_MS) } catch (e) { console.error("Ambience play/fade error:", e) }
      })
      h.on("loaderror", (_id, err) => console.error("Ambience load error:", err))
      ambienceRef.current = h
    }
  }, [state.ambienceUrl, state.activeLayers, enabled, destroyHowl, state.ambienceVolume, state.masterVolume])

  // ── Music mode + stem pool changes ────────────────────────────────────────

  useEffect(() => {
    if (!enabled) return

    const mode = state.musicMode
    const activeStems =
      mode === "explore" ? state.exploreStems
      : mode === "combat" ? state.combatStems
      : []

    const newKey = `${mode}:${activeStems.map((s) => s._id).join(",")}`
    if (newKey === currentModeKey.current) return

    const previousMode = currentModeKey.current.split(":")[0]
    currentModeKey.current = newKey

    if (previousMode !== mode) {
      // Mode boundary — hard cut. Spec §"Mode switch behavior".
      deactivateAllInstruments(STEM_FADE_MS)
      if (mode !== "off" && activeStems.length > 0) {
        activateMode(activeStems, intensityRef.current, masterVolumeRef.current)
      }
    } else if (mode !== "off") {
      // Same mode, variant pool changed (e.g. a new variant was added in the
      // admin UI). Reconcile rather than restarting from zero.
      updateIntensity(activeStems, intensityRef.current, masterVolumeRef.current)
    }
  }, [state.musicMode, state.exploreStems, state.combatStems, enabled])

  // ── Intensity (debounced) ─────────────────────────────────────────────────

  useEffect(() => {
    if (!enabled) return
    if (state.musicMode === "off") return

    const timer = setTimeout(() => {
      if (modeChangeInFlight.current) return
      const activeStems =
        state.musicMode === "explore" ? exploreStemsRef.current
        : state.musicMode === "combat" ? combatStemsRef.current
        : []
      if (activeStems.length === 0) return
      updateIntensity(
        activeStems,
        Math.max(1, Math.min(5, state.musicIntensity)),
        state.masterVolume,
      )
    }, INTENSITY_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [state.musicIntensity, state.masterVolume, state.musicMode, enabled])

  // ── Victory cue ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!enabled) return
    const trigger = state.victoryCuedAt ?? 0
    if (!trigger) return
    if (currentVictoryTrigger.current === trigger) return
    currentVictoryTrigger.current = trigger

    if (state.victoryStems.length === 0) return

    triggerVictory(
      state.victoryStems,
      Math.max(1, Math.min(5, intensityRef.current)),
      masterVolumeRef.current,
    )
  }, [state.victoryCuedAt, state.victoryStems, enabled])

  // ── Ambience volume (Howler — unchanged) ─────────────────────────────────

  useEffect(() => {
    if (!enabled) return
    const hasLayeredAmbience = (state.activeLayers?.length ?? 0) > 0
    if (!hasLayeredAmbience && ambienceRef.current) {
      const vol = (state.ambienceVolume / 100) * (state.masterVolume / 100)
      ambienceRef.current.volume(vol)
    }
  }, [state.ambienceVolume, state.masterVolume, state.activeLayers, enabled])

  // ── Master volume (layered ambience — Howler) ─────────────────────────────

  useEffect(() => {
    if (!enabled) return
    const master = state.masterVolume / 100
    const hasLayeredAmbience = (state.activeLayers?.length ?? 0) > 0

    if (!hasLayeredAmbience && ambienceRef.current) {
      const ambienceTarget = (state.ambienceVolume / 100) * master
      try {
        ambienceRef.current.fade(ambienceRef.current.volume(), ambienceTarget, FADE_MS)
      } catch {
        if (ambienceRef.current) ambienceRef.current.volume(ambienceTarget)
      }
    }

    if (hasLayeredAmbience) {
      for (const [layerId, howl] of layerRefs.current.entries()) {
        const layer = currentLayers.current.get(layerId)
        if (!layer) continue
        const target = layer.volume * master
        try {
          howl.fade(howl.volume(), target, FADE_MS)
        } catch {
          try { howl.volume(target) } catch { /* ignore */ }
        }
      }
    }
  }, [state.masterVolume, state.ambienceVolume, state.activeLayers, enabled])

  // ── Pause / resume ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!enabled) {
      audioContext.current?.suspend()
      ambienceRef.current?.pause()
      layerRefs.current.forEach((r) => r.pause())
    } else {
      audioContext.current?.resume()
      ambienceRef.current?.play()
      layerRefs.current.forEach((r) => r.play())
    }
  }, [enabled])

  // ── Mount / unmount ───────────────────────────────────────────────────────

  useEffect(() => {
    mounted.current = true
    audioContext.current = new AudioContext()

    // Mobile browsers (notably iOS Safari) create an AudioContext in the
    // "suspended" state and only allow the FIRST resume() to succeed from inside
    // a user-gesture handler. Every resume() in this engine otherwise runs from
    // an effect after a Convex round-trip — never within a gesture — so on
    // mobile the context stays locked: the DM hears nothing while a desktop tab
    // on the same session (lenient autoplay) plays the audio, i.e. the phone
    // "acts like a remote." Bless the context on the first interaction anywhere
    // on the page — resume it and kick a one-sample silent buffer to fully
    // unlock iOS. Once unlocked, later programmatic resume()/suspend() calls
    // work without a gesture. (Howler auto-unlocks its own context separately.)
    const unlockAudio = () => {
      const ctx = audioContext.current
      if (!ctx) return
      if (ctx.state === "suspended") ctx.resume().catch(() => {})
      try {
        const source = ctx.createBufferSource()
        source.buffer = ctx.createBuffer(1, 1, 22050)
        source.connect(ctx.destination)
        source.start(0)
      } catch { /* unlock kick failed — the resume() above is what matters */ }
      removeUnlockListeners()
    }
    const removeUnlockListeners = () => {
      document.removeEventListener("touchend", unlockAudio)
      document.removeEventListener("pointerdown", unlockAudio)
      document.removeEventListener("click", unlockAudio)
    }
    document.addEventListener("touchend", unlockAudio, { passive: true })
    document.addEventListener("pointerdown", unlockAudio, { passive: true })
    document.addEventListener("click", unlockAudio, { passive: true })

    return () => {
      mounted.current = false
      removeUnlockListeners()

      instrumentNodes.current.forEach((node) => {
        try { node.source?.stop() } catch { /* already stopped */ }
        node.gainNode.disconnect()
      })
      instrumentNodes.current.clear()
      stemBufferCache.current.clear()
      audioContext.current?.close()
      audioContext.current = null

      ambienceRef.current?.unload()
      layerRefs.current.forEach((r) => r.unload())
      layerRefs.current.clear()
      currentLayers.current.clear()
      currentStems.current = []
    }
  }, [])

  // ── SFX one-shots (Howler) ────────────────────────────────────────────────

  const playSfx = useCallback(
    (url: string) => {
      const h = new Howl({ src: [url], volume: state.masterVolume / 100 })
      h.play()
    },
    [state.masterVolume]
  )

  return { playSfx }
}
