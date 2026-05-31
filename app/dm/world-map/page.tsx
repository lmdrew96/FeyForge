"use client"

import {
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { AppShell } from "@/components/app-shell"
import { useCampaignStore } from "@/lib/campaign-store"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  Globe,
  Plus,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Save,
  X,
  Upload,
  ImageIcon,
  ZoomIn,
  ZoomOut,
  Maximize,
  MapPin as MapPinIcon,
  ExternalLink,
  Castle,
  Trees,
  Waves,
  Landmark,
  Skull,
  Loader2,
  Crown,
  Map as MapIcon,
} from "lucide-react"

type WorldMap = Doc<"worldMaps">
type MapLocation = Doc<"mapLocations">
type LocationId = Id<"mapLocations">
type CampaignId = Id<"campaigns">
type WorldMapId = Id<"worldMaps">

const R2_BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? ""
// imageStorageKey is an R2 key; tolerate a full URL too (defensive).
const toImageUrl = (key: string): string =>
  key.startsWith("http") ? key : `${R2_BASE}/${key}`

const LOCATION_TYPES = ["settlement", "poi", "natural", "water", "region"] as const
type LocationType = (typeof LOCATION_TYPES)[number]

const TYPE_META: Record<
  LocationType,
  { label: string; color: string; icon: typeof MapPinIcon }
> = {
  settlement: { label: "Settlement", color: "#dc2626", icon: Castle },
  poi: { label: "Point of Interest", color: "#7c3aed", icon: Skull },
  natural: { label: "Natural Feature", color: "#059669", icon: Trees },
  water: { label: "Body of Water", color: "#0891b2", icon: Waves },
  region: { label: "Region", color: "#ca8a04", icon: Landmark },
}

const MIN_ZOOM = 0.5
const MAX_ZOOM = 6

type LocationDraft = {
  name: string
  type: LocationType
  playerNotes: string
  dmNotes: string
}

const emptyDraft = (): LocationDraft => ({
  name: "",
  type: "settlement",
  playerNotes: "",
  dmNotes: "",
})

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
  const isAdmin = me?.role === "admin"

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

  // No map yet
  if (!map) {
    return (
      <AppShell>
        <MapSetup
          campaignId={activeCampaignId}
          isDM={isDM}
          canCreateMaps={canCreateMaps}
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
        isAdmin={isAdmin}
        canCreateMaps={canCreateMaps}
      />
    </AppShell>
  )
}

// ── Setup (no campaign map yet) ──────────────────────────────────────────────

function MapSetup({
  campaignId,
  isDM,
  canCreateMaps,
}: {
  campaignId: CampaignId
  isDM: boolean
  canCreateMaps: boolean
}) {
  if (!isDM) {
    return (
      <CenteredCard
        icon={Globe}
        title="No map yet"
        body="Your DM hasn't set up the world map for this campaign yet."
      />
    )
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <div className="mb-6">
        <h1
          className="flex items-center gap-2 text-2xl font-bold"
          style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
        >
          <Globe className="h-6 w-6" style={{ color: "var(--scene-accent)" }} />
          World Map
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--scene-text-muted)" }}>
          Choose a starter map, or upload your own to begin charting your world.
        </p>
      </div>
      <MapChooser campaignId={campaignId} canCreateMaps={canCreateMaps} />
    </div>
  )
}

// Pin-density tiers. `limit` is the max pins adoptPreset samples for the
// campaign; must mirror FREE_MAX_PINS in convex/worldMap.ts (free ≤ 40; the
// larger two are premium). Actual count is random-per-campaign, up to limit.
const DENSITY_TIERS: {
  key: string
  label: string
  sub: string
  limit: number
  premium: boolean
}[] = [
  { key: "handful", label: "A handful", sub: "up to ~10", limit: 10, premium: false },
  { key: "several", label: "Several", sub: "up to ~20", limit: 20, premium: false },
  { key: "many", label: "Many", sub: "up to ~40", limit: 40, premium: false },
  { key: "bunch", label: "A bunch", sub: "up to ~75", limit: 75, premium: true },
  { key: "mega", label: "Mega campaign", sub: "up to ~100", limit: 100, premium: true },
]

