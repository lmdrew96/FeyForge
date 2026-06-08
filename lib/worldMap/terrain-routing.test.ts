import { describe, it, expect } from "vitest"
import { buildFusedGraph, planTerrainJourney, decodeHeightGrid, type HeightGrid } from "./terrain-routing"
import type { GraphRoute } from "./routing"

// 100×100 map so 1 unit of % == 1 px. Speeds chosen so land and an own small craft are
// comparable per-mile (a sea shortcut wins on distance, a road wins on its speed bonus).
const W = 100
const H = 100
const FOOT = 3
const OWN_CRAFT = 2
const CHARTER = 3

// Build a decoded HeightGrid from a (col,row)→height function.
const makeGrid = (cols: number, rows: number, h: (col: number, row: number) => number): HeightGrid => {
  const heights = new Uint8Array(cols * rows)
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) heights[r * cols + c] = h(c, r)
  return { cols, rows, heights }
}

describe("decodeHeightGrid", () => {
  it("round-trips a base64 heightmap and rejects corrupt / mismatched input", () => {
    const bytes = [50, 5, 5, 50]
    const b64 = btoa(String.fromCharCode(...bytes))
    const g = decodeHeightGrid({ cols: 2, rows: 2, heights: b64 })
    expect(g).not.toBeNull()
    expect(Array.from(g!.heights)).toEqual(bytes)
    expect(decodeHeightGrid(null)).toBeNull()
    expect(decodeHeightGrid(undefined)).toBeNull()
    // length mismatch (3 bytes for a 2×2 grid) → null, not a malformed grid
    expect(decodeHeightGrid({ cols: 2, rows: 2, heights: btoa("\x32\x05\x05") })).toBeNull()
  })
})

describe("planTerrainJourney — fused grid + route A* (Phase 2)", () => {
  // ── Fixture A: two landmasses split by a water channel, NO searoute drawn ─────
  // cols 0–3 = land, 4–5 = open water, 6–9 = land. Town A (left) and B (right).
  const channelGrid = makeGrid(10, 5, (col) => (col <= 3 || col >= 6 ? 50 : 5))
  const fusedNoRoutes = buildFusedGraph([], W, H, [], channelGrid)
  const A: [number, number] = [15, 50] // col 1
  const B: [number, number] = [85, 50] // col 8

  it("crosses open water with NO searoute when the party has an own small craft (the Phase-1 gap)", () => {
    const res = planTerrainJourney(fusedNoRoutes, A, B, { water: "own-craft", landSpeed: FOOT, waterSpeed: OWN_CRAFT })
    expect(res).not.toBeNull()
    expect(res!.crossings).toBeGreaterThanOrEqual(1)
    expect(res!.waterPx).toBeGreaterThan(0)
    expect(res!.landPx).toBeGreaterThan(0) // walks the shore on both sides
  })

  it("with no boats, the far landmass is unreachable (land-only)", () => {
    const res = planTerrainJourney(fusedNoRoutes, A, B, { water: "none", landSpeed: FOOT, waterSpeed: 0 })
    expect(res).toBeNull()
  })

  it("a chartered vessel can't launch off an open beach (no port) → no route", () => {
    const res = planTerrainJourney(fusedNoRoutes, A, B, { water: "chartered", landSpeed: FOOT, waterSpeed: CHARTER })
    expect(res).toBeNull()
  })

  // ── Fixture B: a road bridges a water fjord; off-road must detour the long way ─
  // Water only at col 5, rows 0–3 (a fjord from the top); a direct road links A→B
  // straight across. Land-only routing should take the short road, not the long
  // grid detour around the fjord's foot — i.e. roads stay preferred.
  const fjordGrid = makeGrid(11, 5, (col, row) => (col === 5 && row <= 3 ? 5 : 50))
  const roadAx = ((3 + 0.5) / 11) * 100 // 31.82  (col 3, row 1 centre)
  const roadBx = ((7 + 0.5) / 11) * 100 // 68.18  (col 7, row 1 centre)
  const roadY = ((1 + 0.5) / 5) * 100 // 30
  const road: GraphRoute[] = [{ group: "roads", points: [[roadAx, roadY, 1], [roadBx, roadY, 2]] }]
  const fusedRoad = buildFusedGraph(road, W, H, [], fjordGrid)

  it("prefers a road over an equal-or-longer off-road grid path", () => {
    const res = planTerrainJourney(fusedRoad, [roadAx, roadY], [roadBx, roadY], { water: "none", landSpeed: FOOT, waterSpeed: 0 })
    expect(res).not.toBeNull()
    // The straight road is ~36px; the only grid alternative detours down past the
    // fjord (>150px). Taking the road yields ~road length, well under the detour.
    expect(res!.px).toBeGreaterThan(35)
    expect(res!.px).toBeLessThan(45)
    expect(res!.waterPx).toBe(0)
    expect(res!.crossings).toBe(0)
  })

  it("returns a single-point path when origin and destination snap to the same cell", () => {
    const res = planTerrainJourney(fusedNoRoutes, A, A, { water: "own-craft", landSpeed: FOOT, waterSpeed: OWN_CRAFT })
    expect(res).not.toBeNull()
    expect(res!.px).toBe(0)
    expect(res!.segments).toHaveLength(0)
  })
})
