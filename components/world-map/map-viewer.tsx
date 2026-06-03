"use client"

// ── Read-only world-map viewer (in live session) ─────────────────────────────
// A pan/zoom map surface for the live session "Map" tab — same reveal-gating +
// fog as the full DM page, but no authoring. Players see only revealed pins (the
// server strips the rest in worldMap.listLocations); the DM sees everything and
// gets the one live-useful action: reveal/hide a pin at the table. All the heavy
// presentation (markers, the pin detail with gazetteer + drill-downs, fog) is the
// SAME code the DM editor uses — imported from ./shared, never duplicated.
//
// Sizes to its container (the parent gives it height); it must NOT assume the
// full viewport the way the standalone DM page does.

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Crown, Eye, EyeOff, Globe, ListFilter, Loader2, Maximize, Route as RouteIcon, ZoomIn, ZoomOut } from "lucide-react"
import { FogOverlay } from "./fog-overlay"
import { decodeFogMask } from "./fog-mask"
import { JourneyCard, RoutesLegend, RoutesSvg } from "./routes-overlay"
import { buildRouteGraph, planRoute } from "@/lib/worldMap/routing"
import { RealmsFaithsPanel } from "./realms-faiths-panel"
import { COMBAT_POI_KINDS, EncounterGenerator } from "./encounter-generator"
import { SaveNpcButton } from "./save-npc-button"
import { PinsPanel, filterByKeys } from "./pins-panel"
import { computeSurroundings } from "@/lib/worldMap/surroundings"
import {
  clampPanToViewport,
  DEFAULT_FOG_RADIUS,
  LocationDetail,
  LocationMarker,
  MAX_ZOOM,
  MIN_ZOOM,
  toImageUrl,
  ZoomButton,
  type CampaignId,
  type LocationId,
  type MapLocation,
} from "./shared"

