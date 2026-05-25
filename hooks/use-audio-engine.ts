"use client"

import { useEffect, useRef, useCallback } from "react"
import { Howl } from "howler"

export type AudioEngineState = {
  ambienceUrl: string | null
  exploreUrl: string | null
  combatUrl: string | null
  intensity: number
  ambienceVolume: number
  masterVolume: number
}

const FADE_MS = 500

export function useAudioEngine(state: AudioEngineState, enabled: boolean) {
  const ambienceRef = useRef<Howl | null>(null)
  const exploreRef = useRef<Howl | null>(null)
  const combatRef = useRef<Howl | null>(null)

  const currentUrls = useRef({ ambience: "", explore: "", combat: "" })
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

  // Sync explore track
  useEffect(() => {
    if (!enabled) return
    const url = state.exploreUrl ?? ""
    if (url === currentUrls.current.explore) return
    currentUrls.current.explore = url
    destroyHowl(exploreRef)
    if (url) {
      const targetVol = ((1 - state.intensity / 100) * state.masterVolume) / 100
      exploreRef.current = createHowl(url, true, targetVol)
    }
  }, [state.exploreUrl, enabled, createHowl, destroyHowl, state.intensity, state.masterVolume])

  // Sync combat track
  useEffect(() => {
    if (!enabled) return
    const url = state.combatUrl ?? ""
    if (url === currentUrls.current.combat) return
    currentUrls.current.combat = url
    destroyHowl(combatRef)
    if (url) {
      const targetVol = ((state.intensity / 100) * state.masterVolume) / 100
      combatRef.current = createHowl(url, true, targetVol)
    }
  }, [state.combatUrl, enabled, createHowl, destroyHowl, state.intensity, state.masterVolume])

  // Intensity crossfade (no track swap, just volume)
  useEffect(() => {
    if (!enabled) return
    const master = state.masterVolume / 100
    if (exploreRef.current) {
      const vol = (1 - state.intensity / 100) * master
      exploreRef.current.volume(vol)
    }
    if (combatRef.current) {
      const vol = (state.intensity / 100) * master
      combatRef.current.volume(vol)
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
    if (ambienceRef.current) {
      ambienceRef.current.volume((state.ambienceVolume / 100) * master)
    }
    if (exploreRef.current) {
      exploreRef.current.volume((1 - state.intensity / 100) * master)
    }
    if (combatRef.current) {
      combatRef.current.volume((state.intensity / 100) * master)
    }
  }, [state.masterVolume, enabled, state.ambienceVolume, state.intensity])

  // Pause/resume when enabled changes
  useEffect(() => {
    if (!enabled) {
      ambienceRef.current?.pause()
      exploreRef.current?.pause()
      combatRef.current?.pause()
    } else {
      ambienceRef.current?.play()
      exploreRef.current?.play()
      combatRef.current?.play()
    }
  }, [enabled])

  // Mount / unmount
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      ambienceRef.current?.unload()
      exploreRef.current?.unload()
      combatRef.current?.unload()
    }
  }, [])

  const playSfx = useCallback((url: string) => {
    const h = new Howl({ src: [url], volume: state.masterVolume / 100, html5: true })
    h.play()
  }, [state.masterVolume])

  return { playSfx }
}
