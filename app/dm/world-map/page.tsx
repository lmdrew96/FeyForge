"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react"
import { MapSetup } from "./world-map-setup"
import { CenteredCard, PrimaryButton } from "./world-map-ui"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { AppShell } from "@/components/app-shell"
import { useCampaignStore } from "@/lib/campaign-store"
import { cn } from "@/lib/utils"
import { htmlToMarkdown } from "@/lib/html-to-markdown"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import { postAi, AiError } from "@/lib/ai-client"
import { computeSurroundings } from "@/lib/worldMap/surroundings"
import { COMBAT_POI_KINDS, EncounterGenerator } from "@/components/world-map/encounter-generator"
import { SaveNpcButton } from "@/components/world-map/save-npc-button"
import { NpcGenerator, NPC_GEN_POI_KINDS } from "@/components/world-map/npc-generator"
import { type EventPlace } from "@/lib/worldMap/azgaar-map"
import { toast } from "sonner"
import { FogOverlay } from "@/components/world-map/fog-overlay"
import {
  decodeFogMask,
  encodeFogMask,
  emptyMask,
  isMaskEmpty,
  paintBrush,
} from "@/components/world-map/fog-mask"
import { JourneyCard, RoutesLegend, RoutesSvg, type TravelMode } from "@/components/world-map/routes-overlay"
import { buildRouteGraph, planRoute } from "@/lib/worldMap/routing"
import { RealmsFaithsPanel } from "@/components/world-map/realms-faiths-panel"
import { PinsPanel, filterByKeys } from "@/components/world-map/pins-panel"
import {
  Globe,
  Plus,
  Eye,
  EyeOff,
  ListFilter,
  Trash2,
  Save,
  X,
  ImageIcon,
  ZoomIn,
  ZoomOut,
  Maximize,
  MapPin as MapPinIcon,
  Route as RouteIcon,
  Waves,
  Skull,
  Swords,
  Flag,
  Church,
  Flame,
  Mountain,
  Droplets,
  Snowflake,
  TriangleAlert,
  Loader2,
  Crown,
  CloudFog,
  Paintbrush,
  Eraser,
  Check,
  Sparkles,
} from "lucide-react"
import {
  toImageUrl,
  TYPE_META,
  LOCATION_TYPES,
  MIN_ZOOM,
  MAX_ZOOM,
  DEFAULT_FOG_RADIUS,
  clampPanToViewport,
  panToAnchorZoom,
  ResizableDetailAside,
  PANEL_DEFAULT,
  LocationMarker,
  LocationDetail,
  ZoomButton,
  SecondaryButton,
  type WorldMap,
  type MapLocation,
  type LocationId,
  type CampaignId,
  type LocationType,
} from "@/components/world-map/shared"

// Azgaar "zone" (world event) type → SVG icon + color for the DM events panel.
const ZONE_TYPE_META: Record<string, { color: string; icon: typeof MapPinIcon }> = {
  Invasion: { color: "#b91c1c", icon: Swords },
  Crusade: { color: "#b91c1c", icon: Swords },
  Rebels: { color: "#ea580c", icon: Flag },
  Proselytism: { color: "#7c3aed", icon: Church },
  Disease: { color: "#65a30d", icon: Skull },
  Eruption: { color: "#ea580c", icon: Flame },
  Disaster: { color: "#d97706", icon: TriangleAlert },
  Fault: { color: "#78716c", icon: Mountain },
  Avalanche: { color: "#0891b2", icon: Snowflake },
  Flood: { color: "#0284c7", icon: Droplets },
  Tsunami: { color: "#0284c7", icon: Waves },
}
const zoneMeta = (type: string): { color: string; icon: typeof MapPinIcon } =>
  ZONE_TYPE_META[type] ?? { color: "#6b7280", icon: TriangleAlert }

// Geographic reach of a world event, from how many Azgaar cells its zone spans.
// Bands assume Azgaar's default ~10k-cell resolution — confirmed across every repo
// map (small events cluster ≤8 cells, regional 9–40, the rare continent-spanning
// crusade/plague >40). A non-default high-res import would over-count; retune here,
// no reseed needed (we store the raw count). Returns null when the count is absent
// (pre-v0.86 maps, before reseed) so the badge simply doesn't render.
const eventScope = (cellCount?: number): string | null => {
  if (!cellCount || cellCount <= 0) return null
  if (cellCount <= 8) return "Localized"
  if (cellCount <= 40) return "Regional"
  return "Widespread"
}

// Soft render-perf ceiling — mirrors MAX_PINS in convex/worldMap.ts. Adding a World
// Event's town past this is allowed (manual pins are uncapped) but warns the DM.
const PIN_SOFT_CAP = 100

// Fog clearing radius slider bounds (% of the map's shorter side). DEFAULT_FOG_RADIUS
// is imported from the shared module; mirror FOG_MIN/MAX in convex/worldMap.ts.
const FOG_MIN_RADIUS = 5
const FOG_MAX_RADIUS = 30

type LocationDraft = {
  name: string
  type: LocationType
  playerNotes: string
  dmNotes: string
  drillDownImageKey: string // R2 key for the pin's local "launchpad" map ("" = none)
  features: string[] // settlement gazetteer chips (Azgaar's set); "Port" gates ship travel
}

const emptyDraft = (): LocationDraft => ({
  name: "",
  type: "settlement",
  playerNotes: "",
  dmNotes: "",
  drillDownImageKey: "",
  features: [],
})

// Settlement amenity chips, matching Azgaar's burg features so hand-placed towns
// read the same as imported ones. "Port" is load-bearing — it's what makes a town
// a valid embark/disembark point for sea travel in the journey planner.
const SETTLEMENT_FEATURES = ["Capital", "Port", "Walled", "Citadel", "Temple", "Market", "Shantytown"] as const

export default function WorldMapPage() {
  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId) as CampaignId | null
  const role = useQuery(
    api.campaignMembers.getMyRole,
    activeCampaignId ? { campaignId: activeCampaignId } : "skip",
  )
  const me = useQuery(api.users.getMe)
  const map = useQuery(
    api.worldMap.getMap,
    activeCampaignId ? { campaignId: activeCampaignId } : "skip",
  )
  const locations = useQuery(
    api.worldMap.listLocations,
    activeCampaignId ? { campaignId: activeCampaignId } : "skip",
  )

  const isDM = role === "dm"
  const canCreateMaps = me?.role === "admin" || me?.isPremium === true
  // "Change map" drops back to the chooser screen (same UI as first-time setup)
  // rather than opening a modal.
  const [choosing, setChoosing] = useState(false)

  if (!activeCampaignId) {
    return (
      <AppShell>
        <CenteredCard
          icon={Globe}
          title="No campaign selected"
          body="Pick an active campaign from the dashboard or campaigns page to view its world map."
        />
      </AppShell>
    )
  }

  // Loading
  if (role === undefined || map === undefined) {
    return (
      <AppShell>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--scene-accent)" }} />
        </div>
      </AppShell>
    )
  }

  // No map yet, or the DM tapped "Change map" — show the chooser screen.
  if (!map || choosing) {
    return (
      <AppShell>
        <MapSetup
          campaignId={activeCampaignId}
          isDM={isDM}
          canCreateMaps={canCreateMaps}
          onDone={choosing ? () => setChoosing(false) : undefined}
          onCancel={choosing && map ? () => setChoosing(false) : undefined}
        />
      </AppShell>
    )
  }

  return (
    <AppShell>
      <MapWorkspace
        campaignId={activeCampaignId}
        map={map}
        locations={locations ?? []}
        isDM={isDM}
        canCreateMaps={canCreateMaps}
        onChangeMap={() => setChoosing(true)}
      />
    </AppShell>
  )
}

