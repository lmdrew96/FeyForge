"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react"
import Link from "next/link"
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
import { parseMap, curateForImport, type EventPlace } from "@/lib/worldMap/azgaar-map"
import {
  VIBE_AXES,
  vibeSubtitle,
  type VibeShape,
  type VibeClimate,
  type VibeCivilization,
  type VibeScale,
} from "@/lib/worldMap/vibe"
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
  Upload,
  ImageIcon,
  ZoomIn,
  ZoomOut,
  Maximize,
  MapPin as MapPinIcon,
  Route as RouteIcon,
  ExternalLink,
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
  Map as MapIcon,
  CloudFog,
  Paintbrush,
  Eraser,
  Check,
  Sparkles,
  Wand2,
  FileText,
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
  type WorldMapId,
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

// ── Setup (no campaign map yet) ──────────────────────────────────────────────

function MapSetup({
  campaignId,
  isDM,
  canCreateMaps,
  onDone,
  onCancel,
}: {
  campaignId: CampaignId
  isDM: boolean
  canCreateMaps: boolean
  // When set, the chooser is being used to SWITCH maps (a map already exists):
  // onDone fires after a new map is adopted; onCancel keeps the current map.
  onDone?: () => void
  onCancel?: () => void
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

  const changing = !!onCancel

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      {changing && (
        <button
          onClick={onCancel}
          className="mb-4 flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-80"
          style={{ color: "var(--scene-text-muted)" }}
        >
          <X className="h-3.5 w-3.5" />
          Keep current map
        </button>
      )}
      <div className="mb-6">
        <h1
          className="flex items-center gap-2 text-2xl font-bold"
          style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
        >
          <Globe className="h-6 w-6" style={{ color: "var(--scene-accent)" }} />
          {changing ? "Change Map" : "World Map"}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--scene-text-muted)" }}>
          {changing
            ? `Pick a starter map${canCreateMaps ? " or upload a new image" : ""} to replace the current one — existing pins are cleared.`
            : "Choose a starter map, or upload your own to begin charting your world."}
        </p>
      </div>
      <MapChooser campaignId={campaignId} canCreateMaps={canCreateMaps} onDone={onDone} />
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

// Premium "vibe" map picker — the marquee premium feature. The DM filters the
// baked library on 4 axes (no Azgaar vocabulary) and picks a finished, populated
// world; selection flows into MapChooser's shared density step → adoptPreset
// (which gates premium-preset adoption server-side). Only rendered for premium/
// admin DMs. Built on convex/worldMap.listPremiumPresets + lib/worldMap/vibe.ts.
type VibeFilter = {
  vibeShape?: VibeShape
  vibeClimate?: VibeClimate
  vibeCivilization?: VibeCivilization
  vibeScale?: VibeScale
}

function VibeChip({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
      style={{
        background: selected ? "var(--scene-accent)" : "var(--scene-surface)",
        color: selected ? "var(--scene-bg)" : "var(--scene-text-muted)",
        border: "1px solid var(--scene-border)",
      }}
    >
      {label}
    </button>
  )
}

function PremiumMapPicker({ onPick }: { onPick: (id: WorldMapId, name: string) => void }) {
  const [filter, setFilter] = useState<VibeFilter>({})
  const results = useQuery(api.worldMap.listPremiumPresets, filter)
  const libraryHasMaps = useRef(false)

  const setAxis = (field: keyof VibeFilter, option: string | undefined) =>
    setFilter((f) => ({ ...f, [field]: option }) as VibeFilter)

  // Latch: have we ever seen a non-empty premium library? Until we have, render
  // NOTHING — not even while loading. Otherwise the picker flashes in (chips +
  // skeleton) on first load and then vanishes when an empty library resolves,
  // shoving the always-present "build your own world" card up (the reported race).
  // Once maps are known to exist we keep the picker mounted and let the body show
  // the skeleton during filter reloads / the "fewer filters" hint when over-filtered.
  if (results && results.length > 0) libraryHasMaps.current = true
  if (!libraryHasMaps.current) return null

  return (
    <div className="mb-6">
      <div className="mb-1 flex items-center gap-2">
        <Sparkles className="h-4 w-4" style={{ color: "var(--scene-accent)" }} />
        <h2
          className="text-sm font-semibold uppercase tracking-widest"
          style={{ color: "var(--scene-text-muted)" }}
        >
          Premium worlds
        </h2>
      </div>
      <p className="mb-3 text-xs" style={{ color: "var(--scene-text-muted)" }}>
        Pick a vibe — a finished, populated world appears. No map editor, no fuss.
      </p>

      <div className="mb-4 space-y-2.5">
        {VIBE_AXES.map((axis) => {
          const active = filter[axis.field]
          return (
            <div key={axis.field}>
              <span
                className="mb-1 block text-[11px] font-medium uppercase tracking-wide"
                style={{ color: "var(--scene-text-muted)" }}
              >
                {axis.label}
              </span>
              <div className="flex flex-wrap gap-1.5">
                <VibeChip
                  label="Any"
                  selected={active === undefined}
                  onClick={() => setAxis(axis.field, undefined)}
                />
                {axis.options.map((opt) => (
                  <VibeChip
                    key={opt}
                    label={(axis.labels as Record<string, string>)[opt]}
                    selected={active === opt}
                    onClick={() => setAxis(axis.field, active === opt ? undefined : opt)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {results === undefined ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="aspect-video animate-pulse rounded-lg"
              style={{ background: "var(--scene-surface)" }}
            />
          ))}
        </div>
      ) : results.length === 0 ? (
        <div
          className="rounded-xl p-6 text-center"
          style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
        >
          <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
            No premium worlds match these filters. Try fewer.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-2 text-xs" style={{ color: "var(--scene-text-muted)" }}>
            {results.length} world{results.length === 1 ? "" : "s"} match
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {results.map((r) => (
              <button
                key={r._id}
                onClick={() => onPick(r._id, r.name)}
                className="group relative overflow-hidden rounded-lg text-left transition-transform hover:scale-[1.02]"
                style={{ border: "1px solid var(--scene-border)" }}
              >
                <div className="aspect-video w-full" style={{ background: "var(--scene-bg)" }}>
                  <img
                    src={toImageUrl(r.imageStorageKey)}
                    alt={r.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="px-3 py-2" style={{ background: "var(--scene-surface)" }}>
                  <span
                    className="block truncate text-sm font-medium"
                    style={{ color: "var(--scene-text-primary)" }}
                  >
                    {r.name}
                  </span>
                  {r.vibeCivilization && r.vibeScale && (
                    <span
                      className="block truncate text-[11px]"
                      style={{ color: "var(--scene-text-muted)" }}
                    >
                      {vibeSubtitle({ civilization: r.vibeCivilization, scale: r.vibeScale })}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

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
      {/* Premium/admin: vibe picker (marquee), then guided-create + import, then
          plain image upload. The picker hides itself when the library is empty. */}
      {canCreateMaps ? (
        <>
          <PremiumMapPicker onPick={(id, name) => setDensityFor({ id, name })} />
          <AzgaarWorldBuilder campaignId={campaignId} onDone={onDone} />
          <MapUploader campaignId={campaignId} onDone={onDone} />
        </>
      ) : (
        <div
          className="mb-6 flex items-center gap-3 rounded-xl p-4"
          style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
        >
          <Crown className="h-5 w-5 shrink-0" style={{ color: "var(--scene-accent)" }} />
          <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
            Uploading your own maps is a premium feature. Pick a starter map below, or{" "}
            <Link
              href="/account"
              className="font-medium underline underline-offset-2 hover:opacity-80"
              style={{ color: "var(--scene-accent)" }}
            >
              upgrade
            </Link>{" "}
            to import custom worlds.
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
        Image only — no pins. Use <span style={{ color: "var(--scene-accent)" }}>Build your own world</span> above to import an Azgaar world with locations.
      </p>
    </div>
  )
}

const AZGAAR_URL = "https://azgaar.github.io/Fantasy-Map-Generator/"

// Guided-create + import-with-pins (premium). The DM designs a world in Azgaar's
// live generator, exports the .map + a PNG, and drops both here: we parse the .map
// IN THE BROWSER (dodging Vercel's 4.5MB body cap — only the small parsed JSON
// goes to Convex), upload the image to R2, and create the campaign map + its pins
// (settlements get Watabou MFCG city drill-downs for free, same parser as presets).
function AzgaarWorldBuilder({ campaignId, onDone }: { campaignId: CampaignId; onDone?: () => void }) {
  const importMap = useMutation(api.worldMap.setCampaignMapWithPins)
  const [mapFile, setMapFile] = useState<File | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const mapInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const handleImport = async () => {
    if (!mapFile || !imageFile) {
      toast.error("Add both your .map file and the map image.")
      return
    }
    setBusy(true)
    try {
      setStatus("Reading your world…")
      const text = await mapFile.text()
      let parsed
      try {
        parsed = parseMap(text)
      } catch {
        throw new Error("Couldn't read that .map — export it from Azgaar (Menu → Save → .map).")
      }
      const locations = curateForImport(parsed)
      // Valid header but no pins ⇒ likely an unrecognized Azgaar version. Bail
      // BEFORE the upload/mutation so we never destructively replace the DM's
      // current map with an empty world.
      if (locations.length === 0) {
        throw new Error(
          "Read your map but found no towns or points of interest. Make sure you exported a full Azgaar world (Menu → Save → .map).",
        )
      }

      setStatus("Uploading the map image…")
      const presign = await fetch("/api/world-map/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: imageFile.type }),
      })
      if (!presign.ok) {
        const { error } = await presign.json().catch(() => ({ error: "Upload failed" }))
        throw new Error(error)
      }
      const { uploadUrl, key } = await presign.json()
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": imageFile.type },
        body: imageFile,
      })
      if (!put.ok) throw new Error("Upload to storage failed.")

      setStatus("Placing your pins…")
      const name = mapFile.name.replace(/\.[^.]+$/, "") || "My World"
      await importMap({
        campaignId,
        name,
        imageStorageKey: key,
        width: parsed.width,
        height: parsed.height,
        scaleMilesPerPx: parsed.scaleMilesPerPx,
        locations,
        worldEvents: parsed.zones, // named active events → worldMaps row (DM-only)
        routes: parsed.routes, // roads/trails/searoutes polylines → worldMaps row (travel overlay)
        realms: parsed.realms, // Azgaar states → worldMaps row (Realms & Faiths panel)
        faiths: parsed.faiths, // Azgaar religions → worldMaps row (Realms & Faiths panel)
      })
      toast.success(`Imported “${name}” — ${locations.length} location${locations.length === 1 ? "" : "s"} placed.`)
      onDone?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed.")
    } finally {
      setBusy(false)
      setStatus(null)
    }
  }

  return (
    <div
      className="mb-6 rounded-xl p-4"
      style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
    >
      <div className="flex items-center gap-2">
        <Wand2 className="h-5 w-5 shrink-0" style={{ color: "var(--scene-accent)" }} />
        <h3 className="text-sm font-bold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
          Build your own world
        </h3>
      </div>
      <p className="mt-1 text-xs" style={{ color: "var(--scene-text-muted)" }}>
        Design a world in Azgaar&apos;s free generator, then bring it in here — towns, landmarks,
        and city maps come across automatically.
      </p>

      {/* Step 1 — design in Azgaar */}
      <a
        href={AZGAAR_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-opacity hover:opacity-90"
        style={{
          background: "color-mix(in srgb, var(--scene-accent) 16%, transparent)",
          color: "var(--scene-accent)",
          border: "1px solid color-mix(in srgb, var(--scene-accent) 38%, transparent)",
        }}
      >
        <ExternalLink className="h-4 w-4" />
        Open Azgaar&apos;s Map Generator
      </a>
      <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "var(--scene-text-muted)" }}>
        In Azgaar: shape your world, then <strong>Menu → Save → Map file (.map)</strong> and{" "}
        <strong>Export → PNG</strong>. Export both from the <em>same</em> world, then drop them below.
      </p>

      {/* Step 2 — the two files */}
      <input
        ref={mapInputRef}
        type="file"
        accept=".map"
        className="hidden"
        onChange={(e) => setMapFile(e.target.files?.[0] ?? null)}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
      />
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <FilePickButton
          icon={FileText}
          label={mapFile ? mapFile.name : "Choose .map file"}
          chosen={!!mapFile}
          onClick={() => mapInputRef.current?.click()}
          disabled={busy}
        />
        <FilePickButton
          icon={ImageIcon}
          label={imageFile ? imageFile.name : "Choose map image"}
          chosen={!!imageFile}
          onClick={() => imageInputRef.current?.click()}
          disabled={busy}
        />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <PrimaryButton onClick={handleImport} disabled={busy || !mapFile || !imageFile}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {busy ? "Importing…" : "Import world"}
        </PrimaryButton>
        {status && (
          <span className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
            {status}
          </span>
        )}
      </div>
      <p className="mt-2 text-[11px]" style={{ color: "var(--scene-text-muted)" }}>
        Up to 100 locations are kept (the most prominent), so your world stays fast to render.
      </p>
    </div>
  )
}

function FilePickButton({
  icon: Icon,
  label,
  chosen,
  onClick,
  disabled,
}: {
  icon: typeof FileText
  label: string
  chosen: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2.5 text-left text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
      style={{
        borderColor: chosen ? "var(--scene-accent)" : "var(--scene-border)",
        color: "var(--scene-text-primary)",
      }}
    >
      {chosen ? (
        <Check className="h-4 w-4 shrink-0" style={{ color: "var(--scene-accent)" }} />
      ) : (
        <Icon className="h-4 w-4 shrink-0" style={{ color: "var(--scene-text-muted)" }} />
      )}
      <span className="truncate">{label}</span>
    </button>
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
// DM-only popover listing the world's active events (Azgaar zones). Reference-only
// hooks for the DM to seed story — no per-event reveal yet (the natural future seam
// is reveal-per-event like pins). Mirrors FogControl's popover scaffolding.
function WorldEventsControl({
  events,
  locations,
  onJumpTo,
  onAddTown,
}: {
  events: { name: string; type: string; places?: EventPlace[] }[]
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
                      <p className="text-[11px]" style={{ color: "var(--scene-text-muted)" }}>
                        {e.type}
                      </p>
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

