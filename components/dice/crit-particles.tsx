"use client"

import { useMemo } from "react"
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion"

interface CritParticlesProps {
  type: "hit" | "miss"
  active: boolean
}

/**
 * Particle burst effect for critical hits and misses.
 * Generates a radial burst of colored particles with CSS animations.
 */
export function CritParticles({ type, active }: CritParticlesProps) {
  const prefersReducedMotion = useReducedMotion()

  const particles = useMemo(() => {
    const count = 14
    return Array.from({ length: count }, (_, i) => {
      const angle = (i * 360) / count
      const distance = 60 + Math.random() * 40
      const delay = Math.random() * 0.15
      const size = 4 + Math.random() * 4

      // Calculate x and y offsets based on angle
      const radians = (angle * Math.PI) / 180
      const x = Math.cos(radians) * distance
      const y = Math.sin(radians) * distance

      return {
        id: i,
        x,
        y,
        delay,
        size,
      }
    })
  }, [])

  if (!active || prefersReducedMotion) {
    return null
  }

  const colors = {
    hit: {
      primary: "#42e2ed",
      glow: "rgba(66, 226, 237, 0.6)",
    },
    miss: {
      primary: "#e05555",
      glow: "rgba(224, 85, 85, 0.6)",
    },
  }

  const color = colors[type]

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible flex items-center justify-center">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full animate-crit-particle"
          style={{
            width: particle.size,
            height: particle.size,
            backgroundColor: color.primary,
            boxShadow: `0 0 ${particle.size * 2}px ${color.glow}`,
            "--particle-x": `${particle.x}px`,
            "--particle-y": `${particle.y}px`,
            animationDelay: `${particle.delay}s`,
          } as React.CSSProperties}
        />
      ))}
      {/* Central flash effect */}
      <div
        className="absolute rounded-full animate-result-pop"
        style={{
          width: 40,
          height: 40,
          background: `radial-gradient(circle, ${color.primary}40 0%, transparent 70%)`,
        }}
      />
    </div>
  )
}
