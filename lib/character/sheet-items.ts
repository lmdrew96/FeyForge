/**
 * Sheet inventory + attacks: storage↔model mapping and the combat-math wiring.
 *
 * The character sheet stores items as `characterProperties` rows
 * (`{ type:"item", name, equipped, data:{...} }`), but the calculators in
 * ./calculations expect a FLAT ItemProperty/WeaponProperty/ArmorProperty with
 * category/baseAC/damageDice/etc. at the top level. This module bridges the two
 * and exposes the AC + attack/damage helpers the sheet wires its buttons to.
 *
 * Kept Convex-free (generic row type) so it stays pure domain like the rest of
 * lib/character/ — the sheet passes Convex docs, which structurally satisfy it.
 */

import type { AbilityScores, Character, ItemProperty, Modifier } from "./types"
import type { ArmorCategory, DamageType } from "./constants"
import type { AppliedGrants } from "./feats"
import {
  calculateArmorClass,
  calculateAttackBonus,
  calculateDamageBonus,
} from "./calculations"

// ── Categories ────────────────────────────────────────────────────────────────

export type ItemCategory = ItemProperty["category"]

export const ITEM_CATEGORIES: ItemCategory[] = [
  "weapon",
  "armor",
  "gear",
  "magic",
  "consumable",
  "treasure",
  "tool",
]

// Non weapon/armor categories the generic "gear" form lets you pick from.
export const GEAR_CATEGORIES: ItemCategory[] = [
  "gear",
  "magic",
  "consumable",
  "treasure",
  "tool",
]

// 5e weapon property tags the weapon form offers. finesse/thrown/ammunition
// drive the attack-ability math; the rest are descriptive.
export const WEAPON_PROPERTY_OPTIONS = [
  "finesse",
  "thrown",
  "versatile",
  "ammunition",
  "light",
  "heavy",
  "two-handed",
  "reach",
  "loading",
  "special",
] as const

export const ARMOR_CATEGORY_OPTIONS: ArmorCategory[] = [
  "light",
  "medium",
  "heavy",
  "shield",
]

// ── Stored shape ──────────────────────────────────────────────────────────────

// The blob we keep in `characterProperties.data` for an item. Type-specific
// weapon/armor fields live here; the row's top-level name/active/equipped carry
// the rest.
export interface StoredItemData {
  category: ItemCategory
  quantity?: number
  weight?: number
  rarity?: ItemProperty["rarity"]
  description?: string

  // Weapon
  weaponType?: "simple" | "martial"
  damageDice?: string
  damageType?: DamageType
  versatileDamage?: string
  range?: { normal: number; long?: number }
  properties?: string[]
  melee?: boolean
  proficient?: boolean
  magicBonus?: number

  // Armor
  armorCategory?: ArmorCategory
  baseAC?: number
  strengthRequirement?: number
  stealthDisadvantage?: boolean

  // Equipped magic-item bonuses (AC, stats, …); read by the calculators.
  modifiers?: Modifier[]

  // Attunement (5e: 3 attuned items max). A magic item that requiresAttunement
  // confers its `grants` only while `attuned`. Grants are baked into the
  // character doc on attune (applyGrants) and reversed on unattune/delete —
  // equip-independent, unlike the live AC-modifier path.
  requiresAttunement?: boolean
  attuned?: boolean
  grants?: AppliedGrants
}

// A characterProperties row, generically typed so this module needn't import
// Convex generated types. Convex Docs structurally satisfy it.
export interface ItemRow {
  _id: string
  name: string
  active: boolean
  equipped?: boolean
  data: unknown
}

// A flat item the calculators understand, plus the row id and the weapon/armor
// fields hoisted to the top level for the UI.
export type SheetItem = ItemProperty & {
  id: string
  weaponType?: "simple" | "martial"
  damageDice?: string
  damageType?: DamageType
  versatileDamage?: string
  range?: { normal: number; long?: number }
  melee?: boolean
  proficient?: boolean
  magicBonus?: number
  armorCategory?: ArmorCategory
  baseAC?: number
  strengthRequirement?: number
  stealthDisadvantage?: boolean
  requiresAttunement?: boolean
  attuned?: boolean
  grants?: AppliedGrants
}

// ── Mapper ────────────────────────────────────────────────────────────────────

// Convex row → flat SheetItem. Spread `data` FIRST so the defaults below always
// win: getAllModifiers() does `push(...item.modifiers)` on every equipped item,
// so a stored `modifiers: undefined` must resolve to [] or AC math throws. Same
// guard for properties[]/category/quantity/weight.
export function rowToItem(row: ItemRow): SheetItem {
  const data = (row.data ?? {}) as StoredItemData
  return {
    ...data,
    id: row._id,
    type: "item",
    name: row.name,
    active: row.active,
    equipped: row.equipped ?? false,
    category: data.category ?? "gear",
    quantity: data.quantity ?? 1,
    weight: data.weight ?? 0,
    modifiers: data.modifiers ?? [],
    properties: data.properties ?? [],
    requiresAttunement: data.requiresAttunement,
    attuned: data.attuned ?? false,
    grants: data.grants,
  } as unknown as SheetItem
}

// Inverse of rowToItem: rebuild the `characterProperties.data` blob from a flat
// SheetItem, dropping the row-level fields (id/type/name/active/equipped) so they
// never leak into data. Needed because updateProperty patches `data` as a whole
// object (no deep merge) — a partial { quantity } would clobber the rest. Callers
// spread this and override the field they're changing.
export function itemToStoredData(item: SheetItem): StoredItemData {
  const data: Record<string, unknown> = { ...(item as unknown as Record<string, unknown>) }
  delete data.id
  delete data.type
  delete data.name
  delete data.active
  delete data.equipped
  return data as unknown as StoredItemData
}

