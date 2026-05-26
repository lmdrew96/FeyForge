"use client"

import { useEffect, useRef, useCallback } from "react"
import { Howl } from "howler"

export type MusicTrackSet = {
  low: string | null
  med: string | null
  high: string | null
}

export type AudioEngineState = {
  // Ambience (unchanged)
  ambienceUrl: string | null
  activeLayers?: Array<{ layerId: string; url: string; volume: number }>
  ambienceVolume: number
  masterVolume: number
  // Vertical remix music engine
  musicMode: "explore" | "combat" | "off"
  musicIntensity: number  // 1–5
  exploreTracks: MusicTrackSet
  combatTracks: MusicTrackSet
  victoryTracks: MusicTrackSet
  // Victory cue trigger
  victoryCuedAt?: number | null
}

const FADE_MS = 500
const MUSIC_CROSSFADE_MS = 2000
const INTENSITY_FADE_MS = 600
const LAYER_FADE_MS = 800
const VICTORY_FADE_MS = 300

const INTENSITY_MIX: Record<number, [number, number, number]> = {
  1: [1, 0, 0],
  2: [0.5, 0.5, 0],
  3: [0, 1, 0],
  4: [0, 0.5, 0.5],
  5: [0, 0, 1],
}

type MusicSlot = "low" | "med" | "high"
const MUSIC_SLOTS: MusicSlot[] = ["low", "med", "high"]

type HowlSet = { low: Howl | null; med: Howl | null; high: Howl | null }
type ActiveMusicMode = "explore" | "combat" | "victory"

