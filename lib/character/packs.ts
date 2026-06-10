// Standard 5e equipment packs and their contents. A pack is bought/granted as a
// single "X's Pack" gear item; the inventory's Unpack action explodes it into its
// component rows. The contents (item names + counts) are facts, not copyrightable
// expression (see the curated-content convention). Component categories are
// chosen so the unpacked items are immediately useful with the rest of the sheet:
// consumables (rations/torches/candles/oil) get the Use + quantity steppers, kits
// become rollable tools.

import type { ItemCategory } from "./sheet-items"
import type { CurrencyType } from "./constants"
import { parseCost } from "./srd-item-costs"

export interface PackComponent {
  name: string
  quantity?: number
  category?: ItemCategory // default "gear"
  weight?: number // per-unit lb
  cost?: { amount: number; currency: CurrencyType } // per-unit list price
}

// SRD weight (lb) + list price for the items packs explode into, so unpacked rows
// carry the same weight/cost as anything bought à la carte (and don't make a pack
// weigh 55 lb then drop to 0 when opened). Sourced from Open5e /v2/items where it
// lists them; the handful Open5e omits (Hammer, Piton, Torch, Oil flask, Mess kit,
// Case, Sealing wax, Soap) use the standard SRD figures. Flavor items a few packs
// carry that SRD never prices (Alms box, Censer, Vestments, Incense, Bag of sand,
// Small knife) get a sensible weight and no cost. Keyed by the EXACT names below.
const COMPONENT_STATS: Record<string, { weight: number; cost?: string }> = {
  Backpack: { weight: 5, cost: "2 gp" },
  "Ball bearings (bag of 1,000)": { weight: 2, cost: "1 gp" },
  "String (10 ft)": { weight: 0, cost: "1 sp" },
  Bell: { weight: 0, cost: "1 gp" },
  Candle: { weight: 0, cost: "1 cp" },
  Crowbar: { weight: 5, cost: "2 gp" },
  Hammer: { weight: 3, cost: "1 gp" },
  Piton: { weight: 0.25, cost: "5 cp" },
  "Hooded lantern": { weight: 2, cost: "5 gp" },
  "Oil (flask)": { weight: 1, cost: "1 sp" },
  "Rations (day)": { weight: 2, cost: "5 sp" },
  Tinderbox: { weight: 1, cost: "5 sp" },
  Waterskin: { weight: 5, cost: "2 sp" },
  "Hempen rope (50 ft)": { weight: 5, cost: "1 gp" },
  Torch: { weight: 1, cost: "1 cp" },
  Chest: { weight: 25, cost: "5 gp" },
  "Case, map or scroll": { weight: 1, cost: "1 gp" },
  "Fine clothes": { weight: 6, cost: "15 gp" },
  "Ink (bottle)": { weight: 0, cost: "10 gp" },
  "Ink pen": { weight: 0, cost: "2 cp" },
  Lamp: { weight: 1, cost: "5 sp" },
  "Paper (sheet)": { weight: 0, cost: "2 sp" },
  "Perfume (vial)": { weight: 0, cost: "5 gp" },
  "Sealing wax": { weight: 0, cost: "5 sp" },
  Soap: { weight: 0, cost: "2 cp" },
  Bedroll: { weight: 7, cost: "1 gp" },
  Costume: { weight: 4, cost: "5 gp" },
  "Disguise kit": { weight: 3, cost: "25 gp" },
  "Mess kit": { weight: 1, cost: "2 sp" },
  Blanket: { weight: 3, cost: "5 sp" },
  "Book of lore": { weight: 5, cost: "25 gp" },
  "Parchment (sheet)": { weight: 0, cost: "1 sp" },
  // SRD-unpriced flavor items — weight only.
  "Alms box": { weight: 1 },
  "Incense (block)": { weight: 0 },
  Censer: { weight: 1 },
  Vestments: { weight: 4 },
  "Bag of sand": { weight: 1 },
  "Small knife": { weight: 0.5 },
}

