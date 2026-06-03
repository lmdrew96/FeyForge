"use client"

// ── Travel routes overlay + journey planner ──────────────────────────────────
// Azgaar stores the road/sea network as hundreds of short segments. Drawn raw they
// look fragmented, so the network renders FAINT (context only, non-interactive) and
// the real interaction is point-to-point: tap two towns and the shortest road path
// between them is computed (lib/worldMap/routing.ts) and drawn BOLD, with the total
// distance + travel time. Used by both the DM page and the in-session viewer.
//
// Split for the pan/zoom transform: the lines (RoutesSvg) mount INSIDE the transform
// layer so they track the map; the legend/card/prompt mount OUTSIDE it (fixed in the
// viewport). Points are 0–100 %, so the SVG uses a 0–100 viewBox with
// preserveAspectRatio="none" and vector-effect non-scaling-stroke keeps line width a
// constant SCREEN size at any zoom.

import { Footprints, Route as RouteIcon, Ship, X } from "lucide-react"

export type MapRoute = { group: string; points: number[][]; miles?: number }

type GroupStyle = { stroke: string; width: number; dash?: string; label: string; icon: typeof RouteIcon }
const GROUP_STYLE: Record<string, GroupStyle> = {
  roads: { stroke: "#b45309", width: 1.8, label: "Road", icon: RouteIcon },
  trails: { stroke: "#a16207", width: 1.3, dash: "4 3", label: "Trail", icon: Footprints },
  searoutes: { stroke: "#0e7490", width: 1.3, dash: "0.5 4.5", label: "Sea route", icon: Ship },
}
export const styleForGroup = (g: string): GroupStyle => GROUP_STYLE[g] ?? GROUP_STYLE.roads

// D&D 5e overland pace (8-hr travel day): slow 18 / normal 24 / fast 30 mi/day.
export const travelDays = (miles: number) => ({
  slow: Math.round((miles / 18) * 10) / 10,
  normal: Math.round((miles / 24) * 10) / 10,
  fast: Math.round((miles / 30) * 10) / 10,
})

const pointsAttr = (pts: number[][]): string => pts.map((p) => `${p[0]},${p[1]}`).join(" ")

// The network (faint) + the planned journey (bold), inside the map's transform layer.
export function RoutesSvg({ routes, journey }: { routes: MapRoute[]; journey?: number[][] | null }) {
  const dimmed = !!journey && journey.length >= 2
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      aria-hidden="true"
    >
      {/* Faint network — sea first, so land sits on top. */}
      {[...routes]
        .sort((a, b) => (a.group === "searoutes" ? 0 : 1) - (b.group === "searoutes" ? 0 : 1))
        .map((r, i) => {
          const st = styleForGroup(r.group)
          return (
            <polyline
              key={i}
              points={pointsAttr(r.points)}
              fill="none"
              stroke={st.stroke}
              strokeWidth={st.width}
              strokeDasharray={st.dash}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              opacity={dimmed ? 0.18 : 0.5}
            />
          )
        })}

      {/* Planned journey — halo under a bold accent line. */}
      {dimmed && (
        <>
          <polyline
            points={pointsAttr(journey!)}
            fill="none"
            stroke="#fff"
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            opacity={0.55}
          />
          <polyline
            points={pointsAttr(journey!)}
            fill="none"
            stroke="var(--scene-accent)"
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}
    </svg>
  )
}

// Legend chip-row (mount in the viewport corner). Shown while the overlay is on.
export function RoutesLegend({ routes }: { routes: MapRoute[] }) {
  const groups = ["roads", "trails", "searoutes"].filter((g) => routes.some((r) => r.group === g))
  return (
    <div
      className="pointer-events-none flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-3 py-1.5 text-[11px] shadow"
      style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)", color: "var(--scene-text-muted)" }}
    >
      {groups.map((g) => {
        const st = styleForGroup(g)
        return (
          <span key={g} className="flex items-center gap-1.5">
            <svg width="20" height="6" aria-hidden="true">
              <line x1="0" y1="3" x2="20" y2="3" stroke={st.stroke} strokeWidth={st.width + 0.8} strokeDasharray={st.dash} strokeLinecap="round" />
            </svg>
            {st.label}
          </span>
        )
      })}
    </div>
  )
}

// The journey-planner prompt/result card (mount in the viewport corner). Land routes
// get travel days at the three 5e paces; "no overland route" is a real, common
// outcome (disconnected landmasses) and reads as intentional, not an error.
export function JourneyCard({
  fromName,
  toName,
  found,
  miles,
  onClear,
}: {
  fromName: string | null
  toName: string | null
  found: boolean
  miles: number | null
  onClear: () => void
}) {
  const days = miles != null ? travelDays(miles) : null
  return (
    <div
      className="w-64 rounded-xl border p-3 shadow-2xl"
      style={{ background: "var(--scene-surface)", borderColor: "var(--scene-border)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <RouteIcon className="h-4 w-4 shrink-0" style={{ color: "var(--scene-accent)" }} />
          <span className="text-sm font-bold" style={{ color: "var(--scene-text-primary)" }}>
            Plan a journey
          </span>
        </div>
        <button onClick={onClear} aria-label="Clear" className="rounded p-0.5 hover:opacity-70" style={{ color: "var(--scene-text-muted)" }}>
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Step prompt until both ends are chosen. */}
      {!fromName && (
        <p className="mt-1.5 text-xs" style={{ color: "var(--scene-text-muted)" }}>
          Tap a town to set your <span style={{ color: "var(--scene-text-primary)" }}>origin</span>.
        </p>
      )}
      {fromName && !toName && (
        <p className="mt-1.5 text-xs" style={{ color: "var(--scene-text-muted)" }}>
          From <span className="font-medium" style={{ color: "var(--scene-text-primary)" }}>{fromName}</span> — now tap a{" "}
          <span style={{ color: "var(--scene-text-primary)" }}>destination</span>.
        </p>
      )}

      {fromName && toName && (
        <>
          <p className="mt-1.5 text-sm font-medium" style={{ color: "var(--scene-text-primary)" }}>
            {fromName} → {toName}
          </p>
          {!found ? (
            <p className="mt-1.5 text-xs" style={{ color: "var(--scene-text-muted)" }}>
              No overland route — they&apos;re on separate landmasses, or the journey needs sea travel.
            </p>
          ) : miles == null ? (
            <p className="mt-1.5 text-xs italic" style={{ color: "var(--scene-text-muted)" }}>
              Route found — distance unknown (no map scale set).
            </p>
          ) : (
            <>
              <p className="mt-1 text-lg font-bold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-accent)" }}>
                {miles.toLocaleString()} mi by road
              </p>
              {days && (
                <div className="mt-1.5 space-y-1 text-xs" style={{ color: "var(--scene-text-muted)" }}>
                  <div className="flex items-center justify-between">
                    <span>Normal pace</span>
                    <span className="font-medium" style={{ color: "var(--scene-text-primary)" }}>
                      {days.normal} {days.normal === 1 ? "day" : "days"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between opacity-80">
                    <span>Slow · Fast</span>
                    <span>{days.slow} · {days.fast} days</span>
                  </div>
                  <p className="pt-0.5 text-[10px] opacity-70">On foot, 8 hrs/day (5e overland pace).</p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
