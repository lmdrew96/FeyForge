// Shared "vibe" axis definitions for the premium map picker. A premium DM picks a
// vibe in 3–4 taps and a finished, populated, FeyForge-native map appears — they
// never see Azgaar. The four axes here are the picker's whole vocabulary; the
// vibe → Azgaar param MAPPING lives in scripts/bake-presets.ts (bake-only), and
// the baked library is tagged with these literals so the picker can filter it.
//
// The literal unions MUST stay in sync with the worldMaps vibe fields in
// convex/schema.ts (vibeShape / vibeClimate / vibeCivilization / vibeScale).
//
// No deps — imported by the picker UI (browser), the bake script (Node), and the
// premium seed integration.

export const VIBE_SHAPES = ["archipelago", "scattered", "continents", "pangaea"] as const
export const VIBE_CLIMATES = ["frozen", "temperate", "arid", "tropical"] as const
export const VIBE_CIVILIZATIONS = ["wild", "settled", "crowded"] as const
export const VIBE_SCALES = ["region", "world"] as const

export type VibeShape = (typeof VIBE_SHAPES)[number]
export type VibeClimate = (typeof VIBE_CLIMATES)[number]
export type VibeCivilization = (typeof VIBE_CIVILIZATIONS)[number]
export type VibeScale = (typeof VIBE_SCALES)[number]

// A single cell of the 4×4×3×2 = 96-cell matrix.
export type Vibe = {
  shape: VibeShape
  climate: VibeClimate
  civilization: VibeCivilization
  scale: VibeScale
}

// DM-facing chip labels — deliberately NO Azgaar vocabulary (no "heightmap
// template", "states", "precipitation"). The DM picks a feeling, not a knob.
export const VIBE_LABELS = {
  shape: {
    archipelago: "Archipelago",
    scattered: "Scattered isles",
    continents: "Continents",
    pangaea: "One landmass",
  },
  climate: {
    frozen: "Frozen north",
    temperate: "Temperate",
    arid: "Arid / desert",
    tropical: "Tropical",
  },
  civilization: {
    wild: "Wild & sparse",
    settled: "Settled",
    crowded: "Crowded",
  },
  scale: {
    region: "A region",
    world: "A whole world",
  },
} as const

// The four axes in display order, each carrying the Convex arg field name it
// drives (vibeShape, …) so the picker can render + query generically.
export const VIBE_AXES = [
  { field: "vibeShape", label: "Shape of the world", options: VIBE_SHAPES, labels: VIBE_LABELS.shape },
  { field: "vibeClimate", label: "Climate", options: VIBE_CLIMATES, labels: VIBE_LABELS.climate },
  {
    field: "vibeCivilization",
    label: "Civilization",
    options: VIBE_CIVILIZATIONS,
    labels: VIBE_LABELS.civilization,
  },
  { field: "vibeScale", label: "Scale", options: VIBE_SCALES, labels: VIBE_LABELS.scale },
] as const

export type VibeField = (typeof VIBE_AXES)[number]["field"]

// Short, evocative pieces for building a stored map name from a vibe combo.
const CLIMATE_ADJ: Record<VibeClimate, string> = {
  frozen: "Frozen",
  temperate: "Temperate",
  arid: "Arid",
  tropical: "Tropical",
}
const SHAPE_NOUN: Record<VibeShape, string> = {
  archipelago: "Archipelago",
  scattered: "Isles",
  continents: "Continents",
  pangaea: "Supercontinent",
}

// Default stored name (Nae can rename at the cull). e.g. "Frozen Archipelago".
// Civilization + scale aren't in the name — the picker shows them as a sub-line
// (vibeSubtitle) so cells that share a climate+shape still read apart.
export function vibeName(v: Vibe): string {
  return `${CLIMATE_ADJ[v.climate]} ${SHAPE_NOUN[v.shape]}`
}

// "Wild · A region" — the picker card's secondary line.
export function vibeSubtitle(v: Pick<Vibe, "civilization" | "scale">): string {
  return `${VIBE_LABELS.civilization[v.civilization]} · ${VIBE_LABELS.scale[v.scale]}`
}

// A stable slug for the map (filename + R2 key + upsert key).
export function vibeSlug(v: Vibe): string {
  return `${v.shape}-${v.climate}-${v.civilization}-${v.scale}`
}
