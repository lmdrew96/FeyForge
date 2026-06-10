// Starting equipment + wealth for character creation. Each class gets a curated
// default equipment package (the standard "(a)" option of its 2014 SRD choices)
// OR a fixed starting-gold amount instead — the player decides at creation. The
// background always contributes its own gear/gold on top.
//
// Item stat blocks (weapon damage, armor AC) are curated inline so granted gear
// works immediately on the sheet (weapons feed Attacks, armor sets AC). Numbers
// and item names are facts, not copyrightable expression. Gold values are the
// AVERAGE of each class's starting-wealth dice (e.g. 5d4×10 → 125), so creation
// is deterministic.

import type { StoredItemData } from "./sheet-items"
import type { DamageType, ArmorCategory } from "./constants"
import { parseCost } from "./srd-item-costs"

export type StartingChoice = "equipment" | "gold"

// SRD weight (lb) + list price for the items the packages below grant, pulled from
// Open5e /v2/items (the source of truth, same data the picker enriches from) and
// baked so creation never depends on a network call. Keyed by the exact names used
// in the constructors. Ammunition is PER-UNIT (bundle ÷ 20) so encumbrance
// (weight × quantity) totals correctly and the per-arrow price stays whole (5 cp).
const ITEM_STATS: Record<string, { weight: number; cost: string }> = {
  // Weapons
  Greataxe: { weight: 7, cost: "30 gp" },
  Handaxe: { weight: 2, cost: "5 gp" },
  Javelin: { weight: 2, cost: "5 sp" },
  Rapier: { weight: 2, cost: "25 gp" },
  Dagger: { weight: 1, cost: "2 gp" },
  Mace: { weight: 4, cost: "5 gp" },
  "Light Crossbow": { weight: 5, cost: "25 gp" },
  Scimitar: { weight: 3, cost: "25 gp" },
  Longsword: { weight: 3, cost: "15 gp" },
  Shortsword: { weight: 2, cost: "10 gp" },
  Dart: { weight: 0.25, cost: "5 cp" },
  Longbow: { weight: 2, cost: "50 gp" },
  Shortbow: { weight: 2, cost: "25 gp" },
  Quarterstaff: { weight: 4, cost: "2 sp" },
  // Armor (Wooden Shield is a reskinned Shield)
  "Leather Armor": { weight: 10, cost: "10 gp" },
  "Scale Mail": { weight: 45, cost: "50 gp" },
  "Chain Mail": { weight: 55, cost: "75 gp" },
  Shield: { weight: 6, cost: "10 gp" },
  "Wooden Shield": { weight: 6, cost: "10 gp" },
  // Packs (whole-pack weight + price; Unpack explodes them on the sheet)
  "Explorer's Pack": { weight: 55, cost: "10 gp" },
  "Entertainer's Pack": { weight: 58, cost: "40 gp" },
  "Priest's Pack": { weight: 29, cost: "33 gp" },
  "Dungeoneer's Pack": { weight: 55, cost: "12 gp" },
  "Burglar's Pack": { weight: 42, cost: "16 gp" },
  "Scholar's Pack": { weight: 22, cost: "40 gp" },
  // Gear, foci, tools
  Lute: { weight: 2, cost: "35 gp" },
  "Holy Symbol": { weight: 1, cost: "5 gp" },
  "Druidic Focus": { weight: 1, cost: "10 gp" },
  "Component Pouch": { weight: 2, cost: "25 gp" },
  Spellbook: { weight: 3, cost: "50 gp" },
  "Thieves' Tools": { weight: 1, cost: "25 gp" },
  // Ammunition — per-unit (20-count bundle): 1 lb / 1 gp arrows, 1.5 lb / 1 gp bolts
  Arrows: { weight: 0.05, cost: "5 cp" },
  "Crossbow Bolts": { weight: 0.075, cost: "5 cp" },
}