// Local-map ("drill-down") image picker for the location editor. Reuses the same
// premium-gated presign flow as MapUploader, but only resolves to an R2 key (no
// dimensions / no campaign-map write) — the parent stores it on the pin's draft.
// A revealed pin then shows this image in a lightbox (DM + players alike).
function DrillDownUploader({
  value,
  onChange,
}: {
  value: string
  onChange: (key: string) => void
}) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setUploading(true)
    try {
      const presign = await fetch("/api/world-map/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type }),
      })
      if (!presign.ok) {
        const { error } = await presign.json().catch(() => ({ error: "Upload failed" }))
        throw new Error(error)
      }
      const { uploadUrl, key } = await presign.json()
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      })
      if (!put.ok) throw new Error("Upload to storage failed.")
      onChange(key)
      toast.success("Local map attached.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div>
      <p className="mb-1.5 text-[10px] uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
        Local map
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
      {value ? (
        <div className="flex items-center gap-3 rounded-md p-2" style={fieldStyle}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={toImageUrl(value)}
            alt="Local map preview"
            className="h-12 w-12 shrink-0 rounded object-cover"
            style={{ border: "1px solid var(--scene-border)" }}
          />
          <span className="flex-1 truncate text-xs" style={{ color: "var(--scene-text-muted)" }}>
            City / dungeon map attached
          </span>
          <button
            onClick={() => onChange("")}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs hover:opacity-80"
            style={{ color: "#dc2626" }}
            type="button"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed p-3 text-xs font-medium transition-colors hover:opacity-90 disabled:opacity-60"
          style={{ borderColor: "var(--scene-border)", color: "var(--scene-text-primary)" }}
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <ImageIcon className="h-4 w-4" style={{ color: "var(--scene-accent)" }} />
              Attach a local map (city / dungeon image)
            </>
          )}
        </button>
      )}
      <p className="mt-1 text-[11px]" style={{ color: "var(--scene-text-muted)" }}>
        Players see it in a lightbox once revealed. Use this for dungeons/POIs, or to override a settlement&apos;s auto city map with your own image.
      </p>
    </div>
  )
}

// ── Workspace (campaign has a map) ────────────────────────────────────────────

