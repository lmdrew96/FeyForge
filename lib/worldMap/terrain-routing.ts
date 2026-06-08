// Phase-2 "terrain GPS": route across open water — or trackless land — where the
// authored road/searoute network is silent, using Azgaar's GRID heightmap. The grid
// is a regular cols×rows lattice with IMPLICIT 8-neighbour adjacency (cell i → col =
// i % cols, row = ⌊i / cols⌋), so we never store or regenerate a Voronoi mesh; the
// neighbours are arithmetic and computed on the fly during the search.
//
// FUSE, don't replace: the grid layers ON TOP of Phase 1's route graph (roads, trails,
// searoutes, port connectors — buildTravelGraph). The authored network keeps FULL
// speed; off-network grid cells travel at GRID_SPEED_FACTOR of it, so the router still
// PREFERS drawn roads/lanes but can cut across open water when that's genuinely faster.
// Capability gating (none / own-craft / chartered) is shared verbatim with Phase 1 via
// isEdgeUsable — one source of truth. The search is A* (admissible straight-line ÷
// max-speed heuristic) over a binary heap: the grid adds ~10k nodes, far past what
// Phase 1's linear-scan PQ handles. Browser-safe; no deps.
//
// Graceful: callers use this ONLY when a heightGrid is present; otherwise they fall
// back to planJourney (Phase 1). Same PlannedJourney return shape, so the hook is
// agnostic about which engine ran.

import {
  buildTravelGraph,
  isEdgeUsable,
  type GraphPin,
  type GraphRoute,
  type PathSegment,
  type PlannedJourney,
  type PlanOptions,
  type Surface,
  type TravelGraph,
} from "./routing"

export type StoredHeightGrid = { cols: number; rows: number; heights: string } // base64, one byte/cell
export type HeightGrid = { cols: number; rows: number; heights: Uint8Array }

// Decode the stored base64 heightmap to a typed array (browser + Node via atob).
// Returns null on corruption / length mismatch → caller falls back to Phase 1.
export function decodeHeightGrid(g: StoredHeightGrid | null | undefined): HeightGrid | null {
  if (!g || typeof g.heights !== "string" || !g.cols || !g.rows) return null
  try {
    const bin = atob(g.heights)
    const heights = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) heights[i] = bin.charCodeAt(i)
    if (heights.length !== g.cols * g.rows) return null
    return { cols: g.cols, rows: g.rows, heights }
  } catch {
    return null
  }
}

const LAND_MIN = 20 // Azgaar height ≥ 20 = land, below = water
// Off-network grid travel is this fraction of the drawn-network speed at the same
// mode → roads/searoutes stay preferred, but a meaningfully shorter off-grid path
// still wins on time (≈ trackless terrain is ~60% the pace of a road).
const GRID_SPEED_FACTOR = 0.6
// Grid node keys sit above any Azgaar pack cellId (route nodes), so the two node
// spaces never collide inside one adjacency lookup.
const GRID_BASE = 1_000_000

type Edge = { to: number; px: number; surface: Surface; isPort: boolean; grid?: boolean }

export type FusedGraph = {
  base: TravelGraph // Phase 1 route graph (routes + port connectors)
  grid: HeightGrid
  width: number
  height: number
  cross: Map<number, Edge[]> // bridges between a route node and its containing grid cell
}

const pxBetween = (ax: number, ay: number, bx: number, by: number, w: number, h: number): number =>
  Math.hypot(((ax - bx) / 100) * w, ((ay - by) / 100) * h)

// Grid cell ⇄ map %: a cell's centre is at ((col+0.5)/cols, (row+0.5)/rows) of the
// image (verified — Azgaar's grid spans ≈ the image extent, so ports land on coast
// cells). Exact inverses, so a pin's % snaps back to the cell that contains it.
const cellOf = (x: number, y: number, cols: number, rows: number): number => {
  const col = Math.max(0, Math.min(cols - 1, Math.floor((x / 100) * cols)))
  const row = Math.max(0, Math.min(rows - 1, Math.floor((y / 100) * rows)))
  return row * cols + col
}
const centerX = (idx: number, cols: number): number => (((idx % cols) + 0.5) / cols) * 100
const centerY = (idx: number, cols: number, rows: number): number => ((Math.floor(idx / cols) + 0.5) / rows) * 100

