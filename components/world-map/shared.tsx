"use client"

// ── Shared world-map presentation ────────────────────────────────────────────
// Pure, role-agnostic rendering pieces used by BOTH the full DM editor
// (app/dm/world-map/page.tsx) and the read-only in-session viewer
// (components/world-map/map-viewer.tsx). Nothing here mutates — the DM page wires
// these to its mutations; the viewer wires only the reveal toggle. Keeping one
// copy means the player-facing pin detail can never drift between the two
// surfaces. Moved out of the DM monolith unchanged except that LocationDetail's
// edit/move/delete/reveal callbacks are now optional (a button renders only when
// its handler is supplied), so the viewer can show a read-only detail.

import { useEffect, useState } from "react"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { htmlToMarkdown } from "@/lib/html-to-markdown"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import type { PoiKind } from "@/lib/worldMap/azgaar-map"
import {
  Castle,
  Trees,
  Waves,
  Landmark,
  Skull,
  KeyRound,
  PawPrint,
  Swords,
  Beer,
  Flag,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  X,
  ExternalLink,
  MapPin as MapPinIcon,
  Map as MapIcon,
} from "lucide-react"

export type WorldMap = Doc<"worldMaps">
export type MapLocation = Doc<"mapLocations">
export type LocationId = Id<"mapLocations">
export type CampaignId = Id<"campaigns">
export type WorldMapId = Id<"worldMaps">

const R2_BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? ""
// imageStorageKey is an R2 key; tolerate a full URL too (defensive).
export const toImageUrl = (key: string): string =>
  key.startsWith("http") ? key : `${R2_BASE}/${key}`

export const LOCATION_TYPES = ["settlement", "poi", "natural", "water", "region"] as const
export type LocationType = (typeof LOCATION_TYPES)[number]

type PinMeta = { label: string; color: string; icon: typeof MapPinIcon }

export const TYPE_META: Record<LocationType, PinMeta> = {
  settlement: { label: "Settlement", color: "#dc2626", icon: Castle },
  poi: { label: "Point of Interest", color: "#7c3aed", icon: Skull },
  natural: { label: "Natural Feature", color: "#059669", icon: Trees },
  water: { label: "Body of Water", color: "#0891b2", icon: Waves },
  region: { label: "Region", color: "#ca8a04", icon: Landmark },
}

// POI subtypes (Azgaar markers) get their own SVG icon + color — no emojis. A pin
// with a poiKind uses this; everything else falls back to TYPE_META. Mirrors
// PoiKind in lib/worldMap/azgaar-map.ts.
const POI_KIND_META: Record<PoiKind, PinMeta> = {
  dungeon: { label: "Dungeon", color: "#7c3aed", icon: KeyRound },
  ruin: { label: "Ruins", color: "#78716c", icon: Skull },
  monster: { label: "Monster lair", color: "#be123c", icon: PawPrint },
  encounter: { label: "Encounter", color: "#ea580c", icon: Swords },
  tavern: { label: "Tavern", color: "#b45309", icon: Beer },
  landmark: { label: "Landmark", color: "#0d9488", icon: Flag },
}

// Resolve a pin's visual: its POI subtype first, then its coarse location type.
export const metaFor = (loc: { type?: string; poiKind?: PoiKind | string }): PinMeta => {
  if (loc.poiKind && loc.poiKind in POI_KIND_META) return POI_KIND_META[loc.poiKind as PoiKind]
  return TYPE_META[(loc.type as LocationType) ?? "settlement"] ?? TYPE_META.settlement
}

// D&D settlement size band from real population (DMG-ish thresholds). Display label
// for the settlement gazetteer — purely derived, not stored.
const settlementSize = (pop: number): string =>
  pop < 100 ? "Hamlet" : pop < 1000 ? "Village" : pop < 6000 ? "Town" : pop < 25000 ? "City" : "Metropolis"

