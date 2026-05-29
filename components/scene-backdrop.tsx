"use client"

/**
 * Layered atmospheric backdrop for the active scene. Sits behind all content
 * (pointer-events-none) and is driven entirely by the --scene-* tokens, so it
 * recolors per scene automatically. Each scene gets its own mote behavior +
 * texture via body[data-scene="…"] rules in globals.css.
 *
 * Mote positions are generated from a fixed seed so server and client render
 * identical markup (no hydration mismatch).
 */

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const MOTE_COUNT = 18
const rand = mulberry32(0x5eed)
const MOTES = Array.from({ length: MOTE_COUNT }, (_, i) => ({
  i,
  left: Math.round(rand() * 1000) / 10,
  top: Math.round(rand() * 1000) / 10,
  size: 2 + Math.round(rand() * 5),
}))

export function SceneBackdrop() {
  return (
    <div className="scene-backdrop" aria-hidden="true">
      <div className="scene-backdrop__glow" />
      <div className="scene-backdrop__vignette" />
      <div className="scene-backdrop__grain" />
      <div className="scene-backdrop__motes">
        {MOTES.map((m) => (
          <span
            key={m.i}
            className="scene-mote"
            style={
              {
                left: `${m.left}%`,
                top: `${m.top}%`,
                width: `${m.size}px`,
                height: `${m.size}px`,
                "--i": m.i,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </div>
  )
}
