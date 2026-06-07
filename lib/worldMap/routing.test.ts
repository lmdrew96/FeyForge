import { describe, it, expect } from "vitest"
import { buildTravelGraph, planJourney, type GraphRoute, type GraphPin } from "./routing"

// All fixtures use a 100×100 map so 1 unit of % == 1 px (pxBetween divides by 100 and
// multiplies by width/height) — distances below are read directly off the coordinates.
const W = 100
const H = 100
const route = (group: string, points: number[][]): GraphRoute => ({ group, points })

// Speeds passed to the router. Land a touch faster per-mile than an own small craft,
// so a sea shortcut only wins when it's meaningfully shorter (it must on time).
const FOOT = 3
const OWN_CRAFT = 2
const CHARTER = 3

describe("buildTravelGraph + planJourney — multimodal Phase-1 routing", () => {
  // ── Fixture A: a long land detour vs. a short sea hop between two ports ───────
  // Road horseshoes A→top→B (160px); a searoute crosses A→B directly (~80px incl.
  // the two short port connectors).
  const fixtureA = () => {
    const routes: GraphRoute[] = [
      route("roads", [[10, 50, 1], [10, 10, 3], [90, 10, 4], [90, 50, 2]]),
      route("searoutes", [[12, 50, 10], [88, 50, 11]]),
    ]
    const pins: GraphPin[] = [
      { x: 10, y: 50, isPort: true }, // A
      { x: 90, y: 50, isPort: true }, // B
    ]
    return buildTravelGraph(routes, W, H, pins)
  }
  const A: [number, number] = [10, 50]
  const B: [number, number] = [90, 50]

  it("picks the short sea crossing over the long land detour (cost = time)", () => {
    const res = planJourney(fixtureA(), A, B, { water: "own-craft", landSpeed: FOOT, waterSpeed: OWN_CRAFT })
    expect(res).not.toBeNull()
    expect(res!.px).toBeCloseTo(80, 5) // sea route (2 + 76 + 2), not the 160px road
    expect(res!.px).toBeLessThan(160)
    expect(res!.crossings).toBe(1)
    expect(res!.waterPx).toBeGreaterThan(0)
    expect(res!.landPx).toBe(0)
  })

  it("with no boats, falls back to the land route only (no water edges traversed)", () => {
    const res = planJourney(fixtureA(), A, B, { water: "none", landSpeed: FOOT, waterSpeed: 0 })
    expect(res).not.toBeNull()
    expect(res!.px).toBeCloseTo(160, 5) // the full overland horseshoe
    expect(res!.waterPx).toBe(0)
    expect(res!.crossings).toBe(0)
  })

  // ── Fixture B: A (port, mainland) ── sea ── C (non-port, isolated isle) ───────
  // C sits on its own road stub with NO link to any port; its only path off the isle
  // is a non-port connector to the sea lane. D is a port elsewhere on the network.
  const fixtureB = () => {
    const routes: GraphRoute[] = [
      route("searoutes", [[15, 50, 10], [80, 50, 11], [90, 60, 12]]),
      route("roads", [[10, 50, 1], [10, 20, 2], [40, 20, 5]]), // A's mainland (A=1, E=5)
      route("roads", [[80, 52, 20], [75, 52, 21]]), // D's port stub (D=20)
      route("roads", [[88, 58, 30], [92, 58, 31]]), // C's isolated isle (C=30)
    ]
    const pins: GraphPin[] = [
      { x: 10, y: 50, isPort: true }, // A — port
      { x: 40, y: 20, isPort: false }, // E — inland, too far from sea for a connector
      { x: 80, y: 52, isPort: true }, // D — port
      { x: 88, y: 58, isPort: false }, // C — non-port coastal, isolated
    ]
    return buildTravelGraph(routes, W, H, pins)
  }
  const Apt: [number, number] = [10, 50]
  const Cpt: [number, number] = [88, 58]
  const Ept: [number, number] = [40, 20]

  it("reaches a non-port coastal town with an own small craft (embark anywhere)", () => {
    const res = planJourney(fixtureB(), Apt, Cpt, { water: "own-craft", landSpeed: FOOT, waterSpeed: OWN_CRAFT })
    expect(res).not.toBeNull()
    expect(res!.crossings).toBeGreaterThanOrEqual(1)
    expect(res!.waterPx).toBeGreaterThan(0)
  })

  it("a chartered vessel can't disembark at a non-port isle → no route", () => {
    const res = planJourney(fixtureB(), Apt, Cpt, { water: "chartered", landSpeed: FOOT, waterSpeed: CHARTER })
    expect(res).toBeNull()
  })

  it("with no boats, the isolated isle is unreachable", () => {
    const res = planJourney(fixtureB(), Apt, Cpt, { water: "none", landSpeed: FOOT, waterSpeed: 0 })
    expect(res).toBeNull()
  })

  it("pure-land routing is unchanged — A → inland E over the road network", () => {
    const res = planJourney(fixtureB(), Apt, Ept, { water: "none", landSpeed: FOOT, waterSpeed: 0 })
    expect(res).not.toBeNull()
    expect(res!.px).toBeCloseTo(60, 5) // 30px (A→bend) + 30px (bend→E)
    expect(res!.waterPx).toBe(0)
    expect(res!.crossings).toBe(0)
  })

  it("returns a single-point path when origin and destination snap to the same node", () => {
    const res = planJourney(fixtureA(), A, A, { water: "own-craft", landSpeed: FOOT, waterSpeed: OWN_CRAFT })
    expect(res).not.toBeNull()
    expect(res!.px).toBe(0)
    expect(res!.segments).toHaveLength(0)
  })
})