// Render a stored Azgaar coat-of-arms (compact JSON) via Armoria's live SVG API.
// Host is hardcoded (the .map only feeds the spec, never the host) — same threat
// model as the drill-down allowlist.
const ARMORIA_BASE = "https://armoria.herokuapp.com"
const armoriaUrl = (coaJson: string, size = 120): string =>
  `${ARMORIA_BASE}/?size=${size}&format=svg&coa=${encodeURIComponent(coaJson)}`

// Floor at 1 = fit-to-screen: the image renders at scale(1) with
// max-h/max-w constraints (contain), so zoom < 1 would shrink the map
// smaller than the viewport. Zoom-in (up to MAX_ZOOM) stays free.
export const MIN_ZOOM = 1
export const MAX_ZOOM = 6

// Default fog clearing radius (% of the map's shorter side). Mirrors the server
// default in convex/worldMap.ts.
export const DEFAULT_FOG_RADIUS = 10

// Keep the scaled map covering the viewport: pan is bounded to the overflow
// (how much bigger the scaled image is than the viewport) on each axis, so the
// map edge can never be dragged inside the frame. When the scaled image is no
// bigger than the viewport on an axis (e.g. at fit-to-screen zoom=1), that axis
// locks to center. transformOrigin is center center, so the bound is symmetric.
export function clampPanToViewport(
  pan: { x: number; y: number },
  zoom: number,
  img: HTMLImageElement | null,
  viewport: HTMLElement | null,
): { x: number; y: number } {
  if (!img || !viewport) return pan
  const maxX = Math.max(0, (img.offsetWidth * zoom - viewport.clientWidth) / 2)
  const maxY = Math.max(0, (img.offsetHeight * zoom - viewport.clientHeight) / 2)
  return {
    x: Math.min(maxX, Math.max(-maxX, pan.x)),
    y: Math.min(maxY, Math.max(-maxY, pan.y)),
  }
}

// ── Map pin ──────────────────────────────────────────────────────────────────

export function LocationMarker({
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
  const meta = metaFor(loc)
  const Icon = meta.icon
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
        {/* Selection glow sits behind the pin (painted first ⇒ lower in stack). */}
        {selected && (
          <span
            aria-hidden
            className="absolute left-1/2 top-[1px] h-7 w-7 -translate-x-1/2 rounded-full"
            style={{ background: meta.color, opacity: 0.3 }}
          />
        )}
        {/* Filled teardrop in the kind's color… */}
        <MapPinIcon
          className="h-8 w-8 drop-shadow-md"
          style={{
            color: meta.color,
            fill: meta.color,
            opacity: hiddenFromPlayers ? 0.45 : 1,
          }}
        />
        {/* …with the kind's SVG glyph (white) in the bulb — no emojis. */}
        <Icon
          className="pointer-events-none absolute left-1/2 top-[5px] h-3.5 w-3.5 -translate-x-1/2"
          style={{ color: "#fff", opacity: hiddenFromPlayers ? 0.55 : 1 }}
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

// Town/realm crest, rendered from the stored COA spec via Armoria. Hides itself if
// the (third-party) render ever fails — never blocks the rest of the panel.
export function CoatOfArms({ coa, name }: { coa: string; name: string }) {
  const [ok, setOk] = useState(true)
  if (!ok) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={armoriaUrl(coa)}
      alt={`Coat of arms of ${name}`}
      width={56}
      height={56}
      loading="lazy"
      onError={() => setOk(false)}
      className="h-14 w-14 shrink-0 rounded"
      style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}
    />
  )
}

// ── Pin detail panel ───────────────────────────────────────────────────────────
// The reveal/edit/move/delete actions are OPTIONAL: each button renders only when
// its handler is supplied. The DM editor passes all four; the in-session viewer
// passes only onReveal (DM) or none (player) for a read-only detail.

