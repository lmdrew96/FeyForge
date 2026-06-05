"use client"

// World-map SETUP flow — everything for "how a campaign gets a map" (the empty
// state + the in-workspace "Change map" screen). Lifted out of page.tsx so that
// file holds only the live map workspace. MapSetup is the single entry point the
// page renders; the rest (chooser, premium picker, uploader, Azgaar import) are
// internal to this module.

import { useState, useRef } from "react"
import Link from "next/link"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { parseMap, curateForImport } from "@/lib/worldMap/azgaar-map"
import {
  VIBE_AXES,
  vibeSubtitle,
  type VibeShape,
  type VibeClimate,
  type VibeCivilization,
  type VibeScale,
} from "@/lib/worldMap/vibe"
import { toast } from "sonner"
import {
  Globe,
  X,
  Upload,
  ImageIcon,
  Crown,
  Map as MapIcon,
  Loader2,
  Check,
  Sparkles,
  Wand2,
  FileText,
  ExternalLink,
  Plus,
} from "lucide-react"
import {
  toImageUrl,
  type CampaignId,
  type WorldMapId,
} from "@/components/world-map/shared"
import { CenteredCard, PrimaryButton } from "./world-map-ui"

// ── Setup (no campaign map yet) ──────────────────────────────────────────────

export function MapSetup({
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