// Shared map chooser: upload (premium/admin) + the starter-preset grid. Used for
// first-time setup (empty state) AND the in-workspace "Change map" modal — both
// adoptPreset and setCampaignMap replace any existing campaign map (they clear it
// + its pins first), so the same UI serves "pick first" and "switch later".
// Picking a preset is a two-step: choose the map, then the pin density.
function MapChooser({
  campaignId,
  canCreateMaps,
  onDone,
}: {
  campaignId: CampaignId
  canCreateMaps: boolean
  onDone?: () => void
}) {
  const presets = useQuery(api.worldMap.listPresets, {})
  const adoptPreset = useMutation(api.worldMap.adoptPreset)
  const [adopting, setAdopting] = useState(false)
  // When set, we're on the density step for this preset.
  const [densityFor, setDensityFor] = useState<{ id: WorldMapId; name: string } | null>(null)

  const handleAdopt = async (presetId: WorldMapId, limit: number) => {
    setAdopting(true)
    try {
      await adoptPreset({ campaignId, presetId, limit })
      toast.success("Map added to your campaign.")
      setDensityFor(null)
      onDone?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't load that map.")
    } finally {
      setAdopting(false)
    }
  }

  // Step 2 — pin density for the chosen preset.
  if (densityFor) {
    return (
      <div>
        <button
          onClick={() => setDensityFor(null)}
          disabled={adopting}
          className="mb-3 flex items-center gap-1 text-xs font-medium disabled:opacity-60"
          style={{ color: "var(--scene-text-muted)" }}
        >
          <X className="h-3.5 w-3.5" />
          Back to maps
        </button>
        <h3
          className="text-base font-bold"
          style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
        >
          How many locations on {densityFor.name}?
        </h3>
        <p className="mb-4 mt-1 text-xs" style={{ color: "var(--scene-text-muted)" }}>
          Pins are chosen at random for your campaign, weighted toward capitals and
          landmarks — so your world is unique. You can reveal them to players over time.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DENSITY_TIERS.map((tier) => {
            const locked = tier.premium && !canCreateMaps
            return (
              <button
                key={tier.key}
                onClick={() =>
                  locked
                    ? toast.error("Larger maps are a premium feature.")
                    : handleAdopt(densityFor.id, tier.limit)
                }
                disabled={adopting}
                aria-disabled={locked}
                className="flex items-center justify-between gap-2 rounded-lg px-4 py-3 text-left transition-transform hover:scale-[1.01] disabled:opacity-60"
                style={{
                  background: "var(--scene-surface)",
                  border: "1px solid var(--scene-border)",
                  opacity: locked ? 0.6 : 1,
                }}
              >
                <span>
                  <span
                    className="block text-sm font-semibold"
                    style={{ color: "var(--scene-text-primary)" }}
                  >
                    {tier.label}
                  </span>
                  <span className="block text-xs" style={{ color: "var(--scene-text-muted)" }}>
                    {tier.sub} pins
                  </span>
                </span>
                {locked && <Crown className="h-4 w-4 shrink-0" style={{ color: "var(--scene-accent)" }} />}
                {adopting && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Upload (premium/admin) */}
      {canCreateMaps ? (
        <MapUploader campaignId={campaignId} onDone={onDone} />
      ) : (
        <div
          className="mb-6 flex items-center gap-3 rounded-xl p-4"
          style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
        >
          <Crown className="h-5 w-5 shrink-0" style={{ color: "var(--scene-accent)" }} />
          <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
            Uploading your own maps is a premium feature. Pick a starter map below, or upgrade to import custom worlds.
          </p>
        </div>
      )}

      {/* Presets */}
      <h2
        className="mb-3 text-sm font-semibold uppercase tracking-widest"
        style={{ color: "var(--scene-text-muted)" }}
      >
        Starter maps
      </h2>
      {presets === undefined ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="aspect-video animate-pulse rounded-lg" style={{ background: "var(--scene-surface)" }} />
          ))}
        </div>
      ) : presets.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
        >
          <MapIcon className="mx-auto mb-3 h-8 w-8" style={{ color: "var(--scene-text-muted)", opacity: 0.4 }} />
          <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
            No starter maps available yet{canCreateMaps ? " — upload your own above to get started." : "."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {presets.map((preset) => (
            <button
              key={preset._id}
              onClick={() => setDensityFor({ id: preset._id, name: preset.name })}
              className="group relative overflow-hidden rounded-lg text-left transition-transform hover:scale-[1.02]"
              style={{ border: "1px solid var(--scene-border)" }}
            >
              <div className="aspect-video w-full" style={{ background: "var(--scene-bg)" }}>
                <img
                  src={toImageUrl(preset.imageStorageKey)}
                  alt={preset.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div
                className="flex items-center justify-between gap-2 px-3 py-2"
                style={{ background: "var(--scene-surface)" }}
              >
                <span className="truncate text-sm font-medium" style={{ color: "var(--scene-text-primary)" }}>
                  {preset.name}
                </span>
                {preset.isPremiumPreset && (
                  <Crown className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--scene-accent)" }} />
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  )
}

// Handles file → dimensions → presign → R2 PUT → setCampaignMap.
function MapUploader({ campaignId, onDone }: { campaignId: CampaignId; onDone?: () => void }) {
  const setCampaignMap = useMutation(api.worldMap.setCampaignMap)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const readDimensions = (file: File): Promise<{ width: number; height: number }> =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve({ width: img.naturalWidth, height: img.naturalHeight })
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error("Couldn't read that image."))
      }
      img.src = url
    })

  const handleFile = async (file: File) => {
    setUploading(true)
    try {
      const { width, height } = await readDimensions(file)
      // SVGs may report 0×0 — fall back to a sane default aspect.
      const w = width || 1000
      const h = height || 1000

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

      await setCampaignMap({
        campaignId,
        name: file.name.replace(/\.[^.]+$/, ""),
        imageStorageKey: key,
        width: w,
        height: h,
      })
      toast.success("Map uploaded.")
      onDone?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="mb-6">
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
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-sm font-medium transition-colors hover:opacity-90 disabled:opacity-60"
        style={{ borderColor: "var(--scene-border)", color: "var(--scene-text-primary)" }}
      >
        {uploading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Uploading…
          </>
        ) : (
          <>
            <Upload className="h-5 w-5" style={{ color: "var(--scene-accent)" }} />
            Upload a map image (PNG, JPG, WebP, SVG)
          </>
        )}
      </button>
      <p className="mt-2 text-center text-xs" style={{ color: "var(--scene-text-muted)" }}>
        Generate a world in Azgaar&apos;s Fantasy Map Generator, export a PNG, and drop it here.
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
  isAdmin,
  canCreateMaps,
}: {
  campaignId: CampaignId
  map: WorldMap
  locations: MapLocation[]
  isDM: boolean
  isAdmin: boolean
  canCreateMaps: boolean
}) {
  const createLocation = useMutation(api.worldMap.createLocation)
  const updateLocation = useMutation(api.worldMap.updateLocation)
  const removeLocation = useMutation(api.worldMap.removeLocation)
  const setRevealed = useMutation(api.worldMap.setRevealed)
  const saveAsPreset = useMutation(api.worldMap.saveAsPreset)

  // View transform
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const imgRef = useRef<HTMLImageElement>(null)
  const dragState = useRef<{ sx: number; sy: number; px: number; py: number; moved: boolean } | null>(null)

  // Interaction
  const [selectedId, setSelectedId] = useState<LocationId | null>(null)
  const [placing, setPlacing] = useState(false)
  const [movingId, setMovingId] = useState<LocationId | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<"new" | "edit">("new")
  const [draft, setDraft] = useState<LocationDraft>(emptyDraft())
  const [pendingCoords, setPendingCoords] = useState<{ x: number; y: number } | null>(null)
  const [saving, setSaving] = useState(false)

  const selected = useMemo(
    () => (selectedId ? locations.find((l) => l._id === selectedId) ?? null : null),
    [locations, selectedId],
  )

  const clampZoom = (z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z))

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
    const delta = -e.deltaY * 0.0015
    setZoom((z) => clampZoom(z * (1 + delta)))
  }

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((placing || movingId) && isDM) return // placement click, not a pan
    dragState.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y, moved: false }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragState.current
    if (!d) return
    const dx = e.clientX - d.sx
    const dy = e.clientY - d.sy
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true
    setPan({ x: d.px + dx, y: d.py + dy })
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
        })
        setSelectedId(id)
        toast.success("Location placed.")
      } else if (editorMode === "edit" && selectedId) {
        await updateLocation({
          locationId: selectedId,
          type: draft.type,
          name: draft.name.trim(),
          dmNotes: draft.dmNotes.trim() || undefined,
          playerNotes: draft.playerNotes.trim() || undefined,
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

  const handleSaveAsPreset = async () => {
    const name = prompt("Name this preset (visible to all users):", map.name)
    if (!name?.trim()) return
    try {
      await saveAsPreset({ campaignId, presetName: name.trim() })
      toast.success("Published as a starter map.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't publish preset.")
    }
  }

  const cancelMode = () => {
    setPlacing(false)
    setMovingId(null)
  }

  const activeMode = (placing || movingId !== null) && isDM

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
            <ToolbarButton onClick={() => setPlacing((p) => !p)} active={placing} title="Add a location">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{placing ? "Placing…" : "Add"}</span>
            </ToolbarButton>
            {isAdmin && (
              <ToolbarButton onClick={handleSaveAsPreset} title="Publish as a starter map for all users">
                <Crown className="h-4 w-4" />
              </ToolbarButton>
            )}
            <ChangeMapButton campaignId={campaignId} canCreateMaps={canCreateMaps} />
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Viewport */}
        <div className="relative min-h-0 flex-1 overflow-hidden" style={{ background: "var(--scene-bg)" }}>
          <div
            className={cn(
              "absolute inset-0 flex touch-none select-none items-center justify-center",
              activeMode ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing",
            )}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={(e) => {
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
              {locations.map((loc) => (
                <LocationMarker
                  key={loc._id}
                  loc={loc}
                  zoom={zoom}
                  isDM={isDM}
                  selected={loc._id === selectedId}
                  onSelect={() => setSelectedId(loc._id)}
                />
              ))}
            </div>
          </div>

          {/* Zoom controls */}
          <div className="absolute bottom-4 right-4 flex flex-col gap-1">
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

          {activeMode && (
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
              onEdit={() => startEdit(selected)}
              onMove={() => { setMovingId(selected._id); setSelectedId(null) }}
              onDelete={() => handleDelete(selected)}
              onReveal={() => handleReveal(selected)}
            />
          </aside>
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
    </div>
  )
}

function ChangeMapButton({
  campaignId,
  canCreateMaps,
}: {
  campaignId: CampaignId
  canCreateMaps: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <ToolbarButton onClick={() => setOpen(true)} title="Switch to a different map">
        <ImageIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Change map</span>
      </ToolbarButton>
      {open && (
        <Modal onClose={() => setOpen(false)}>
          <h2
            className="mb-1 text-lg font-bold"
            style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
          >
            Change Map
          </h2>
          <p className="mb-4 text-xs" style={{ color: "var(--scene-text-muted)" }}>
            Picking a starter map{canCreateMaps ? " or uploading a new image" : ""} replaces the
            current map. Existing pins are cleared.
          </p>
          <MapChooser
            campaignId={campaignId}
            canCreateMaps={canCreateMaps}
            onDone={() => setOpen(false)}
          />
          <SecondaryButton onClick={() => setOpen(false)}>
            <X className="h-4 w-4" />
            Close
          </SecondaryButton>
        </Modal>
      )}
    </>
  )
}

// ── Markers + detail ──────────────────────────────────────────────────────────

function LocationMarker({
  loc,
  zoom,
  isDM,
  selected,
  onSelect,
}: {
  loc: MapLocation
  zoom: number
  isDM: boolean
  selected: boolean
  onSelect: () => void
}) {
  const meta = TYPE_META[(loc.type as LocationType) ?? "settlement"] ?? TYPE_META.settlement
  const hiddenFromPlayers = isDM && !loc.revealed
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onSelect() }}
      onPointerDown={(e) => e.stopPropagation()}
      title={loc.name}
      className="absolute"
      style={{
        left: `${loc.x}%`,
        top: `${loc.y}%`,
        // Anchor the ICON TIP (bottom-center) to the coord; counter-scale so the
        // marker stays a constant screen size. The label is absolutely positioned
        // below so it doesn't shift the anchor point.
        transform: `translate(-50%, -100%) scale(${1 / zoom})`,
        transformOrigin: "bottom center",
      }}
    >
      <span className="relative block">
        <MapPinIcon
          className="h-7 w-7 drop-shadow-md"
          style={{
            color: meta.color,
            fill: selected ? meta.color : "transparent",
            opacity: hiddenFromPlayers ? 0.45 : 1,
          }}
        />
        {hiddenFromPlayers && (
          <EyeOff className="absolute -right-1 -top-1 h-3 w-3" style={{ color: "var(--scene-text-muted)" }} />
        )}
        <span
          className="pointer-events-none absolute left-1/2 top-full max-w-[120px] -translate-x-1/2 truncate rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight shadow"
          style={{ background: "var(--scene-surface)", color: "var(--scene-text-primary)", border: "1px solid var(--scene-border)" }}
        >
          {loc.name}
        </span>
      </span>
    </button>
  )
}

function LocationDetail({
  loc,
  isDM,
  onClose,
  onEdit,
  onMove,
  onDelete,
  onReveal,
}: {
  loc: MapLocation
  isDM: boolean
  onClose: () => void
  onEdit: () => void
  onMove: () => void
  onDelete: () => void
  onReveal: () => void
}) {
  const meta = TYPE_META[(loc.type as LocationType) ?? "settlement"] ?? TYPE_META.settlement
  const Icon = meta.icon
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 shrink-0" style={{ color: meta.color }} />
          <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
            {loc.name}
          </h2>
        </div>
        <button onClick={onClose} aria-label="Close" className="rounded p-1 hover:opacity-70" style={{ color: "var(--scene-text-muted)" }}>
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}>
          {meta.label}
        </span>
        {isDM && (
          <span className="text-xs" style={{ color: loc.revealed ? "var(--scene-accent)" : "var(--scene-text-muted)" }}>
            {loc.revealed ? "Visible to players" : "DM-only"}
          </span>
        )}
      </div>

      {loc.playerNotes?.trim() && (
        <p className="mt-3 whitespace-pre-wrap text-sm" style={{ color: "var(--scene-text-primary)" }}>
          {loc.playerNotes}
        </p>
      )}

      {loc.drillDownMapId && (
        <div className="mt-3">
          <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--scene-accent)" }}>
            <ExternalLink className="h-3.5 w-3.5" />
            Has a local map
          </span>
        </div>
      )}

      {isDM && loc.dmNotes?.trim() && (
        <div className="mt-3 rounded-md p-2.5" style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}>
          <p className="mb-1 text-[10px] uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>DM notes</p>
          <p className="whitespace-pre-wrap text-sm" style={{ color: "var(--scene-text-primary)" }}>{loc.dmNotes}</p>
        </div>
      )}

      {isDM && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <SecondaryButton onClick={onReveal}>
            {loc.revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {loc.revealed ? "Hide" : "Reveal"}
          </SecondaryButton>
          <SecondaryButton onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            Edit
          </SecondaryButton>
          <SecondaryButton onClick={onMove}>
            <MapPinIcon className="h-4 w-4" />
            Move
          </SecondaryButton>
          <SecondaryButton onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
            Delete
          </SecondaryButton>
        </div>
      )}
    </div>
  )
}