// Build the fused graph: Phase 1 route graph + the grid (kept implicit) + bridges from
// each route node to its containing grid cell so the search can move between layers.
export function buildFusedGraph(
  routes: GraphRoute[],
  width: number,
  height: number,
  pins: GraphPin[],
  grid: HeightGrid,
): FusedGraph {
  const base = buildTravelGraph(routes, width, height, pins)
  const { cols, rows, heights } = grid
  const cross = new Map<number, Edge[]>()
  const link = (a: number, b: number, px: number, surface: Surface) => {
    ;(cross.get(a) ?? cross.set(a, []).get(a))!.push({ to: b, px, surface, isPort: false })
    ;(cross.get(b) ?? cross.set(b, []).get(b))!.push({ to: a, px, surface, isPort: false })
  }
  for (const [cellId, [x, y]] of base.pos) {
    const gi = cellOf(x, y, cols, rows)
    const surface: Surface = heights[gi] >= LAND_MIN ? "land" : "water"
    link(cellId, GRID_BASE + gi, pxBetween(x, y, centerX(gi, cols), centerY(gi, cols, rows), width, height), surface)
  }
  return { base, grid, width, height, cross }
}

// Snap a pin (%) to a grid cell to START/END on. Towns are land features, so prefer
// the nearest LAND cell — a coastal pin can sit on the water side of the boundary;
// search an expanding ring, fall back to the containing cell (water-locked).
function snapCell(x: number, y: number, grid: HeightGrid): number {
  const { cols, rows, heights } = grid
  const home = cellOf(x, y, cols, rows)
  if (heights[home] >= LAND_MIN) return home
  const hc = home % cols
  const hr = Math.floor(home / cols)
  for (let ring = 1; ring <= 3; ring++) {
    for (let dr = -ring; dr <= ring; dr++) {
      for (let dc = -ring; dc <= ring; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue // perimeter of the ring only
        const c = hc + dc
        const r = hr + dr
        if (c < 0 || r < 0 || c >= cols || r >= rows) continue
        const idx = r * cols + c
        if (heights[idx] >= LAND_MIN) return idx
      }
    }
  }
  return home
}

const posOf = (u: number, f: FusedGraph): [number, number] =>
  u < GRID_BASE ? f.base.pos.get(u)! : [centerX(u - GRID_BASE, f.grid.cols), centerY(u - GRID_BASE, f.grid.cols, f.grid.rows)]

const NEIGHBORS: [number, number][] = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]

// The 8 grid-neighbour edges of a grid cell, surfaced from cell heights: both land →
// land; both water → open water; mixed → a coast transition (connector, non-port: an
// own small craft may launch off any beach, a chartered ship may not).
function gridEdges(gi: number, f: FusedGraph): Edge[] {
  const { cols, rows, heights } = f.grid
  const col = gi % cols
  const row = Math.floor(gi / cols)
  const here = heights[gi] >= LAND_MIN
  const cx = centerX(gi, cols)
  const cy = centerY(gi, cols, rows)
  const out: Edge[] = []
  for (const [dc, dr] of NEIGHBORS) {
    const c = col + dc
    const r = row + dr
    if (c < 0 || r < 0 || c >= cols || r >= rows) continue
    const gj = r * cols + c
    const there = heights[gj] >= LAND_MIN
    const surface: Surface = here && there ? "land" : !here && !there ? "water" : "connector"
    out.push({
      to: GRID_BASE + gj,
      px: pxBetween(cx, cy, centerX(gj, cols), centerY(gj, cols, rows), f.width, f.height),
      surface,
      isPort: false,
      grid: true,
    })
  }
  return out
}

function edgesOf(u: number, f: FusedGraph): Edge[] {
  const cross = f.cross.get(u)
  if (u < GRID_BASE) {
    const route = (f.base.adj.get(u) ?? []) as Edge[]
    return cross ? [...route, ...cross] : route
  }
  const g = gridEdges(u - GRID_BASE, f)
  return cross ? [...g, ...cross] : g
}

