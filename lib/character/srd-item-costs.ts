// Curated list prices for SRD weapons and armor.
//
// Open5e's v2 mechanics endpoints (used by open5eApi.getWeapons / getArmor) don't
// carry prices, so the item picker showed gear with no cost — a player browsing to
// buy something can't tell what they can afford. These are the standard 5e SRD
// equipment prices (numeric facts, not copyrightable expression — same posture as
// the rest of the curated D&D content in this repo).
//
// Names are matched by a word-sorted, punctuation-stripped key so the lookup is
// robust to ordering/punctuation differences in the source ("Crossbow, Light"
// matches "Light Crossbow"). Anything not in the table returns undefined and simply
// shows no cost — the same as before, so there's no regression for unknown/homebrew.

const COSTS: Record<string, string> = {
  // ── Simple melee ──
  Club: "1 sp",
  Dagger: "2 gp",
  Greatclub: "2 sp",
  Handaxe: "5 gp",
  Javelin: "5 sp",
  "Light Hammer": "2 gp",
  Mace: "5 gp",
  Quarterstaff: "2 sp",
  Sickle: "1 gp",
  Spear: "1 gp",
  // ── Simple ranged ──
  "Light Crossbow": "25 gp",
  Dart: "5 cp",
  Shortbow: "25 gp",
  Sling: "1 sp",
  // ── Martial melee ──
  Battleaxe: "10 gp",
  Flail: "10 gp",
  Glaive: "20 gp",
  Greataxe: "30 gp",
  Greatsword: "50 gp",
  Halberd: "20 gp",
  Lance: "10 gp",
  Longsword: "15 gp",
  Maul: "10 gp",
  Morningstar: "15 gp",
  Pike: "5 gp",
  Rapier: "25 gp",
  Scimitar: "25 gp",
  Shortsword: "10 gp",
  Trident: "5 gp",
  "War Pick": "5 gp",
  Warhammer: "15 gp",
  Whip: "2 gp",
  // ── Martial ranged ──
  Blowgun: "10 gp",
  "Hand Crossbow": "75 gp",
  "Heavy Crossbow": "50 gp",
  Longbow: "50 gp",
  Net: "1 gp",
  // ── Light armor ──
  Padded: "5 gp",
  Leather: "10 gp",
  "Studded Leather": "45 gp",
  // ── Medium armor ──
  Hide: "10 gp",
  "Chain Shirt": "50 gp",
  "Scale Mail": "50 gp",
  Breastplate: "400 gp",
  "Half Plate": "750 gp",
  // ── Heavy armor ──
  "Ring Mail": "30 gp",
  "Chain Mail": "75 gp",
  Splint: "200 gp",
  Plate: "1,500 gp",
  // ── Shield ──
  Shield: "10 gp",
}

// Lowercase, drop punctuation, sort the words — so word order and commas in the
// source name don't matter for the match.
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ")
}

const BY_NORM = new Map<string, string>()
for (const [name, cost] of Object.entries(COSTS)) BY_NORM.set(normalize(name), cost)

/** Curated SRD list price for a weapon/armor by name, or undefined if unknown. */
export function srdItemCost(name: string): string | undefined {
  if (!name) return undefined
  return BY_NORM.get(normalize(name))
}
