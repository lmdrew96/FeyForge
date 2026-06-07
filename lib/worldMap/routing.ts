// Multimodal point-to-point travel routing over Azgaar's road/trail/sea network.
//
// Phase 1 "GPS": ONE cost-weighted graph that merges land + water so a single
// search auto-picks the fastest SURFACE — a short sea hop naturally beats a long
// land detour — instead of running land and water as separate, non-competing
// per-leg graphs (the old model, which errored on Port→non-port crossings and took
// absurd overland detours). No new map data: every existing map benefits.
//
// Azgaar stores the network as hundreds of short SEGMENTS (route objects). Each
// segment point carries a cellId (3rd element); segments meet where they share a
// cell, so cellIds are the graph's node keys. We stitch ALL segments (roads,
// trails, AND searoutes) into one graph; every edge carries a `surface` so the
// search can price it by travel TIME under the chosen capability profile.
//
// Land↔water transfer happens at CONNECTORS: for each coastal pin we bridge its
// nearest land node to its nearest sea node (the "launch a boat from the beach"
// edge). A connector remembers whether its pin was a Port, so a chartered vessel
// (ports only) can be restricted while an own small craft embarks anywhere.
//
// Edge weight for path SELECTION = pixels ÷ surfaceSpeed (i.e. time). px is a
// single consistent unit and one map scale applies to every edge, so the scale
// constant cancels out of the arg-min — surface selection is correct even when the
// map carries no real mile scale. Distances are reported in miles by the caller via
// scaleMilesPerPx. Browser-safe; no dependencies, so viewer + DM page route client-side.

export type Surface = "land" | "water" | "connector"
// Journey-wide water capability: drives which edges are usable + their speed.
//   none      → land only (water + connectors unusable)
//   own-craft → searoutes + connectors usable (SLOW); embark/disembark ANYWHERE coastal
//   chartered → searoutes usable (FAST), but embark/disembark only at PORT connectors
export type WaterCapability = "none" | "own-craft" | "chartered"

export type RoutePoints = number[][] // [[x%, y%, cellId?], …]
export type GraphRoute = { group: string; points: RoutePoints }

// A coastal launch point fed to the builder. isPort gates chartered embark.
export type GraphPin = { x: number; y: number; isPort: boolean }

type Edge = { to: number; px: number; surface: Surface; isPort: boolean }

export type TravelGraph = {
  adj: Map<number, Edge[]> // cell → outgoing edges
  pos: Map<number, [number, number]> // cell → [x%, y%]
  seaNodes: Set<number> // nodes that lie on the searoute network
}

// A typed run of the planned path (connectors fold into "water" for display).
export type PathSegment = { surface: "land" | "water"; points: number[][] }

export type PlannedJourney = {
  points: number[][] // full path polyline, % space ([x,y] per node)
  px: number // total length in pixels (× scaleMilesPerPx → miles)
  landPx: number // pixels travelled on land
  waterPx: number // pixels travelled on water (incl. connectors)
  crossings: number // # of contiguous water runs ("N sea crossings")
  segments: PathSegment[] // per-surface runs for styling the overlay
}

export type PlanOptions = {
  water: WaterCapability
  landSpeed: number // mph (any unit consistent with waterSpeed)
  waterSpeed: number // mph
}

const pxBetween = (
  a: number[] | readonly [number, number],
  b: number[] | readonly [number, number],
  width: number,
  height: number,
): number => Math.hypot(((a[0] - b[0]) / 100) * width, ((a[1] - b[1]) / 100) * height)

// Connector reach: a pin only earns a land↔sea bridge if that bridge is within this
// fraction of the map diagonal (≈ "close enough to row out to the lane"). Generous
// on purpose — a connector's time-cost self-limits its use; the cap just stops
// deep-inland towns from teleporting to the coast.
const CONNECTOR_MAX_FRACTION = 0.08

function addEdge(
  adj: Map<number, Edge[]>,
  a: number,
  b: number,
  px: number,
  surface: Surface,
  isPort: boolean,
): void {
  if (a === b) return
  const push = (from: number, to: number) => {
    let list = adj.get(from)
    if (!list) adj.set(from, (list = []))
    // Dedup parallel edges of the SAME surface (keep the cheaper, and treat the
    // bridge as port-accessible if ANY contributing pin was a port). Different
    // surfaces between the same pair coexist — the search prices them separately.
    const existing = list.find((e) => e.to === to && e.surface === surface)
    if (existing) {
      if (px < existing.px) existing.px = px
      existing.isPort = existing.isPort || isPort
    } else {
      list.push({ to, px, surface, isPort })
    }
  }
  push(a, b)
  push(b, a)
}

