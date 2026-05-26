"use client"

import { useEffect, useRef, useCallback } from "react"
import { Howl } from "howler"

export type AudioEngineState = {
  ambienceUrl: string | null
  activeLayers?: Array<{ layerId: string; url: string; volume: number }>
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
  const layerRefs = useRef<Map<string, Howl>>(new Map())
  const exploreRefs = useRef<Howl[]>([])
  const combatRefs = useRef<Howl[]>([])
  const victoryRef = useRef<Howl | null>(null)

  const currentUrls = useRef({ ambience: "", explore: [] as string[], combat: [] as string[] })
  const currentLayers = useRef<Map<string, { url: string; volume: number }>>(new Map())
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
       if (!mounted.current) {
         h.unload()
         return
       }
       try {
         h.play()
         h.fade(0, vol, FADE_MS)
       } catch (e) {
         console.error("Howl play/fade error:", e)
       }
     })
     h.on("loaderror", (id, error) => {
       console.error("Howl load error:", error)
     })
     return h
   }, [])

  const destroyLayerHowl = useCallback((layerId: string) => {
    const howl = layerRefs.current.get(layerId)
    if (!howl) return
    howl.fade(howl.volume(), 0, FADE_MS)
    setTimeout(() => howl.unload(), FADE_MS + 50)
    layerRefs.current.delete(layerId)
    currentLayers.current.delete(layerId)
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

  // Sync layered ambience tracks
  useEffect(() => {
    if (!enabled) return

    const nextLayers = new Map(
      (state.activeLayers ?? [])
        .filter((layer) => Boolean(layer.url))
        .map((layer) => [layer.layerId, { url: layer.url, volume: layer.volume }] as const)
    )

    // remove layers no longer active
    for (const layerId of currentLayers.current.keys()) {
      if (!nextLayers.has(layerId)) destroyLayerHowl(layerId)
    }

    // add/update active layers
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
          howl.fade(0, targetVol, FADE_MS)
        })

        layerRefs.current.set(layerId, howl)
        currentLayers.current.set(layerId, next)
        continue
      }

      try {
        existingHowl.fade(existingHowl.volume(), targetVol, FADE_MS)
      } catch (e) {
        existingHowl.volume(targetVol)
      }

      currentLayers.current.set(layerId, next)
    }
  }, [state.activeLayers, state.masterVolume, enabled, destroyLayerHowl])

  // Sync ambience track (legacy single-slot path)
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
      ambienceRef.current = createHowl(url, true, targetVol)
    }
  }, [state.ambienceUrl, state.activeLayers, enabled, createHowl, destroyHowl, state.ambienceVolume, state.masterVolume])
   // Sync music tracks based on active mode
   useEffect(() => {
     if (!enabled) return

     const master = state.masterVolume / 100

     // Determine which mode is active
     const activeMode = state.musicMode === "explore" ? "explore" : state.musicMode === "combat" ? "combat" : "blend"
     const exploreUrls = state.exploreUrls ?? []
     const combatUrls = state.combatUrls ?? []

     // Destroy and recreate only what's needed
     if (activeMode === "explore") {
       // Load explore, destroy combat
       { // Explore scope
         const old = currentUrls.current.explore
         const same = exploreUrls.length === old.length && exploreUrls.every((u, i) => u === old[i])
         if (!same) {
           currentUrls.current.explore = exploreUrls
           exploreRefs.current.forEach((r) => {
             try { r.fade(r.volume(), 0, FADE_MS); setTimeout(() => r.unload(), FADE_MS + 50) } catch (e) { r.unload() }
           })
           exploreRefs.current = []
           if (exploreUrls.length > 0) {
             exploreUrls.forEach((u) => {
               const h = createHowl(u, true, (state.intensity / 100) * master)
               exploreRefs.current.push(h)
             })
           }
         } else {
           // Same URL array; just update volume
           setRefsForLevel(exploreRefs.current, state.intensity, master)
         }
       }
       // Destroy combat
       { // Combat scope
         currentUrls.current.combat = []
         combatRefs.current.forEach((r) => {
           try { r.fade(r.volume(), 0, FADE_MS); setTimeout(() => r.unload(), FADE_MS + 50) } catch (e) { r.unload() }
         })
         combatRefs.current = []
       }
     } else if (activeMode === "combat") {
       // Load combat, destroy explore
       { // Combat scope
         const old = currentUrls.current.combat
         const same = combatUrls.length === old.length && combatUrls.every((u, i) => u === old[i])
         if (!same) {
           currentUrls.current.combat = combatUrls
           combatRefs.current.forEach((r) => {
             try { r.fade(r.volume(), 0, FADE_MS); setTimeout(() => r.unload(), FADE_MS + 50) } catch (e) { r.unload() }
           })
           combatRefs.current = []
           if (combatUrls.length > 0) {
             combatUrls.forEach((u) => {
               const h = createHowl(u, true, (state.intensity / 100) * master)
               combatRefs.current.push(h)
             })
           }
         } else {
           // Same URL array; just update volume
           setRefsForLevel(combatRefs.current, state.intensity, master)
         }
       }
       // Destroy explore
       { // Explore scope
         currentUrls.current.explore = []
         exploreRefs.current.forEach((r) => {
           try { r.fade(r.volume(), 0, FADE_MS); setTimeout(() => r.unload(), FADE_MS + 50) } catch (e) { r.unload() }
         })
         exploreRefs.current = []
       }
     } else {
       // blend: load both
       { // Explore scope
         const old = currentUrls.current.explore
         const same = exploreUrls.length === old.length && exploreUrls.every((u, i) => u === old[i])
         if (!same) {
           currentUrls.current.explore = exploreUrls
           exploreRefs.current.forEach((r) => {
             try { r.fade(r.volume(), 0, FADE_MS); setTimeout(() => r.unload(), FADE_MS + 50) } catch (e) { r.unload() }
           })
           exploreRefs.current = []
           if (exploreUrls.length > 0) {
             exploreUrls.forEach((u) => {
               const h = createHowl(u, true, ((100 - state.intensity) / 100) * master)
               exploreRefs.current.push(h)
             })
           }
         } else {
           setRefsForLevel(exploreRefs.current, 100 - state.intensity, master)
         }
       }
       { // Combat scope
         const old = currentUrls.current.combat
         const same = combatUrls.length === old.length && combatUrls.every((u, i) => u === old[i])
         if (!same) {
           currentUrls.current.combat = combatUrls
           combatRefs.current.forEach((r) => {
             try { r.fade(r.volume(), 0, FADE_MS); setTimeout(() => r.unload(), FADE_MS + 50) } catch (e) { r.unload() }
           })
           combatRefs.current = []
           if (combatUrls.length > 0) {
             combatUrls.forEach((u) => {
               const h = createHowl(u, true, (state.intensity / 100) * master)
               combatRefs.current.push(h)
             })
           }
         } else {
           setRefsForLevel(combatRefs.current, state.intensity, master)
         }
       }
     }
   }, [state.exploreUrls, state.combatUrls, state.musicMode, state.intensity, state.masterVolume, enabled, createHowl, setRefsForLevel])

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

   // (Intensity crossfade now handled in music sync above)

  // Ambience volume
  useEffect(() => {
    if (!enabled) return
    const hasLayeredAmbience = (state.activeLayers?.length ?? 0) > 0
    if (!hasLayeredAmbience && ambienceRef.current) {
      const vol = (state.ambienceVolume / 100) * (state.masterVolume / 100)
      ambienceRef.current.volume(vol)
    }
  }, [state.ambienceVolume, state.masterVolume, state.activeLayers, enabled])

   // Master volume
   useEffect(() => {
     if (!enabled) return
     const master = state.masterVolume / 100
     const hasLayeredAmbience = (state.activeLayers?.length ?? 0) > 0

     // Update ambience volume (legacy single-slot path)
     const ambienceTarget = (state.ambienceVolume / 100) * master
     if (!hasLayeredAmbience && ambienceRef.current) {
       try {
         const cur = ambienceRef.current.volume()
         ambienceRef.current.fade(cur, ambienceTarget, FADE_MS)
       } catch (e) {
         if (ambienceRef.current) ambienceRef.current.volume(ambienceTarget)
       }
     }

     // Update layered ambience volumes
     if (hasLayeredAmbience) {
       for (const [layerId, howl] of layerRefs.current.entries()) {
         const layer = currentLayers.current.get(layerId)
         if (!layer) continue
         const target = layer.volume * master
         try {
           howl.fade(howl.volume(), target, FADE_MS)
         } catch (e) {
           try { howl.volume(target) } catch (e2) { /* ignore */ }
         }
       }
     }

     // Update music tracks volume (active mode only, based on music sync effect)
     const activeMode = state.musicMode === "explore" ? "explore" : state.musicMode === "combat" ? "combat" : "blend"
     if (activeMode === "explore") {
       setRefsForLevel(exploreRefs.current, state.intensity, master)
     } else if (activeMode === "combat") {
       setRefsForLevel(combatRefs.current, state.intensity, master)
     } else {
       // blend
       setRefsForLevel(exploreRefs.current, 100 - state.intensity, master)
       setRefsForLevel(combatRefs.current, state.intensity, master)
     }
   }, [state.masterVolume, enabled, state.ambienceVolume, state.activeLayers, state.musicMode, state.intensity, setRefsForLevel])

  // Pause/resume when enabled changes
  useEffect(() => {
    if (!enabled) {
      ambienceRef.current?.pause()
      layerRefs.current.forEach((r) => r.pause())
      exploreRefs.current.forEach((r) => r.pause())
      combatRefs.current.forEach((r) => r.pause())
    } else {
      ambienceRef.current?.play()
      layerRefs.current.forEach((r) => r.play())
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
      layerRefs.current.forEach((r) => r.unload())
      layerRefs.current.clear()
      currentLayers.current.clear()
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
