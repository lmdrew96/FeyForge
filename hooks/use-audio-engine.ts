"use client"

import { useEffect, useRef, useCallback } from "react"
import { Howl } from "howler"

export type MusicStem = {
  _id: string
  name: string
  r2Url: string
  intensityMin: number
  intensityMax: number
  sortOrder: number
}

export type AudioEngineState = {
  // Ambience (unchanged)
  ambienceUrl: string | null
  activeLayers?: Array<{ layerId: string; url: string; volume: number }>
  ambienceVolume: number
  masterVolume: number
  // Stem window music engine
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

function stemTargetVolume(stem: MusicStem, intensity: number, masterVolume: number): number {
  if (intensity < stem.intensityMin || intensity > stem.intensityMax) return 0
  return masterVolume / 100
}

// ── Web Audio stem node ───────────────────────────────────────────────────────

type StemNode = {
  gainNode: GainNode
  source: AudioBufferSourceNode | null
  buffer: AudioBuffer
  playing: boolean
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAudioEngine(state: AudioEngineState, enabled: boolean) {
  // ── Ambience (Howler — unchanged) ─────────────────────────────────────────
  const ambienceRef = useRef<Howl | null>(null)
  const layerRefs = useRef<Map<string, Howl>>(new Map())

  // ── Web Audio stem engine ─────────────────────────────────────────────────
  const audioContext = useRef<AudioContext | null>(null)
  const stemNodes = useRef<Map<string, StemNode>>(new Map())
  const stemBufferCache = useRef<Map<string, AudioBuffer>>(new Map())

  // ── Shared state refs ─────────────────────────────────────────────────────
  const currentLayers = useRef<Map<string, { url: string; volume: number }>>(new Map())
  const currentStems = useRef<MusicStem[]>([])
  const victoryPrevStems = useRef<MusicStem[]>([])
  const currentVictoryTrigger = useRef<number>(0)
  const currentModeKey = useRef<string>("")

  // Kept in sync at render time so effects can read current values without
  // re-running on every slider drag
  const intensityRef = useRef(state.musicIntensity)
  const masterVolumeRef = useRef(state.masterVolume)
  intensityRef.current = state.musicIntensity
  masterVolumeRef.current = state.masterVolume

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

  function deactivateCurrentStems(fadeMs: number = STEM_FADE_MS): void {
    const ctx = audioContext.current
    if (!ctx) return
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

  async function activateMode(
    stems: MusicStem[],
    intensity: number,
    masterVolume: number
  ): Promise<void> {
    const ctx = audioContext.current
    if (!ctx || !mounted.current) return
    await ensureContextRunning()

    await preloadStems(stems)
    if (!mounted.current) return // unmounted during async load

    const startTime = ctx.currentTime + START_BUFFER_S

    for (const stem of stems) {
      const buffer = stemBufferCache.current.get(stem._id)
      if (!buffer) continue // fetch failed for this stem — skip it

      const gainNode = ctx.createGain()
      const target = stemTargetVolume(stem, intensity, masterVolume)

      gainNode.gain.setValueAtTime(0, startTime)
      if (target > 0) {
        gainNode.gain.linearRampToValueAtTime(target, startTime + STEM_FADE_MS / 1000)
      }
      gainNode.connect(ctx.destination)

      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.loop = true
      source.connect(gainNode)
      source.start(startTime) // all stems: exact same startTime

      stemNodes.current.set(stem._id, { gainNode, source, buffer, playing: true })
    }

    currentStems.current = stems
  }

  function updateStemVolumes(intensity: number, masterVolume: number): void {
    const ctx = audioContext.current
    if (!ctx) return
    ensureContextRunning() // fire-and-forget — resuming is best-effort here
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

  async function triggerVictory(
    victoryStems: MusicStem[],
    intensity: number,
    masterVolume: number
  ): Promise<void> {
    const ctx = audioContext.current
    if (!ctx || !mounted.current) return
    await ensureContextRunning()

    const audibleStems = victoryStems.filter(
      (s) => stemTargetVolume(s, intensity, masterVolume) > 0
    )
    if (audibleStems.length === 0) return

    // Store current mode stems for restore after victory ends
    victoryPrevStems.current = [...currentStems.current]

    // Fade out current mode
    deactivateCurrentStems(STEM_FADE_MS)

    // Pre-load victory buffers
    await preloadStems(victoryStems)
    if (!mounted.current) return

    const startTime = ctx.currentTime + START_BUFFER_S

    // Loudest stem gets the onended callback to trigger restore
    const loudestStem = audibleStems.reduce((a, b) =>
      stemTargetVolume(b, intensity, masterVolume) >= stemTargetVolume(a, intensity, masterVolume)
        ? b
        : a
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
      source.loop = false // victory plays once
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

  // ── Music mode (Web Audio) ────────────────────────────────────────────────

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

  // ── Intensity (debounced, Web Audio) ─────────────────────────────────────

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

  // ── Victory cue (Web Audio) ───────────────────────────────────────────────

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
      masterVolumeRef.current
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
      // Stems: suspend the whole AudioContext — pauses all nodes simultaneously
      audioContext.current?.suspend()
      // Ambience: Howler pause/play
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

    return () => {
      mounted.current = false

      // Tear down Web Audio stem engine
      stemNodes.current.forEach((node) => {
        try { node.source?.stop() } catch { /* already stopped */ }
        node.gainNode.disconnect()
      })
      stemNodes.current = new Map()
      stemBufferCache.current.clear()
      audioContext.current?.close()
      audioContext.current = null

      // Tear down Howler ambience
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
