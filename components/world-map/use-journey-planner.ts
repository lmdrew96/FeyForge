"use client"

// ── Multi-leg journey planner (Phase-1 GPS) ───────────────────────────────────
// A real D&D journey chains stops, so the planner is a list of WAYPOINTS. Routing is
// now a single cost-weighted MULTIMODAL search per leg (lib/worldMap/routing.ts):
// land + water compete on TIME, so a short sea hop beats a long land detour, and a
// journey-wide capability PROFILE (no boats / own craft / chartered) decides which
// surfaces are usable. Each leg's surface is an OUTPUT, not an input — the old
// per-leg mode toggle is gone. The multi-stop waypoint chain is unchanged.
//
// This hook is the single home for that state + routing so both surfaces (the DM
// page and the in-session viewer) share one implementation. The pure graph/Dijkstra
// engine stays in lib/worldMap/routing.ts; this is the React-stateful, map-aware layer.

import { useCallback, useMemo, useState } from "react"
import { buildTravelGraph, planJourney } from "@/lib/worldMap/routing"
import type { PathSegment, WaterCapability } from "@/lib/worldMap/routing"
import { buildFusedGraph, decodeHeightGrid, planTerrainJourney } from "@/lib/worldMap/terrain-routing"
import type { StoredHeightGrid } from "@/lib/worldMap/terrain-routing"
import { landSpeedMph, waterSpeedMph } from "./routes-overlay"
import type { FootPace, LandMode, MapRoute, ShipKind } from "./routes-overlay"
import type { LocationId, MapLocation } from "./shared"

// Journey-wide travel settings. land (+ footPace) and water capability drive BOTH the
// router (which surfaces are usable + how fast) and the days reported per leg.
export type TravelProfile = {
  land: LandMode
  footPace: FootPace
  water: WaterCapability
  shipKind: ShipKind
  hoursPerDay: number
}

export type JourneyLeg = {
  fromId: LocationId
  toId: LocationId
  fromName: string
  toName: string
  found: boolean
  miles: number | null // total leg miles (land + water); null when the map has no scale
  landMiles: number // 0 when no scale / no land travel
  waterMiles: number // 0 when no scale / no water travel
  crossings: number // # of sea crossings the router chose
  segments: PathSegment[] // per-surface runs for the overlay
  noPathReason: string | null // informative message when no route exists under the profile
}

export type Itinerary = {
  legs: JourneyLeg[]
  totalMiles: number | null // Σ of the measurable legs; null if none can be measured
  journeySegments: PathSegment[] // every leg's runs, flattened, for RoutesSvg
}

export type JourneyPlanner = {
  waypointCount: number
  originName: string | null
  lastName: string | null
  itinerary: Itinerary | null // null until there are ≥ 2 waypoints (≥ 1 leg)
  hasWater: boolean // map has a sea network → boat capabilities are usable
  profile: TravelProfile
  addWaypoint: (loc: MapLocation) => void
  removeLast: () => void
  clear: () => void
  isWaypoint: (id: LocationId) => boolean
  setLandMode: (m: LandMode) => void
  setFootPace: (p: FootPace) => void
  setWater: (w: WaterCapability) => void
  setShipKind: (k: ShipKind) => void
  setHoursPerDay: (h: number) => void
}

const DEFAULT_PROFILE: TravelProfile = {
  land: "foot",
  footPace: "normal",
  // A small boat by default so coastal + overseas towns "just work" out of the box
  // (the original felt bug). Switch to "No boats" to force a strictly overland route.
  water: "own-craft",
  shipKind: "sailing",
  hoursPerDay: 8,
}

// Waypoint ids + the journey-wide profile live in ONE state object so each update is
// atomic — a nested setState inside another updater double-fires under StrictMode.
// Unlike the old per-leg `modes`, the profile is journey-wide, so there's no per-leg
// array whose length must track ids.
type JourneyState = { ids: LocationId[]; profile: TravelProfile }