// A* over the fused graph, pricing edges by TIME (px ÷ speed; grid edges at
// GRID_SPEED_FACTOR). Same PlannedJourney shape as Phase 1's planJourney.
export function planTerrainJourney(
  f: FusedGraph,
  from: [number, number],
  to: [number, number],
  opts: PlanOptions,
): PlannedJourney | null {
  const src = GRID_BASE + snapCell(from[0], from[1], f.grid)
  const dst = GRID_BASE + snapCell(to[0], to[1], f.grid)
  if (src === dst) return { points: [posOf(src, f)], px: 0, landPx: 0, waterPx: 0, crossings: 0, segments: [] }

  const [dx, dy] = posOf(dst, f)
  const maxSpeed = Math.max(opts.landSpeed, opts.waterSpeed, 1e-4)
  const heuristic = (u: number): number => {
    const [ux, uy] = posOf(u, f)
    return pxBetween(ux, uy, dx, dy, f.width, f.height) / maxSpeed
  }
  const edgeCost = (e: Edge): number => {
    const speed = (e.surface === "land" ? opts.landSpeed : opts.waterSpeed) * (e.grid ? GRID_SPEED_FACTOR : 1)
    return e.px / Math.max(speed, 1e-4)
  }

  const g = new Map<number, number>([[src, 0]])
  const prev = new Map<number, { from: number; surface: Surface; px: number }>()
  const done = new Set<number>()
  const heap = new MinHeap()
  heap.push(src, heuristic(src))
  while (heap.size > 0) {
    const u = heap.pop()!
    if (done.has(u)) continue
    done.add(u)
    if (u === dst) break
    const gu = g.get(u)!
    for (const e of edgesOf(u, f)) {
      if (done.has(e.to) || !isEdgeUsable(e.surface, e.isPort, opts.water)) continue
      const nd = gu + edgeCost(e)
      if (nd < (g.get(e.to) ?? Infinity)) {
        g.set(e.to, nd)
        prev.set(e.to, { from: u, surface: e.surface, px: e.px })
        heap.push(e.to, nd + heuristic(e.to))
      }
    }
  }
  if (!done.has(dst)) return null

  // Reconstruct (identical to Phase 1's planJourney: per-surface runs, connectors fold
  // into "water" for display + waterPx).
  const steps: { from: number; to: number; surface: Surface; px: number }[] = []
  for (let c = dst; c !== src; ) {
    const step = prev.get(c)
    if (!step) break
    steps.push({ from: step.from, to: c, surface: step.surface, px: step.px })
    c = step.from
  }
  steps.reverse()

  let landPx = 0
  let waterPx = 0
  let crossings = 0
  const segments: PathSegment[] = []
  let cur: PathSegment | null = null
  for (const e of steps) {
    const disp: "land" | "water" = e.surface === "land" ? "land" : "water"
    if (disp === "land") landPx += e.px
    else waterPx += e.px
    const a = posOf(e.from, f)
    const b = posOf(e.to, f)
    if (!cur || cur.surface !== disp) {
      if (disp === "water") crossings++
      cur = { surface: disp, points: [a, b] }
      segments.push(cur)
    } else {
      cur.points.push(b)
    }
  }
  const points = [posOf(src, f), ...steps.map((e) => posOf(e.to, f))]
  return { points, px: landPx + waterPx, landPx, waterPx, crossings, segments }
}

// Binary min-heap keyed by priority (parallel node/priority arrays). Stale entries are
// fine — the search skips already-finalized nodes on pop, so we never decrease-key.
class MinHeap {
  private nodes: number[] = []
  private prio: number[] = []
  get size(): number {
    return this.nodes.length
  }
  push(node: number, priority: number): void {
    this.nodes.push(node)
    this.prio.push(priority)
    let i = this.nodes.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (this.prio[p] <= this.prio[i]) break
      this.swap(i, p)
      i = p
    }
  }
  pop(): number | undefined {
    const n = this.nodes.length
    if (n === 0) return undefined
    const top = this.nodes[0]
    const lastNode = this.nodes.pop()!
    const lastPrio = this.prio.pop()!
    if (n > 1) {
      this.nodes[0] = lastNode
      this.prio[0] = lastPrio
      const size = this.nodes.length
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = 2 * i + 2
        let s = i
        if (l < size && this.prio[l] < this.prio[s]) s = l
        if (r < size && this.prio[r] < this.prio[s]) s = r
        if (s === i) break
        this.swap(i, s)
        i = s
      }
    }
    return top
  }
  private swap(i: number, j: number): void {
    const tn = this.nodes[i]
    this.nodes[i] = this.nodes[j]
    this.nodes[j] = tn
    const tp = this.prio[i]
    this.prio[i] = this.prio[j]
    this.prio[j] = tp
  }
}