// Weight + structured cost for a starting item by name, or {} if uncurated (e.g.
// free-form background gear), so the constructors can spread it into the data blob.
function statData(name: string): Partial<StoredItemData> {
  const s = ITEM_STATS[name]
  if (!s) return {}
  const cost = parseCost(s.cost)
  return { weight: s.weight, ...(cost ? { cost } : {}) }
}

export interface StartingItem {
  name: string
  equipped?: boolean
  data: StoredItemData
}

// ── Item constructors (keep the packages terse + consistent) ────────────────

function weapon(
  name: string,
  weaponType: "simple" | "martial",
  damageDice: string,
  damageType: DamageType,
  opts: { properties?: string[]; melee?: boolean; range?: { normal: number; long?: number }; versatile?: string; quantity?: number } = {},
): StartingItem {
  return {
    name,
    equipped: false, // which weapon to wield is the player's call — equip on the sheet
    data: {
      category: "weapon",
      ...statData(name),
      weaponType,
      damageDice,
      damageType,
      melee: opts.melee ?? true,
      properties: opts.properties ?? [],
      ...(opts.range ? { range: opts.range } : {}),
      ...(opts.versatile ? { versatileDamage: opts.versatile } : {}),
      ...(opts.quantity ? { quantity: opts.quantity } : {}),
    },
  }
}

function armor(
  name: string,
  armorCategory: ArmorCategory,
  baseAC: number,
  opts: { stealthDisadvantage?: boolean; strengthRequirement?: number } = {},
): StartingItem {
  return {
    name,
    equipped: true, // one body armor / one shield — unambiguous, so equip for live AC
    data: {
      category: "armor",
      ...statData(name),
      armorCategory,
      baseAC,
      ...(opts.stealthDisadvantage ? { stealthDisadvantage: true } : {}),
      ...(opts.strengthRequirement ? { strengthRequirement: opts.strengthRequirement } : {}),
    },
  }
}

function gear(name: string, opts: { quantity?: number; tool?: boolean } = {}): StartingItem {
  return {
    name,
    equipped: false,
    data: {
      category: opts.tool ? "tool" : "gear",
      ...statData(name),
      ...(opts.quantity ? { quantity: opts.quantity } : {}),
    },
  }
}

// ── Per-class starting packages + wealth ────────────────────────────────────

interface ClassStarting {
  gold: number // average starting wealth (gp) if taking gold instead of equipment
  equipment: StartingItem[]
}