export function WorldMapViewer({ campaignId, isDM }: { campaignId: CampaignId; isDM: boolean }) {
  const map = useQuery(api.worldMap.getMap, { campaignId })
  const locations = useQuery(api.worldMap.listLocations, { campaignId })
  const setRevealed = useMutation(api.worldMap.setRevealed)
  // Travel routes are heavy + lazy — only fetched when journey mode is on. In that
  // mode the network draws faint and tapping two town pins plans a road route.
  const [showRoutes, setShowRoutes] = useState(false)
  const [journeyFrom, setJourneyFrom] = useState<LocationId | null>(null)
  const [journeyTo, setJourneyTo] = useState<LocationId | null>(null)
  const routes = useQuery(api.worldMap.getRoutes, showRoutes ? { campaignId } : "skip")
  // Realms & faiths panel — lazy, opened from the toolbar.
  const [wbOpen, setWbOpen] = useState(false)
  const worldbuilding = useQuery(api.worldMap.getWorldbuilding, wbOpen ? { campaignId } : "skip")

  // View transform
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [selectedId, setSelectedId] = useState<LocationId | null>(null)
  // View-only declutter: hide every pin for a clean look at the bare map.
  const [showPins, setShowPins] = useState(true)
  // Pin-type filter (empty = show all) + the filter/locator drawer.
  const [filterKeys, setFilterKeys] = useState<Set<string>>(new Set())
  const [pinsPanelOpen, setPinsPanelOpen] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{ sx: number; sy: number; px: number; py: number; moved: boolean } | null>(null)

  const clampZoom = (z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z))

  // Pull pan back into bounds whenever zoom changes (matches the DM page).
  useEffect(() => {
    setPan((p) => clampPanToViewport(p, zoom, imgRef.current, viewportRef.current))
  }, [zoom])

  // Fog: players see the shroud with clearings around revealed pins; the DM sees
  // the full map in-session (no preview toggle here — the pin detail's
  // "Visible to players / DM-only" label already tells them each pin's state).
  // listLocations already hands players only revealed pins, so the filter is a
  // safe no-op for them and the real gate for the DM's fuller list.
  const fogRadius = map?.fogRevealRadius ?? DEFAULT_FOG_RADIUS
  const fogPins = useMemo(
    () => (locations ?? []).filter((l) => l.revealed).map((l) => ({ x: l.x, y: l.y })),
    [locations],
  )
  const maskCells = useMemo(() => decodeFogMask(map?.fogMask), [map?.fogMask])
  const showFog = (map?.fogEnabled ?? false) && !isDM

  const selected = useMemo(
    () => (selectedId ? (locations ?? []).find((l) => l._id === selectedId) ?? null : null),
    [locations, selectedId],
  )

  // AI encounter generator — DM-only, combat-capable POI pins. Lets a DM spin up
  // a CR-balanced encounter live at the table, grounded in the pin's neighborhood.
  const selectedSurroundings = useMemo(
    () =>
      selected && map
        ? computeSurroundings(
            { x: selected.x, y: selected.y },
            (locations ?? []).filter((l) => l._id !== selected._id),
            map,
          )
        : undefined,
    [selected, locations, map],
  )
  const encounterAction =
    selected && isDM && selected.poiKind && COMBAT_POI_KINDS.has(selected.poiKind) ? (
      <EncounterGenerator loc={selected} campaignId={campaignId} mapName={map?.name ?? ""} surroundings={selectedSurroundings} />
    ) : undefined
  const npcAction =
    selected && isDM && selected.poiKind === "npc" ? <SaveNpcButton locationId={selected._id} /> : undefined

  // Pin-type filter drives ONLY the marker render below — fog, routing, journey,
  // and jump-to-center stay on the full location list.
  const visibleLocations = useMemo(() => filterByKeys(locations ?? [], filterKeys), [locations, filterKeys])
  const toggleFilterKey = (key: string) =>
    setFilterKeys((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  // If the filter hides the selected pin, drop the selection.
  useEffect(() => {
    if (selectedId && filterKeys.size > 0 && !visibleLocations.some((l) => l._id === selectedId)) {
      setSelectedId(null)
    }
  }, [filterKeys, visibleLocations, selectedId])

  // Land routing graph, built once per loaded route set; Dijkstra runs on it per
  // journey. The journey result feeds both the bold path overlay and the card.
  const graph = useMemo(
    () => (routes && map ? buildRouteGraph(routes, map.width, map.height) : null),
    [routes, map],
  )
  const journey = useMemo(() => {
    if (!graph || !journeyFrom || !journeyTo) return null
    const f = (locations ?? []).find((l) => l._id === journeyFrom)
    const t = (locations ?? []).find((l) => l._id === journeyTo)
    if (!f || !t) return null
    const res = planRoute(graph, [f.x, f.y], [t.x, t.y])
    const miles = res && map?.scaleMilesPerPx ? Math.round(res.px * map.scaleMilesPerPx) : null
    return { found: !!res, miles, points: res?.points ?? null }
  }, [graph, journeyFrom, journeyTo, locations, map])

  // ── Pan / zoom (read-only: no placement, move, or paint) ────────────────────
  const handleWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    const delta = -e.deltaY * 0.0015
    setZoom((z) => clampZoom(z * (1 + delta)))
  }

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragState.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y, moved: false }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragState.current
    if (!d) return
    const dx = e.clientX - d.sx
    const dy = e.clientY - d.sy
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true
    setPan(clampPanToViewport({ x: d.px + dx, y: d.py + dy }, zoom, imgRef.current, viewportRef.current))
  }

  const endPointer = () => {
    dragState.current = null
  }

  // Center the view on a map coord (% of the rendered image), matching the DM page.
  const centerOn = (x: number, y: number) => {
    const img = imgRef.current
    if (!img) return
    const z = clampZoom(Math.max(zoom, 1.8))
    const dx = ((x - 50) / 100) * img.offsetWidth
    const dy = ((y - 50) / 100) * img.offsetHeight
    setZoom(z)
    setPan(clampPanToViewport({ x: -dx * z, y: -dy * z }, z, imgRef.current, viewportRef.current))
  }

  const jumpToLocation = (loc: MapLocation) => {
    setSelectedId(loc._id)
    centerOn(loc.x, loc.y)
  }

  const handleReveal = async (loc: MapLocation) => {
    try {
      await setRevealed({ locationId: loc._id, revealed: !loc.revealed })
      toast.success(loc.revealed ? "Hidden from players." : "Revealed to players.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update visibility.")
    }
  }

  // Journey mode: first tap = origin, second = destination, third starts over.
  const pickJourney = (loc: MapLocation) => {
    if (!journeyFrom || journeyTo) {
      setJourneyFrom(loc._id)
      setJourneyTo(null)
    } else {
      setJourneyTo(loc._id)
    }
  }
  const toggleRoutes = () => {
    setShowRoutes((s) => !s)
    setJourneyFrom(null)
    setJourneyTo(null)
    setSelectedId(null)
    setShowPins(true) // journey planning needs tappable town pins
    setFilterKeys(new Set()) // …and all towns visible, not a filtered subset
  }
  const togglePins = () => {
    const next = !showPins
    setShowPins(next)
    if (!next) setSelectedId(null)
  }

  // ── Loading / empty (the parent mounts us past the DM page's own guards) ─────
  if (map === undefined || locations === undefined) {
    return (
      <div className="flex h-[70vh] min-h-[420px] items-center justify-center rounded-xl border" style={{ borderColor: "var(--scene-border)", background: "var(--scene-surface)" }}>
        <Loader2 className="h-7 w-7 animate-spin" style={{ color: "var(--scene-accent)" }} />
      </div>
    )
  }

  if (map === null) {
    return (
      <div
        className="flex h-[70vh] min-h-[420px] flex-col items-center justify-center gap-2 rounded-xl border p-6 text-center"
        style={{ borderColor: "var(--scene-border)", background: "var(--scene-surface)" }}
      >
        <Globe className="h-9 w-9" style={{ color: "var(--scene-accent)", opacity: 0.6 }} />
        <p className="text-sm font-medium" style={{ color: "var(--scene-text-primary)" }}>
          {isDM ? "No world map yet" : "Your DM hasn't set up a map yet"}
        </p>
        <p className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
          {isDM
            ? "Open the World Map page to import or build one — it'll show up here for your players."
            : "Once your DM adds one and reveals locations, they'll appear here."}
        </p>
      </div>
    )
  }

  return (
    <div
      className="relative flex h-[70vh] min-h-[420px] overflow-hidden rounded-xl border"
      style={{ borderColor: "var(--scene-border)", background: "var(--scene-bg)" }}
    >
      {/* Viewport */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {/* Header strip */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center gap-2 bg-gradient-to-b from-black/40 to-transparent px-4 py-2.5"
        >
          <Globe className="h-4 w-4 shrink-0" style={{ color: "#fff" }} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white" style={{ fontFamily: "var(--font-cinzel)" }}>
              {map.name}
            </p>
            <p className="truncate text-[11px] text-white/70">
              {isDM
                ? `${locations.length} location${locations.length === 1 ? "" : "s"} · tap a pin to reveal it`
                : "Locations your DM has revealed"}
            </p>
          </div>
        </div>

        <div
          ref={viewportRef}
          className="absolute inset-0 flex cursor-grab touch-none select-none items-center justify-center active:cursor-grabbing"
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endPointer}
          onPointerLeave={endPointer}
        >
          {/* Transform layer shrink-wraps the image so pin %s resolve against the
              same box (identical to the DM page). */}
          <div
            className="relative"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center center",
            }}
          >
            <img
              ref={imgRef}
              src={toImageUrl(map.imageStorageKey)}
              alt={map.name}
              draggable={false}
              className="block max-h-[70vh] max-w-full"
            />
            <FogOverlay
              enabled={showFog}
              width={map.width}
              height={map.height}
              revealed={fogPins}
              radiusPct={fogRadius}
              paintedCells={maskCells}
            />
            {showRoutes && routes && (
              <RoutesSvg routes={routes} journey={journey?.points ?? null} />
            )}
            {showPins &&
              visibleLocations.map((loc) => (
                <LocationMarker
                  key={loc._id}
                  loc={loc}
                  zoom={zoom}
                  isDM={isDM}
                  selected={
                    showRoutes
                      ? loc._id === journeyFrom || loc._id === journeyTo
                      : loc._id === selectedId
                  }
                  onSelect={() => (showRoutes ? pickJourney(loc) : jumpToLocation(loc))}
                />
              ))}
          </div>
        </div>

        {/* Zoom controls */}
        <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1">
          <ZoomButton onClick={() => setZoom((z) => clampZoom(z * 1.25))} title="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </ZoomButton>
          <ZoomButton onClick={() => setZoom((z) => clampZoom(z / 1.25))} title="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </ZoomButton>
          <ZoomButton onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} title="Reset view">
            <Maximize className="h-4 w-4" />
          </ZoomButton>
        </div>

        {/* Overlay controls (top-right): pin visibility + journey planner + realms/faiths */}
        <div className="absolute right-4 top-4 z-10 flex flex-col items-end gap-1">
          <button
            onClick={togglePins}
            title={showPins ? "Hide all pins" : "Show all pins"}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium shadow transition-opacity hover:opacity-90"
            style={{
              background: !showPins ? "var(--scene-accent)" : "var(--scene-surface)",
              color: !showPins ? "#fff" : "var(--scene-text-primary)",
              border: `1px solid ${!showPins ? "var(--scene-accent)" : "var(--scene-border)"}`,
            }}
          >
            {showPins ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            <span className="hidden sm:inline">Pins</span>
          </button>
          <button
            onClick={() => setPinsPanelOpen(true)}
            title="Filter pins by type & jump to a location"
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium shadow transition-opacity hover:opacity-90"
            style={{
              background: filterKeys.size > 0 ? "var(--scene-accent)" : "var(--scene-surface)",
              color: filterKeys.size > 0 ? "#fff" : "var(--scene-text-primary)",
              border: `1px solid ${filterKeys.size > 0 ? "var(--scene-accent)" : "var(--scene-border)"}`,
            }}
          >
            <ListFilter className="h-4 w-4" />
            <span className="hidden sm:inline">List</span>
          </button>
          <button
            onClick={toggleRoutes}
            title="Plan a journey — show the road network and tap two towns for the route + travel time"
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium shadow transition-opacity hover:opacity-90"
            style={{
              background: showRoutes ? "var(--scene-accent)" : "var(--scene-surface)",
              color: showRoutes ? "#fff" : "var(--scene-text-primary)",
              border: `1px solid ${showRoutes ? "var(--scene-accent)" : "var(--scene-border)"}`,
            }}
          >
            <RouteIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Travel</span>
          </button>
          <button
            onClick={() => setWbOpen(true)}
            title="Realms &amp; Faiths — the world's kingdoms and religions"
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium shadow transition-opacity hover:opacity-90"
            style={{ background: "var(--scene-surface)", color: "var(--scene-text-primary)", border: "1px solid var(--scene-border)" }}
          >
            <Crown className="h-4 w-4" />
            <span className="hidden sm:inline">Realms</span>
          </button>
        </div>

        {showRoutes && routes && routes.length > 0 && (
          <div className="absolute left-4 top-16 z-10 max-w-[calc(100%-2rem)]">
            <RoutesLegend routes={routes} />
          </div>
        )}

        {showRoutes && (
          <div className="absolute bottom-4 left-4 z-20">
            <JourneyCard
              fromName={journeyFrom ? locations.find((l) => l._id === journeyFrom)?.name ?? null : null}
              toName={journeyTo ? locations.find((l) => l._id === journeyTo)?.name ?? null : null}
              found={journey?.found ?? false}
              miles={journey?.miles ?? null}
              onClear={() => { setJourneyFrom(null); setJourneyTo(null) }}
            />
          </div>
        )}
      </div>

      {/* Detail sidebar (desktop) */}
      {selected && (
        <aside
          className="hidden w-72 shrink-0 overflow-y-auto border-l p-4 lg:block"
          style={{ borderColor: "var(--scene-border)", background: "var(--scene-surface)" }}
        >
          <LocationDetail
            loc={selected}
            isDM={isDM}
            onClose={() => setSelectedId(null)}
            onReveal={isDM ? () => handleReveal(selected) : undefined}
            extraActions={encounterAction ?? npcAction}
          />
        </aside>
      )}

      {/* Detail sheet (mobile) */}
      {selected && (
        <div
          className="absolute inset-x-0 bottom-0 z-20 max-h-[60%] overflow-y-auto rounded-t-2xl border-t p-4 shadow-2xl lg:hidden"
          style={{ borderColor: "var(--scene-border)", background: "var(--scene-surface)" }}
        >
          <LocationDetail
            loc={selected}
            isDM={isDM}
            onClose={() => setSelectedId(null)}
            onReveal={isDM ? () => handleReveal(selected) : undefined}
            extraActions={encounterAction ?? npcAction}
          />
        </div>
      )}

      {wbOpen && worldbuilding && (
        <RealmsFaithsPanel
          realms={worldbuilding.realms}
          faiths={worldbuilding.faiths}
          onClose={() => setWbOpen(false)}
        />
      )}

      {pinsPanelOpen && (
        <PinsPanel
          locations={locations}
          activeKeys={filterKeys}
          onToggleKey={toggleFilterKey}
          onClear={() => setFilterKeys(new Set())}
          onSelect={(loc) => { setShowPins(true); jumpToLocation(loc); setPinsPanelOpen(false) }}
          onClose={() => setPinsPanelOpen(false)}
          isDM={isDM}
        />
      )}
    </div>
  )
}