// ── Armor class ───────────────────────────────────────────────────────────────

// Real AC from equipped armor/shield + modifiers (replaces the old 10+DEX stub).
// Returns 10+DEX when nothing is equipped, so it's always safe to call.
// IMPORTANT: pass raw ability SCORES here, not modifiers — calculateArmorClass
// derives the DEX modifier itself.
// The Defense fighting style adds +1 AC while wearing armor (a shield alone
// doesn't count — RAW requires armor); pass the character's chosen style id.
export function computeArmorClass(
  level: number,
  abilities: AbilityScores,
  items: SheetItem[],
  fightingStyleId?: string,
  draconicResilience?: boolean,
): number {
  const base = calculateArmorClass(
    { level, properties: items } as unknown as Character,
    abilities,
  )
  const defenseBonus = fightingStyleId === "defense" && equippedArmor(items) ? 1 : 0
  // Draconic Resilience: while not wearing armor, AC is 13 + Dex instead of the
  // 10 + Dex unarmored default (a flat +3). A shield still stacks (it's already
  // counted in `base`); body armor overrides it, so only apply when unarmored.
  const draconicBonus = draconicResilience && !equippedArmor(items) ? 3 : 0
  return base + defenseBonus + draconicBonus
}

// The equipped body armor (not a shield), for labelling the AC box.
export function equippedArmor(items: SheetItem[]): SheetItem | undefined {
  return items.find(
    (i) =>
      i.equipped &&
      i.active &&
      i.category === "armor" &&
      i.armorCategory !== "shield",
  )
}

// ── Attacks ───────────────────────────────────────────────────────────────────

export interface WeaponAttack {
  id: string
  name: string
  attackBonus: number
  damageExpr: string // e.g. "1d8+3" (or "1d8" when the bonus is 0)
  versatileExpr?: string // two-handed option for versatile weapons
  damageType?: DamageType
  isMelee: boolean
  isProficient: boolean
}

// Fuzzy weapon-proficiency match: explicit weapon name, or the simple/martial
// category, against the character's weaponProficiencies list.
export function isProficientWithWeapon(
  weaponProficiencies: string[],
  item: SheetItem,
): boolean {
  const profs = weaponProficiencies.map((p) => p.toLowerCase().trim())
  const name = item.name.toLowerCase().trim()
  if (profs.some((p) => p === name || name.includes(p) || p.includes(name))) {
    return true
  }
  if (item.weaponType === "simple" && profs.some((p) => p.includes("simple"))) {
    return true
  }
  if (item.weaponType === "martial" && profs.some((p) => p.includes("martial"))) {
    return true
  }
  return false
}

// Derive the to-hit bonus + damage expression(s) for an equipped weapon.
// IMPORTANT: pass raw ability SCORES — the calculators derive modifiers.
// Fighting styles wired here:
//   Archery → +2 to ranged weapon attack rolls.
//   Dueling → +2 to damage with a one-handed melee weapon when it's the only
//     weapon wielded. Pass `isOnlyWeapon` (true when exactly one weapon is
//     equipped — a shield doesn't count, it's armor). RAW it requires one hand,
//     so it boosts the one-handed damage expr only, never the versatile
//     (two-handed) expr, and never a weapon with the two-handed property.
// Pass the character's chosen style id to enable either.
export function weaponAttackInfo(
  level: number,
  weaponProficiencies: string[],
  abilities: AbilityScores,
  item: SheetItem,
  fightingStyleId?: string,
  isOnlyWeapon?: boolean,
): WeaponAttack {
  const props = item.properties ?? []
  // Ranged weapons (ammunition) use DEX; everything else (incl. thrown melee)
  // uses STR, unless finesse — which the calculators resolve to max(STR,DEX).
  const isMelee = item.melee ?? !props.includes("ammunition")
  const isProficient =
    item.proficient ?? isProficientWithWeapon(weaponProficiencies, item)
  const magic = item.magicBonus ?? 0
  const archeryBonus = fightingStyleId === "archery" && !isMelee ? 2 : 0

  const attackBonus =
    calculateAttackBonus(
      { level } as unknown as Character,
      abilities,
      props,
      isProficient,
      isMelee,
    ) + magic + archeryBonus
  const damageBonus = calculateDamageBonus(abilities, props, isMelee) + magic

  // Dueling: +2 damage to a one-handed melee weapon used alone. A two-handed
  // weapon can't be wielded one-handed, so it never qualifies — and the bonus
  // applies to the one-handed damage only, not the versatile two-handed expr.
  const duelingApplies =
    fightingStyleId === "dueling" &&
    isMelee &&
    !!isOnlyWeapon &&
    !props.includes("two-handed")
  const duelingBonus = duelingApplies ? 2 : 0

  const expr = (dice: string | undefined, bonus: number): string => {
    if (!dice) return ""
    if (bonus === 0) return dice
    return `${dice}${bonus >= 0 ? "+" : "-"}${Math.abs(bonus)}`
  }

  return {
    id: item.id,
    name: item.name,
    attackBonus,
    damageExpr: expr(item.damageDice, damageBonus + duelingBonus),
    versatileExpr: item.versatileDamage
      ? expr(item.versatileDamage, damageBonus)
      : undefined,
    damageType: item.damageType,
    isMelee,
    isProficient,
  }
}
