"use client"

import { useEffect, useId, useMemo, useState } from "react"

// ── Fog of war overlay (player view) ─────────────────────────────────────────
// Renders a mystical shroud over the world map with a soft clearing punched out
// around each REVEALED pin — the classic "explored vs. unexplored" experience.
// Pure presentational: the caller decides whether to render it (DM sees the full
// map; players see fog when map.fogEnabled). Mounts inside the pan/zoom transform
// layer as `absolute inset-0`, between the map <img> and the pins, so it tracks
// pan/zoom for free and never blocks pin/pan interaction (pointer-events-none).
//
// We use an SVG <mask> (one soft black circle per revealed pin) rather than
// stacked CSS radial-gradient masks: compositing many holes needs finicky
// mask-composite that's unreliable across browsers, while an SVG mask with N
// circles is clean, resolution-independent, and exact across aspect ratios.

const FOG_COLOR = "#1E1830" // ADHDesigns Deep Dark — deep mystical mist, not flat black

export type FogPin = { x: number; y: number } // normalized 0–100

export function FogOverlay({
  enabled,
  width,
  height,
  revealed,
  radiusPct,
  reducedMotion,
}: {
  enabled: boolean
  width: number
  height: number
  revealed: FogPin[]
  radiusPct: number
  reducedMotion?: boolean
}) {
  // Detect prefers-reduced-motion ourselves unless the caller forces it. Freezes
  // the slow mist drift while keeping the static shroud (same convention as the
  // app's SceneBackdrop).
  const systemReduced = usePrefersReducedMotion()
  const noMotion = reducedMotion ?? systemReduced

  // Unique mask id so multiple overlays on one page (e.g. a DM "preview" beside
  // the real player view) never collide.
  const maskId = useId().replace(/:/g, "")

  // Radius in user space (viewBox px). The clearing is a fixed area of the WORLD,
  // so it scales with the map — do NOT counter-scale by zoom the way the markers
  // do. Based on the shorter side so a wide map doesn't get egg-shaped holes.
  const radius = useMemo(() => {
    const r = (radiusPct / 100) * Math.min(width, height)
    return Math.max(r, 1)
  }, [radiusPct, width, height])

  if (!enabled || width <= 0 || height <= 0) return null

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          {/* Soft falloff for each clearing: opaque (revealing) at the center,
              fading to transparent (still fogged) at the edge. Default
              objectBoundingBox units mean the gradient maps to each <circle>'s
              own bounding box — which is square — so it renders as round
              torchlight per pin regardless of the map's aspect ratio. (The SVG
              viewBox also matches the image's aspect, so there's no stretch.) */}
          <radialGradient id={`${maskId}-hole`}>
            <stop offset="0%" stopColor="#000" />
            <stop offset="62%" stopColor="#000" />
            <stop offset="100%" stopColor="#fff" />
          </radialGradient>

          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={width} height={height}>
            {/* White = fog shows; black = hole (fog hidden). */}
            <rect x="0" y="0" width={width} height={height} fill="#fff" />
            {revealed.map((p, i) => {
              const cx = (p.x / 100) * width
              const cy = (p.y / 100) * height
              return (
                <circle key={i} cx={cx} cy={cy} r={radius} fill={`url(#${maskId}-hole)`} />
              )
            })}
          </mask>

          {/* Subtle drifting mist texture inside the fog fill. */}
          <filter id={`${maskId}-mist`} x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.012 0.018"
              numOctaves={2}
              seed={7}
              result="noise"
            >
              {!noMotion && (
                <animate
                  attributeName="baseFrequency"
                  dur="36s"
                  values="0.012 0.018; 0.016 0.014; 0.012 0.018"
                  repeatCount="indefinite"
                />
              )}
            </feTurbulence>
            <feColorMatrix in="noise" type="saturate" values="0" result="mono" />
            <feComponentTransfer in="mono" result="soft">
              {/* Keep the texture faint — a whisper of cloud, not visual noise. */}
              <feFuncA type="linear" slope="0.10" intercept="0" />
            </feComponentTransfer>
            <feComposite in="soft" in2="SourceGraphic" operator="in" />
          </filter>
        </defs>

        {/* The fog itself, with the clearings masked out. */}
        <g mask={`url(#${maskId})`}>
          <rect x="0" y="0" width={width} height={height} fill={FOG_COLOR} fillOpacity={0.92} />
          {/* Faint mist on top of the fill (also masked, so clearings stay clear). */}
          <rect
            x="0"
            y="0"
            width={width}
            height={height}
            fill="#cdbfe6"
            filter={`url(#${maskId}-mist)`}
          />
          {/* Edge vignette so the fog feels like it deepens toward the borders. */}
          <radialGradient id={`${maskId}-vig`} cx="50%" cy="50%" r="75%">
            <stop offset="55%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.45" />
          </radialGradient>
          <rect x="0" y="0" width={width} height={height} fill={`url(#${maskId}-vig)`} />
        </g>
      </svg>
    </div>
  )
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduced(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])
  return reduced
}
