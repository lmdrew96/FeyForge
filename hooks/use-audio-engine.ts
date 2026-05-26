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

function stemTargetVolume(stem: MusicStem, intensity: number, masterVolume: number): number {
  if (intensity < stem.intensityMin || intensity > stem.intensityMax) return 0
  return masterVolume / 100
}

export function useAudioEngine(state: AudioEngineState, enabled: boolean) {
  const ambienceRef = useRef<Howl | null>(null)
  const layerRefs = useRef<Map<string, Howl>>(new Map())
  const stemHowls = useRef<Map<string, Howl>>(new Map())

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

  // ── Helpers ──────────────────────────────────────────────────────────────

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

  // ── Layered ambience sync ─────────────────────────────────────────────────

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

        const howl = new Howl({ src: [next.url], loop: true, volume: 0, html5: true })
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

  // ── Legacy single-slot ambience ───────────────────────────────────────────

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
      const h = new Howl({ src: [url], loop: true, volume: 0, html5: true })
      h.once("load", () => {
        if (!mounted.current) { h.unload(); return }
        try { h.play(); h.fade(0, targetVol, FADE_MS) } catch (e) { console.error("Ambience play/fade error:", e) }
      })
      h.on("loaderror", (_id, err) => console.error("Ambience load error:", err))
      ambienceRef.current = h
    }
  }, [state.ambienceUrl, state.activeLayers, enabled, destroyHowl, state.ambienceVolume, state.masterVolume])

  // ── Music mode + stems ────────────────────────────────────────────────────

  useEffect(() => {
    if (!enabled) return

    const mode = state.musicMode
    const activeStems =
      mode === "explore" ? state.exploreStems
      : mode === "combat" ? state.combatStems
      : []

    // Deduplicate: only act when mode or active stem set actually changes
    const newKey = `${mode}:${activeStems.map((s) => s._id).join(",")}`
    if (newKey === currentModeKey.current) return
    currentModeKey.current = newKey

    // Fade out and unload all current stem howls
    for (const howl of stemHowls.current.values()) {
      howl.fade(howl.volume(), 0, STEM_FADE_MS)
      const h = howl
      setTimeout(() => h.unload(), STEM_FADE_MS + 100)
    }
    stemHowls.current = new Map()
    currentStems.current = []

    if (mode === "off" || activeStems.length === 0) return

    currentStems.current = activeStems

    for (const stem of activeStems) {
      const target = stemTargetVolume(stem, intensityRef.current, masterVolumeRef.current)
      const howl = new Howl({ src: [stem.r2Url], loop: true, volume: 0, html5: true })
      howl.once("load", () => {
        if (!mounted.current) { howl.unload(); return }
        try {
          howl.play()
          if (target > 0) howl.fade(0, target, STEM_FADE_MS)
        } catch (e) { console.error("Stem play/fade error:", e) }
      })
      howl.on("loaderror", (_id, err) => console.error("Stem load error:", err))
      stemHowls.current.set(stem._id, howl)
    }
  }, [state.musicMode, state.exploreStems, state.combatStems, enabled])

  // ── Intensity (debounced) ─────────────────────────────────────────────────

  useEffect(() => {
    if (!enabled) return

    const timer = setTimeout(() => {
      const intensity = Math.max(1, Math.min(5, state.musicIntensity))
      const masterVolume = state.masterVolume

      for (const stem of currentStems.current) {
        const howl = stemHowls.current.get(stem._id)
        if (!howl) continue

        const current = howl.volume()
        const target = stemTargetVolume(stem, intensity, masterVolume)
        if (Math.abs(current - target) < 0.01) continue

        try { howl.fade(current, target, STEM_FADE_MS) } catch { howl.volume(target) }
      }
    }, INTENSITY_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [state.musicIntensity, state.masterVolume, enabled])

  // ── Victory cue ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!enabled) return
    const trigger = state.victoryCuedAt ?? 0
    if (!trigger) return
    if (currentVictoryTrigger.current === trigger) return
    currentVictoryTrigger.current = trigger

    const victoryStems = state.victoryStems
    if (victoryStems.length === 0) return

    const intensity = Math.max(1, Math.min(5, intensityRef.current))
    const masterVolume = masterVolumeRef.current

    // Check audibility BEFORE muting anything — if nothing would play, bail
    const audibleVictoryStems = victoryStems.filter(
      (s) => stemTargetVolume(s, intensity, masterVolume) > 0
    )
    if (audibleVictoryStems.length === 0) return

    // Store current stems so we can restore them after victory ends
    victoryPrevStems.current = [...currentStems.current]

    // Fade out and unload current mode stems
    for (const howl of stemHowls.current.values()) {
      howl.fade(howl.volume(), 0, STEM_FADE_MS)
      const h = howl
      setTimeout(() => h.unload(), STEM_FADE_MS + 100)
    }
    stemHowls.current = new Map()
    currentStems.current = []

    // Loudest stem gets the onend callback to trigger restore
    const loudestStem = audibleVictoryStems.reduce((a, b) =>
      stemTargetVolume(b, intensity, masterVolume) >= stemTargetVolume(a, intensity, masterVolume) ? b : a
    )

    for (const stem of victoryStems) {
      const target = stemTargetVolume(stem, intensity, masterVolume)
      if (target === 0) continue

      const howl = new Howl({ src: [stem.r2Url], loop: false, volume: 0, html5: true })

      if (stem._id === loudestStem._id) {
        howl.on("end", () => {
          // Fade out victory howls
          for (const vh of stemHowls.current.values()) {
            try {
              vh.fade(vh.volume(), 0, VICTORY_FADE_MS)
              const v = vh
              setTimeout(() => v.unload(), VICTORY_FADE_MS + 50)
            } catch { vh.unload() }
          }
          stemHowls.current = new Map()

          // Re-activate previous mode stems from position 0 per spec
          const prevStems = victoryPrevStems.current
          currentStems.current = prevStems
          for (const s of prevStems) {
            const t = stemTargetVolume(s, intensityRef.current, masterVolumeRef.current)
            const h = new Howl({ src: [s.r2Url], loop: true, volume: 0, html5: true })
            h.once("load", () => {
              if (!mounted.current) { h.unload(); return }
              try {
                h.play()
                if (t > 0) h.fade(0, t, STEM_FADE_MS)
              } catch (e) { console.error("Restore play/fade error:", e) }
            })
            h.on("loaderror", (_id, err) => console.error("Restore stem load error:", err))
            stemHowls.current.set(s._id, h)
          }
        })
      }

      howl.once("load", () => {
        if (!mounted.current) { howl.unload(); return }
        try { howl.play(); howl.fade(0, target, VICTORY_FADE_MS) } catch (e) { console.error("Victory play error:", e) }
      })
      howl.on("loaderror", (_id, err) => console.error("Victory load error:", err))
      stemHowls.current.set(stem._id, howl)
    }
  }, [state.victoryCuedAt, state.victoryStems, enabled])

  // ── Ambience volume ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!enabled) return
    const hasLayeredAmbience = (state.activeLayers?.length ?? 0) > 0
    if (!hasLayeredAmbience && ambienceRef.current) {
      const vol = (state.ambienceVolume / 100) * (state.masterVolume / 100)
      ambienceRef.current.volume(vol)
    }
  }, [state.ambienceVolume, state.masterVolume, state.activeLayers, enabled])

  // ── Master volume (layered ambience) ─────────────────────────────────────

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
      ambienceRef.current?.pause()
      layerRefs.current.forEach((r) => r.pause())
      stemHowls.current.forEach((h) => h.pause())
    } else {
      ambienceRef.current?.play()
      layerRefs.current.forEach((r) => r.play())
      stemHowls.current.forEach((h) => h.play())
    }
  }, [enabled])

  // ── Mount / unmount ───────────────────────────────────────────────────────

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      ambienceRef.current?.unload()
      layerRefs.current.forEach((r) => r.unload())
      layerRefs.current.clear()
      currentLayers.current.clear()
      stemHowls.current.forEach((h) => h.unload())
      stemHowls.current = new Map()
      currentStems.current = []
    }
  }, [])

  const playSfx = useCallback(
    (url: string) => {
      const h = new Howl({ src: [url], volume: state.masterVolume / 100, html5: true })
      h.play()
    },
    [state.masterVolume]
  )

  return { playSfx }
}
