// Propose vibe tags for a premium map from the .map's OWN data — the defaults
// scripts/tag-premium.ts pre-fills so curation is "confirm/nudge" instead of blind
// picking. Script-only (does light .map parsing); kept out of vibe.ts so the browser
// picker bundle stays clean.
//
// What's actually recoverable (verified against real exports):
//   • climate  → equator temperature is stored (options JSON, line 1). Distinguishes
//                frozen / temperate / tropical. ARID can't be seen (precipitation
//                isn't saved) so it's never proposed — that's the curator's call.
//   • civ      → from the actual realm + settlement counts (not the gen knob).
//   • scale    → physical span (width × mi/px) + settlement count.
//   • shape    → the heightmap TEMPLATE NAME is not stored, so this is a heuristic on
//                the `features` array (landmass count + largest share), NOT a lookup.
// Every axis is a SUGGESTION; the curator confirms or overrides. Thresholds are
// rough — tune against docs/specs/feyforge-premium-map-curation.md as the library grows.

import type { ParsedMap } from "./azgaar-map"
import type { VibeClimate, VibeCivilization, VibeScale, VibeShape } from "./vibe"

export type VibeProposal = {
  shape?: VibeShape
  climate?: VibeClimate
  civilization?: VibeCivilization
  scale?: VibeScale
}

export function proposeVibe(text: string, parsed: ParsedMap): VibeProposal {
  const out: VibeProposal = {}

  // Climate — equator temperature (°C, stored regardless of the display unit) lives
  // in the options JSON on line 1. Earth-like equator ≈ 27 °C reads as temperate;
  // a markedly colder world → frozen, hotter → tropical. Arid is precipitation-driven
  // and precipitation isn't persisted, so we never auto-propose it.
  const eq = text.match(/"temperatureEquator":(-?\d+(?:\.\d+)?)/)
  if (eq) {
    const t = Number(eq[1])
    out.climate = t <= 16 ? "frozen" : t >= 30 ? "tropical" : "temperate"
  }

  // Shape — the template name isn't saved, so infer from landmasses. Many small isles
  // → archipelago; a single dominant mass → one-landmass (pangaea); a handful of big
  // ones → continents; in between → scattered.
  const land = landmassSizes(text)
  if (land.length > 0) {
    const total = land.reduce((a, b) => a + b, 0) || 1
    const largestShare = Math.max(...land) / total
    out.shape =
      largestShare >= 0.7 ? "pangaea" : land.length >= 12 ? "archipelago" : land.length >= 5 ? "scattered" : "continents"
  }

  // Civilization — the real settlement + realm counts (the output, not the input knob).
  const burgs = parsed.settlements.length
  const realms = parsed.realms.length
  out.civilization = burgs < 150 || realms <= 6 ? "wild" : burgs > 600 || realms >= 20 ? "crowded" : "settled"

  // Scale — real-world span (map width × miles-per-pixel) + how many settlements it holds.
  if (parsed.scaleMilesPerPx && parsed.scaleMilesPerPx > 0) {
    const spanMi = parsed.width * parsed.scaleMilesPerPx
    out.scale = spanMi >= 2000 || parsed.settlements.length > 250 ? "world" : "region"
  }

  return out
}

// Cell-count sizes of the LAND features (islands/isles), for the shape heuristic.
// The `features` array is the only one whose elements carry group + cells + type.
function landmassSizes(text: string): number[] {
  for (const ln of text.split("\n")) {
    const t = ln.trimStart()
    if (!t.startsWith("[")) continue
    let arr: unknown
    try {
      arr = JSON.parse(t)
    } catch {
      continue
    }
    if (!Array.isArray(arr) || arr.length === 0) continue
    // Richest sample (index 0 is a thin placeholder) to read the keys.
    let sample: Record<string, unknown> | undefined
    let keys = 0
    for (const e of arr) {
      if (e && typeof e === "object" && !Array.isArray(e)) {
        const n = Object.keys(e).length
        if (n > keys) {
          sample = e as Record<string, unknown>
          keys = n
        }
      }
    }
    if (!sample || !("group" in sample) || !("cells" in sample) || !("type" in sample)) continue
    return (arr as { land?: boolean; cells?: number }[])
      .filter((f) => f && f.land === true && typeof f.cells === "number" && f.cells > 0)
      .map((f) => f.cells as number)
  }
  return []
}