export function LocationDetail({
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
  onEdit?: () => void
  onMove?: () => void
  onDelete?: () => void
  onReveal?: () => void
}) {
  const meta = metaFor(loc)
  const Icon = meta.icon
  const [lightbox, setLightbox] = useState(false)
  const [cityOpen, setCityOpen] = useState(false)
  // Drill-down resolution (per spec): a DM's uploaded image overrides everything;
  // else the pin's embedded Watabou map — a settlement's MFCG city, a dungeon's One
  // Page Dungeon, or an encounter's premade-NPC view. POI drill-downs are DM-only
  // (listLocations strips drillDownUrl from the player payload for type "poi").
  const hasImage = !!loc.drillDownImageKey
  const hasEmbed = !hasImage && !!loc.drillDownUrl
  // Label/title the drill-down by what it actually opens.
  const embedLabel =
    loc.poiKind === "dungeon"
      ? "View dungeon map"
      : loc.poiKind === "encounter"
        ? "View encounter NPC"
        : loc.type === "settlement"
          ? "View city map"
          : "View map"
  // Notes render as Markdown (the shared, sanitized renderer). htmlToMarkdown
  // also cleans the raw HTML the Azgaar seed pipeline leaves in dmNotes — links
  // survive, the <iframe>/<div> soup doesn't. Gate on the NORMALIZED value so an
  // HTML-only legend (e.g. just an embed) doesn't leave an empty header block.
  const playerMd = htmlToMarkdown(loc.playerNotes)
  const dmMd = htmlToMarkdown(loc.dmNotes)
  const showActions = isDM && (onReveal || onEdit || onMove || onDelete)
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

      {/* Settlement gazetteer (imported from the Azgaar burg): crest, size, realm, chips. */}
      {loc.town && (
        <div className="mt-3 flex gap-3">
          {loc.town.coa && <CoatOfArms coa={loc.town.coa} name={loc.name} />}
          <div className="min-w-0 flex-1">
            {loc.town.population != null && (
              <p className="text-sm font-medium" style={{ color: "var(--scene-text-primary)" }}>
                {settlementSize(loc.town.population)} · {loc.town.population.toLocaleString()} people
              </p>
            )}
            {(loc.town.realm || loc.town.culture) && (
              <p className="mt-0.5 text-xs" style={{ color: "var(--scene-text-muted)" }}>
                {loc.town.realm}
                {loc.town.realm && loc.town.government ? ` · ${loc.town.government}` : ""}
                {loc.town.realm && loc.town.culture ? " · " : ""}
                {loc.town.culture ? `${loc.town.culture} culture` : ""}
              </p>
            )}
            {loc.town.features && loc.town.features.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {loc.town.features.map((f) => (
                  <span
                    key={f}
                    className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                    style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}
                  >
                    {f}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {playerMd && (
        <MarkdownRenderer variant="scene" content={playerMd} className="mt-3 text-sm" />
      )}

      {(hasImage || hasEmbed) && (
        <button
          type="button"
          onClick={() => (hasImage ? setLightbox(true) : setCityOpen(true))}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-90"
          style={{
            background: "color-mix(in srgb, var(--scene-accent) 16%, transparent)",
            color: "var(--scene-accent)",
            border: "1px solid color-mix(in srgb, var(--scene-accent) 38%, transparent)",
          }}
        >
          <MapIcon className="h-3.5 w-3.5" />
          {hasImage ? "View local map" : embedLabel}
        </button>
      )}

      {lightbox && loc.drillDownImageKey && (
        <LocalMapLightbox
          imageKey={loc.drillDownImageKey}
          title={loc.name}
          onClose={() => setLightbox(false)}
        />
      )}

      {cityOpen && loc.drillDownUrl && (
        <MfcgViewer url={loc.drillDownUrl} title={loc.name} onClose={() => setCityOpen(false)} />
      )}

      {isDM && dmMd && (
        <div className="mt-3 rounded-md p-2.5" style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}>
          <p className="mb-1 text-[10px] uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>DM notes</p>
          <MarkdownRenderer variant="scene" content={dmMd} className="text-sm" />
        </div>
      )}

      {isDM && !playerMd && !dmMd && (
        <p className="mt-3 text-sm italic" style={{ color: "var(--scene-text-muted)" }}>
          {onEdit ? "No description yet — Edit to add one." : "No description yet."}
        </p>
      )}

      {showActions && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {onReveal && (
            <SecondaryButton onClick={onReveal}>
              {loc.revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {loc.revealed ? "Hide" : "Reveal"}
            </SecondaryButton>
          )}
          {onEdit && (
            <SecondaryButton onClick={onEdit}>
              <Pencil className="h-4 w-4" />
              Edit
            </SecondaryButton>
          )}
          {onMove && (
            <SecondaryButton onClick={onMove}>
              <MapPinIcon className="h-4 w-4" />
              Move
            </SecondaryButton>
          )}
          {onDelete && (
            <SecondaryButton onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
              Delete
            </SecondaryButton>
          )}
        </div>
      )}
    </div>
  )
}

// ── Drill-down overlays (used by LocationDetail, DM + players) ──────────────────

// Full-screen lightbox for a pin's local "drill-down" map. Sits at z-[60] so it
// rides above the editor Modal (z-50) and the detail panels. Image is shown
// object-contain to fit any aspect; an "open full image" link lets the viewer
// zoom in a browser tab for detailed city/dungeon maps. Used by DM + players.
function LocalMapLightbox({
  imageKey,
  title,
  onClose,
}: {
  imageKey: string
  title: string
  onClose: () => void
}) {
  // Close on Escape — this is a top-level overlay, so it owns the key handler.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/85" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between gap-3 p-3">
        <span className="truncate text-sm font-medium text-white/90" style={{ fontFamily: "var(--font-cinzel)" }}>
          {title}
        </span>
        <div className="flex items-center gap-2">
          <a
            href={toImageUrl(imageKey)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-white/90 hover:bg-white/10"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open full image
          </a>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-white/90 hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      {/* Click the backdrop (not the image) to dismiss. */}
      <div className="flex flex-1 items-center justify-center overflow-auto p-4" onClick={onClose}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={toImageUrl(imageKey)}
          alt={`Local map for ${title}`}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
        />
      </div>
    </div>
  )
}

// Settlement drill-down: Watabou MFCG framed in-app (his live site, his servers —
// we never host his output; see docs/specs/feyforge-drilldown-spec.md). Keyed on
// the URL so each pin gets a fresh iframe (avoids MFCG's multi-city stale-state
// bug). A CSP block may never fire onError, so an 8s load-timeout flips to the
// always-available external link; the "Open in new tab" header link is the final
// escape hatch even if a block renders inside the frame.
function MfcgViewer({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  useEffect(() => {
    if (loaded) return
    const t = setTimeout(() => setFailed(true), 8000)
    return () => clearTimeout(t)
  }, [loaded])

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/85" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between gap-3 p-3">
        <span className="truncate text-sm font-medium text-white/90" style={{ fontFamily: "var(--font-cinzel)" }}>
          {title} — city map
        </span>
        <div className="flex items-center gap-2">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-white/90 hover:bg-white/10"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open in new tab
          </a>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-white/90 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="relative flex-1">
        {failed ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-white/80">Couldn&apos;t embed the city map here.</p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium"
              style={{ background: "var(--scene-accent)", color: "#fff" }}
            >
              <ExternalLink className="h-4 w-4" />
              Open city map
            </a>
          </div>
        ) : (
          <iframe
            key={url}
            src={url}
            title={`${title} — city map`}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className="h-full w-full border-0 bg-white"
          />
        )}
      </div>

      <div className="p-2 text-center text-[11px] text-white/50">
        City maps by{" "}
        <a
          href="https://watabou.github.io/city-generator/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-white/80"
        >
          Watabou&apos;s Medieval Fantasy City Generator
        </a>
      </div>
    </div>
  )
}

// ── Button atoms ───────────────────────────────────────────────────────────────

export function ZoomButton({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title?: string }) {
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

export function SecondaryButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
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
