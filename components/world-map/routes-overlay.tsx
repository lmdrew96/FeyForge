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

import { useState } from "react"
import { Footprints, Route as RouteIcon, Ship, X } from "lucide-react"
import type { JourneyLeg } from "./use-journey-planner"

export type MapRoute = { group: string; points: number[][]; miles?: number }

// ── Travel modes + pace model ────────────────────────────────────────────────
// Everything resolves to an effective miles-per-hour, then × hours/day → distance
// per day → total days. On foot reproduces the canonical PHB overland pace exactly
// at the default 8-hour day (slow 18 / normal 24 / fast 30 mi/day). Ship rates are
// the SRD waterborne-vehicle speeds. Mounted/cart are sustained-overland
// conventions (5e doesn't table a daily rate for them).
export type TravelMode = "foot" | "mounted" | "cart" | "ship"
export type FootPace = "slow" | "normal" | "fast"
export type ShipKind = "rowboat" | "sailing" | "longship" | "galley"

const FOOT_MPH: Record<FootPace, number> = { slow: 2.25, normal: 3, fast: 3.75 }
const SHIP_MPH: Record<ShipKind, number> = { rowboat: 1.5, sailing: 2, longship: 3, galley: 4 }
const MOUNTED_MPH = 5 // riding horse, sustained with rests (~40 mi / 8-hr day)
const CART_MPH = 3 // horse-drawn wagon on a road (~24 mi / 8-hr day)

export const MODE_LABEL: Record<TravelMode, string> = {
  foot: "On foot",
  mounted: "Mounted",
  cart: "Cart",
  ship: "By ship",
}
export const SHIP_LABEL: Record<ShipKind, string> = {
  rowboat: "Rowboat",
  sailing: "Sailing ship",
  longship: "Longship",
  galley: "Galley",
}

const speedMph = (mode: TravelMode, pace: FootPace, ship: ShipKind): number =>
  mode === "foot" ? FOOT_MPH[pace] : mode === "mounted" ? MOUNTED_MPH : mode === "cart" ? CART_MPH : SHIP_MPH[ship]

type GroupStyle = { stroke: string; width: number; dash?: string; label: string; icon: typeof RouteIcon }
const GROUP_STYLE: Record<string, GroupStyle> = {
  roads: { stroke: "#b45309", width: 1.8, label: "Road", icon: RouteIcon },
  trails: { stroke: "#a16207", width: 1.3, dash: "4 3", label: "Trail", icon: Footprints },
  searoutes: { stroke: "#0e7490", width: 1.3, dash: "0.5 4.5", label: "Sea route", icon: Ship },
}
export const styleForGroup = (g: string): GroupStyle => GROUP_STYLE[g] ?? GROUP_STYLE.roads

const pointsAttr = (pts: number[][]): string => pts.map((p) => `${p[0]},${p[1]}`).join(" ")

// The network (faint) + the planned journey (bold), inside the map's transform
// layer. `legs` is one polyline per journey leg — a broken/blocked leg simply
// contributes none, so found legs still draw while the rest of the chain is unset.
export function RoutesSvg({ routes, legs }: { routes: MapRoute[]; legs?: number[][][] | null }) {
  const drawn = (legs ?? []).filter((p) => p.length >= 2)
  const dimmed = drawn.length > 0
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

      {/* Planned journey — halo under a bold accent line, drawn per leg. */}
      {drawn.map((pts, i) => (
        <g key={i}>
          <polyline
            points={pointsAttr(pts)}
            fill="none"
            stroke="#fff"
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            opacity={0.55}
          />
          <polyline
            points={pointsAttr(pts)}
            fill="none"
            stroke="var(--scene-accent)"
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ))}
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

// A small segmented-control chip. Active = accent fill; disabled dims + blocks.
function Seg({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex-1 rounded-md px-1.5 py-1 text-[11px] font-medium transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        background: active ? "var(--scene-accent)" : "color-mix(in srgb, var(--scene-text-primary) 7%, transparent)",
        color: active ? "#fff" : "var(--scene-text-primary)",
        border: `1px solid ${active ? "var(--scene-accent)" : "var(--scene-border)"}`,
      }}
    >
      {children}
    </button>
  )
}

