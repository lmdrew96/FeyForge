/**
 * Circle of the Land "Circle Spells" — the Druid Land circle's terrain choice.
 * Like invocations/maneuvers this is a PLAYER CHOICE, so it's stored (feat-like):
 * a single chosen terrain persisted as a `characterProperties` row (type
 * "landCircle", data `{ terrain }`). The chosen terrain's spells are always
 * prepared and flow into the sheet's "Always Prepared · Subclass" block via
 * deriveCharacter — they don't count against the druid's prepared budget.
 *
 * 2014 ruleset. Spell lists verified against dnd5e.wikidot.com/druid:land. Spell
 * NAMES are SRD; the surrounding text is original paraphrase.
 */

import type { GrantedSpellRef } from "./class-grants"

export interface LandTerrain {
  id: string
  name: string
  /**
   * Circle spells gained at druid levels 3 / 5 / 7 / 9 — of spell level 2 / 3 / 4 /
   * 5 respectively (the fixed Land cadence). Two spells per tier.
   */
  spells: {
    l3: [string, string]
    l5: [string, string]
    l7: [string, string]
    l9: [string, string]
  }
}

export const LAND_TERRAINS: LandTerrain[] = [
  {
    id: "arctic",
    name: "Arctic",
    spells: {
      l3: ["hold person", "spike growth"],
      l5: ["sleet storm", "slow"],
      l7: ["freedom of movement", "ice storm"],
      l9: ["commune with nature", "cone of cold"],
    },
  },
  {
    id: "coast",
    name: "Coast",
    spells: {
      l3: ["mirror image", "misty step"],
      l5: ["water breathing", "water walk"],
      l7: ["control water", "freedom of movement"],
      l9: ["conjure elemental", "scrying"],
    },
  },
  {
    id: "desert",
    name: "Desert",
    spells: {
      l3: ["blur", "silence"],
      l5: ["create food and water", "protection from energy"],
      l7: ["blight", "hallucinatory terrain"],
      l9: ["insect plague", "wall of stone"],
    },
  },
  {
    id: "forest",
    name: "Forest",
    spells: {
      l3: ["barkskin", "spider climb"],
      l5: ["call lightning", "plant growth"],
      l7: ["divination", "freedom of movement"],
      l9: ["commune with nature", "tree stride"],
    },
  },
  {
    id: "grassland",
    name: "Grassland",
    spells: {
      l3: ["invisibility", "pass without trace"],
      l5: ["daylight", "haste"],
      l7: ["divination", "freedom of movement"],
      l9: ["dream", "insect plague"],
    },
  },
  {
    id: "mountain",
    name: "Mountain",
    spells: {
      l3: ["spider climb", "spike growth"],
      l5: ["lightning bolt", "meld into stone"],
      l7: ["stone shape", "stoneskin"],
      l9: ["passwall", "wall of stone"],
    },
  },
  {
    id: "swamp",
    name: "Swamp",
    spells: {
      l3: ["darkness", "acid arrow"],
      l5: ["water walk", "stinking cloud"],
      l7: ["freedom of movement", "locate creature"],
      l9: ["insect plague", "scrying"],
    },
  },
  {
    id: "underdark",
    name: "Underdark",
    spells: {
      l3: ["spider climb", "web"],
      l5: ["gaseous form", "stinking cloud"],
      l7: ["greater invisibility", "stone shape"],
      l9: ["cloudkill", "insect plague"],
    },
  },
]

export function getTerrainById(id: string | undefined): LandTerrain | undefined {
  if (!id) return undefined
  return LAND_TERRAINS.find((t) => t.id === id.toLowerCase())
}

// Tiers as [required druid level, spell level, spell pair-key]. The Land cadence is
// fixed: druid 3/5/7/9 → spell level 2/3/4/5.
const TIERS: [number, number, keyof LandTerrain["spells"]][] = [
  [3, 2, "l3"],
  [5, 3, "l5"],
  [7, 4, "l7"],
  [9, 5, "l9"],
]

/**
 * Always-prepared circle spells unlocked at/below `druidLevel` for a terrain.
 * Returns [] for an unknown terrain or a druid below 3rd level.
 */
export function getCircleSpells(terrainId: string | undefined, druidLevel: number): GrantedSpellRef[] {
  const terrain = getTerrainById(terrainId)
  if (!terrain) return []
  const out: GrantedSpellRef[] = []
  for (const [reqLevel, spellLevel, key] of TIERS) {
    if (druidLevel >= reqLevel) {
      const [a, b] = terrain.spells[key]
      out.push({ name: a, spellLevel }, { name: b, spellLevel })
    }
  }
  return out
}