function componentStats(name: string): Pick<PackComponent, "weight" | "cost"> {
  const s = COMPONENT_STATS[name]
  if (!s) return {}
  const cost = s.cost ? parseCost(s.cost) : undefined
  return { weight: s.weight, ...(cost ? { cost } : {}) }
}

const C = (name: string, quantity?: number, category?: ItemCategory): PackComponent => ({
  name,
  ...(quantity ? { quantity } : {}),
  ...(category ? { category } : {}),
  ...componentStats(name),
})

// Keys are normalized (lowercase, straight apostrophe). See normalizePackName.
export const PACK_CONTENTS: Record<string, PackComponent[]> = {
  "burglar's pack": [
    C("Backpack"),
    C("Ball bearings (bag of 1,000)"),
    C("String (10 ft)"),
    C("Bell"),
    C("Candle", 5, "consumable"),
    C("Crowbar"),
    C("Hammer"),
    C("Piton", 10),
    C("Hooded lantern"),
    C("Oil (flask)", 2, "consumable"),
    C("Rations (day)", 5, "consumable"),
    C("Tinderbox"),
    C("Waterskin"),
    C("Hempen rope (50 ft)"),
  ],
  "diplomat's pack": [
    C("Chest"),
    C("Case, map or scroll", 2),
    C("Fine clothes"),
    C("Ink (bottle)"),
    C("Ink pen"),
    C("Lamp"),
    C("Oil (flask)", 2, "consumable"),
    C("Paper (sheet)", 5, "consumable"),
    C("Perfume (vial)", 1, "consumable"),
    C("Sealing wax"),
    C("Soap"),
  ],
  "dungeoneer's pack": [
    C("Backpack"),
    C("Crowbar"),
    C("Hammer"),
    C("Piton", 10),
    C("Torch", 10, "consumable"),
    C("Tinderbox"),
    C("Rations (day)", 10, "consumable"),
    C("Waterskin"),
    C("Hempen rope (50 ft)"),
  ],
  "entertainer's pack": [
    C("Backpack"),
    C("Bedroll"),
    C("Costume", 2),
    C("Candle", 5, "consumable"),
    C("Rations (day)", 5, "consumable"),
    C("Waterskin"),
    C("Disguise kit", 1, "tool"),
  ],
  "explorer's pack": [
    C("Backpack"),
    C("Bedroll"),
    C("Mess kit"),
    C("Tinderbox"),
    C("Torch", 10, "consumable"),
    C("Rations (day)", 10, "consumable"),
    C("Waterskin"),
    C("Hempen rope (50 ft)"),
  ],
  "priest's pack": [
    C("Backpack"),
    C("Blanket"),
    C("Candle", 10, "consumable"),
    C("Tinderbox"),
    C("Alms box"),
    C("Incense (block)", 2, "consumable"),
    C("Censer"),
    C("Vestments"),
    C("Rations (day)", 2, "consumable"),
    C("Waterskin"),
  ],
  "scholar's pack": [
    C("Backpack"),
    C("Book of lore"),
    C("Ink (bottle)"),
    C("Ink pen"),
    C("Parchment (sheet)", 10, "consumable"),
    C("Bag of sand"),
    C("Small knife"),
  ],
}

function normalizePackName(name: string): string {
  return name.trim().toLowerCase().replace(/[’`]/g, "'")
}

// Resolve a pack item's contents by (normalized) name, or null if it isn't a
// recognized pack. Tolerant of curly apostrophes and minor wrapping ("a
// Scholar's Pack").
export function getPackContents(itemName: string): PackComponent[] | null {
  const norm = normalizePackName(itemName)
  if (PACK_CONTENTS[norm]) return PACK_CONTENTS[norm]
  for (const key of Object.keys(PACK_CONTENTS)) {
    if (norm.includes(key) || key.includes(norm)) return PACK_CONTENTS[key]
  }
  return null
}
