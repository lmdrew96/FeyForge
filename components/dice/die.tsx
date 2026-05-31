"use client"

// Distinct color per die type so a spread of dice reads as variety, not a
// monochrome set. Tuned to sit against the dark scene surfaces.
export const DIE_COLORS: Record<number, string> = {
  4: "#e0a23c", // amber
  6: "#d1564f", // crimson
  8: "#3aa6a0", // teal
  10: "#4a86d9", // blue
  12: "#9a63c4", // violet
  20: "#6fae45", // green — the hero die
  100: "#c64fa0", // magenta
}

type Shape = "d4" | "d6" | "d8" | "d10" | "d12" | "d20"

function shapeFor(sides: number): Shape {
  if (sides === 4) return "d4"
  if (sides === 6) return "d6"
  if (sides === 8) return "d8"
  if (sides === 10 || sides === 100) return "d10"
  if (sides === 12) return "d12"
  return "d20"
}

// clip-path silhouettes (percent coords). d6 is a rounded square (no clip).
const CLIP: Record<Shape, string | null> = {
  d4: "polygon(50% 4%, 96% 92%, 4% 92%)",
  d6: null,
  d8: "polygon(50% 2%, 96% 50%, 50% 98%, 4% 50%)",
  d10: "polygon(50% 3%, 88% 40%, 70% 97%, 30% 97%, 12% 40%)",
  d12: "polygon(50% 2%, 98% 38%, 80% 96%, 20% 96%, 2% 38%)",
  d20: "polygon(50% 3%, 95% 27%, 95% 73%, 50% 97%, 5% 73%, 5% 27%)",
}

// Where the face value sits — pointed dice read better with the number nudged
// down toward the wider part of the silhouette.
const NUMBER_Y: Record<Shape, string> = {
  d4: "66%",
  d6: "58%",
  d8: "50%",
  d10: "52%",
  d12: "54%",
  d20: "50%",
}

// Three-digit faces (only "100" on a d100) need a smaller glyph to fit the
// narrow silhouette without overflowing.
function faceFontScale(value: number | undefined): number {
  return value !== undefined && String(value).length >= 3 ? 0.27 : 0.4
}

export interface DieProps {
  sides: number
  /** The rolled face. Omit for a static shape (e.g. a quick-roll button). */
  value?: number
  size?: number
  /** Drives the tumble animation and hides the face until it settles. */
  rolling?: boolean
  /** Dropped advantage/disadvantage die — shown faded. */
  dimmed?: boolean
  highlight?: "nat20" | "nat1" | null
  /** Stagger index so a handful of dice don't tumble in lockstep. */
  index?: number
}

export function Die({
  sides,
  value,
  size = 56,
  rolling = false,
  dimmed = false,
  highlight = null,
  index = 0,
}: DieProps) {
  const shape = shapeFor(sides)
  const die = DIE_COLORS[sides] ?? "var(--scene-accent)"
  const light = `color-mix(in srgb, ${die}, white 34%)`
  const dark = `color-mix(in srgb, ${die}, black 30%)`
  const edge = `color-mix(in srgb, ${die}, black 50%)`
  const clip = CLIP[shape]
  const ringColor =
    highlight === "nat20" ? die : highlight === "nat1" ? "#ef4444" : null

  // The d6 is the one die that tumbles as a true 3D cube (the option Nae
  // picked). It only takes its cube form while rolling; on settle it swaps to
  // the flat face below, "landing" with the value showing.
  const isCube = shape === "d6" && rolling

  return (
    <span
      className={rolling && !isCube ? "dice-rolling" : undefined}
      style={{
        position: "relative",
        display: "inline-flex",
        width: size,
        height: size,
        flex: "0 0 auto",
        opacity: dimmed ? 0.55 : 1,
        animationDelay: rolling && !isCube ? `${index * 45}ms` : undefined,
        filter: ringColor ? `drop-shadow(0 0 6px ${ringColor})` : undefined,
        perspective: isCube ? size * 3 : undefined,
      }}
    >
      {isCube ? (
        <D6Cube size={size} light={light} die={die} dark={dark} edge={edge} />
      ) : (
        <>
          {/* silhouette + shading — a clean colored gem, no internal lines */}
          <span
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(145deg, ${light} 0%, ${die} 46%, ${dark} 100%)`,
              clipPath: clip ?? undefined,
              borderRadius: shape === "d6" ? size * 0.18 : undefined,
              filter: "drop-shadow(0 2px 3px var(--scene-shadow))",
            }}
          />
          {/* face value */}
          {value !== undefined && (
            <span
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: NUMBER_Y[shape],
                transform: "translateY(-50%)",
                textAlign: "center",
                fontFamily: "var(--font-cinzel)",
                fontWeight: 700,
                fontSize: size * faceFontScale(value),
                lineHeight: 1,
                color: "#fff",
                textShadow: "0 1px 2px rgba(0,0,0,0.65)",
                visibility: rolling ? "hidden" : "visible",
                pointerEvents: "none",
              }}
            >
              {value}
            </span>
          )}
        </>
      )}
    </span>
  )
}

// ── d6 as a real CSS-3D cube ──────────────────────────────────────────────────
// Six faces positioned in 3D; the wrapper carries `transform-style: preserve-3d`
// and a tumble keyframe (defined in globals.css). Opposite faces sum to 7, the
// way a real d6 is numbered. Shown only during the ~500ms roll.

function D6Cube({
  size,
  light,
  die,
  dark,
  edge,
}: {
  size: number
  light: string
  die: string
  dark: string
  edge: string
}) {
  const half = size / 2
  // front, back, right, left, top, bottom — numbers chosen so opposite pairs
  // sum to 7 (1/6, 2/5, 3/4).
  const faces: { n: number; transform: string }[] = [
    { n: 1, transform: `translateZ(${half}px)` },
    { n: 6, transform: `rotateY(180deg) translateZ(${half}px)` },
    { n: 3, transform: `rotateY(90deg) translateZ(${half}px)` },
    { n: 4, transform: `rotateY(-90deg) translateZ(${half}px)` },
    { n: 2, transform: `rotateX(90deg) translateZ(${half}px)` },
    { n: 5, transform: `rotateX(-90deg) translateZ(${half}px)` },
  ]

  return (
    <span
      className="dice-cube-rolling"
      style={{
        position: "absolute",
        inset: 0,
        transformStyle: "preserve-3d",
      }}
    >
      {faces.map((f) => (
        <span
          key={f.n}
          style={{
            position: "absolute",
            inset: 0,
            transform: f.transform,
            background: `linear-gradient(145deg, ${light} 0%, ${die} 46%, ${dark} 100%)`,
            border: `1px solid ${edge}`,
            borderRadius: size * 0.14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-cinzel)",
            fontWeight: 700,
            fontSize: size * 0.42,
            color: "#fff",
            textShadow: "0 1px 2px rgba(0,0,0,0.65)",
            backfaceVisibility: "hidden",
          }}
        >
          {f.n}
        </span>
      ))}
    </span>
  )
}
