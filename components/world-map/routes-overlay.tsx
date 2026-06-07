"use client"

// ── Travel routes overlay + journey planner ──────────────────────────────────
// Azgaar stores the road/sea network as hundreds of short segments. Drawn raw they
// look fragmented, so the network renders FAINT (context only, non-interactive) and
// the real interaction is point-to-point GPS: tap two towns and the FASTEST route
// between them is computed (lib/worldMap/routing.ts) and drawn BOLD, with the total
// distance + travel time. Land and water are one cost-weighted graph, so the search
// auto-picks a short sea hop over a long land detour. Used by DM page + in-session.
//
// Split for the pan/zoom transform: the lines (RoutesSvg) mount INSIDE the transform
// layer so they track the map; the legend/card/prompt mount OUTSIDE it (fixed in the
// viewport). Points are 0–100 %, so the SVG uses a 0–100 viewBox with
// preserveAspectRatio="none" and vector-effect non-scaling-stroke keeps line width a
// constant SCREEN size at any zoom.

import { Footprints, Route as RouteIcon, Ship, X } from "lucide-react"
import type { PathSegment, WaterCapability } from "@/lib/worldMap/routing"
import type { JourneyLeg, JourneyPlanner } from "./use-journey-planner"

export type MapRoute = { group: string; points: number[][]; miles?: number }

// ── Travel modes + pace model ────────────────────────────────────────────────
// Everything resolves to an effective miles-per-hour, then × hours/day → distance
// per day → total days. On foot reproduces the canonical PHB overland pace exactly
// at the default 8-hour day (slow 18 / normal 24 / fast 30 mi/day). Ship rates are
// the SRD waterborne-vehicle speeds. Mounted/cart are sustained-overland
// conventions (5e doesn't table a daily rate for them). The router prices each
// surface by these speeds so the faster surface wins on TIME, not distance.
export type LandMode = "foot" | "mounted" | "cart"
export type FootPace = "slow" | "normal" | "fast"
export type ShipKind = "rowboat" | "sailing" | "longship" | "galley"

const FOOT_MPH: Record<FootPace, number> = { slow: 2.25, normal: 3, fast: 3.75 }
const SHIP_MPH: Record<ShipKind, number> = { rowboat: 1.5, sailing: 2, longship: 3, galley: 4 }
const MOUNTED_MPH = 5 // riding horse, sustained with rests (~40 mi / 8-hr day)
const CART_MPH = 3 // horse-drawn wagon on a road (~24 mi / 8-hr day)
const OWN_CRAFT_MPH = 1.5 // a borrowed skiff / raft — slow, but it crosses

export const LAND_LABEL: Record<LandMode, string> = { foot: "On foot", mounted: "Mounted", cart: "Cart" }
export const WATER_LABEL: Record<WaterCapability, string> = {
  none: "No boats",
  "own-craft": "Own boat",
  chartered: "Charter",
}
// Vessels offered when chartering (own-craft is a fixed slow speed, no choice).
export const CHARTER_KINDS: ShipKind[] = ["sailing", "longship", "galley"]
export const SHIP_LABEL: Record<ShipKind, string> = {
  rowboat: "Rowboat",
  sailing: "Sailing ship",
  longship: "Longship",
  galley: "Galley",
}

// Effective land/water speeds (mph) for the active profile — used by BOTH the router
// (path selection) and the card (days), so the chosen route and its reported time
// always agree.
export const landSpeedMph = (mode: LandMode, pace: FootPace): number =>
  mode === "foot" ? FOOT_MPH[pace] : mode === "mounted" ? MOUNTED_MPH : CART_MPH
export const waterSpeedMph = (water: WaterCapability, ship: ShipKind): number =>
  water === "chartered" ? SHIP_MPH[ship] : water === "own-craft" ? OWN_CRAFT_MPH : 0

