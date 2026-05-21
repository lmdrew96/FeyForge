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
