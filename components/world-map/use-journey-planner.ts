"use client"

// ── Multi-leg journey planner ─────────────────────────────────────────────────
// A real D&D journey often chains modes — caravan overland to a port, then sail
// port → port — so the planner is a list of WAYPOINTS, not a single from→to pair.
// Each waypoint after the first defines a LEG, and every leg keeps its OWN travel
// mode (the leg's mode decides whether it routes over the land graph or the sea
// graph). Tap a town to append the next stop; the itinerary sums per-leg distance
// and the card turns each leg's miles into days.
//
// This hook is the single home for that state + routing so both surfaces (the DM
// page and the in-session viewer) share one implementation — they used to carry
// near-identical journey state each. The pure graph/Dijkstra engine stays in
// lib/worldMap/routing.ts; this is just the React-stateful, map-aware layer.

import { useCallback, useMemo, useState } from "react"
import { buildRouteGraph, planRoute } from "@/lib/worldMap/routing"
import type { MapRoute, TravelMode } from "./routes-overlay"
import type { LocationId, MapLocation } from "./shared"

export type JourneyLeg = {
  fromId: LocationId
  toId: LocationId
  fromName: string
  toName: string
  mode: TravelMode
  found: boolean
  miles: number | null
  points: number[][] | null
  // A non-port endpoint chosen for a Ship leg — the leg is blocked with a reason
  // rather than snapping to a distant sea node and reporting a confident wrong mile.
  seaBlockedBy: string | null
}

export type Itinerary = {
  legs: JourneyLeg[]
  totalMiles: number | null // Σ of the measurable legs; null if none can be measured
  legPoints: number[][][] // each found leg's polyline (% space) for RoutesSvg
}

export type JourneyPlanner = {
  waypointCount: number
  originName: string | null
  lastName: string | null
  itinerary: Itinerary | null // null until there are ≥ 2 waypoints (≥ 1 leg)
  hasWater: boolean // map has a sea network → Ship legs are usable
  addWaypoint: (loc: MapLocation) => void
  setLegMode: (legIndex: number, mode: TravelMode) => void
  removeLast: () => void
  clear: () => void
  isWaypoint: (id: LocationId) => boolean
}

// Waypoint ids and per-leg modes are kept in ONE state object so a single tap
// updates both atomically — nesting one setState inside another's updater would
// double-fire under React StrictMode and desync the two arrays. Invariant:
// modes.length === max(0, ids.length - 1).
type JourneyState = { ids: LocationId[]; modes: TravelMode[] }

export function useJourneyPlanner({
  routes,
  locations,
  width,
  height,
  scaleMilesPerPx,
}: {
  routes: MapRoute[] | undefined
  locations: MapLocation[] | undefined
  width: number | undefined
  height: number | undefined
  scaleMilesPerPx: number | null | undefined
}): JourneyPlanner {
  const [state, setState] = useState<JourneyState>({ ids: [], modes: [] })

  // Separate land + sea graphs, built once per loaded route set; each leg routes
  // over one depending on its mode. They meet only at ports.
  const landGraph = useMemo(
    () => (routes && width && height ? buildRouteGraph(routes, width, height, "land") : null),
    [routes, width, height],
  )
  const waterGraph = useMemo(
    () => (routes && width && height ? buildRouteGraph(routes, width, height, "water") : null),
    [routes, width, height],
  )
  const hasWater = useMemo(() => (routes ?? []).some((r) => r.group === "searoutes"), [routes])

  const locById = useMemo(() => {
    const m = new Map<LocationId, MapLocation>()
    for (const l of locations ?? []) m.set(l._id, l)
    return m
  }, [locations])

  // Append a stop. The first waypoint is just the origin; from the second on, each
  // tap also births a leg, defaulting its mode to the previous leg's (explicit, no
  // auto-switching). Re-tapping the current last stop is a no-op.
  const addWaypoint = useCallback((loc: MapLocation) => {
    setState(({ ids, modes }) => {
      if (ids.length > 0 && ids[ids.length - 1] === loc._id) return { ids, modes }
      const nextModes = ids.length >= 1 ? [...modes, modes[modes.length - 1] ?? "foot"] : modes
      return { ids: [...ids, loc._id], modes: nextModes }
    })
  }, [])

  const setLegMode = useCallback((legIndex: number, mode: TravelMode) => {
    setState((s) => ({ ids: s.ids, modes: s.modes.map((m, i) => (i === legIndex ? mode : m)) }))
  }, [])

  const removeLast = useCallback(() => {
    setState(({ ids, modes }) => {
      if (ids.length === 0) return { ids, modes }
      return { ids: ids.slice(0, -1), modes: ids.length >= 2 ? modes.slice(0, -1) : modes }
    })
  }, [])

  const clear = useCallback(() => setState({ ids: [], modes: [] }), [])

  const isWaypoint = useCallback((id: LocationId) => state.ids.includes(id), [state.ids])

  const itinerary = useMemo<Itinerary | null>(() => {
    if (state.ids.length < 2) return null
    const legs: JourneyLeg[] = []
    for (let i = 0; i < state.ids.length - 1; i++) {
      const f = locById.get(state.ids[i])
      const t = locById.get(state.ids[i + 1])
      if (!f || !t) continue
      const mode = state.modes[i] ?? "foot"
      const base: JourneyLeg = {
        fromId: f._id,
        toId: t._id,
        fromName: f.name,
        toName: t.name,
        mode,
        found: false,
        miles: null,
        points: null,
        seaBlockedBy: null,
      }
      // Ship legs embark only from ports (the explicit Port tag is the guard, not a
      // snap-distance threshold). Block with a reason instead of a wrong distance.
      if (mode === "ship") {
        if (!f.town?.features?.includes("Port")) {
          legs.push({ ...base, seaBlockedBy: f.name })
          continue
        }
        if (!t.town?.features?.includes("Port")) {
          legs.push({ ...base, seaBlockedBy: t.name })
          continue
        }
      }
      const graph = mode === "ship" ? waterGraph : landGraph
      if (!graph) {
        legs.push(base)
        continue
      }
      const res = planRoute(graph, [f.x, f.y], [t.x, t.y])
      const miles = res && scaleMilesPerPx ? Math.round(res.px * scaleMilesPerPx) : null
      legs.push({ ...base, found: !!res, miles, points: res?.points ?? null })
    }
    const measurable = legs.filter((l) => l.miles != null)
    const totalMiles = measurable.length ? measurable.reduce((s, l) => s + (l.miles ?? 0), 0) : null
    const legPoints = legs.filter((l) => l.points && l.points.length >= 2).map((l) => l.points as number[][])
    return { legs, totalMiles, legPoints }
  }, [state.ids, state.modes, landGraph, waterGraph, locById, scaleMilesPerPx])

  const originName = state.ids.length ? locById.get(state.ids[0])?.name ?? null : null
  const lastName = state.ids.length ? locById.get(state.ids[state.ids.length - 1])?.name ?? null : null

  return {
    waypointCount: state.ids.length,
    originName,
    lastName,
    itinerary,
    hasWater,
    addWaypoint,
    setLegMode,
    removeLast,
    clear,
    isWaypoint,
  }
}