type GroupStyle = { stroke: string; width: number; dash?: string; label: string; icon: typeof RouteIcon }
const GROUP_STYLE: Record<string, GroupStyle> = {
  roads: { stroke: "#b45309", width: 1.8, label: "Road", icon: RouteIcon },
  trails: { stroke: "#a16207", width: 1.3, dash: "4 3", label: "Trail", icon: Footprints },
  searoutes: { stroke: "#0e7490", width: 1.3, dash: "0.5 4.5", label: "Sea route", icon: Ship },
}
export const styleForGroup = (g: string): GroupStyle => GROUP_STYLE[g] ?? GROUP_STYLE.roads

const pointsAttr = (pts: number[][]): string => pts.map((p) => `${p[0]},${p[1]}`).join(" ")

// The network (faint) + the planned journey (bold), inside the map's transform
// layer. `segments` is the chosen route split into per-surface runs — land draws as a
// solid accent line, water (sea hops + connectors) as a dashed one, so the player can
// see where the crossing is.
export function RoutesSvg({ routes, segments }: { routes: MapRoute[]; segments?: PathSegment[] | null }) {
  const drawn = (segments ?? []).filter((s) => s.points.length >= 2)
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

      {/* Planned journey — halo under a bold accent line, one run per surface. */}
      {drawn.map((seg, i) => (
        <g key={i}>
          <polyline
            points={pointsAttr(seg.points)}
            fill="none"
            stroke="#fff"
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            opacity={0.55}
          />
          <polyline
            points={pointsAttr(seg.points)}
            fill="none"
            stroke="var(--scene-accent)"
            strokeWidth={3.5}
            strokeDasharray={seg.surface === "water" ? "2 2.5" : undefined}
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

// One-line summary of what the router CHOSE for a leg (mode is an output now).
const describeLeg = (leg: JourneyLeg): string => {
  const sea = leg.crossings > 0 ? `${leg.crossings} sea crossing${leg.crossings === 1 ? "" : "s"}` : ""
  if (leg.landMiles > 0 && sea) return `road + ${sea}`
  return sea || "overland"
}

// The journey-planner itinerary card (mount in the viewport corner). The GPS model:
// pick a journey-wide TRAVEL PROFILE (land mode + water capability) up top; each leg's
// surface is an OUTPUT the router chose, shown with distance + days. Tap towns on the
// map to chain stops. "No route" reasons are real, informative outcomes — never a
// dead end. The multi-stop WAYPOINT structure is unchanged; only mode is now auto.
export function JourneyCard({ planner, onClose }: { planner: JourneyPlanner; onClose: () => void }) {
  const { originName, waypointCount, itinerary, hasWater, profile } = planner
  const legs = itinerary?.legs ?? []
  const totalMiles = itinerary?.totalMiles ?? null

  const landSpeed = landSpeedMph(profile.land, profile.footPace)
  const waterSpeed = waterSpeedMph(profile.water, profile.shipKind)

  // Each leg's days come from ITS land/water miles × the journey-wide speeds.
  const legDays = (leg: JourneyLeg): number | null => {
    if (leg.miles == null) return null
    const water = waterSpeed > 0 ? leg.waterMiles / waterSpeed : 0
    const days = (leg.landMiles / landSpeed + water) / profile.hoursPerDay
    return Math.round(days * 10) / 10
  }
  const totalDays = Math.round(legs.reduce((sum, leg) => sum + (legDays(leg) ?? 0), 0) * 10) / 10

  const planning = waypointCount >= 2
  const hasMeasuredLeg = legs.some((l) => l.miles != null)
  const forcedMarch = profile.hoursPerDay > 8 && legs.some((l) => l.landMiles > 0)

  const fieldStyle = {
    background: "color-mix(in srgb, var(--scene-text-primary) 7%, transparent)",
    border: "1px solid var(--scene-border)",
    color: "var(--scene-text-primary)",
  } as const

  return (
    <div
      className="flex max-h-[60vh] w-full flex-col rounded-t-2xl border p-3 shadow-2xl sm:max-h-[70vh] sm:w-72 sm:rounded-xl"
      style={{ background: "var(--scene-surface)", borderColor: "var(--scene-border)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <RouteIcon className="h-4 w-4 shrink-0" style={{ color: "var(--scene-accent)" }} />
          <span className="text-sm font-bold" style={{ color: "var(--scene-text-primary)" }}>
            Plan a journey
          </span>
        </div>
        <button onClick={onClose} aria-label="Close" title="Exit travel mode" className="rounded p-0.5 hover:opacity-70" style={{ color: "var(--scene-text-muted)" }}>
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Journey-wide travel profile. Land mode (+ foot pace) and water capability
          decide which surfaces the router may use and how fast it travels them. */}
      <div className="mt-2 space-y-1.5">
        <div className="flex gap-1">
          {(["foot", "mounted", "cart"] as LandMode[]).map((m) => (
            <Seg key={m} active={profile.land === m} onClick={() => planner.setLandMode(m)} title={LAND_LABEL[m]}>
              {m === "foot" ? "Foot" : m === "mounted" ? "Mount" : "Cart"}
            </Seg>
          ))}
        </div>
        {profile.land === "foot" && (
          <div className="flex gap-1">
            {(["slow", "normal", "fast"] as FootPace[]).map((p) => (
              <Seg key={p} active={profile.footPace === p} onClick={() => planner.setFootPace(p)}>
                {p[0].toUpperCase() + p.slice(1)}
              </Seg>
            ))}
          </div>
        )}
        <div className="flex gap-1">
          {(["none", "own-craft", "chartered"] as WaterCapability[]).map((w) => (
            <Seg
              key={w}
              active={profile.water === w}
              disabled={w !== "none" && !hasWater}
              onClick={() => planner.setWater(w)}
              title={w !== "none" && !hasWater ? "This map has no sea routes" : WATER_LABEL[w]}
            >
              {WATER_LABEL[w]}
            </Seg>
          ))}
        </div>
        {profile.water === "chartered" && hasWater && (
          <select
            value={profile.shipKind}
            onChange={(e) => planner.setShipKind(e.target.value as ShipKind)}
            className="w-full cursor-pointer rounded-md px-2 py-1 text-[11px] outline-none"
            style={fieldStyle}
          >
            {CHARTER_KINDS.map((k) => (
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
              onClick={() => planner.setHoursPerDay(profile.hoursPerDay - 1)}
              className="grid h-6 w-6 place-items-center rounded-md text-sm leading-none hover:opacity-80"
              style={fieldStyle}
              aria-label="Fewer hours"
            >
              −
            </button>
            <span className="w-8 text-center text-xs font-semibold" style={{ color: "var(--scene-text-primary)" }}>
              {profile.hoursPerDay} h
            </span>
            <button
              onClick={() => planner.setHoursPerDay(profile.hoursPerDay + 1)}
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

      {/* Itinerary — one block per leg (router-chosen surface), then a summed total. */}
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
                <div className="mt-1 text-xs" style={{ color: "var(--scene-text-muted)" }}>
                  {leg.noPathReason ? (
                    <span>{leg.noPathReason}</span>
                  ) : leg.miles == null ? (
                    <span className="italic">Route found — distance unknown (no map scale).</span>
                  ) : (
                    <span>
                      <span className="font-semibold" style={{ color: "var(--scene-accent)" }}>{leg.miles.toLocaleString()} mi</span>
                      {days != null && (
                        <span style={{ color: "var(--scene-text-primary)" }}> · {days} {days === 1 ? "day" : "days"}</span>
                      )}
                      <span> — {describeLeg(leg)}</span>
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
          <div className="mt-2 flex items-center justify-between gap-2 text-[11px]" style={{ color: "var(--scene-text-muted)" }}>
            <span className="min-w-0 flex-1 truncate">Tap a town to add a stop.</span>
            <div className="flex shrink-0 items-center gap-1.5">
              <button onClick={planner.clear} className="rounded px-1.5 py-0.5 font-medium hover:opacity-80" style={fieldStyle}>
                Clear
              </button>
              <button onClick={planner.removeLast} className="rounded px-1.5 py-0.5 font-medium hover:opacity-80" style={fieldStyle}>
                Remove last
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
