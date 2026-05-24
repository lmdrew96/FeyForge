export interface CustomPalette {
  bg: string
  surface: string
  accent: string
  highlight: string
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null
}

function lightenHex(hex: string, amount: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  return "#" + rgb.map(c => Math.min(255, c + amount).toString(16).padStart(2, "0")).join("")
}

export function buildSceneVars(palette: CustomPalette): Record<string, string> {
  const rgb = hexToRgb(palette.accent)
  const accentGlow = rgb ? `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.3)` : "rgba(123,104,200,0.3)"
  return {
    "--scene-bg": palette.bg,
    "--scene-surface": palette.surface,
    "--scene-border": lightenHex(palette.surface, 18),
    "--scene-accent": palette.accent,
    "--scene-accent-glow": accentGlow,
    "--scene-text-primary": "#e8e6f0",
    "--scene-text-muted": "#6b6882",
    "--scene-highlight": palette.highlight,
    "--scene-shadow": "rgba(0,0,0,0.5)",
    "--scene-particle": palette.accent,
  }
}

const CUSTOM_VAR_KEYS = [
  "--scene-bg", "--scene-surface", "--scene-border", "--scene-accent",
  "--scene-accent-glow", "--scene-text-primary", "--scene-text-muted",
  "--scene-highlight", "--scene-shadow", "--scene-particle",
]

export function applySceneToBody(scene: string, palette?: CustomPalette | null) {
  if (scene === "custom" && palette) {
    document.body.removeAttribute("data-scene")
    const vars = buildSceneVars(palette)
    Object.entries(vars).forEach(([k, v]) => document.body.style.setProperty(k, v))
  } else {
    CUSTOM_VAR_KEYS.forEach(k => document.body.style.removeProperty(k))
    document.body.setAttribute("data-scene", scene)
  }
}

export const SCENES = [
  { id: "", label: "Neutral", desc: "No active scene — expectant dark" },
  { id: "dungeon", label: "Dungeon", desc: "Cold, oppressive, ancient" },
  { id: "tavern", label: "Tavern", desc: "Warm, chaotic, alive" },
  { id: "forest", label: "Forest", desc: "Dappled, breathing, alive" },
  { id: "underdark", label: "Underdark", desc: "Void, alien, bioluminescent" },
  { id: "castle", label: "Castle", desc: "Imposing, regal, cold stone" },
  { id: "coastal", label: "Coastal", desc: "Open, salt-air, vast" },
  { id: "infernal", label: "Infernal", desc: "Scorched, suffocating, red" },
  { id: "celestial", label: "Celestial", desc: "Radiant, impossibly bright" },
  { id: "shadowfell", label: "Shadowfell", desc: "Ashen, grief-heavy, still" },
  { id: "feywild", label: "Feywild", desc: "Saturated, shifting, alive" },
] as const

export type SceneId = (typeof SCENES)[number]["id"]
