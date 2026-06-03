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
import { Globe, Loader2, Maximize, ZoomIn, ZoomOut } from "lucide-react"
import { FogOverlay } from "./fog-overlay"
import { decodeFogMask } from "./fog-mask"
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

  // View transform
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [selectedId, setSelectedId] = useState<LocationId | null>(null)
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
            {locations.map((loc) => (
              <LocationMarker
                key={loc._id}
                loc={loc}
                zoom={zoom}
                isDM={isDM}
                selected={loc._id === selectedId}
                onSelect={() => jumpToLocation(loc)}
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
          />
        </div>
      )}
    </div>
  )
}
