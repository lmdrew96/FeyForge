// Map-aware context for AI location generation (Phase 1).
//
// Given a pin's position and the other pins on the map, compute a compact
// "surroundings" summary — the nearest places with bearing + distance, plus the
// region it sits in — so /api/world-map/generate-location can ground the writing
// in the real neighborhood instead of generating each place in a vacuum.
//
// Pure + isomorphic (no client/server deps): computeSurroundings runs in the DM's
// browser (it already holds every pin + the map dims); formatSurroundings runs in
// the route to build the prompt block. One file = one source of truth for both.

export type NearbyPin = {
  name: string
  type: string // settlement | poi | natural | water | region
  bearing: string // N..NW
  miles?: number // present only when the map has a scale
  proximity: string // qualitative fallback when there's no scale
  revealed: boolean // unrevealed neighbors must not be named in player-facing text
}

export type Surroundings = {
  region?: string
  nearby: NearbyPin[]
}

type Point = { x: number; y: number } // normalized 0–100
type PinLike = { name: string; type: string; x: number; y: number; revealed?: boolean }
type MapLike = { width: number; height: number; scaleMilesPerPx?: number }

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const

// Bearing from self → neighbor in PIXEL space (the map isn't square, so equal
// normalized deltas aren't equal ground deltas). Image-Y grows downward, so
// north = −dy; 0° = N, 90° = E.
function bearing(dxPx: number, dyPx: number): string {
  const deg = (Math.atan2(dxPx, -dyPx) * 180) / Math.PI
  const idx = Math.round((((deg % 360) + 360) % 360) / 45) % 8
  return COMPASS[idx]
}

// Qualitative distance as a fraction of the map's diagonal — the fallback when
// the map carries no miles-per-pixel scale.
function proximityWord(frac: number): string {
  if (frac < 0.08) return "very close"
  if (frac < 0.18) return "nearby"
  if (frac < 0.35) return "a ways off"
  return "distant"
}

const NEARBY_LIMIT = 5
// Drop "neighbors" farther than this fraction of the map diagonal. These preset
// maps are continental (~3,000 mi wide), so the 5 nearest pins can still be many
// hundreds of miles off — feeding a 1,500-mi "neighbor" is noise, not context.
const NEARBY_MAX_FRAC = 0.4
// Ignore a region marker farther than half the map diagonal — at that range it's
// almost certainly a different region, so naming it would mislead the model.
const REGION_MAX_FRAC = 0.5

export function computeSurroundings(self: Point, others: PinLike[], map: MapLike): Surroundings {
  const { width, height, scaleMilesPerPx } = map
  const diag = Math.hypot(width, height) || 1

  const measured = others
    .filter((o) => Number.isFinite(o.x) && Number.isFinite(o.y))
    .map((o) => {
      const dxPx = ((o.x - self.x) / 100) * width
      const dyPx = ((o.y - self.y) / 100) * height
      const px = Math.hypot(dxPx, dyPx)
      return {
        o,
        px,
        frac: px / diag,
        bearing: bearing(dxPx, dyPx),
        miles: scaleMilesPerPx ? Math.max(1, Math.round(px * scaleMilesPerPx)) : undefined,
      }
    })
    .sort((a, b) => a.px - b.px)

  const nonRegion = measured.filter((m) => m.o.type !== "region")
  const withinRange = nonRegion.filter((m) => m.frac <= NEARBY_MAX_FRAC).slice(0, NEARBY_LIMIT)
  // If everything's beyond the cutoff (an isolated pin in open country), keep the
  // single nearest as a lone anchor so the prompt still has *some* grounding.
  const chosen = withinRange.length > 0 ? withinRange : nonRegion.slice(0, 1)

  const nearby: NearbyPin[] = chosen.map((m) => ({
      name: m.o.name,
      type: m.o.type,
      bearing: m.bearing,
      miles: m.miles,
      proximity: proximityWord(m.frac),
      // Treat anything not explicitly true as undiscovered — fail safe against
      // leaking a secret place's name into player-facing prose.
      revealed: m.o.revealed === true,
    }))

  const regionHit = measured.find((m) => m.o.type === "region" && m.frac <= REGION_MAX_FRAC)

  return { region: regionHit?.o.name, nearby }
}

const TYPE_LABEL: Record<string, string> = {
  settlement: "settlement",
  poi: "point of interest",
  natural: "natural feature",
  water: "body of water",
  region: "region",
}

// Render the surroundings as a prompt block. Empty string when there's nothing
// useful to add, so the base prompt is unchanged for maps with a single pin.
export function formatSurroundings(s?: Surroundings | null): string {
  if (!s) return ""
  const nearby = Array.isArray(s.nearby) ? s.nearby.slice(0, 8) : []
  if (!s.region && nearby.length === 0) return ""

  const lines: string[] = []
  if (s.region) lines.push(`Region: within or near ${s.region}.`)
  if (nearby.length) {
    lines.push("Nearby places:")
    for (const n of nearby) {
      const where =
        typeof n.miles === "number" ? `~${n.miles} mi ${n.bearing}` : `to the ${n.bearing}, ${n.proximity}`
      const hidden = n.revealed ? "" : " [undiscovered]"
      lines.push(`- ${n.name} (${TYPE_LABEL[n.type] ?? n.type}) — ${where}${hidden}`)
    }
  }
  lines.push(
    "Ground the writing in these surroundings — reference neighbors, the region, and rough distance/direction where it makes the place feel connected to its world. Don't invent geography that contradicts this list. Never name an [undiscovered] place in the player-facing description (DM notes may use them).",
  )
  return "\n" + lines.join("\n")
}
