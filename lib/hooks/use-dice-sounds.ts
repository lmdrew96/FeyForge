"use client"

import { useRef, useCallback } from "react"
import { useSettingsStore } from "@/lib/settings-store"

/**
 * Hook for dice sound effects using Web Audio API synthesis.
 * No external audio files needed - all sounds are generated programmatically.
 */
export function useDiceSounds() {
  const audioContextRef = useRef<AudioContext | null>(null)
  const soundEnabled = useSettingsStore((s) => s.diceSound)

  const getContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }
    // Resume context if suspended (browser autoplay policy)
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume()
    }
    return audioContextRef.current
  }, [])

  /**
   * Play a dice rolling sound - quick percussive clicks simulating dice hitting table
   */
  const playRollSound = useCallback(() => {
    if (!soundEnabled) return

    try {
      const ctx = getContext()
      const now = ctx.currentTime

      // Create multiple quick clicks to simulate dice bouncing
      for (let i = 0; i < 4; i++) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.connect(gain)
        gain.connect(ctx.destination)

        // Different frequencies for each click
        osc.frequency.value = 200 + Math.random() * 300
        osc.type = "triangle"

        const clickTime = now + i * 0.08
        const clickDuration = 0.03

        gain.gain.setValueAtTime(0, clickTime)
        gain.gain.linearRampToValueAtTime(0.15, clickTime + 0.005)
        gain.gain.exponentialRampToValueAtTime(0.001, clickTime + clickDuration)

        osc.start(clickTime)
        osc.stop(clickTime + clickDuration)
      }

      // Add a subtle noise burst for texture
      const bufferSize = ctx.sampleRate * 0.1
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1))
      }

      const noise = ctx.createBufferSource()
      const noiseGain = ctx.createGain()
      const filter = ctx.createBiquadFilter()

      noise.buffer = buffer
      filter.type = "highpass"
      filter.frequency.value = 2000

      noise.connect(filter)
      filter.connect(noiseGain)
      noiseGain.connect(ctx.destination)

      noiseGain.gain.setValueAtTime(0.08, now)
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)

      noise.start(now)
    } catch {
      // Silently fail if audio context isn't available
    }
  }, [soundEnabled, getContext])

  /**
   * Play a critical hit/miss sound
   * @param isHit - true for critical hit (triumphant), false for critical miss (sad)
   */
  const playCritSound = useCallback(
    (isHit: boolean) => {
      if (!soundEnabled) return

      try {
        const ctx = getContext()
        const now = ctx.currentTime

        if (isHit) {
          // Triumphant ascending arpeggio for critical hit
          const notes = [523.25, 659.25, 783.99, 1046.5] // C5, E5, G5, C6
          notes.forEach((freq, i) => {
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()

            osc.connect(gain)
            gain.connect(ctx.destination)

            osc.frequency.value = freq
            osc.type = "sine"

            const noteTime = now + i * 0.1
            const noteDuration = 0.3

            gain.gain.setValueAtTime(0, noteTime)
            gain.gain.linearRampToValueAtTime(0.2, noteTime + 0.02)
            gain.gain.exponentialRampToValueAtTime(0.001, noteTime + noteDuration)

            osc.start(noteTime)
            osc.stop(noteTime + noteDuration)
          })

          // Add shimmer effect
          const shimmer = ctx.createOscillator()
          const shimmerGain = ctx.createGain()
          shimmer.connect(shimmerGain)
          shimmerGain.connect(ctx.destination)

          shimmer.frequency.value = 2000
          shimmer.type = "sine"

          shimmerGain.gain.setValueAtTime(0, now)
          shimmerGain.gain.linearRampToValueAtTime(0.05, now + 0.1)
          shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5)

          shimmer.start(now)
          shimmer.stop(now + 0.5)
        } else {
          // Descending sad tone for critical miss
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()

          osc.connect(gain)
          gain.connect(ctx.destination)

          osc.frequency.setValueAtTime(300, now)
          osc.frequency.exponentialRampToValueAtTime(100, now + 0.4)
          osc.type = "sawtooth"

          gain.gain.setValueAtTime(0, now)
          gain.gain.linearRampToValueAtTime(0.15, now + 0.02)
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5)

          osc.start(now)
          osc.stop(now + 0.5)

          // Add low thud
          const thud = ctx.createOscillator()
          const thudGain = ctx.createGain()
          thud.connect(thudGain)
          thudGain.connect(ctx.destination)

          thud.frequency.value = 60
          thud.type = "sine"

          thudGain.gain.setValueAtTime(0.2, now)
          thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)

          thud.start(now)
          thud.stop(now + 0.3)
        }
      } catch {
        // Silently fail if audio context isn't available
      }
    },
    [soundEnabled, getContext]
  )

  return { playRollSound, playCritSound }
}