const MODE_CHIP: Record<TravelMode, string> = { foot: "Foot", mounted: "Mount", cart: "Cart", ship: "Ship" }

// The journey-planner itinerary card (mount in the viewport corner). Journey-wide
// travel settings (foot pace / vessel / hours per day) sit up top; below, each leg
// shows its OWN mode toggle + distance + days, then a summed total. Tap towns on the
// map to chain stops. "No route" / "isn't a port" are real, common PER-LEG outcomes
// (disconnected landmasses, or a non-port picked for a sea leg) and read as
// intentional, not errors.
export function JourneyCard({
  originName,
  waypointCount,
  legs,
  totalMiles,
  hasWater,
  onSetLegMode,
  onRemoveLast,
  onClear,
}: {
  originName: string | null
  waypointCount: number
  legs: JourneyLeg[]
  totalMiles: number | null
  hasWater: boolean // map has a sea network → Ship legs are usable
  onSetLegMode: (legIndex: number, mode: TravelMode) => void
  onRemoveLast: () => void
  onClear: () => void
}) {
  const [footPace, setFootPace] = useState<FootPace>("normal")
  const [shipKind, setShipKind] = useState<ShipKind>("sailing")
  const [hoursPerDay, setHoursPerDay] = useState(8)
  const setHours = (n: number) => setHoursPerDay(Math.max(1, Math.min(24, n)))

  // Each leg's days come from ITS mode × the journey-wide pace/vessel/hours.
  const legDays = (leg: JourneyLeg): number | null => {
    if (leg.miles == null) return null
    const milesPerDay = speedMph(leg.mode, footPace, shipKind) * hoursPerDay
    return Math.round((leg.miles / milesPerDay) * 10) / 10
  }
  const totalDays = Math.round(legs.reduce((sum, leg) => sum + (legDays(leg) ?? 0), 0) * 10) / 10

  const planning = waypointCount >= 2
  const anyFoot = legs.some((l) => l.mode === "foot")
  const anyShip = legs.some((l) => l.mode === "ship")
  const hasMeasuredLeg = legs.some((l) => l.miles != null)
  const forcedMarch = hoursPerDay > 8 && legs.some((l) => l.mode === "foot" || l.mode === "mounted")

  const fieldStyle = {
    background: "color-mix(in srgb, var(--scene-text-primary) 7%, transparent)",
    border: "1px solid var(--scene-border)",
    color: "var(--scene-text-primary)",
  } as const

  return (
    <div
      className="flex max-h-[70vh] w-72 flex-col rounded-xl border p-3 shadow-2xl"
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

      {/* Journey-wide travel settings. Foot pace shows while a foot leg exists (or no
          leg yet, as the default); vessel when a ship leg exists; hours always. */}
      <div className="mt-2 space-y-1.5">
        {(!planning || anyFoot) && (
          <div className="flex gap-1">
            {(["slow", "normal", "fast"] as FootPace[]).map((p) => (
              <Seg key={p} active={footPace === p} onClick={() => setFootPace(p)}>
                {p[0].toUpperCase() + p.slice(1)}
              </Seg>
            ))}
          </div>
        )}
        {anyShip && (
          <select
            value={shipKind}
            onChange={(e) => setShipKind(e.target.value as ShipKind)}
            className="w-full cursor-pointer rounded-md px-2 py-1 text-[11px] outline-none"
            style={fieldStyle}
          >
            {(["rowboat", "sailing", "longship", "galley"] as ShipKind[]).map((k) => (
              <option key={k} value={k}>
                {SHIP_LABEL[k]} · {SHIP_MPH[k]} mph
              </option>
            ))}
          </select>
        )}

        {/* Hours per day */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px]" style={{ color: "var(--scene-text-muted)" }}>
            Hours/day
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setHours(hoursPerDay - 1)}
              className="grid h-6 w-6 place-items-center rounded-md text-sm leading-none hover:opacity-80"
              style={fieldStyle}
              aria-label="Fewer hours"
            >
              −
            </button>
            <span className="w-8 text-center text-xs font-semibold" style={{ color: "var(--scene-text-primary)" }}>
              {hoursPerDay} h
            </span>
            <button
              onClick={() => setHours(hoursPerDay + 1)}
              className="grid h-6 w-6 place-items-center rounded-md text-sm leading-none hover:opacity-80"
              style={fieldStyle}
              aria-label="More hours"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div className="my-2 border-t" style={{ borderColor: "var(--scene-border)" }} />

      {/* Step prompt until a journey exists (≥ 2 waypoints). */}
      {waypointCount === 0 && (
        <p className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
          Tap a town to set your <span style={{ color: "var(--scene-text-primary)" }}>origin</span>.
        </p>
      )}
      {waypointCount === 1 && (
        <p className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
          From <span className="font-medium" style={{ color: "var(--scene-text-primary)" }}>{originName}</span> — tap the next{" "}
          <span style={{ color: "var(--scene-text-primary)" }}>stop</span>.
        </p>
      )}

      {/* Itinerary — one block per leg, then a summed total. */}
      {planning && (
        <div className="-mx-1 flex-1 space-y-2 overflow-y-auto px-1">
          {legs.map((leg, i) => {
            const days = legDays(leg)
            return (
              <div
                key={`${leg.fromId}-${leg.toId}-${i}`}
                className="rounded-lg p-2"
                style={{ background: "color-mix(in srgb, var(--scene-text-primary) 4%, transparent)", border: "1px solid var(--scene-border)" }}
              >
                <p className="text-xs font-medium" style={{ color: "var(--scene-text-primary)" }}>
                  <span style={{ color: "var(--scene-text-muted)" }}>{i + 1}.</span> {leg.fromName} → {leg.toName}
                </p>
                <div className="mt-1.5 flex gap-1">
                  {(["foot", "mounted", "cart", "ship"] as TravelMode[]).map((m) => (
                    <Seg
                      key={m}
                      active={leg.mode === m}
                      disabled={m === "ship" && !hasWater}
                      onClick={() => onSetLegMode(i, m)}
                      title={m === "ship" && !hasWater ? "This map has no sea routes" : MODE_LABEL[m]}
                    >
                      {MODE_CHIP[m]}
                    </Seg>
                  ))}
                </div>
                <div className="mt-1.5 text-xs" style={{ color: "var(--scene-text-muted)" }}>
                  {leg.seaBlockedBy ? (
                    <span>
                      <span className="font-medium" style={{ color: "var(--scene-text-primary)" }}>{leg.seaBlockedBy}</span> isn&apos;t a port — pick ports for sea legs.
                    </span>
                  ) : !leg.found ? (
                    <span>{leg.mode === "ship" ? "No sea route between these ports." : "No overland route — separate landmasses."}</span>
                  ) : leg.miles == null ? (
                    <span className="italic">Route found — distance unknown (no map scale).</span>
                  ) : (
                    <span>
                      <span className="font-semibold" style={{ color: "var(--scene-accent)" }}>{leg.miles.toLocaleString()} mi</span> by{" "}
                      {leg.mode === "ship" ? "sea" : "road"}
                      {days != null && (
                        <span style={{ color: "var(--scene-text-primary)" }}> · {days} {days === 1 ? "day" : "days"}</span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Total + actions. */}
      {planning && (
        <div className="mt-2 border-t pt-2" style={{ borderColor: "var(--scene-border)" }}>
          {hasMeasuredLeg && totalMiles != null && (
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
                Total
              </span>
              <span className="font-bold" style={{ color: "var(--scene-accent)" }}>
                {totalMiles.toLocaleString()} mi · {totalDays} {totalDays === 1 ? "day" : "days"}
              </span>
            </div>
          )}
          {forcedMarch && (
            <p className="mt-1 text-[10px] opacity-80" style={{ color: "var(--scene-text-muted)" }}>
              Past 8 h/day on land is a forced march — Con saves each extra hour or gain exhaustion (5e).
            </p>
          )}
          <div className="mt-2 flex items-center justify-between text-[11px]" style={{ color: "var(--scene-text-muted)" }}>
            <span>Tap a town to add a stop.</span>
            <button onClick={onRemoveLast} className="rounded px-1.5 py-0.5 font-medium hover:opacity-80" style={fieldStyle}>
              Remove last
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