function MapWorkspace({
  campaignId,
  map,
  locations,
  isDM,
  canCreateMaps,
  onChangeMap,
}: {
  campaignId: CampaignId
  map: WorldMap
  locations: MapLocation[]
  isDM: boolean
  canCreateMaps: boolean
  onChangeMap: () => void
}) {
  const createLocation = useMutation(api.worldMap.createLocation)
  const updateLocation = useMutation(api.worldMap.updateLocation)
  const removeLocation = useMutation(api.worldMap.removeLocation)
  const setRevealed = useMutation(api.worldMap.setRevealed)
  const setFogSettings = useMutation(api.worldMap.setFogSettings)
  const paintFog = useMutation(api.worldMap.paintFog)

  // Fog of war. The map row carries fogEnabled + fogRevealRadius; the DM can also
  // toggle a client-only "preview" to see the player's fogged view over their own
  // map (DM otherwise always sees the full map).
  const [fogPreview, setFogPreview] = useState(false)
  const fogRadius = map.fogRevealRadius ?? DEFAULT_FOG_RADIUS
  // Players (non-DM) hold only revealed pins; the DM preview must mimic that.
  const fogPins = useMemo(
    () => locations.filter((l) => l.revealed).map((l) => ({ x: l.x, y: l.y })),
    [locations],
  )

  // ── Manual fog brush (Phase 2) ─────────────────────────────────────────────
  // The painted-open mask is a 64×36 boolean grid. We keep a local optimistic
  // copy (maskCells) and debounce-flush it to paintFog; the server value reaches
  // every member via getMap. latestCellsRef holds the freshest array so a fast
  // drag chains dabs synchronously (before React re-renders) and the flush reads
  // the latest. pendingRef + paintMode gate the resync so an in-flight server
  // echo can't clobber a stroke mid-paint.
  const [paintMode, setPaintMode] = useState<"off" | "paint" | "erase">("off")
  const [brushSize, setBrushSize] = useState(2)
  const [maskCells, setMaskCells] = useState<boolean[]>(() => decodeFogMask(map.fogMask))
  const latestCellsRef = useRef<boolean[]>(maskCells)
  const pendingRef = useRef(false)
  const paintingRef = useRef(false)
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const painting = paintMode !== "off" && isDM

  // Keep the chaining ref in sync with whatever's current (paint or server).
  useEffect(() => {
    latestCellsRef.current = maskCells
  }, [maskCells])

  // Resync from the server only when we hold no unsaved edits AND aren't mid
  // paint-session — otherwise a stale echo would drop dabs / flicker.
  useEffect(() => {
    if (pendingRef.current || paintMode !== "off") return
    setMaskCells(decodeFogMask(map.fogMask))
  }, [map.fogMask, paintMode])

  // Flush the latest mask to the server (empty mask → "" clears the field).
  const flushFog = () => {
    if (flushTimer.current) {
      clearTimeout(flushTimer.current)
      flushTimer.current = null
    }
    const cells = latestCellsRef.current
    paintFog({ campaignId, fogMask: isMaskEmpty(cells) ? "" : encodeFogMask(cells) })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Couldn't save fog."))
      .finally(() => {
        pendingRef.current = false
      })
  }
  const scheduleFlush = () => {
    if (flushTimer.current) clearTimeout(flushTimer.current)
    flushTimer.current = setTimeout(flushFog, 400)
  }
  useEffect(
    () => () => {
      if (flushTimer.current) clearTimeout(flushTimer.current)
    },
    [],
  )

  // Stamp the brush at a screen point (paint = open, erase = re-fog).
  const applyBrushAt = (clientX: number, clientY: number) => {
    const coords = screenToPercent(clientX, clientY)
    if (!coords) return
    const next = paintBrush(
      latestCellsRef.current,
      coords.x,
      coords.y,
      brushSize,
      paintMode === "paint",
    )
    latestCellsRef.current = next
    setMaskCells(next)
    pendingRef.current = true
    scheduleFlush()
  }

  const startPaint = () => {
    setPlacing(false)
    setMovingId(null)
    setPaintMode("paint")
  }
  const stopPaint = () => {
    setPaintMode("off")
    if (pendingRef.current) flushFog()
  }
  const clearPaint = () => {
    const empty = emptyMask()
    latestCellsRef.current = empty
    setMaskCells(empty)
    pendingRef.current = true
    flushFog()
  }

  // Show fog to players whenever the DM enabled it; show it to the DM in preview
  // OR while painting (so the brush strokes are visible as they clear the shroud).
  const showFog = (map.fogEnabled ?? false) && (!isDM || fogPreview || painting)

  // View transform
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const imgRef = useRef<HTMLImageElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{ sx: number; sy: number; px: number; py: number; moved: boolean } | null>(null)

  // Interaction
  const [selectedId, setSelectedId] = useState<LocationId | null>(null)
  const [showRoutes, setShowRoutes] = useState(false)
  // View-only declutter: hide every pin so the bare map can be shown to players.
  const [showPins, setShowPins] = useState(true)
  // Pin-type filter (empty = show all) + the filter/locator drawer.
  const [filterKeys, setFilterKeys] = useState<Set<string>>(new Set())
  const [pinsPanelOpen, setPinsPanelOpen] = useState(false)
  // Current width of the detail overlay, mirrored as the --panel-w CSS var so the
  // map's right-edge zoom controls slide left of the panel instead of hiding under it.
  const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT)
  const [journeyFrom, setJourneyFrom] = useState<LocationId | null>(null)
  const [journeyTo, setJourneyTo] = useState<LocationId | null>(null)
  const [travelMode, setTravelMode] = useState<TravelMode>("foot")
  const [placing, setPlacing] = useState(false)
  const [movingId, setMovingId] = useState<LocationId | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<"new" | "edit">("new")
  const [draft, setDraft] = useState<LocationDraft>(emptyDraft())
  const [pendingCoords, setPendingCoords] = useState<{ x: number; y: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)

  // Today's AI quota (premium 50 / free 3) for the "✨ Generate details" button.
  const aiUsage = useQuery(api.aiUsage.getUsage)
  // Travel routes (roads/trails/searoutes) — lazy, only fetched when toggled on.
  const routes = useQuery(api.worldMap.getRoutes, showRoutes ? { campaignId } : "skip")
  const [wbOpen, setWbOpen] = useState(false)
  const worldbuilding = useQuery(api.worldMap.getWorldbuilding, wbOpen ? { campaignId } : "skip")
  // Separate land + sea graphs; the journey routes over one depending on mode.
  const landGraph = useMemo(
    () => (routes ? buildRouteGraph(routes, map.width, map.height, "land") : null),
    [routes, map.width, map.height],
  )
  const waterGraph = useMemo(
    () => (routes ? buildRouteGraph(routes, map.width, map.height, "water") : null),
    [routes, map.width, map.height],
  )
  const hasWater = useMemo(() => (routes ?? []).some((r) => r.group === "searoutes"), [routes])
  const journey = useMemo(() => {
    if (!journeyFrom || !journeyTo) return null
    const f = locations.find((l) => l._id === journeyFrom)
    const t = locations.find((l) => l._id === journeyTo)
    if (!f || !t) return null
    // Ship travel embarks only from ports — this is the guard. A non-port (or a pin
    // with no gazetteer at all) would otherwise snap to a distant sea node and report
    // a confident, wrong distance. Block it with a clear reason instead; an explicit
    // Port tag (Azgaar-imported OR set in the editor) is then trusted to connect to
    // the nearest sea lane however far offshore it sits.
    if (travelMode === "ship") {
      if (!f.town?.features?.includes("Port")) return { found: false, miles: null, points: null, seaBlockedBy: f.name }
      if (!t.town?.features?.includes("Port")) return { found: false, miles: null, points: null, seaBlockedBy: t.name }
    }
    const graph = travelMode === "ship" ? waterGraph : landGraph
    if (!graph) return null
    const res = planRoute(graph, [f.x, f.y], [t.x, t.y])
    const miles = res && map.scaleMilesPerPx ? Math.round(res.px * map.scaleMilesPerPx) : null
    return { found: !!res, miles, points: res?.points ?? null, seaBlockedBy: null as string | null }
  }, [landGraph, waterGraph, travelMode, journeyFrom, journeyTo, locations, map.scaleMilesPerPx])

  // AI: flesh out the pin's player + DM notes into the draft for review (never
  // saved silently). Confirms before clobbering notes the DM already wrote.
  const handleGenerateLocation = async () => {
    if (!draft.name.trim()) {
      toast.error("Name the location first, then generate.")
      return
    }
    if (
      (draft.playerNotes.trim() || draft.dmNotes.trim()) &&
      !confirm("Replace the current notes with AI-generated ones?")
    ) {
      return
    }
    setGenerating(true)
    try {
      // Map-aware context: the pin's neighborhood so the AI grounds the place in
      // its surroundings. Self coords come from the pending click (new pin) or the
      // pin being edited; exclude the pin itself from its own neighbor list.
      const selfLoc = selectedId ? locations.find((l) => l._id === selectedId) : null
      const selfCoords =
        editorMode === "edit"
          ? selfLoc
            ? { x: selfLoc.x, y: selfLoc.y }
            : null
          : pendingCoords
      const surroundings = selfCoords
        ? computeSurroundings(
            selfCoords,
            editorMode === "edit" && selectedId
              ? locations.filter((l) => l._id !== selectedId)
              : locations,
            map,
          )
        : undefined

      const result = await postAi<{ playerNotes: string; dmNotes: string; remaining: number }>(
        "/api/world-map/generate-location",
        { name: draft.name.trim(), type: draft.type, mapName: map.name, surroundings },
      )
      setDraft((d) => ({ ...d, playerNotes: result.playerNotes, dmNotes: result.dmNotes }))
      toast.success(`Details generated — ${result.remaining} left today.`)
    } catch (err) {
      toast.error(err instanceof AiError ? err.message : "Couldn't generate details.")
    } finally {
      setGenerating(false)
    }
  }

  const selected = useMemo(
    () => (selectedId ? locations.find((l) => l._id === selectedId) ?? null : null),
    [locations, selectedId],
  )

  // AI encounter generator — only on combat-capable POI pins, DM-only. Its
  // surroundings are the selected pin's neighborhood (itself excluded).
  const selectedSurroundings = useMemo(
    () =>
      selected
        ? computeSurroundings({ x: selected.x, y: selected.y }, locations.filter((l) => l._id !== selected._id), map)
        : undefined,
    [selected, locations, map],
  )
  const encounterAction =
    selected && isDM && selected.poiKind && COMBAT_POI_KINDS.has(selected.poiKind) ? (
      <EncounterGenerator loc={selected} campaignId={campaignId} mapName={map.name} surroundings={selectedSurroundings} />
    ) : undefined
  const npcAction =
    selected && isDM && selected.poiKind === "npc" ? <SaveNpcButton locationId={selected._id} /> : undefined
  // Tavern/landmark pins → "Flesh out NPC" (AI). A pin has one poiKind, so at most
  // one of these three actions is ever non-undefined.
  const npcGenAction =
    selected && isDM && selected.poiKind && NPC_GEN_POI_KINDS.has(selected.poiKind) ? (
      <NpcGenerator loc={selected} campaignId={campaignId} mapName={map.name} />
    ) : undefined

  // World events affecting the selected settlement — the inverse of the Events panel
  // (town → its events, vs. event → its towns). Reverse-match by name + near-exact
  // coords: the same key the panel uses to bind a place to a pin (guards Azgaar's
  // duplicate burg names). DM-only — worldEvents is undefined for players (server-
  // stripped). Only the top-6 affected towns per event are stored, so a minor town
  // caught in a sprawling event may not list it; the prominent ones do.
  const affectingEvents = useMemo(() => {
    if (!selected || selected.type !== "settlement" || !map.worldEvents) return []
    return map.worldEvents.filter((e) =>
      (e.places ?? []).some(
        (p) => p.name === selected.name && Math.abs(p.x - selected.x) < 0.5 && Math.abs(p.y - selected.y) < 0.5,
      ),
    )
  }, [selected, map.worldEvents])
  const eventsSlot =
    isDM && affectingEvents.length > 0 ? <SettlementEventsBlock events={affectingEvents} /> : undefined

  // Pin-type filter drives ONLY the marker render below — fog, routing, journey,
  // and jump-to-center all stay on the full `locations`.
  const visibleLocations = useMemo(() => filterByKeys(locations, filterKeys), [locations, filterKeys])
  const toggleFilterKey = (key: string) =>
    setFilterKeys((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  // If the filter hides the selected pin, drop the selection so no stale detail lingers.
  useEffect(() => {
    if (selectedId && filterKeys.size > 0 && !visibleLocations.some((l) => l._id === selectedId)) {
      setSelectedId(null)
    }
  }, [filterKeys, visibleLocations, selectedId])

  const clampZoom = (z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z))

  // Whenever zoom changes (wheel, buttons, reset, centering), pull pan back into
  // bounds — zooming out should reclaim empty edge space rather than stranding the
  // map off-center. Drag-time clamping is handled inline in handlePointerMove.
  useEffect(() => {
    setPan((p) => clampPanToViewport(p, zoom, imgRef.current, viewportRef.current))
  }, [zoom])

  // Click → map-relative percent. Measured against the IMAGE element, which is
  // the exact box pins are positioned within (left/top %), so placement is exact
  // at any zoom/pan and aspect ratio.
  const screenToPercent = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const img = imgRef.current
    if (!img) return null
    const rect = img.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null
    const x = ((clientX - rect.left) / rect.width) * 100
    const y = ((clientY - rect.top) / rect.height) * 100
    if (x < 0 || x > 100 || y < 0 || y > 100) return null
    return { x, y }
  }

  const handleWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    const nz = clampZoom(zoom * (1 + -e.deltaY * 0.0015))
    // Anchor the zoom to the cursor (not the map center) so the spot under the
    // pointer stays put. Pre-clamped to the viewport; both set as absolute values.
    if (nz !== zoom) setPan(panToAnchorZoom(e, zoom, nz, pan, imgRef.current, viewportRef.current))
    setZoom(nz)
  }

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (painting) {
      // Start a paint stroke — capture so a drag off the image still tracks.
      paintingRef.current = true
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
      applyBrushAt(e.clientX, e.clientY)
      return
    }
    if ((placing || movingId) && isDM) return // placement click, not a pan
    dragState.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y, moved: false }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (paintingRef.current) {
      applyBrushAt(e.clientX, e.clientY)
      return
    }
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

  const handleViewportClick = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragState.current?.moved) return // was a pan
    if (!isDM) return

    if (movingId) {
      const coords = screenToPercent(e.clientX, e.clientY)
      if (!coords) return
      const id = movingId
      setMovingId(null)
      updateLocation({ locationId: id, x: coords.x, y: coords.y })
        .then(() => toast.success("Location moved."))
        .catch((err) => toast.error(err instanceof Error ? err.message : "Couldn't move it."))
      return
    }

    if (!placing) return
    const coords = screenToPercent(e.clientX, e.clientY)
    if (!coords) return
    setPendingCoords(coords)
    setDraft(emptyDraft())
    setEditorMode("new")
    setEditorOpen(true)
    setPlacing(false)
  }

  const startEdit = (loc: MapLocation) => {
    setDraft({
      name: loc.name,
      type: (loc.type as LocationType) ?? "settlement",
      playerNotes: loc.playerNotes ?? "",
      dmNotes: loc.dmNotes ?? "",
      drillDownImageKey: loc.drillDownImageKey ?? "",
      features: loc.town?.features ?? [],
    })
    setSelectedId(loc._id)
    setEditorMode("edit")
    setPendingCoords(null)
    setEditorOpen(true)
  }

  const handleSave = async () => {
    if (!draft.name.trim()) return
    setSaving(true)
    try {
      // Settlement amenity chips → town.features. Only settlements carry a town
      // block; for other pin types we never write one.
      const features = draft.type === "settlement" ? draft.features : []
      if (editorMode === "new" && pendingCoords) {
        const id = await createLocation({
          campaignId,
          worldMapId: map._id,
          type: draft.type,
          name: draft.name.trim(),
          x: pendingCoords.x,
          y: pendingCoords.y,
          dmNotes: draft.dmNotes.trim() || undefined,
          playerNotes: draft.playerNotes.trim() || undefined,
          drillDownImageKey: draft.drillDownImageKey || undefined,
          town: features.length ? { features } : undefined,
        })
        setSelectedId(id)
        toast.success("Location placed.")
      } else if (editorMode === "edit" && selectedId) {
        // Merge: preserve imported gazetteer fields (population, crest, realm…) and
        // replace only the features. Drop features entirely when none are set.
        const existingTown = selected?.town
        const town =
          existingTown || features.length
            ? { ...(existingTown ?? {}), features: features.length ? features : undefined }
            : undefined
        await updateLocation({
          locationId: selectedId,
          type: draft.type,
          name: draft.name.trim(),
          dmNotes: draft.dmNotes.trim() || undefined,
          playerNotes: draft.playerNotes.trim() || undefined,
          // Always send (possibly "") so removing a local map clears it.
          drillDownImageKey: draft.drillDownImageKey,
          town,
        })
        toast.success("Location updated.")
      }
      setEditorOpen(false)
      setPendingCoords(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (loc: MapLocation) => {
    if (!confirm(`Delete "${loc.name}"? This can't be undone.`)) return
    try {
      await removeLocation({ locationId: loc._id })
      if (selectedId === loc._id) setSelectedId(null)
      toast.success("Location deleted.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete.")
    }
  }

  const handleReveal = async (loc: MapLocation) => {
    try {
      await setRevealed({ locationId: loc._id, revealed: !loc.revealed })
      toast.success(loc.revealed ? "Hidden from players." : "Revealed to players.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update visibility.")
    }
  }

  const handleToggleFog = async () => {
    const next = !(map.fogEnabled ?? false)
    try {
      await setFogSettings({ campaignId, fogEnabled: next })
      toast.success(next ? "Fog of war on — players see only explored areas." : "Fog of war off.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update fog.")
    }
  }

  const handleFogRadius = (radius: number) => {
    setFogSettings({ campaignId, fogRevealRadius: radius }).catch((err) =>
      toast.error(err instanceof Error ? err.message : "Couldn't update fog radius."),
    )
  }

  const cancelMode = () => {
    setPlacing(false)
    setMovingId(null)
  }

  // Center the view on a map coord (% of the rendered image). After scaling about
  // the layer's center, a point d px from center sits d*zoom from center, so
  // pan=-d*zoom brings it to the middle. No-op if the image isn't ready yet.
  const centerOn = (x: number, y: number) => {
    const img = imgRef.current
    if (!img) return
    const z = clampZoom(Math.max(zoom, 1.8))
    const dx = ((x - 50) / 100) * img.offsetWidth
    const dy = ((y - 50) / 100) * img.offsetHeight
    setZoom(z)
    setPan(clampPanToViewport({ x: -dx * z, y: -dy * z }, z, imgRef.current, viewportRef.current))
  }
  // World Events panel: jump to an already-pinned town (select + center).
  const jumpToLocation = (loc: MapLocation) => {
    setSelectedId(loc._id)
    centerOn(loc.x, loc.y)
  }
  // World Events panel: "+ add" an affected town that isn't on the map yet. Mints a
  // full settlement pin from the event's stored payload (it exists nowhere else),
  // then selects + centers it. If a matching pin already exists (name + near-exact
  // coords — guards Azgaar's duplicate burg names), just jump there instead.
  const addEventTown = async (place: EventPlace) => {
    if (!map) return
    const existing = locations.find(
      (l) =>
        l.type === "settlement" &&
        l.name === place.name &&
        Math.abs(l.x - place.x) < 0.5 &&
        Math.abs(l.y - place.y) < 0.5,
    )
    if (existing) {
      jumpToLocation(existing)
      return
    }
    try {
      const id = await createLocation({
        campaignId,
        worldMapId: map._id,
        type: "settlement",
        name: place.name,
        x: place.x,
        y: place.y,
        drillDownUrl: place.drillDownUrl,
        town: place.town,
      })
      setSelectedId(id)
      centerOn(place.x, place.y)
      toast.success(
        locations.length >= PIN_SOFT_CAP
          ? `Added ${place.name} — heads up, you're past ${PIN_SOFT_CAP} pins, so the map may slow.`
          : `Added ${place.name} to the map.`,
      )
    } catch {
      toast.error("Couldn't add that town to the map.")
    }
  }

  const activeMode = (placing || movingId !== null || painting) && isDM

  // Journey mode (Travel toggle): first town tap = origin, second = destination.
  // Turning it on exits the authoring modes so a town tap plans a route, not a pin.
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
    setPlacing(false)
    setMovingId(null)
    setPaintMode("off")
    setShowPins(true) // journey planning needs tappable town pins
    setFilterKeys(new Set()) // …and all towns visible, not a filtered subset
  }
  const togglePins = () => {
    const next = !showPins
    setShowPins(next)
    if (!next) {
      // Hiding pins is a "show players the clean map" view — drop selection and
      // any authoring mode so nothing's left mid-action behind the hidden pins.
      setSelectedId(null)
      setPlacing(false)
      setMovingId(null)
      setPaintMode("off")
    }
  }

  return (
    <div className="flex h-[100dvh] flex-col lg:h-screen">
      {/* Header */}
      <div
        className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6"
        style={{ borderColor: "var(--scene-border)" }}
      >
        <div className="min-w-0">
          <h1
            className="flex items-center gap-2 text-lg font-bold sm:text-xl"
            style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
          >
            <Globe className="h-5 w-5 shrink-0" style={{ color: "var(--scene-accent)" }} />
            <span className="truncate">{map.name}</span>
          </h1>
          <p className="truncate text-xs" style={{ color: "var(--scene-text-muted)" }}>
            {isDM
              ? `${locations.length} location${locations.length === 1 ? "" : "s"} · reveal them to your players`
              : "Locations your DM has revealed"}
          </p>
        </div>
        {isDM && (
          <div className="flex shrink-0 items-center gap-2">
            <ToolbarButton
              onClick={() => {
                setPaintMode("off")
                setPlacing((p) => !p)
              }}
              active={placing}
              title="Add a location"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{placing ? "Placing…" : "Add"}</span>
            </ToolbarButton>
            <FogControl
              fogEnabled={map.fogEnabled ?? false}
              fogRadius={fogRadius}
              previewing={fogPreview}
              painting={painting}
              onToggleFog={handleToggleFog}
              onRadius={handleFogRadius}
              onTogglePreview={() => setFogPreview((p) => !p)}
              onStartPaint={startPaint}
            />
            <ToolbarButton
              onClick={togglePins}
              active={!showPins}
              title={
                showPins
                  ? "Hide all pins from this view (just declutters your screen — doesn't change what players see)"
                  : "Show all pins"
              }
            >
              {showPins ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              <span className="hidden sm:inline">Pins</span>
            </ToolbarButton>
            <ToolbarButton
              onClick={() => setPinsPanelOpen(true)}
              active={pinsPanelOpen || filterKeys.size > 0}
              title="Filter pins by type & jump to a location"
            >
              <ListFilter className="h-4 w-4" />
              <span className="hidden sm:inline">List</span>
            </ToolbarButton>
            {(map.worldEvents?.length ?? 0) > 0 && (
              <WorldEventsControl
                events={map.worldEvents!}
                locations={locations}
                onJumpTo={jumpToLocation}
                onAddTown={addEventTown}
              />
            )}
            <ToolbarButton
              onClick={toggleRoutes}
              active={showRoutes}
              title="Plan a journey — show the road network and tap two towns"
            >
              <RouteIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Travel</span>
            </ToolbarButton>
            <ToolbarButton onClick={() => setWbOpen(true)} title="Realms & Faiths — the world's kingdoms and religions">
              <Crown className="h-4 w-4" />
              <span className="hidden sm:inline">Realms</span>
            </ToolbarButton>
            <ToolbarButton onClick={onChangeMap} title="Switch to a different map">
              <ImageIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Change map</span>
            </ToolbarButton>
          </div>
        )}
      </div>

      <div
        className="relative flex min-h-0 flex-1"
        style={{ "--panel-w": selected ? `${panelWidth}px` : "0px" } as React.CSSProperties}
      >
        {/* Viewport */}
        <div className="relative min-h-0 flex-1 overflow-hidden" style={{ background: "var(--scene-bg)" }}>
          <div
            ref={viewportRef}
            className={cn(
              "absolute inset-0 flex touch-none select-none items-center justify-center",
              activeMode ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing",
            )}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={(e) => {
              if (paintingRef.current) {
                paintingRef.current = false
                if (pendingRef.current) flushFog()
                return
              }
              handleViewportClick(e)
              endPointer()
            }}
            onPointerLeave={endPointer}
          >
            {/* Transform layer shrink-wraps the image so pin %s and click %s
                resolve against the same box. */}
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
                className="block max-h-[calc(100dvh-7rem)] max-w-full lg:max-h-[calc(100vh-7rem)]"
              />
              {/* Fog of war: shroud over the map with soft clearings around
                  revealed pins. Above the image, below the pins, same box. */}
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

          {/* Zoom controls — slide left of the detail overlay when a pin is open. */}
          <div className="absolute bottom-4 right-4 flex flex-col gap-1 lg:right-[calc(var(--panel-w)_+_1rem)]">
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

          {showRoutes && routes && routes.length > 0 && (
            <div className="absolute left-4 top-4 z-10 max-w-[calc(100%-2rem)]">
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
                mode={travelMode}
                onModeChange={setTravelMode}
                hasWater={hasWater}
                seaBlockedBy={journey?.seaBlockedBy ?? null}
                onClear={() => { setJourneyFrom(null); setJourneyTo(null) }}
              />
            </div>
          )}

          {(placing || movingId !== null) && isDM && (
            <div
              className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-3 rounded-full px-4 py-1.5 text-xs font-medium shadow-lg"
              style={{ background: "var(--scene-accent)", color: "#fff" }}
            >
              {movingId ? "Click the new spot for this location" : "Click the map to place a location"}
              <button onClick={cancelMode} className="rounded-full p-0.5 hover:bg-white/20" aria-label="Cancel">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {painting && (
            <PaintBar
              mode={paintMode === "erase" ? "erase" : "paint"}
              brushSize={brushSize}
              onMode={setPaintMode}
              onBrushSize={setBrushSize}
              onClear={clearPaint}
              onDone={stopPaint}
            />
          )}
        </div>

        {/* Detail sidebar (desktop) — drag its left edge to resize. */}
        {selected && (
          <ResizableDetailAside onWidthChange={setPanelWidth}>
            <LocationDetail
              loc={selected}
              isDM={isDM}
              onClose={() => setSelectedId(null)}
              onEdit={() => startEdit(selected)}
              onMove={() => { setMovingId(selected._id); setSelectedId(null) }}
              onDelete={() => handleDelete(selected)}
              onReveal={() => handleReveal(selected)}
              extraActions={encounterAction ?? npcAction ?? npcGenAction}
              eventsSlot={eventsSlot}
            />
          </ResizableDetailAside>
        )}
      </div>

      {/* Detail sheet (mobile) */}
      {selected && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 max-h-[60vh] overflow-y-auto rounded-t-2xl border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl lg:hidden"
          style={{ borderColor: "var(--scene-border)", background: "var(--scene-surface)" }}
        >
          <LocationDetail
            loc={selected}
            isDM={isDM}
            onClose={() => setSelectedId(null)}
            onEdit={() => startEdit(selected)}
            onMove={() => { setMovingId(selected._id); setSelectedId(null) }}
            onDelete={() => handleDelete(selected)}
            onReveal={() => handleReveal(selected)}
            extraActions={encounterAction ?? npcAction}
            eventsSlot={eventsSlot}
          />
        </div>
      )}

      {/* Editor modal */}
      {editorOpen && isDM && (
        <Modal onClose={() => { setEditorOpen(false); setPendingCoords(null) }}>
          <h2
            className="mb-4 text-lg font-bold"
            style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
          >
            {editorMode === "new" ? "New Location" : "Edit Location"}
          </h2>
          <div className="space-y-3">
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Location name…"
              autoFocus
              className="w-full rounded-md px-3 py-2 text-sm outline-none"
              style={fieldStyle}
            />
            <select
              value={draft.type}
              onChange={(e) => setDraft({ ...draft, type: e.target.value as LocationType })}
              className="w-full cursor-pointer rounded-md px-3 py-2 text-sm outline-none"
              style={fieldStyle}
            >
              {LOCATION_TYPES.map((t) => (
                <option key={t} value={t}>{TYPE_META[t].label}</option>
              ))}
            </select>

            {/* Settlement amenity chips. "Port" is functional — it makes the town a
                valid endpoint for sea travel in the journey planner. */}
            {draft.type === "settlement" && (
              <div>
                <p className="mb-1.5 text-xs font-medium" style={{ color: "var(--scene-text-muted)" }}>
                  Settlement features
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SETTLEMENT_FEATURES.map((feat) => {
                    const on = draft.features.includes(feat)
                    return (
                      <button
                        key={feat}
                        type="button"
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            features: on ? d.features.filter((x) => x !== feat) : [...d.features, feat],
                          }))
                        }
                        className="rounded-md px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-90"
                        style={{
                          background: on
                            ? "var(--scene-accent)"
                            : "color-mix(in srgb, var(--scene-text-primary) 7%, transparent)",
                          color: on ? "#fff" : "var(--scene-text-primary)",
                          border: `1px solid ${on ? "var(--scene-accent)" : "var(--scene-border)"}`,
                        }}
                      >
                        {feat}
                      </button>
                    )
                  })}
                </div>
                <p className="mt-1 text-[11px]" style={{ color: "var(--scene-text-muted)" }}>
                  <span style={{ color: "var(--scene-text-primary)" }}>Port</span> lets this town embark or land sea travel.
                </p>
              </div>
            )}

            {/* AI fill (premium 50/day · free 3/day). Fills the notes below for
                review — never saved without the DM hitting Save. */}
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={handleGenerateLocation}
                disabled={generating || !draft.name.trim() || aiUsage?.remaining === 0}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{
                  background: "color-mix(in srgb, var(--scene-accent) 16%, transparent)",
                  color: "var(--scene-accent)",
                  border: "1px solid color-mix(in srgb, var(--scene-accent) 38%, transparent)",
                }}
                title={
                  aiUsage?.remaining === 0
                    ? "Daily AI limit reached"
                    : "Generate player + DM notes with AI"
                }
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {generating ? "Generating…" : "Generate details"}
              </button>
              {aiUsage && (
                <span className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
                  {aiUsage.remaining}/{aiUsage.cap} AI today
                </span>
              )}
            </div>

            <textarea
              value={draft.playerNotes}
              onChange={(e) => setDraft({ ...draft, playerNotes: e.target.value })}
              placeholder="Player description (shown once revealed)…"
              rows={3}
              className="w-full resize-y rounded-md px-3 py-2 text-sm outline-none"
              style={fieldStyle}
            />
            <textarea
              value={draft.dmNotes}
              onChange={(e) => setDraft({ ...draft, dmNotes: e.target.value })}
              placeholder="DM notes (never shown to players)…"
              rows={2}
              className="w-full resize-y rounded-md px-3 py-2 text-sm outline-none"
              style={fieldStyle}
            />
            <p className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
              Markdown supported — **bold**, *italic*, - lists, [links](url).
            </p>

            {/* Drill-down: a local map image (e.g. a Watabou city/dungeon) revealed
                in a lightbox when this pin is opened. Authoring is premium/admin;
                viewing works for everyone (incl. free DMs adopting curated presets). */}
            {canCreateMaps && (
              <DrillDownUploader
                value={draft.drillDownImageKey}
                onChange={(key) => setDraft((d) => ({ ...d, drillDownImageKey: key }))}
              />
            )}

            <div className="flex items-center gap-2 pt-1">
              <PrimaryButton onClick={handleSave} disabled={saving || !draft.name.trim()}>
                <Save className="h-4 w-4" />
                {saving ? "Saving…" : "Save"}
              </PrimaryButton>
              <SecondaryButton onClick={() => { setEditorOpen(false); setPendingCoords(null) }}>
                <X className="h-4 w-4" />
                Cancel
              </SecondaryButton>
            </div>
          </div>
        </Modal>
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

// Fog-of-war control: a toolbar button that opens a small popover with the
// on/off toggle, the clearing-radius slider, and a "preview player view" toggle
// so the DM can see exactly what their players see.
// Geographic-reach chip (Localized / Regional / Widespread), derived from an event's
// cell span. Shared by the Events panel and the per-settlement events block.
function ScopeBadge({ label }: { label: string }) {
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
      style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}
    >
      {label}
    </span>
  )
}