export const CLASS_STARTING: Record<string, ClassStarting> = {
  barbarian: {
    gold: 50, // 2d4×10
    equipment: [
      weapon("Greataxe", "martial", "1d12", "slashing", { properties: ["Heavy", "Two-handed"] }),
      weapon("Handaxe", "simple", "1d6", "slashing", { properties: ["Light", "Thrown"], range: { normal: 20, long: 60 }, quantity: 2 }),
      weapon("Javelin", "simple", "1d6", "piercing", { properties: ["Thrown"], range: { normal: 30, long: 120 }, quantity: 4 }),
      gear("Explorer's Pack"),
    ],
  },
  bard: {
    gold: 125, // 5d4×10
    equipment: [
      weapon("Rapier", "martial", "1d8", "piercing", { properties: ["Finesse"] }),
      weapon("Dagger", "simple", "1d4", "piercing", { properties: ["Finesse", "Light", "Thrown"], range: { normal: 20, long: 60 } }),
      armor("Leather Armor", "light", 11),
      gear("Lute"),
      gear("Entertainer's Pack"),
    ],
  },
  cleric: {
    gold: 125,
    equipment: [
      weapon("Mace", "simple", "1d6", "bludgeoning"),
      armor("Scale Mail", "medium", 14, { stealthDisadvantage: true }),
      armor("Shield", "shield", 2),
      weapon("Light Crossbow", "simple", "1d8", "piercing", { properties: ["Ammunition", "Loading", "Two-handed"], melee: false, range: { normal: 80, long: 320 } }),
      gear("Crossbow Bolts", { quantity: 20 }),
      gear("Holy Symbol"),
      gear("Priest's Pack"),
    ],
  },
  druid: {
    gold: 50,
    equipment: [
      armor("Wooden Shield", "shield", 2),
      weapon("Scimitar", "martial", "1d6", "slashing", { properties: ["Finesse", "Light"] }),
      armor("Leather Armor", "light", 11),
      gear("Druidic Focus"),
      gear("Explorer's Pack"),
    ],
  },
  fighter: {
    gold: 125,
    equipment: [
      armor("Chain Mail", "heavy", 16, { stealthDisadvantage: true, strengthRequirement: 13 }),
      weapon("Longsword", "martial", "1d8", "slashing", { versatile: "1d10" }),
      armor("Shield", "shield", 2),
      weapon("Light Crossbow", "simple", "1d8", "piercing", { properties: ["Ammunition", "Loading", "Two-handed"], melee: false, range: { normal: 80, long: 320 } }),
      gear("Crossbow Bolts", { quantity: 20 }),
      gear("Dungeoneer's Pack"),
    ],
  },
  monk: {
    gold: 13, // 5d4
    equipment: [
      weapon("Shortsword", "martial", "1d6", "piercing", { properties: ["Finesse", "Light"] }),
      weapon("Dart", "simple", "1d4", "piercing", { properties: ["Finesse", "Thrown"], melee: false, range: { normal: 20, long: 60 }, quantity: 10 }),
      gear("Dungeoneer's Pack"),
    ],
  },
  paladin: {
    gold: 125,
    equipment: [
      weapon("Longsword", "martial", "1d8", "slashing", { versatile: "1d10" }),
      armor("Shield", "shield", 2),
      weapon("Javelin", "simple", "1d6", "piercing", { properties: ["Thrown"], range: { normal: 30, long: 120 }, quantity: 5 }),
      armor("Chain Mail", "heavy", 16, { stealthDisadvantage: true, strengthRequirement: 13 }),
      gear("Holy Symbol"),
      gear("Priest's Pack"),
    ],
  },
  ranger: {
    gold: 125,
    equipment: [
      armor("Scale Mail", "medium", 14, { stealthDisadvantage: true }),
      weapon("Shortsword", "martial", "1d6", "piercing", { properties: ["Finesse", "Light"], quantity: 2 }),
      weapon("Longbow", "martial", "1d8", "piercing", { properties: ["Ammunition", "Heavy", "Two-handed"], melee: false, range: { normal: 150, long: 600 } }),
      gear("Arrows", { quantity: 20 }),
      gear("Dungeoneer's Pack"),
    ],
  },
  rogue: {
    gold: 100, // 4d4×10
    equipment: [
      weapon("Rapier", "martial", "1d8", "piercing", { properties: ["Finesse"] }),
      weapon("Shortbow", "simple", "1d6", "piercing", { properties: ["Ammunition", "Two-handed"], melee: false, range: { normal: 80, long: 320 } }),
      gear("Arrows", { quantity: 20 }),
      armor("Leather Armor", "light", 11),
      weapon("Dagger", "simple", "1d4", "piercing", { properties: ["Finesse", "Light", "Thrown"], range: { normal: 20, long: 60 }, quantity: 2 }),
      gear("Thieves' Tools", { tool: true }),
      gear("Burglar's Pack"),
    ],
  },
  sorcerer: {
    gold: 75, // 3d4×10
    equipment: [
      weapon("Light Crossbow", "simple", "1d8", "piercing", { properties: ["Ammunition", "Loading", "Two-handed"], melee: false, range: { normal: 80, long: 320 } }),
      gear("Crossbow Bolts", { quantity: 20 }),
      gear("Component Pouch"),
      weapon("Dagger", "simple", "1d4", "piercing", { properties: ["Finesse", "Light", "Thrown"], range: { normal: 20, long: 60 }, quantity: 2 }),
      gear("Dungeoneer's Pack"),
    ],
  },
  warlock: {
    gold: 100,
    equipment: [
      weapon("Light Crossbow", "simple", "1d8", "piercing", { properties: ["Ammunition", "Loading", "Two-handed"], melee: false, range: { normal: 80, long: 320 } }),
      gear("Crossbow Bolts", { quantity: 20 }),
      gear("Component Pouch"),
      armor("Leather Armor", "light", 11),
      weapon("Dagger", "simple", "1d4", "piercing", { properties: ["Finesse", "Light", "Thrown"], range: { normal: 20, long: 60 }, quantity: 2 }),
      gear("Scholar's Pack"),
    ],
  },
  wizard: {
    gold: 100,
    equipment: [
      weapon("Quarterstaff", "simple", "1d6", "bludgeoning", { versatile: "1d8" }),
      gear("Component Pouch"),
      gear("Spellbook"),
      gear("Scholar's Pack"),
    ],
  },
}