export function useJourneyPlanner({
  routes,
  locations,
  width,
  height,
  scaleMilesPerPx,
  heightGrid,
}: {
  routes: MapRoute[] | undefined
  locations: MapLocation[] | undefined
  width: number | undefined
  height: number | undefined
  scaleMilesPerPx: number | null | undefined
  // Phase-2 terrain heightmap (lazy-loaded). Present ⇒ the planner fuses the grid with
  // the route graph and routes via A* (cross open water with no searoute); absent ⇒
  // Phase-1 route-graph Dijkstra. Optional so existing callers/maps degrade gracefully.
  heightGrid?: StoredHeightGrid | null
}): JourneyPlanner {
  const [state, setState] = useState<JourneyState>({ ids: [], profile: DEFAULT_PROFILE })
  const { ids, profile } = state

  // The travel graph, rebuilt when the route set / map dims / pins / heightmap change.
  // With a heightmap → a FUSED grid+route graph (A* terrain routing, Phase 2); without
  // → the Phase-1 route graph (Dijkstra). Coastal pins seed the land↔sea connectors
  // (the Port flag gates chartered embark) in both. Tagged so the planner picks the
  // matching search; either engine returns the same PlannedJourney shape.
  const graph = useMemo(() => {
    if (!routes || !width || !height) return null
    const pins = (locations ?? []).map((l) => ({
      x: l.x,
      y: l.y,
      isPort: !!l.town?.features?.includes("Port"),
    }))
    const grid = decodeHeightGrid(heightGrid)
    if (grid) return { kind: "terrain" as const, g: buildFusedGraph(routes, width, height, pins, grid) }
    return { kind: "route" as const, g: buildTravelGraph(routes, width, height, pins) }
  }, [routes, locations, width, height, heightGrid])

  const hasWater = useMemo(() => (routes ?? []).some((r) => r.group === "searoutes"), [routes])

  const locById = useMemo(() => {
    const m = new Map<LocationId, MapLocation>()
    for (const l of locations ?? []) m.set(l._id, l)
    return m
  }, [locations])

  // Append a stop. Re-tapping the current last stop is a no-op. (Profile is untouched.)
  const addWaypoint = useCallback((loc: MapLocation) => {
    setState((s) => {
      if (s.ids.length > 0 && s.ids[s.ids.length - 1] === loc._id) return s
      return { ...s, ids: [...s.ids, loc._id] }
    })
  }, [])
  const removeLast = useCallback(() => {
    setState((s) => (s.ids.length === 0 ? s : { ...s, ids: s.ids.slice(0, -1) }))
  }, [])
  const clear = useCallback(() => setState((s) => ({ ...s, ids: [] })), [])
  const isWaypoint = useCallback((id: LocationId) => ids.includes(id), [ids])

  const setLandMode = useCallback((m: LandMode) => setState((s) => ({ ...s, profile: { ...s.profile, land: m } })), [])
  const setFootPace = useCallback((p: FootPace) => setState((s) => ({ ...s, profile: { ...s.profile, footPace: p } })), [])
  const setWater = useCallback((w: WaterCapability) => setState((s) => ({ ...s, profile: { ...s.profile, water: w } })), [])
  const setShipKind = useCallback((k: ShipKind) => setState((s) => ({ ...s, profile: { ...s.profile, shipKind: k } })), [])
  const setHoursPerDay = useCallback(
    (h: number) => setState((s) => ({ ...s, profile: { ...s.profile, hoursPerDay: Math.max(1, Math.min(24, h)) } })),
    [],
  )

  const itinerary = useMemo<Itinerary | null>(() => {
    if (ids.length < 2) return null
    const landSpeed = landSpeedMph(profile.land, profile.footPace)
    const waterSpeed = waterSpeedMph(profile.water, profile.shipKind)
    const legs: JourneyLeg[] = []
    for (let i = 0; i < ids.length - 1; i++) {
      const f = locById.get(ids[i])
      const t = locById.get(ids[i + 1])
      if (!f || !t) continue
      const base = { fromId: f._id, toId: t._id, fromName: f.name, toName: t.name }
      const opts = { water: profile.water, landSpeed, waterSpeed }
      const res = !graph
        ? null
        : graph.kind === "terrain"
          ? planTerrainJourney(graph.g, [f.x, f.y], [t.x, t.y], opts)
          : planJourney(graph.g, [f.x, f.y], [t.x, t.y], opts)
      if (!res) {
        // Informative, never a dead end: tell the DM the obvious next action. A boat
        // helps whenever there's a sea network OR a heightmap to cross open water.
        const canBoat = hasWater || graph?.kind === "terrain"
        const reason =
          profile.water === "none"
            ? canBoat
              ? "No land route — enable a boat to try a sea crossing."
              : "No overland route — separate landmasses."
            : "No route reaches there yet — no sea lane links these coasts."
        legs.push({ ...base, found: false, miles: null, landMiles: 0, waterMiles: 0, crossings: 0, segments: [], noPathReason: reason })
        continue
      }
      const scale = scaleMilesPerPx ?? null
      legs.push({
        ...base,
        found: true,
        miles: scale ? Math.round(res.px * scale) : null,
        landMiles: scale ? res.landPx * scale : 0,
        waterMiles: scale ? res.waterPx * scale : 0,
        crossings: res.crossings,
        segments: res.segments,
        noPathReason: null,
      })
    }
    const measurable = legs.filter((l) => l.miles != null)
    const totalMiles = measurable.length ? measurable.reduce((s, l) => s + (l.miles ?? 0), 0) : null
    const journeySegments = legs.flatMap((l) => l.segments)
    return { legs, totalMiles, journeySegments }
  }, [ids, profile, graph, locById, scaleMilesPerPx, hasWater])

  const originName = ids.length ? locById.get(ids[0])?.name ?? null : null
  const lastName = ids.length ? locById.get(ids[ids.length - 1])?.name ?? null : null

  return {
    waypointCount: ids.length,
    originName,
    lastName,
    itinerary,
    hasWater,
    profile,
    addWaypoint,
    removeLast,
    clear,
    isWaypoint,
    setLandMode,
    setFootPace,
    setWater,
    setShipKind,
    setHoursPerDay,
  }
}
