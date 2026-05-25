"use client"

import { useEffect, useRef, useCallback } from "react"
import { Howl } from "howler"

export type AudioEngineState = {
  ambienceUrl: string | null
  exploreUrls?: string[]
  combatUrls?: string[]
  intensity: number
  ambienceVolume: number
  masterVolume: number
  // victory cue fields
  victoryUrl?: string | null
  victoryTriggeredAt?: number | null
  victoryDurationMs?: number | null
  // musicMode selects which music tier is active: 'explore' | 'combat' | 'off' | 'blend'
  musicMode?: "explore" | "combat" | "off" | "blend"
}

const FADE_MS = 500

export function useAudioEngine(state: AudioEngineState, enabled: boolean) {
  const ambienceRef = useRef<Howl | null>(null)
  const exploreRefs = useRef<Howl[]>([])
  const combatRefs = useRef<Howl[]>([])
  const victoryRef = useRef<Howl | null>(null)

  const currentUrls = useRef({ ambience: "", explore: [] as string[], combat: [] as string[] })
  const currentTrigger = useRef({ victoryTriggeredAt: 0 })
  const mounted = useRef(false)

  const destroyHowl = useCallback((ref: React.MutableRefObject<Howl | null>) => {
    if (ref.current) {
      ref.current.fade(ref.current.volume(), 0, FADE_MS)
      const h = ref.current
      setTimeout(() => h.unload(), FADE_MS + 50)
      ref.current = null
    }
  }, [])

  const createHowl = useCallback((url: string, loop: boolean, vol: number): Howl => {
    const h = new Howl({ src: [url], loop, volume: 0, html5: true })
    h.once("load", () => {
      if (!mounted.current) return
      h.play()
      h.fade(0, vol, FADE_MS)
    })
    return h
  }, [])

  const destroyVictory = useCallback(() => {
    if (victoryRef.current) {
      victoryRef.current.fade(victoryRef.current.volume(), 0, FADE_MS)
      const h = victoryRef.current
      setTimeout(() => h.unload(), FADE_MS + 50)
      victoryRef.current = null
    }
  }, [])

  // helper: set volumes across refs according to level 0-100
  const setRefsForLevel = useCallback((refs: Howl[], level: number, master: number) => {
    if (refs.length === 0) return
    const p = Math.max(0, Math.min(1, level / 100))
    const scaled = p * (refs.length - 1)
    const idx = Math.floor(scaled)
    const frac = scaled - idx
    refs.forEach((r, i) => {
      let weight = 0
      if (i === idx) weight = 1 - frac
      else if (i === idx + 1) weight = frac
      else weight = 0
      const targetVol = weight * master
      try {
        const cur = r.volume()
        r.fade(cur, targetVol, FADE_MS)
      } catch (e) {
        r.volume(targetVol)
      }
    })
  }, [])

  // Sync ambience track
  useEffect(() => {
    if (!enabled) return
    const url = state.ambienceUrl ?? ""
    if (url === currentUrls.current.ambience) return
    currentUrls.current.ambience = url
    destroyHowl(ambienceRef)
    if (url) {
      const targetVol = (state.ambienceVolume / 100) * (state.masterVolume / 100)
      ambienceRef.current = createHowl(url, true, targetVol)
    }
  }, [state.ambienceUrl, enabled, createHowl, destroyHowl, state.ambienceVolume, state.masterVolume])
  // Sync explore tracks (array)
  useEffect(() => {
    if (!enabled) return
    const urls = state.exploreUrls ?? []
    // shallow compare
    const old = currentUrls.current.explore
    const same = urls.length === old.length && urls.every((u, i) => u === old[i])
    if (same) return
    // replace
    currentUrls.current.explore = urls
    // destroy previous refs
    exploreRefs.current.forEach((r) => { r.fade(r.volume(), 0, FADE_MS); setTimeout(() => r.unload(), FADE_MS + 50)})
    exploreRefs.current = []
    if (urls.length === 0) return
    const master = state.masterVolume / 100
    urls.forEach((u, i) => {
      // initial vol 0, will be set by setRefsForLevel
      const h = createHowl(u, true, 0)
      exploreRefs.current.push(h)
    })
    // set initial volumes according to musicMode/intensity
    const masterVol = state.masterVolume / 100
    if (state.musicMode === "explore") {
      setRefsForLevel(exploreRefs.current, state.intensity, masterVol)
    } else if (state.musicMode === "combat") {
      setRefsForLevel(exploreRefs.current, 0, masterVol)
    } else {
      // blend
      setRefsForLevel(exploreRefs.current, 100 - state.intensity, masterVol)
    }
  }, [state.exploreUrls, enabled, createHowl, state.intensity, state.masterVolume, state.musicMode, setRefsForLevel])

  // Sync combat tracks (array)
  useEffect(() => {
    if (!enabled) return
    const urls = state.combatUrls ?? []
    const old = currentUrls.current.combat
    const same = urls.length === old.length && urls.every((u, i) => u === old[i])
    if (same) return
    currentUrls.current.combat = urls
    combatRefs.current.forEach((r) => { r.fade(r.volume(), 0, FADE_MS); setTimeout(() => r.unload(), FADE_MS + 50)})
    combatRefs.current = []
    if (urls.length === 0) return
    const master = state.masterVolume / 100
    urls.forEach((u) => {
      const h = createHowl(u, true, 0)
      combatRefs.current.push(h)
    })
    const masterVol = state.masterVolume / 100
    if (state.musicMode === "combat") {
      setRefsForLevel(combatRefs.current, state.intensity, masterVol)
    } else if (state.musicMode === "explore") {
      setRefsForLevel(combatRefs.current, 0, masterVol)
    } else {
      // blend
      setRefsForLevel(combatRefs.current, state.intensity, masterVol)
    }
  }, [state.combatUrls, enabled, createHowl, state.intensity, state.masterVolume, state.musicMode, setRefsForLevel])

  // Victory cue handling: perform a local fade-in -> hold -> fade-out to restore music mix
  const victoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!enabled) return
    const trigger = state.victoryTriggeredAt ?? 0
    const url = state.victoryUrl ?? ""
    // ignore if not triggered or no url
    if (!trigger || !url) return
    // don't react to the same trigger twice
    if (currentTrigger.current.victoryTriggeredAt === trigger) return
    currentTrigger.current.victoryTriggeredAt = trigger

    // start victory playback
    destroyVictory()
    // create victory howl at full master volume
    const targetVol = state.masterVolume / 100
    victoryRef.current = createHowl(url, true, targetVol)

    // crossfade out explore & combat (we mute both for victory)
    exploreRefs.current.forEach((r) => {
      try { r.fade(r.volume(), 0, FADE_MS) } catch (e) { r.volume(0) }
    })
    combatRefs.current.forEach((r) => {
      try { r.fade(r.volume(), 0, FADE_MS) } catch (e) { r.volume(0) }
    })

    const holdMs = state.victoryDurationMs ?? 10000
    // schedule end of victory
    if (victoryTimerRef.current) clearTimeout(victoryTimerRef.current)
    victoryTimerRef.current = setTimeout(() => {
      // fade victory out
      if (victoryRef.current) {
        victoryRef.current.fade(victoryRef.current.volume(), 0, FADE_MS)
      }

      // restore explore/combat volumes based on musicMode and music level
      const master = state.masterVolume / 100
      if (state.musicMode === "explore") {
        setRefsForLevel(exploreRefs.current, state.intensity, master)
        setRefsForLevel(combatRefs.current, 0, master)
      } else if (state.musicMode === "combat") {
        setRefsForLevel(combatRefs.current, state.intensity, master)
        setRefsForLevel(exploreRefs.current, 0, master)
      } else {
        // blend legacy behavior: explore = 100 - intensity
        setRefsForLevel(exploreRefs.current, 100 - state.intensity, master)
        setRefsForLevel(combatRefs.current, state.intensity, master)
      }

      // unload victory howl after fade
      setTimeout(() => {
        destroyVictory()
      }, FADE_MS + 100)
    }, holdMs)

    return () => {
      if (victoryTimerRef.current) clearTimeout(victoryTimerRef.current)
    }
  }, [state.victoryTriggeredAt, state.victoryUrl, state.victoryDurationMs, enabled, createHowl, destroyVictory, state.masterVolume, state.intensity])

  // Intensity crossfade (no track swap, just volume)
  useEffect(() => {
    if (!enabled) return
    const master = state.masterVolume / 100
    if (state.musicMode === "explore") {
      setRefsForLevel(exploreRefs.current, state.intensity, master)
      setRefsForLevel(combatRefs.current, 0, master)
    } else if (state.musicMode === "combat") {
      setRefsForLevel(combatRefs.current, state.intensity, master)
      setRefsForLevel(exploreRefs.current, 0, master)
    } else {
      // blend
      setRefsForLevel(exploreRefs.current, 100 - state.intensity, master)
      setRefsForLevel(combatRefs.current, state.intensity, master)
    }
  }, [state.intensity, state.masterVolume, enabled])

  // Ambience volume
  useEffect(() => {
    if (!enabled) return
    if (ambienceRef.current) {
      const vol = (state.ambienceVolume / 100) * (state.masterVolume / 100)
      ambienceRef.current.volume(vol)
    }
  }, [state.ambienceVolume, state.masterVolume, enabled])

  // Master volume
  useEffect(() => {
    if (!enabled) return
    const master = state.masterVolume / 100
    const ambienceTarget = (state.ambienceVolume / 100) * master
    if (ambienceRef.current) {
      try {
        const cur = ambienceRef.current.volume()
        ambienceRef.current.fade(cur, ambienceTarget, FADE_MS)
      } catch (e) {
        ambienceRef.current.volume(ambienceTarget)
      }
    }
    // master volume changes should update mixed refs according to musicMode
    if (state.musicMode === "explore") {
      setRefsForLevel(exploreRefs.current, state.intensity, master)
      setRefsForLevel(combatRefs.current, 0, master)
    } else if (state.musicMode === "combat") {
      setRefsForLevel(combatRefs.current, state.intensity, master)
      setRefsForLevel(exploreRefs.current, 0, master)
    } else {
      setRefsForLevel(exploreRefs.current, 100 - state.intensity, master)
      setRefsForLevel(combatRefs.current, state.intensity, master)
    }
  }, [state.masterVolume, enabled, state.ambienceVolume, state.intensity])

  // Pause/resume when enabled changes
  useEffect(() => {
    if (!enabled) {
      ambienceRef.current?.pause()
      exploreRefs.current.forEach((r) => r.pause())
      combatRefs.current.forEach((r) => r.pause())
    } else {
      ambienceRef.current?.play()
      exploreRefs.current.forEach((r) => r.play())
      combatRefs.current.forEach((r) => r.play())
    }
  }, [enabled])

  // Mount / unmount
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      ambienceRef.current?.unload()
      exploreRefs.current.forEach((r) => r.unload())
      combatRefs.current.forEach((r) => r.unload())
    }
  }, [])

  const playSfx = useCallback((url: string) => {
    const h = new Howl({ src: [url], volume: state.masterVolume / 100, html5: true })
    h.play()
  }, [state.masterVolume])

  return { playSfx }
}