export function useAudioEngine(state: AudioEngineState, enabled: boolean) {
  const ambienceRef = useRef<Howl | null>(null)
  const layerRefs = useRef<Map<string, Howl>>(new Map())
  const musicHowls = useRef<Record<ActiveMusicMode, HowlSet>>({
    explore: { low: null, med: null, high: null },
    combat:  { low: null, med: null, high: null },
    victory: { low: null, med: null, high: null },
  })

  const currentUrls = useRef<{ ambience: string; music: Record<ActiveMusicMode, Partial<Record<MusicSlot, string>>> }>({
    ambience: "",
    music: { explore: {}, combat: {}, victory: {} },
  })
  const currentLayers = useRef<Map<string, { url: string; volume: number }>>(new Map())
  const currentVictoryTrigger = useRef<number>(0)
  const victoryPrevMode = useRef<"explore" | "combat" | "off">("off")
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

  const fadeOutHowlSet = useCallback((set: HowlSet, fadeMs: number) => {
    MUSIC_SLOTS.forEach((slot) => {
      const h = set[slot]
      if (!h) return
      try { h.fade(h.volume(), 0, fadeMs); setTimeout(() => h.unload(), fadeMs + 50) } catch { h.unload() }
      set[slot] = null
    })
  }, [])

  const activateHowlSet = useCallback((
    set: HowlSet,
    tracks: MusicTrackSet,
    volumes: [number, number, number],
    master: number,
    loop: boolean,
    fadeMs: number,
  ) => {
    MUSIC_SLOTS.forEach((slot, i) => {
      const url = tracks[slot]
      if (!url) return
      const targetVol = volumes[i] * master
      const h = new Howl({ src: [url], loop, volume: 0, html5: true })
      h.once("load", () => {
        if (!mounted.current) { h.unload(); return }
        try { h.play(); h.fade(0, targetVol, fadeMs) } catch (e) { console.error("Howl play/fade error:", e) }
      })
      h.on("loaderror", (_id, err) => console.error("Music load error:", err))
      set[slot] = h
    })
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

  useEffect(() => {
    if (!enabled) return
    const hasLayeredAmbience = (state.activeLayers?.length ?? 0) > 0
    if (hasLayeredAmbience) {
      currentUrls.current.ambience = ""
      destroyHowl(ambienceRef)
      return
    }

    const url = state.ambienceUrl ?? ""
    if (url === currentUrls.current.ambience) return
    currentUrls.current.ambience = url
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

  // ── Music sync (mode + intensity + URLs) ─────────────────────────────────

  useEffect(() => {
    if (!enabled) return

    const master = state.masterVolume / 100
    const intensity = Math.max(1, Math.min(5, Math.round(state.musicIntensity)))
    const mix = INTENSITY_MIX[intensity] ?? INTENSITY_MIX[3]
    const mode = state.musicMode

    if (mode === "off") {
      ;(["explore", "combat"] as const).forEach((m) => {
        const hasActive = MUSIC_SLOTS.some((slot) => musicHowls.current[m][slot] !== null)
        if (hasActive) {
          fadeOutHowlSet(musicHowls.current[m], MUSIC_CROSSFADE_MS)
          currentUrls.current.music[m] = {}
        }
      })
      return
    }

    // Fade out the inactive mode
    const inactiveMode = mode === "explore" ? "combat" : "explore"
    const inactiveHasActive = MUSIC_SLOTS.some((slot) => musicHowls.current[inactiveMode][slot] !== null)
    if (inactiveHasActive) {
      fadeOutHowlSet(musicHowls.current[inactiveMode], MUSIC_CROSSFADE_MS)
      currentUrls.current.music[inactiveMode] = {}
    }

    // Load or update the active mode
    const activeTracks = mode === "explore" ? state.exploreTracks : state.combatTracks
    const prevUrls = currentUrls.current.music[mode]
    const urlsChanged = MUSIC_SLOTS.some((slot) => activeTracks[slot] !== (prevUrls[slot] ?? null))

    if (urlsChanged) {
      fadeOutHowlSet(musicHowls.current[mode], MUSIC_CROSSFADE_MS)
      currentUrls.current.music[mode] = {
        low: activeTracks.low ?? undefined,
        med: activeTracks.med ?? undefined,
        high: activeTracks.high ?? undefined,
      }
      activateHowlSet(musicHowls.current[mode], activeTracks, mix, master, true, MUSIC_CROSSFADE_MS)
    } else {
      // Update volumes only (intensity or master changed)
      MUSIC_SLOTS.forEach((slot, i) => {
        const h = musicHowls.current[mode][slot]
        if (!h) return
        const targetVol = mix[i] * master
        try { h.fade(h.volume(), targetVol, INTENSITY_FADE_MS) } catch { h.volume(targetVol) }
      })
    }
  }, [
    state.musicMode, state.exploreTracks, state.combatTracks,
    state.musicIntensity, state.masterVolume, enabled,
    fadeOutHowlSet, activateHowlSet,
  ])

  // ── Victory cue ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!enabled) return
    const trigger = state.victoryCuedAt ?? 0
    if (!trigger) return
    if (currentVictoryTrigger.current === trigger) return
    currentVictoryTrigger.current = trigger

    const hasTracks = state.victoryTracks.low || state.victoryTracks.med || state.victoryTracks.high
    if (!hasTracks) return

    const intensity = Math.max(1, Math.min(5, Math.round(state.musicIntensity)))
    const mix = INTENSITY_MIX[intensity] ?? INTENSITY_MIX[3]
    const master = state.masterVolume / 100

    victoryPrevMode.current = state.musicMode

    // Mute active mode tracks
    const activeMode = state.musicMode
    if (activeMode !== "off") {
      MUSIC_SLOTS.forEach((slot) => {
        const h = musicHowls.current[activeMode][slot]
        if (h) try { h.fade(h.volume(), 0, VICTORY_FADE_MS) } catch { h.volume(0) }
      })
    }

    // Destroy any lingering victory Howls
    fadeOutHowlSet(musicHowls.current.victory, VICTORY_FADE_MS)

    // Find the loudest slot for the onend callback
    const loudestIdx = mix.indexOf(Math.max(...mix))
    const loudestSlot = MUSIC_SLOTS[loudestIdx]

    // Create victory Howls
    MUSIC_SLOTS.forEach((slot, i) => {
      const url = state.victoryTracks[slot]
      if (!url) return
      const targetVol = mix[i] * master
      const h = new Howl({ src: [url], loop: false, volume: 0, html5: true })

      if (slot === loudestSlot) {
        h.on("end", () => {
          // Fade out all victory Howls
          MUSIC_SLOTS.forEach((s) => {
            const vh = musicHowls.current.victory[s]
            if (!vh) return
            try { vh.fade(vh.volume(), 0, VICTORY_FADE_MS); setTimeout(() => vh.unload(), VICTORY_FADE_MS + 50) } catch { vh.unload() }
            musicHowls.current.victory[s] = null
          })
          // Restore previous mode's volumes
          const restoreMode = victoryPrevMode.current
          if (restoreMode !== "off") {
            const restoreMix = INTENSITY_MIX[intensity] ?? INTENSITY_MIX[3]
            MUSIC_SLOTS.forEach((s, si) => {
              const mh = musicHowls.current[restoreMode][s]
              if (!mh) return
              const targetVol = restoreMix[si] * master
              try { mh.fade(mh.volume(), targetVol, VICTORY_FADE_MS) } catch { mh.volume(targetVol) }
            })
          }
        })
      }

      h.once("load", () => {
        if (!mounted.current) { h.unload(); return }
        try { h.play(); h.fade(0, targetVol, VICTORY_FADE_MS) } catch (e) { console.error("Victory play/fade error:", e) }
      })
      h.on("loaderror", (_id, err) => console.error("Victory load error:", err))

      musicHowls.current.victory[slot] = h
    })
  }, [
    state.victoryCuedAt, state.victoryTracks, state.musicMode,
    state.musicIntensity, state.masterVolume, enabled, fadeOutHowlSet,
  ])

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
      ;(["explore", "combat", "victory"] as const).forEach((m) => {
        MUSIC_SLOTS.forEach((slot) => musicHowls.current[m][slot]?.pause())
      })
    } else {
      ambienceRef.current?.play()
      layerRefs.current.forEach((r) => r.play())
      ;(["explore", "combat", "victory"] as const).forEach((m) => {
        MUSIC_SLOTS.forEach((slot) => musicHowls.current[m][slot]?.play())
      })
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
      ;(["explore", "combat", "victory"] as const).forEach((m) => {
        MUSIC_SLOTS.forEach((slot) => {
          musicHowls.current[m][slot]?.unload()
          musicHowls.current[m][slot] = null
        })
      })
    }
  }, [])

  const playSfx = useCallback((url: string) => {
    const h = new Howl({ src: [url], volume: state.masterVolume / 100, html5: true })
    h.play()
  }, [state.masterVolume])

  return { playSfx }
}