// ── Background gear/gold parsing ────────────────────────────────────────────

// Background equipment is a flat string list (character-data.ts). Pull out coin
// ("15 gp", "Purse with 25 gp") into gold; everything else becomes a gear item.
export function parseBackgroundEquipment(equipment: string[] | undefined): { items: StartingItem[]; gold: number } {
  let gold = 0
  const items: StartingItem[] = []
  for (const entry of equipment ?? []) {
    const gp = entry.match(/(\d+)\s*gp\b/i)
    if (gp) {
      gold += parseInt(gp[1], 10)
      // A bare "15 gp" is just coin; a "Pouch with 10 gp" keeps the container.
      const container = entry.replace(/\bwith\b.*$/i, "").replace(/\d+\s*gp\b/i, "").trim()
      if (container && !/^(a|an|the)?\s*$/i.test(container)) items.push(gear(container))
      continue
    }
    items.push(gear(entry))
  }
  return { items, gold }
}

// ── Resolver ────────────────────────────────────────────────────────────────

// Resolve a character's full starting loadout. `equipment` → class package +
// background gear; `gold` → class starting gold + background gear/gold. Unknown
// (homebrew) classes have no package, so they get background gear only.
// A weapon granted as a pair (quantity 2 — two shortswords, two handaxes, two
// daggers) must become two discrete rows. A single quantity-2 row carries one
// Equip toggle, so only one of the pair could ever be wielded — dual-wielding
// (two attacks) was impossible. Split exactly-2 weapon stacks into separate
// equippable rows; leave 3+ alone (javelins/darts are thrown ammo — a counted
// stack with one attack entry, not weapons you wield two-at-a-time).
export function explodeWeaponPairs(items: StartingItem[]): StartingItem[] {
  return items.flatMap((it) => {
    if (it.data.category !== "weapon" || it.data.quantity !== 2) return [it]
    const single = { ...it.data }
    delete single.quantity
    return [
      { ...it, data: single },
      { ...it, data: { ...single } },
    ]
  })
}

export function getStartingLoadout(
  classId: string,
  backgroundEquipment: string[] | undefined,
  choice: StartingChoice,
): { items: StartingItem[]; gold: number } {
  const pkg = CLASS_STARTING[classId]
  const bg = parseBackgroundEquipment(backgroundEquipment)
  if (!pkg) return { items: explodeWeaponPairs(bg.items), gold: bg.gold }
  if (choice === "gold") return { items: explodeWeaponPairs(bg.items), gold: bg.gold + pkg.gold }
  return { items: explodeWeaponPairs([...pkg.equipment, ...bg.items]), gold: bg.gold }
}

export function startingGoldFor(classId: string): number {
  return CLASS_STARTING[classId]?.gold ?? 0
}

export function hasStartingPackage(classId: string): boolean {
  return !!CLASS_STARTING[classId]
}
