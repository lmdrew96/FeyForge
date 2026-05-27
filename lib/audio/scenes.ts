/**
 * Predefined scene names for music stem assignment.
 * These are world-geography/environment categories distinct from the visual
 * theme palettes in lib/scenes.ts (feywild, shadowfell, etc.).
 * Cody adds to this list as new scenes are needed.
 */
export const FEYFORGE_SCENES = [
  "town",
  "tavern",
  "forest",
  "dungeon",
  "cave",
  "wilderness",
  "castle",
  "ruins",
  "ocean",
  "plains",
  "mountain",
  "swamp",
  "temple",
  "market",
  "sewers",
] as const

export type FeyForgeScene = typeof FEYFORGE_SCENES[number]