// Build the unified multimodal graph from the route network + coastal launch pins.
export function buildTravelGraph(
  routes: GraphRoute[],
  width: number,
  height: number,
  pins: GraphPin[] = [],
): TravelGraph {
  const adj = new Map<number, Edge[]>()
  const pos = new Map<number, [number, number]>()
  const seaNodes = new Set<number>()
  const landNodes = new Set<number>()

  for (const r of routes) {
    const isSea = r.group === "searoutes"
    const surface: Surface = isSea ? "water" : "land"
    const pts = r.points
    for (const p of pts) {
      const c = p[2]
      if (typeof c === "number") {
        if (!pos.has(c)) pos.set(c, [p[0], p[1]])
        ;(isSea ? seaNodes : landNodes).add(c)
      }
    }
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1][2]
      const b = pts[i][2]
      if (typeof a === "number" && typeof b === "number") {
        addEdge(adj, a, b, pxBetween(pts[i - 1], pts[i], width, height), surface, false)
      }
    }
  }

  // Connectors: bridge each coastal pin's nearest land node to its nearest sea node.
  // Skipped entirely when the map has no sea network.
  if (seaNodes.size > 0 && pins.length > 0) {
    const maxPx = CONNECTOR_MAX_FRACTION * Math.hypot(width, height)
    const nearestOf = (set: Set<number>, x: number, y: number): number | null => {
      let best: number | null = null
      let bestD = Infinity
      for (const c of set) {
        const d = pxBetween([x, y], pos.get(c)!, width, height)
        if (d < bestD) {
          bestD = d
          best = c
        }
      }
      return best
    }
    for (const pin of pins) {
      const sea = nearestOf(seaNodes, pin.x, pin.y)
      if (sea == null) continue
      const land = landNodes.size > 0 ? nearestOf(landNodes, pin.x, pin.y) : null
      if (land == null || land === sea) continue // a port sitting on the sea network needs no bridge
      const px = pxBetween(pos.get(land)!, pos.get(sea)!, width, height)
      if (px > maxPx) continue // too far inland to launch
      addEdge(adj, land, sea, px, "connector", pin.isPort)
    }
  }

  return { adj, pos, seaNodes }
}

// Nearest graph node to a point (% space). Towns sit on the graph, so this resolves
// a town pin to its road/sea node; an off-network pin snaps to the closest node.
function nearestNode(pos: Map<number, [number, number]>, x: number, y: number): number | null {
  let best: number | null = null
  let bestD = Infinity
  for (const [cell, p] of pos) {
    const d = (p[0] - x) ** 2 + (p[1] - y) ** 2
    if (d < bestD) {
      bestD = d
      best = cell
    }
  }
  return best
}

// Is this edge traversable under the capability profile?
const usable = (e: Edge, water: WaterCapability): boolean => {
  if (e.surface === "land") return true
  if (water === "none") return false
  // Chartered vessels embark/disembark at ports only → non-port connectors are off.
  if (e.surface === "connector" && water === "chartered" && !e.isPort) return false
  return true
}

// Dijkstra over the multimodal graph, pricing each edge by TIME (px ÷ surfaceSpeed)
// under the given profile. Returns the path polyline, its land/water breakdown, and
// the per-surface runs — or null when the two pins sit on networks that don't connect
// under this profile (a real, common, correctly-reported outcome). Graphs here are a
// few thousand nodes and this runs once per leg, so a simple array PQ is fine.
export function planJourney(
  graph: TravelGraph,
  from: [number, number],
  to: [number, number],
  opts: PlanOptions,
): PlannedJourney | null {
  const { adj, pos } = graph
  const src = nearestNode(pos, from[0], from[1])
  const dst = nearestNode(pos, to[0], to[1])
  if (src == null || dst == null) return null
  if (src === dst) {
    return { points: [pos.get(src)!], px: 0, landPx: 0, waterPx: 0, crossings: 0, segments: [] }
  }

  const speedFor = (s: Surface): number => (s === "land" ? opts.landSpeed : opts.waterSpeed)
  const cost = (e: Edge): number => e.px / Math.max(speedFor(e.surface), 0.0001)

  const dist = new Map<number, number>([[src, 0]])
  const prev = new Map<number, { from: number; surface: Surface; px: number }>()
  const done = new Set<number>()
  const pq: [number, number][] = [[0, src]] // [cost, node]
  while (pq.length) {
    let mi = 0
    for (let i = 1; i < pq.length; i++) if (pq[i][0] < pq[mi][0]) mi = i
    const [d, u] = pq.splice(mi, 1)[0]
    if (done.has(u)) continue
    done.add(u)
    if (u === dst) break
    const edges = adj.get(u)
    if (!edges) continue
    for (const e of edges) {
      if (done.has(e.to) || !usable(e, opts.water)) continue
      const nd = d + cost(e)
      if (nd < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, nd)
        prev.set(e.to, { from: u, surface: e.surface, px: e.px })
        pq.push([nd, e.to])
      }
    }
  }
  if (!done.has(dst)) return null // disconnected under this profile

  // Walk the predecessor chain back to src, collecting per-edge surface + px.
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
    const a = pos.get(e.from)!
    const b = pos.get(e.to)!
    if (!cur || cur.surface !== disp) {
      if (disp === "water") crossings++
      cur = { surface: disp, points: [a, b] }
      segments.push(cur)
    } else {
      cur.points.push(b)
    }
  }

  const points: number[][] = [pos.get(src)!, ...steps.map((e) => pos.get(e.to)!)]
  return { points, px: landPx + waterPx, landPx, waterPx, crossings, segments }
}