// ── Shared bits ────────────────────────────────────────────────────────────────

const fieldStyle = {
  background: "var(--scene-bg)",
  border: "1px solid var(--scene-border)",
  color: "var(--scene-text-primary)",
} as const

function CenteredCard({ icon: Icon, title, body }: { icon: typeof Globe; title: string; body: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div
        className="max-w-md rounded-xl p-8 text-center"
        style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
      >
        <Icon className="mx-auto mb-4 h-10 w-10" style={{ color: "var(--scene-accent)", opacity: 0.6 }} />
        <h1 className="mb-2 text-xl font-bold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
          {title}
        </h1>
        <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>{body}</p>
      </div>
    </div>
  )
}

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

function ZoomButton({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex h-9 w-9 items-center justify-center rounded-md shadow transition-opacity hover:opacity-90"
      style={{ background: "var(--scene-surface)", color: "var(--scene-text-primary)", border: "1px solid var(--scene-border)" }}
    >
      {children}
    </button>
  )
}

function PrimaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
      style={{ background: "var(--scene-accent)", color: "#fff" }}
    >
      {children}
    </button>
  )
}

function SecondaryButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm transition-opacity hover:opacity-90"
      style={{ background: "var(--scene-bg)", color: "var(--scene-text-primary)", border: "1px solid var(--scene-border)" }}
    >
      {children}
    </button>
  )
}
