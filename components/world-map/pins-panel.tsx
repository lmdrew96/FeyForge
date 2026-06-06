"use client"

// ── Pin filter + locator panel ───────────────────────────────────────────────
// A toolbar-opened drawer to (a) filter which pin types show on the map and (b)
// search/sort the full pin list and jump to any one. Shared by the DM editor and
// the in-session viewer. The filter set it drives gates ONLY the marker render in
// each parent — fog, routing, and jump-to-center stay on the full location list.

import { useEffect, useMemo, useState } from "react"
import { ArrowDownAZ, ListFilter, MapPin, Search, X } from "lucide-react"
import { metaFor, type MapLocation } from "./shared"
import { POI_KINDS } from "@/lib/worldMap/azgaar-map"

const POI_KIND_SET: Set<string> = new Set(POI_KINDS)

// A pin's filter bucket: its POI subtype, else its coarse type ("poi" for an
// untyped POI). The one source of truth, shared by the map render (which buckets
// are visible) and this panel's chips + list.
export function pinFilterKey(loc: { type?: string; poiKind?: string }): string {
  if (loc.type === "poi") return loc.poiKind ?? "poi"
  return loc.type ?? "settlement"
}

export function filterByKeys(locations: MapLocation[], keys: Set<string>): MapLocation[] {
  if (keys.size === 0) return locations
  return locations.filter((l) => keys.has(pinFilterKey(l)))
}

// Resolve a bucket key to the same icon/label/color the pin uses on the map.
const metaForKey = (key: string) =>
  POI_KIND_SET.has(key)
    ? metaFor({ type: "poi", poiKind: key })
    : key === "poi"
      ? metaFor({ type: "poi" })
      : metaFor({ type: key })

// Display order: settlements first, then combat/quest POIs, social/flavor, terrain.
const KEY_ORDER = [
  "settlement", "npc", "encounter", "monster", "dungeon", "ruin", "tavern", "landmark", "poi", "natural", "water", "region",
]
const orderIndex = (k: string): number => {
  const i = KEY_ORDER.indexOf(k)
  return i === -1 ? 999 : i
}

export function PinsPanel({
  locations,
  activeKeys,
  onToggleKey,
  onClear,
  onSelect,
  onClose,
  isDM,
}: {
  locations: MapLocation[]
  activeKeys: Set<string>
  onToggleKey: (key: string) => void
  onClear: () => void
  onSelect: (loc: MapLocation) => void
  onClose: () => void
  isDM: boolean
}) {
  const [query, setQuery] = useState("")
  const [sortByType, setSortByType] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  // Buckets present on the map, with counts, in display order.
  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const l of locations) {
      const k = pinFilterKey(l)
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => orderIndex(a[0]) - orderIndex(b[0]))
  }, [locations])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    let items = filterByKeys(locations, activeKeys)
    if (q) items = items.filter((l) => l.name.toLowerCase().includes(q))
    return [...items].sort((a, b) =>
      sortByType
        ? orderIndex(pinFilterKey(a)) - orderIndex(pinFilterKey(b)) || a.name.localeCompare(b.name)
        : a.name.localeCompare(b.name),
    )
  }, [locations, activeKeys, query, sortByType])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-stretch sm:justify-end"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      {/* Bottom sheet on mobile (partial height, map visible above), right-side
          panel on desktop — matches the pin detail's bottom-sheet behavior. */}
      <aside
        className="flex max-h-[85vh] w-full flex-col rounded-t-2xl border-t pb-[env(safe-area-inset-bottom)] shadow-2xl sm:h-full sm:max-h-none sm:max-w-sm sm:rounded-none sm:border-t-0 sm:border-l sm:pb-0"
        style={{ borderColor: "var(--scene-border)", background: "var(--scene-surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--scene-border)" }}>
          <div className="flex items-center gap-2">
            <ListFilter className="h-5 w-5" style={{ color: "var(--scene-accent)" }} />
            <h2 className="text-sm font-bold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
              Locations
            </h2>
            <span className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
              {list.length}/{locations.length}
            </span>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 hover:opacity-70" style={{ color: "var(--scene-text-muted)" }}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filter chips */}
        <div className="border-b px-4 py-3" style={{ borderColor: "var(--scene-border)" }}>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--scene-text-muted)" }}>
              Show on map
            </p>
            {activeKeys.size > 0 && (
              <button onClick={onClear} className="text-[11px] font-medium hover:underline" style={{ color: "var(--scene-accent)" }}>
                Show all
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {categories.map(([key, count]) => {
              const meta = metaForKey(key)
              const Icon = meta.icon
              const active = activeKeys.has(key)
              const on = activeKeys.size === 0 || active
              return (
                <button
                  key={key}
                  onClick={() => onToggleKey(key)}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-90"
                  style={{
                    background: active ? meta.color : "var(--scene-bg)",
                    color: active ? "#fff" : "var(--scene-text-primary)",
                    border: `1px solid ${active ? meta.color : "var(--scene-border)"}`,
                    opacity: on ? 1 : 0.5,
                  }}
                >
                  <Icon className="h-3.5 w-3.5" style={{ color: active ? "#fff" : meta.color }} />
                  {meta.label}
                  <span style={{ opacity: 0.7 }}>{count}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Search + sort */}
        <div className="flex items-center gap-2 border-b px-4 py-2" style={{ borderColor: "var(--scene-border)" }}>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: "var(--scene-text-muted)" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search locations…"
              className="w-full rounded-md border py-1.5 pl-8 pr-2 text-sm outline-none"
              style={{ borderColor: "var(--scene-border)", background: "var(--scene-bg)", color: "var(--scene-text-primary)" }}
            />
          </div>
          <button
            onClick={() => setSortByType((s) => !s)}
            title={sortByType ? "Sorted by type — switch to A–Z" : "Sorted A–Z — switch to by type"}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-opacity hover:opacity-90"
            style={{
              borderColor: "var(--scene-border)",
              background: sortByType ? "var(--scene-accent)" : "var(--scene-bg)",
              color: sortByType ? "#fff" : "var(--scene-text-primary)",
            }}
          >
            <ArrowDownAZ className="h-3.5 w-3.5" />
            {sortByType ? "Type" : "A–Z"}
          </button>
        </div>

        {/* List */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {list.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm" style={{ color: "var(--scene-text-muted)" }}>
              No locations match.
            </p>
          ) : (
            list.map((loc) => {
              const meta = metaFor(loc)
              const Icon = meta.icon
              const pop = loc.town?.population
              return (
                <button
                  key={loc._id}
                  onClick={() => onSelect(loc)}
                  className="flex w-full items-center gap-2.5 border-b px-4 py-2 text-left transition-colors hover:opacity-80"
                  style={{ borderColor: "var(--scene-border)" }}
                >
                  <Icon className="h-4 w-4 shrink-0" style={{ color: meta.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium" style={{ color: "var(--scene-text-primary)" }}>
                      {loc.name}
                    </span>
                    <span className="block truncate text-[11px]" style={{ color: "var(--scene-text-muted)" }}>
                      {meta.label}
                      {pop ? ` · pop. ~${pop.toLocaleString()}` : ""}
                    </span>
                  </span>
                  {isDM && !loc.revealed && (
                    <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: "var(--scene-bg)", color: "var(--scene-text-muted)" }}>
                      hidden
                    </span>
                  )}
                  <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--scene-text-muted)" }} />
                </button>
              )
            })
          )}
        </div>
      </aside>
    </div>
  )
}
