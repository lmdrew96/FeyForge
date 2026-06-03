// Point-to-point travel routing over Azgaar's road/trail network.
//
// Azgaar stores the network as hundreds of short SEGMENTS (route objects), not
// continuous town-to-town roads. Each segment point carries a cellId (3rd element);
// segments meet where they share a cell, so cellIds are the graph's node keys. We
// stitch the LAND segments (roads + trails — sea routes are a separate network with
// a different pace) into a weighted graph and shortest-path between two pins.
//
// Edge weight = distance in PIXELS. Stored points are 0–100 %, so a segment's px
// length is hypot((dx/100)*width, (dy/100)*height); multiply the path total by
// scaleMilesPerPx for miles. (Applying the scale to raw % deltas would be wrong by
// ~width/100 — the points are normalized, the scale is per-pixel.) Browser-safe; no
// dependencies, so both the viewer and the DM page can build/route client-side.

export type RoutePoints = number[][] // [[x%, y%, cellId?], …]
export type GraphRoute = { group: string; points: RoutePoints }

export type RouteGraph = {
  adj: Map<number, Map<number, number>> // cell → (neighbor cell → px distance)
  pos: Map<number, [number, number]> // cell → [x%, y%]
}

const pxBetween = (a: number[], b: number[], width: number, height: number): number =>
  Math.hypot(((a[0] - b[0]) / 100) * width, ((a[1] - b[1]) / 100) * height)

// Build the land routing graph (roads + trails). Sea routes are excluded.
export function buildRouteGraph(routes: GraphRoute[], width: number, height: number): RouteGraph {
  const adj = new Map<number, Map<number, number>>()
  const pos = new Map<number, [number, number]>()
  const link = (a: number, b: number, w: number) => {
    if (a === b) return
    if (!adj.has(a)) adj.set(a, new Map())
    if (!adj.has(b)) adj.set(b, new Map())
    const cur = adj.get(a)!.get(b)
    if (cur == null || w < cur) {
      adj.get(a)!.set(b, w)
      adj.get(b)!.set(a, w)
    }
  }
  for (const r of routes) {
    if (r.group === "searoutes") continue
    const pts = r.points
    for (const p of pts) {
      const c = p[2]
      if (typeof c === "number" && !pos.has(c)) pos.set(c, [p[0], p[1]])
    }
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1][2]
      const b = pts[i][2]
      if (typeof a === "number" && typeof b === "number") {
        link(a, b, pxBetween(pts[i - 1], pts[i], width, height))
      }
    }
  }
  return { adj, pos }
}

// Nearest graph node to a point (% space). Towns sit on the graph, so this resolves
// a town pin to its road node exactly; an off-road pin snaps to the closest road.
function nearestNode(graph: RouteGraph, x: number, y: number): number | null {
  let best: number | null = null
  let bestD = Infinity
  for (const [cell, p] of graph.pos) {
    const d = (p[0] - x) ** 2 + (p[1] - y) ** 2
    if (d < bestD) {
      bestD = d
      best = cell
    }
  }
  return best
}

export type PlannedRoute = {
  points: number[][] // path polyline in % space ([x,y] per node)
  px: number // total length in pixels (× scaleMilesPerPx → miles)
}

// Dijkstra from the node nearest `from` to the node nearest `to`. Returns the path
// polyline + total px length, or null when the two sit on disconnected networks
// (separate landmasses — a common, correct outcome). Graphs here are ≤ a few
// thousand nodes and this runs once per journey, so a simple array PQ is fine.
export function planRoute(
  graph: RouteGraph,
  from: [number, number],
  to: [number, number],
): PlannedRoute | null {
  const src = nearestNode(graph, from[0], from[1])
  const dst = nearestNode(graph, to[0], to[1])
  if (src == null || dst == null) return null
  if (src === dst) return { points: [graph.pos.get(src)!], px: 0 }

  const dist = new Map<number, number>([[src, 0]])
  const prev = new Map<number, number>()
  const done = new Set<number>()
  const pq: [number, number][] = [[0, src]]
  while (pq.length) {
    let mi = 0
    for (let i = 1; i < pq.length; i++) if (pq[i][0] < pq[mi][0]) mi = i
    const [d, u] = pq.splice(mi, 1)[0]
    if (done.has(u)) continue
    done.add(u)
    if (u === dst) break
    const neighbors = graph.adj.get(u)
    if (!neighbors) continue
    for (const [v, w] of neighbors) {
      if (done.has(v)) continue
      const nd = d + w
      if (nd < (dist.get(v) ?? Infinity)) {
        dist.set(v, nd)
        prev.set(v, u)
        pq.push([nd, v])
      }
    }
  }
  if (!done.has(dst)) return null // disconnected networks

  const cells: number[] = []
  for (let c: number | undefined = dst; c != null; c = prev.get(c)) {
    cells.push(c)
    if (c === src) break
  }
  cells.reverse()
  const points = cells.map((c) => graph.pos.get(c)).filter((p): p is [number, number] => !!p)
  return { points, px: dist.get(dst) ?? 0 }
}