// "Active world events affecting this settlement" — rendered into LocationDetail's
// eventsSlot for the selected pin (DM-only). The inverse of WorldEventsControl: there
// you pick an event → its towns; here you click a town → the events bearing down on
// it. Reuses zoneMeta + the scope badge so the two surfaces never drift.
function SettlementEventsBlock({
  events,
}: {
  events: { name: string; type: string; cellCount?: number }[]
}) {
  if (events.length === 0) return null
  return (
    <div
      className="mt-3 rounded-md p-2.5"
      style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}
    >
      <p className="mb-1.5 text-[10px] uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
        Active world events
      </p>
      <ul className="space-y-1.5">
        {events.map((e, i) => {
          const m = zoneMeta(e.type)
          const Icon = m.icon
          const scope = eventScope(e.cellCount)
          return (
            <li key={`${e.name}-${i}`} className="flex items-start gap-2">
              <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: m.color }} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium" style={{ color: "var(--scene-text-primary)" }}>
                  {e.name}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="text-[11px]" style={{ color: "var(--scene-text-muted)" }}>
                    {e.type}
                  </span>
                  {scope && <ScopeBadge label={scope} />}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// DM-only popover listing the world's active events (Azgaar zones). Reference-only
// hooks for the DM to seed story — no per-event reveal yet (the natural future seam
// is reveal-per-event like pins). Mirrors FogControl's popover scaffolding.
function WorldEventsControl({
  events,
  locations,
  onJumpTo,
  onAddTown,
}: {
  events: { name: string; type: string; cellCount?: number; places?: EventPlace[] }[]
  locations: MapLocation[]
  onJumpTo: (loc: MapLocation) => void
  onAddTown: (place: EventPlace) => void
}) {
  const [open, setOpen] = useState(false)
  // Match an affected town to an existing pin by name AND near-exact coords (the
  // same burg ⇒ identical coords; this guards Azgaar's duplicate burg names). A
  // match ⇒ jump-link; no match ⇒ a "+" chip that mints the pin from the payload.
  const settlementPins = useMemo(() => locations.filter((l) => l.type === "settlement"), [locations])
  const findPin = (place: EventPlace) =>
    settlementPins.find(
      (l) => l.name === place.name && Math.abs(l.x - place.x) < 0.5 && Math.abs(l.y - place.y) < 0.5,
    )
  return (
    <div className="relative">
      <ToolbarButton onClick={() => setOpen((o) => !o)} active={open} title="Active world events">
        <Swords className="h-4 w-4" />
        <span className="hidden sm:inline">Events</span>
        <span
          className="ml-1 rounded-full px-1.5 text-[10px] font-bold leading-tight"
          style={{ background: "var(--scene-accent)", color: "#fff" }}
        >
          {events.length}
        </span>
      </ToolbarButton>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full z-50 mt-2 max-h-[60vh] w-72 overflow-y-auto rounded-xl p-4 shadow-2xl"
            style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
          >
            <span
              className="text-sm font-bold"
              style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
            >
              Active World Events
            </span>
            <p className="mt-1 text-xs" style={{ color: "var(--scene-text-muted)" }}>
              Brewing conflicts, plagues, and disasters across this world — DM-only hooks to seed your story.
            </p>
            <ul className="mt-3 space-y-1.5">
              {events.map((e, i) => {
                const m = zoneMeta(e.type)
                const Icon = m.icon
                return (
                  <li key={`${e.name}-${i}`} className="flex items-start gap-2">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: m.color }} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium" style={{ color: "var(--scene-text-primary)" }}>
                        {e.name}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px]" style={{ color: "var(--scene-text-muted)" }}>
                          {e.type}
                        </span>
                        {eventScope(e.cellCount) && <ScopeBadge label={eventScope(e.cellCount)!} />}
                      </div>
                      {e.places && e.places.length > 0 && (
                        <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px]">
                          <span style={{ color: "var(--scene-text-muted)" }}>Affecting:</span>
                          {e.places.map((place) => {
                            const pin = findPin(place)
                            return pin ? (
                              <button
                                key={place.name}
                                onClick={() => {
                                  onJumpTo(pin)
                                  setOpen(false)
                                }}
                                title={`Go to ${place.name}`}
                                className="rounded px-1.5 py-0.5 font-medium transition-opacity hover:opacity-80"
                                style={{
                                  background: "color-mix(in srgb, var(--scene-accent) 16%, transparent)",
                                  color: "var(--scene-accent)",
                                  border: "1px solid color-mix(in srgb, var(--scene-accent) 38%, transparent)",
                                }}
                              >
                                {place.name}
                              </button>
                            ) : (
                              <button
                                key={place.name}
                                onClick={() => {
                                  onAddTown(place)
                                  setOpen(false)
                                }}
                                title={`Add ${place.name} to the map`}
                                className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-medium transition-opacity hover:opacity-80"
                                style={{
                                  background: "var(--scene-bg)",
                                  color: "var(--scene-text-muted)",
                                  border: "1px dashed var(--scene-border)",
                                }}
                              >
                                {place.name}
                                <Plus className="h-3 w-3" />
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}

function FogControl({
  fogEnabled,
  fogRadius,
  previewing,
  painting,
  onToggleFog,
  onRadius,
  onTogglePreview,
  onStartPaint,
}: {
  fogEnabled: boolean
  fogRadius: number
  previewing: boolean
  painting: boolean
  onToggleFog: () => void
  onRadius: (radius: number) => void
  onTogglePreview: () => void
  onStartPaint: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <ToolbarButton onClick={() => setOpen((o) => !o)} active={fogEnabled || painting} title="Fog of war">
        <CloudFog className="h-4 w-4" />
        <span className="hidden sm:inline">Fog</span>
      </ToolbarButton>
      {open && (
        <>
          {/* Click-away backdrop. */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl p-4 shadow-2xl"
            style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className="text-sm font-bold"
                style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
              >
                Fog of War
              </span>
              <button
                onClick={onToggleFog}
                role="switch"
                aria-checked={fogEnabled}
                aria-label="Toggle fog of war"
                className="relative h-5 w-9 shrink-0 rounded-full transition-colors"
                style={{ background: fogEnabled ? "var(--scene-accent)" : "var(--scene-border)" }}
              >
                <span
                  className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform"
                  style={{ transform: fogEnabled ? "translateX(18px)" : "translateX(2px)" }}
                />
              </button>
            </div>
            <p className="mt-1 text-xs" style={{ color: "var(--scene-text-muted)" }}>
              Players see only explored areas. Revealing a pin clears the fog around it.
            </p>

            <div className={cn("mt-4 space-y-3", !fogEnabled && "pointer-events-none opacity-50")}>
              <label className="block">
                <span className="mb-1 flex items-center justify-between text-xs" style={{ color: "var(--scene-text-muted)" }}>
                  <span>Clearing size</span>
                  <span>{Math.round(fogRadius)}%</span>
                </span>
                <input
                  type="range"
                  min={FOG_MIN_RADIUS}
                  max={FOG_MAX_RADIUS}
                  step={1}
                  value={fogRadius}
                  disabled={!fogEnabled}
                  onChange={(e) => onRadius(Number(e.target.value))}
                  className="w-full cursor-pointer"
                  style={{ accentColor: "var(--scene-accent)" }}
                />
              </label>

              <button
                onClick={onTogglePreview}
                disabled={!fogEnabled}
                className="flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{
                  background: previewing ? "var(--scene-accent)" : "var(--scene-bg)",
                  color: previewing ? "#fff" : "var(--scene-text-primary)",
                  border: `1px solid ${previewing ? "var(--scene-accent)" : "var(--scene-border)"}`,
                }}
              >
                {previewing ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {previewing ? "Exit player preview" : "Preview player view"}
              </button>

              {/* Manual brush: clear (or re-fog) terrain with no pin on it. */}
              <button
                onClick={() => {
                  onStartPaint()
                  setOpen(false)
                }}
                disabled={!fogEnabled}
                className="flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{
                  background: painting ? "var(--scene-accent)" : "var(--scene-bg)",
                  color: painting ? "#fff" : "var(--scene-text-primary)",
                  border: `1px solid ${painting ? "var(--scene-accent)" : "var(--scene-border)"}`,
                }}
              >
                <Paintbrush className="h-3.5 w-3.5" />
                Paint fog
              </button>
              <p className="text-[11px] leading-snug" style={{ color: "var(--scene-text-muted)" }}>
                Brush open coastlines, roads, or wilderness the party has seen — no pin required.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Floating toolbar shown while the DM is painting fog: paint/erase, brush size,
// clear-all, and done. Pointer events on the map do the actual painting.
function PaintBar({
  mode,
  brushSize,
  onMode,
  onBrushSize,
  onClear,
  onDone,
}: {
  mode: "paint" | "erase"
  brushSize: number
  onMode: (m: "paint" | "erase") => void
  onBrushSize: (n: number) => void
  onClear: () => void
  onDone: () => void
}) {
  return (
    <div
      className="absolute left-1/2 top-4 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 flex-wrap items-center gap-2 rounded-xl px-3 py-2 shadow-2xl"
      style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
    >
      <div className="flex items-center gap-1">
        <PaintSegment active={mode === "paint"} onClick={() => onMode("paint")}>
          <Paintbrush className="h-3.5 w-3.5" />
          Clear
        </PaintSegment>
        <PaintSegment active={mode === "erase"} onClick={() => onMode("erase")}>
          <Eraser className="h-3.5 w-3.5" />
          Re-fog
        </PaintSegment>
      </div>

      <label className="flex items-center gap-1.5 px-1">
        <span className="text-[11px]" style={{ color: "var(--scene-text-muted)" }}>
          Brush
        </span>
        <input
          type="range"
          min={0}
          max={5}
          step={1}
          value={brushSize}
          onChange={(e) => onBrushSize(Number(e.target.value))}
          className="w-20 cursor-pointer"
          style={{ accentColor: "var(--scene-accent)" }}
          aria-label="Brush size"
        />
      </label>

      <button
        onClick={onClear}
        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-opacity hover:opacity-90"
        style={{ background: "var(--scene-bg)", color: "var(--scene-text-primary)", border: "1px solid var(--scene-border)" }}
        title="Re-fog the whole map (clear all painting)"
      >
        <Trash2 className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Clear all</span>
      </button>

      <button
        onClick={onDone}
        className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-90"
        style={{ background: "var(--scene-accent)", color: "#fff" }}
      >
        <Check className="h-3.5 w-3.5" />
        Done
      </button>
    </div>
  )
}

function PaintSegment({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors"
      style={{
        background: active ? "var(--scene-accent)" : "var(--scene-bg)",
        color: active ? "#fff" : "var(--scene-text-muted)",
        border: `1px solid ${active ? "var(--scene-accent)" : "var(--scene-border)"}`,
      }}
    >
      {children}
    </button>
  )
}

// ── Shared bits ────────────────────────────────────────────────────────────────

const fieldStyle = {
  background: "var(--scene-bg)",
  border: "1px solid var(--scene-border)",
  color: "var(--scene-text-primary)",
} as const

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-md rounded-xl p-5 shadow-2xl"
        style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
      >
        {children}
      </div>
    </div>
  )
}

function ToolbarButton({
  children, onClick, active, title,
}: { children: React.ReactNode; onClick: () => void; active?: boolean; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-opacity hover:opacity-90"
      style={{
        background: active ? "var(--scene-accent)" : "var(--scene-surface)",
        color: active ? "#fff" : "var(--scene-text-primary)",
        border: `1px solid ${active ? "var(--scene-accent)" : "var(--scene-border)"}`,
      }}
    >
      {children}
    </button>
  )
}

