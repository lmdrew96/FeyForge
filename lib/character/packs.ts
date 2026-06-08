// Standard 5e equipment packs and their contents. A pack is bought/granted as a
// single "X's Pack" gear item; the inventory's Unpack action explodes it into its
// component rows. The contents (item names + counts) are facts, not copyrightable
// expression (see the curated-content convention). Component categories are
// chosen so the unpacked items are immediately useful with the rest of the sheet:
// consumables (rations/torches/candles/oil) get the Use + quantity steppers, kits
// become rollable tools.

import type { ItemCategory } from "./sheet-items"

export interface PackComponent {
  name: string
  quantity?: number
  category?: ItemCategory // default "gear"
}

const C = (name: string, quantity?: number, category?: ItemCategory): PackComponent => ({
  name,
  ...(quantity ? { quantity } : {}),
  ...(category ? { category } : {}),
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
