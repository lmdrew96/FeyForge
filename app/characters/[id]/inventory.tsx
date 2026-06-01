"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import { Plus, Trash2, Pencil, Sword, Shield, Package, X, Zap, Check, Search } from "lucide-react"
import { DAMAGE_TYPES, type DamageType } from "@/lib/character/constants"
import type { AbilityScores } from "@/lib/character/types"
import { parseDiceExpression } from "@/lib/dice-store"
import {
  open5eApi,
  type Open5eWeapon,
  type Open5eArmor,
  type Open5eMagicItem,
} from "@/lib/open5e-api"
import {
  ARMOR_CATEGORY_OPTIONS,
  GEAR_CATEGORIES,
  WEAPON_PROPERTY_OPTIONS,
  weaponAttackInfo,
  type ItemCategory,
  type SheetItem,
  type StoredItemData,
} from "@/lib/character/sheet-items"

// The sheet's roll helpers, passed down from the page's useSheetRoll().
export type SheetRollFn = (label: string, mod: number) => void
export type SheetRollExprFn = (
  label: string,
  expression: string,
  opts?: { crit?: boolean },
) => void

const fmtMod = (n: number) => (n >= 0 ? `+${n}` : `${n}`)

const CATEGORY_ICON: Record<ItemCategory, typeof Package> = {
  weapon: Sword,
  armor: Shield,
  gear: Package,
  magic: Zap,
  consumable: Package,
  treasure: Package,
  tool: Package,
}

const CATEGORY_LABEL: Record<ItemCategory, string> = {
  weapon: "Weapons",
  armor: "Armor",
  gear: "Gear",
  magic: "Magic Items",
  consumable: "Consumables",
  treasure: "Treasure",
  tool: "Tools",
}

const GROUP_ORDER: ItemCategory[] = [
  "weapon",
  "armor",
  "magic",
  "gear",
  "tool",
  "consumable",
  "treasure",
]

// ── Attacks ───────────────────────────────────────────────────────────────────

// Derived from equipped weapons. Tapping the weapon rolls 1d20 + to-hit through
// the sheet's adv/dis-aware roller; tapping damage rolls the weapon dice + ability
// mod. A one-shot crit toggle doubles the damage dice on the next damage roll.
export function AttacksSection({
  level,
  weaponProficiencies,
  abilities,
  weapons,
  roll,
  rollExpr,
}: {
  level: number
  weaponProficiencies: string[]
  abilities: AbilityScores
  weapons: SheetItem[]
  roll: SheetRollFn
  rollExpr: SheetRollExprFn
}) {
  const [crit, setCrit] = useState(false)

  const attacks = useMemo(
    () =>
      weapons.map((w) =>
        weaponAttackInfo(level, weaponProficiencies, abilities, w),
      ),
    [weapons, level, weaponProficiencies, abilities],
  )

  const rollDamage = (label: string, expr: string) => {
    rollExpr(label, expr, { crit })
    if (crit) setCrit(false)
  }

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2
          className="text-xs uppercase tracking-widest"
          style={{ color: "var(--scene-text-muted)" }}
        >
          Attacks
        </h2>
        {attacks.length > 0 && (
          <button
            onClick={() => setCrit((c) => !c)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
            style={{
              background: crit
                ? "var(--scene-accent)"
                : "var(--scene-surface)",
              color: crit ? "var(--scene-bg)" : "var(--scene-text-muted)",
              border: "1px solid var(--scene-border)",
            }}
            title="When on, your next damage roll doubles its dice (critical hit)"
          >
            <Zap className="h-3.5 w-3.5" />
            {crit ? "Crit armed" : "Crit"}
          </button>
        )}
      </div>

      {attacks.length === 0 ? (
        <div
          className="rounded-xl p-4 text-sm"
          style={{
            background: "var(--scene-surface)",
            border: "1px solid var(--scene-border)",
            color: "var(--scene-text-muted)",
          }}
        >
          Equip a weapon from your inventory below to make attacks.
        </div>
      ) : (
        <div className="space-y-2">
          {attacks.map((atk) => {
            const versatile = atk.versatileExpr
            return (
            <div
              key={atk.id}
              className="rounded-xl p-3 flex flex-wrap items-center gap-2"
              style={{
                background: "var(--scene-surface)",
                border: "1px solid var(--scene-border)",
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="text-sm font-medium truncate"
                    style={{ color: "var(--scene-text-primary)" }}
                  >
                    {atk.name}
                  </span>
                  {!atk.isProficient && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{
                        background: "var(--scene-border)",
                        color: "var(--scene-text-muted)",
                      }}
                      title="Not proficient — no proficiency bonus to hit"
                    >
                      no prof
                    </span>
                  )}
                </div>
                <span
                  className="text-xs"
                  style={{ color: "var(--scene-text-muted)" }}
                >
                  {atk.isMelee ? "Melee" : "Ranged"}
                  {atk.damageType ? ` · ${atk.damageType}` : ""}
                </span>
              </div>

              <button
                onClick={() => roll(`${atk.name} attack`, atk.attackBonus)}
                className="px-3 py-1.5 rounded-md text-sm font-semibold transition-transform active:scale-95 hover:opacity-90"
                style={{
                  background:
                    "color-mix(in srgb, var(--scene-accent) 14%, transparent)",
                  color: "var(--scene-accent)",
                  border:
                    "1px solid color-mix(in srgb, var(--scene-accent) 32%, transparent)",
                }}
                title="Roll to hit (honors the adv/dis toggle)"
              >
                {fmtMod(atk.attackBonus)} hit
              </button>

              <button
                onClick={() => rollDamage(`${atk.name} damage`, atk.damageExpr)}
                disabled={!atk.damageExpr}
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-transform active:scale-95 hover:opacity-90 disabled:opacity-40"
                style={{
                  background: "var(--scene-border)",
                  color: "var(--scene-text-primary)",
                }}
                title="Roll damage"
              >
                {atk.damageExpr || "—"}
              </button>

              {versatile && (
                <button
                  onClick={() =>
                    rollDamage(`${atk.name} damage (2H)`, versatile)
                  }
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition-transform active:scale-95 hover:opacity-90"
                  style={{
                    background: "var(--scene-border)",
                    color: "var(--scene-text-primary)",
                  }}
                  title="Two-handed (versatile) damage"
                >
                  2H {versatile}
                </button>
              )}
            </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

// ── Inventory ─────────────────────────────────────────────────────────────────

export function InventorySection({
  characterId,
  items,
  nextOrder,
}: {
  characterId: Id<"characters">
  items: SheetItem[]
  nextOrder: number
}) {
  const updateProperty = useMutation(api.characters.updateProperty)
  const removeProperty = useMutation(api.characters.removeProperty)

  const [editing, setEditing] = useState<SheetItem | null>(null)
  const [adding, setAdding] = useState(false)

  const groups = useMemo(() => {
    const byCat = new Map<ItemCategory, SheetItem[]>()
    for (const item of items) {
      const cat = item.category as ItemCategory
      const list = byCat.get(cat) ?? []
      list.push(item)
      byCat.set(cat, list)
    }
    return GROUP_ORDER.flatMap((c) => {
      const groupItems = byCat.get(c)
      return groupItems ? [{ category: c, items: groupItems }] : []
    })
  }, [items])

  const toggleEquip = async (item: SheetItem) => {
    try {
      await updateProperty({
        id: item.id as Id<"characterProperties">,
        equipped: !item.equipped,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update item.")
    }
  }

  const handleRemove = async (item: SheetItem) => {
    try {
      await removeProperty({ id: item.id as Id<"characterProperties"> })
      toast.success("Item removed.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove item.")
    }
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2
          className="text-xs uppercase tracking-widest"
          style={{ color: "var(--scene-text-muted)" }}
        >
          Inventory
        </h2>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-opacity hover:opacity-80"
          style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
        >
          <Plus className="h-4 w-4" /> Add item
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
          No items yet. Add weapons, armor, and gear — equipped weapons become
          attacks and equipped armor sets your AC.
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map(({ category, items: groupItems }) => {
            const Icon = CATEGORY_ICON[category]
            const equippable = category === "weapon" || category === "armor"
            return (
              <div key={category}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Icon
                    className="h-3.5 w-3.5"
                    style={{ color: "var(--scene-text-muted)" }}
                  />
                  <span
                    className="text-xs uppercase tracking-widest"
                    style={{ color: "var(--scene-text-muted)" }}
                  >
                    {CATEGORY_LABEL[category]}
                  </span>
                </div>
                <div
                  className="rounded-xl overflow-hidden"
                  style={{
                    background: "var(--scene-surface)",
                    border: "1px solid var(--scene-border)",
                  }}
                >
                  {groupItems.map((item, i) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 px-3 py-2.5"
                      style={{
                        borderBottom:
                          i < groupItems.length - 1
                            ? "1px solid var(--scene-border)"
                            : "none",
                        opacity: item.active ? 1 : 0.55,
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-sm font-medium truncate"
                            style={{ color: "var(--scene-text-primary)" }}
                          >
                            {item.name}
                          </span>
                          {(item.quantity ?? 1) > 1 && (
                            <span
                              className="text-xs tabular-nums"
                              style={{ color: "var(--scene-text-muted)" }}
                            >
                              ×{item.quantity}
                            </span>
                          )}
                        </div>
                        <span
                          className="text-xs"
                          style={{ color: "var(--scene-text-muted)" }}
                        >
                          {itemSubtitle(item)}
                        </span>
                      </div>

                      {equippable && (
                        <button
                          onClick={() => toggleEquip(item)}
                          className="text-[10px] px-2 py-1 rounded-md transition-opacity hover:opacity-80 flex-shrink-0"
                          style={{
                            background: item.equipped
                              ? "color-mix(in srgb, var(--scene-accent) 16%, transparent)"
                              : "var(--scene-border)",
                            color: item.equipped
                              ? "var(--scene-accent)"
                              : "var(--scene-text-muted)",
                          }}
                          title={
                            item.equipped
                              ? "Equipped — click to unequip"
                              : "Click to equip"
                          }
                        >
                          {item.equipped ? "Equipped" : "Equip"}
                        </button>
                      )}

                      <button
                        onClick={() => setEditing(item)}
                        className="p-1.5 rounded transition-opacity hover:opacity-80 flex-shrink-0"
                        style={{ color: "var(--scene-text-muted)" }}
                        title="Edit item"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleRemove(item)}
                        className="p-1.5 rounded transition-opacity hover:opacity-80 flex-shrink-0"
                        style={{ color: "var(--scene-text-muted)" }}
                        title="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {(adding || editing) && (
        <ItemEditorDialog
          characterId={characterId}
          item={editing}
          nextOrder={nextOrder}
          onClose={() => {
            setAdding(false)
            setEditing(null)
          }}
        />
      )}
    </section>
  )
}

// One-line summary under an item name.
function itemSubtitle(item: SheetItem): string {
  const bits: string[] = []
  if (item.category === "weapon") {
    if (item.damageDice) {
      bits.push(`${item.damageDice}${item.damageType ? ` ${item.damageType}` : ""}`)
    }
    if (item.weaponType) bits.push(item.weaponType)
    if (item.magicBonus) bits.push(fmtMod(item.magicBonus))
  } else if (item.category === "armor") {
    if (item.armorCategory === "shield") bits.push(`+${item.baseAC ?? 0} AC`)
    else if (item.baseAC != null) bits.push(`AC ${item.baseAC}`)
    if (item.armorCategory) bits.push(item.armorCategory)
  }
  if ((item.weight ?? 0) > 0) bits.push(`${item.weight} lb`)
  return bits.join(" · ") || "—"
}

// ── Item editor ───────────────────────────────────────────────────────────────

type Kind = "weapon" | "armor" | "gear"

interface FormState {
  kind: Kind
  name: string
  quantity: string
  weight: string
  equipped: boolean
  description: string
  gearCategory: ItemCategory
  // weapon
  weaponType: "simple" | "martial"
  damageDice: string
  damageType: DamageType
  versatileDamage: string
  rangeNormal: string
  rangeLong: string
  melee: boolean
  proficient: boolean
  magicBonus: string
  properties: string[]
  // armor
  armorCategory: "light" | "medium" | "heavy" | "shield"
  baseAC: string
  stealthDisadvantage: boolean
  strengthRequirement: string
}

function initialForm(item: SheetItem | null): FormState {
  const cat = (item?.category ?? "gear") as ItemCategory
  const kind: Kind = cat === "weapon" ? "weapon" : cat === "armor" ? "armor" : "gear"
  return {
    kind,
    name: item?.name ?? "",
    quantity: String(item?.quantity ?? 1),
    weight: String(item?.weight ?? 0),
    equipped: item?.equipped ?? false,
    description: item?.description ?? "",
    gearCategory: kind === "gear" ? cat : "gear",
    weaponType: item?.weaponType ?? "simple",
    damageDice: item?.damageDice ?? "1d6",
    damageType: item?.damageType ?? "slashing",
    versatileDamage: item?.versatileDamage ?? "",
    rangeNormal: item?.range?.normal ? String(item.range.normal) : "",
    rangeLong: item?.range?.long ? String(item.range.long) : "",
    melee: item?.melee ?? true,
    proficient: item?.proficient ?? true,
    magicBonus: String(item?.magicBonus ?? 0),
    properties: item?.properties ?? [],
    armorCategory: item?.armorCategory ?? "light",
    baseAC: item?.baseAC != null ? String(item.baseAC) : "11",
    stealthDisadvantage: item?.stealthDisadvantage ?? false,
    strengthRequirement: item?.strengthRequirement
      ? String(item.strengthRequirement)
      : "",
  }
}

const toInt = (s: string, fallback: number) => {
  const n = Math.floor(Number(s))
  return Number.isFinite(n) ? n : fallback
}
const toNum = (s: string, fallback: number) => {
  const n = Number(s)
  return Number.isFinite(n) ? n : fallback
}

// ── SRD autofill (Open5e) ──────────────────────────────────────────────────────

// Open5e weight strings look like "1 lb." / "1/4 lb." / "" (armor is blank).
function parseWeight(w?: string): number {
  if (!w) return 0
  const m = w.match(/([\d.]+)(?:\s*\/\s*([\d.]+))?/)
  if (!m) return 0
  return m[2] ? Number(m[1]) / Number(m[2]) : Number(m[1]) || 0
}

function normDamageType(dt?: string): DamageType {
  const d = (dt ?? "").toLowerCase()
  return (DAMAGE_TYPES as readonly string[]).includes(d)
    ? (d as DamageType)
    : "slashing"
}

// "Martial Ranged Weapons" → { weaponType, melee }
function parseWeaponCategory(cat: string): {
  weaponType: "simple" | "martial"
  melee: boolean
} {
  const c = (cat ?? "").toLowerCase()
  return {
    weaponType: c.includes("martial") ? "martial" : "simple",
    melee: !c.includes("ranged"),
  }
}

// Open5e properties arrive lowercased with inline detail, e.g.
// ["versatile (1d10)"], ["thrown (range 20/60)"], ["ammunition (range 80/320)"].
function parseWeaponProperties(props: string[]): {
  tags: string[]
  versatileDamage?: string
  range?: { normal: number; long?: number }
} {
  const tags: string[] = []
  let versatileDamage: string | undefined
  let range: { normal: number; long?: number } | undefined
  for (const raw of props) {
    const p = raw.toLowerCase().trim()
    if (p.startsWith("versatile")) {
      tags.push("versatile")
      versatileDamage = raw.match(/\(([^)]+)\)/)?.[1]?.trim()
    } else if (p.startsWith("thrown") || p.startsWith("ammunition")) {
      tags.push(p.startsWith("thrown") ? "thrown" : "ammunition")
      const r = raw.match(/(\d+)\s*\/\s*(\d+)/)
      if (r) range = { normal: Number(r[1]), long: Number(r[2]) }
    } else {
      const known = WEAPON_PROPERTY_OPTIONS.find((o) => o === p)
      if (known) tags.push(known)
    }
  }
  return { tags, versatileDamage, range }
}

function parseArmorCategory(
  cat: string,
): "light" | "medium" | "heavy" | "shield" {
  const c = (cat ?? "").toLowerCase()
  if (c.includes("shield")) return "shield"
  if (c.includes("heavy")) return "heavy"
  if (c.includes("medium")) return "medium"
  return "light"
}

// Body armor ac_string is "11 + Dex modifier (max 2)" / "18" → the leading base.
// A shield's is "0 +2" — the bonus is the "+2", NOT the leading 0.
function parseArmorAC(acString: string, isShield: boolean): number {
  if (isShield) return Number(acString.match(/\+\s*(\d+)/)?.[1] ?? 2)
  return Number(acString?.match(/-?\d+/)?.[0] ?? 10)
}

function weaponPrefill(w: Open5eWeapon): Partial<FormState> {
  const { weaponType, melee } = parseWeaponCategory(w.category)
  const { tags, versatileDamage, range } = parseWeaponProperties(
    w.properties ?? [],
  )
  return {
    kind: "weapon",
    name: w.name,
    weaponType,
    melee,
    damageDice: w.damage_dice || "1d4",
    damageType: normDamageType(w.damage_type),
    properties: tags,
    versatileDamage: versatileDamage ?? "",
    rangeNormal: range?.normal ? String(range.normal) : "",
    rangeLong: range?.long ? String(range.long) : "",
    weight: String(parseWeight(w.weight)),
    proficient: true,
  }
}

function armorPrefill(a: Open5eArmor): Partial<FormState> {
  const cat = parseArmorCategory(a.category)
  return {
    kind: "armor",
    name: a.name,
    armorCategory: cat,
    baseAC: String(parseArmorAC(a.ac_string, cat === "shield")),
    stealthDisadvantage: a.stealth_disadvantage,
    strengthRequirement: a.strength_requirement
      ? (String(a.strength_requirement).match(/\d+/)?.[0] ?? "")
      : "",
    weight: String(parseWeight(a.weight)),
  }
}

function magicPrefill(m: Open5eMagicItem): Partial<FormState> {
  return {
    kind: "gear",
    gearCategory: "magic",
    name: m.name,
    description: [m.rarity, m.type].filter(Boolean).join(" · "),
  }
}

// Searchable SRD picker that autofills the item form. Lists are tiny (37 weapons,
// 18 armor) so we fetch the kind's full SRD set once (Open5e client caches in
// IndexedDB) and filter locally for instant results. Falls back silently to
// manual entry if the API is unreachable.
function SrdSearch({
  kind,
  onPick,
}: {
  kind: Kind
  onPick: (prefill: Partial<FormState>) => void
}) {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const cacheRef = useRef<{
    weapon?: Open5eWeapon[]
    armor?: Open5eArmor[]
    gear?: Open5eMagicItem[]
  }>({})
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (cacheRef.current[kind]) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        if (kind === "weapon") cacheRef.current.weapon = await open5eApi.getWeapons()
        else if (kind === "armor") cacheRef.current.armor = await open5eApi.getArmor()
        else cacheRef.current.gear = await open5eApi.getMagicItems()
        if (!cancelled) setVersion((v) => v + 1)
      } catch {
        // API down — manual entry still works.
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [kind])

  const q = query.trim().toLowerCase()
  const results = useMemo(() => {
    if (!q) return [] as { name: string; hint: string; pick: () => void }[]
    void version // re-run when the cache fills
    if (kind === "weapon") {
      return (cacheRef.current.weapon ?? [])
        .filter((w) => w.name.toLowerCase().includes(q))
        .slice(0, 8)
        .map((w) => ({
          name: w.name,
          hint: `${w.damage_dice} ${w.damage_type}`.trim(),
          pick: () => onPick(weaponPrefill(w)),
        }))
    }
    if (kind === "armor") {
      return (cacheRef.current.armor ?? [])
        .filter((a) => a.name.toLowerCase().includes(q))
        .slice(0, 8)
        .map((a) => ({
          name: a.name,
          hint: a.ac_string,
          pick: () => onPick(armorPrefill(a)),
        }))
    }
    return (cacheRef.current.gear ?? [])
      .filter((m) => m.name.toLowerCase().includes(q))
      .slice(0, 8)
      .map((m) => ({
        name: m.name,
        hint: m.rarity,
        pick: () => onPick(magicPrefill(m)),
      }))
  }, [q, kind, version, onPick])

  const kindLabel =
    kind === "weapon" ? "weapons" : kind === "armor" ? "armor" : "magic items"

  return (
    <div className="mb-4">
      <div className="relative">
        <Search
          className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: "var(--scene-text-muted)" }}
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search SRD ${kindLabel} to autofill…`}
          className="w-full pl-8 pr-3 py-2 rounded-md text-sm bg-transparent outline-none"
          style={{
            border: "1px solid var(--scene-border)",
            color: "var(--scene-text-primary)",
          }}
        />
      </div>
      {query.trim() && (
        <div
          className="mt-1 rounded-md max-h-48 overflow-y-auto"
          style={{
            border: "1px solid var(--scene-border)",
            background: "var(--scene-bg)",
          }}
        >
          {loading && results.length === 0 ? (
            <div
              className="px-3 py-2 text-sm"
              style={{ color: "var(--scene-text-muted)" }}
            >
              Loading SRD {kindLabel}…
            </div>
          ) : results.length === 0 ? (
            <div
              className="px-3 py-2 text-sm"
              style={{ color: "var(--scene-text-muted)" }}
            >
              No matches — fill it in manually below.
            </div>
          ) : (
            results.map((r) => (
              <button
                key={r.name}
                onClick={() => {
                  r.pick()
                  setQuery("")
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-left transition-colors hover:opacity-80"
                style={{ borderBottom: "1px solid var(--scene-border)" }}
              >
                <span
                  className="text-sm flex-1 truncate"
                  style={{ color: "var(--scene-text-primary)" }}
                >
                  {r.name}
                </span>
                {r.hint && (
                  <span
                    className="text-xs capitalize flex-shrink-0"
                    style={{ color: "var(--scene-text-muted)" }}
                  >
                    {r.hint}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function ItemEditorDialog({
  characterId,
  item,
  nextOrder,
  onClose,
}: {
  characterId: Id<"characters">
  item: SheetItem | null
  nextOrder: number
  onClose: () => void
}) {
  const addProperty = useMutation(api.characters.addProperty)
  const updateProperty = useMutation(api.characters.updateProperty)
  const [form, setForm] = useState<FormState>(() => initialForm(item))
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const toggleProperty = (p: string) =>
    setForm((f) => ({
      ...f,
      properties: f.properties.includes(p)
        ? f.properties.filter((x) => x !== p)
        : [...f.properties, p],
    }))

  // Rebuild the FULL data blob — updateProperty replaces `data` wholesale (no
  // deep merge), so a partial would wipe unedited fields.
  const buildData = (): StoredItemData | null => {
    const quantity = Math.max(1, toInt(form.quantity, 1))
    const weight = Math.max(0, toNum(form.weight, 0))
    const description = form.description.trim() || undefined

    if (form.kind === "weapon") {
      const dice = form.damageDice.trim()
      if (!parseDiceExpression(dice)) {
        toast.error("Damage dice must look like 1d8 or 2d6+1.")
        return null
      }
      const hasVersatile = form.properties.includes("versatile")
      const versatile = form.versatileDamage.trim()
      if (hasVersatile && versatile && !parseDiceExpression(versatile)) {
        toast.error("Versatile damage must look like 1d10.")
        return null
      }
      const normal = Math.max(0, toInt(form.rangeNormal, 0))
      const long = Math.max(0, toInt(form.rangeLong, 0))
      const magicBonus = toInt(form.magicBonus, 0)
      return {
        category: "weapon",
        quantity,
        weight,
        description,
        weaponType: form.weaponType,
        damageDice: dice,
        damageType: form.damageType,
        properties: form.properties,
        melee: form.melee,
        proficient: form.proficient,
        ...(hasVersatile && versatile ? { versatileDamage: versatile } : {}),
        ...(normal > 0 ? { range: { normal, long: long > 0 ? long : undefined } } : {}),
        ...(magicBonus !== 0 ? { magicBonus } : {}),
      }
    }

    if (form.kind === "armor") {
      const strReq = Math.max(0, toInt(form.strengthRequirement, 0))
      return {
        category: "armor",
        quantity,
        weight,
        description,
        armorCategory: form.armorCategory,
        baseAC: Math.max(0, toInt(form.baseAC, 10)),
        stealthDisadvantage: form.stealthDisadvantage,
        ...(strReq > 0 ? { strengthRequirement: strReq } : {}),
      }
    }

    return { category: form.gearCategory, quantity, weight, description }
  }

  const handleSave = async () => {
    const name = form.name.trim()
    if (!name) {
      toast.error("Give the item a name.")
      return
    }
    const data = buildData()
    if (!data) return
    setSaving(true)
    try {
      if (item) {
        await updateProperty({
          id: item.id as Id<"characterProperties">,
          name,
          equipped: form.equipped,
          data,
        })
        toast.success("Item updated.")
      } else {
        await addProperty({
          characterId,
          type: "item",
          name,
          active: true,
          equipped: form.equipped,
          orderIndex: nextOrder,
          data,
        })
        toast.success("Item added.")
      }
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save item.")
    } finally {
      setSaving(false)
    }
  }

  const equippable = form.kind === "weapon" || form.kind === "armor"

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="rounded-xl p-5 w-full max-w-md max-h-[85vh] overflow-y-auto"
        style={{
          background: "var(--scene-surface)",
          border: "1px solid var(--scene-border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-lg font-bold"
            style={{
              fontFamily: "var(--font-cinzel)",
              color: "var(--scene-text-primary)",
            }}
          >
            {item ? "Edit item" : "Add item"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:opacity-80"
            style={{ color: "var(--scene-text-muted)" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* SRD autofill — search Open5e and prefill the form (add-mode only) */}
        {!item && (
          <SrdSearch
            kind={form.kind}
            onPick={(prefill) => setForm((f) => ({ ...f, ...prefill }))}
          />
        )}

        {/* Kind selector — locked once an item exists (category drives schema) */}
        {!item && (
          <div className="flex gap-1.5 mb-4">
            {(["weapon", "armor", "gear"] as Kind[]).map((k) => (
              <button
                key={k}
                onClick={() => set("kind", k)}
                className="flex-1 py-2 rounded-md text-sm font-medium capitalize transition-colors"
                style={{
                  background:
                    form.kind === k ? "var(--scene-accent)" : "var(--scene-bg)",
                  color:
                    form.kind === k
                      ? "var(--scene-bg)"
                      : "var(--scene-text-primary)",
                  border: "1px solid var(--scene-border)",
                }}
              >
                {k}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <Field label="Name">
            <TextInput
              value={form.name}
              onChange={(v) => set("name", v)}
              placeholder="e.g. Longsword"
              autoFocus
            />
          </Field>

          {form.kind === "gear" && (
            <Field label="Category">
              <Select
                value={form.gearCategory}
                onChange={(v) => set("gearCategory", v as ItemCategory)}
                options={GEAR_CATEGORIES.map((c) => ({ value: c, label: c }))}
              />
            </Field>
          )}

          {form.kind === "weapon" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Damage dice">
                  <TextInput
                    value={form.damageDice}
                    onChange={(v) => set("damageDice", v)}
                    placeholder="1d8"
                  />
                </Field>
                <Field label="Damage type">
                  <Select
                    value={form.damageType}
                    onChange={(v) => set("damageType", v as DamageType)}
                    options={DAMAGE_TYPES.map((d) => ({ value: d, label: d }))}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Weapon type">
                  <Select
                    value={form.weaponType}
                    onChange={(v) =>
                      set("weaponType", v as "simple" | "martial")
                    }
                    options={[
                      { value: "simple", label: "simple" },
                      { value: "martial", label: "martial" },
                    ]}
                  />
                </Field>
                <Field label="Attack range">
                  <Select
                    value={form.melee ? "melee" : "ranged"}
                    onChange={(v) => set("melee", v === "melee")}
                    options={[
                      { value: "melee", label: "melee (STR)" },
                      { value: "ranged", label: "ranged (DEX)" },
                    ]}
                  />
                </Field>
              </div>

              <Field label="Properties">
                <div className="flex flex-wrap gap-1.5">
                  {WEAPON_PROPERTY_OPTIONS.map((p) => {
                    const on = form.properties.includes(p)
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => toggleProperty(p)}
                        className="px-2 py-1 rounded text-xs transition-colors"
                        style={{
                          background: on
                            ? "color-mix(in srgb, var(--scene-accent) 18%, transparent)"
                            : "var(--scene-bg)",
                          color: on
                            ? "var(--scene-accent)"
                            : "var(--scene-text-muted)",
                          border: `1px solid ${
                            on
                              ? "color-mix(in srgb, var(--scene-accent) 38%, transparent)"
                              : "var(--scene-border)"
                          }`,
                        }}
                      >
                        {p}
                      </button>
                    )
                  })}
                </div>
              </Field>

              {form.properties.includes("versatile") && (
                <Field label="Versatile damage (two-handed)">
                  <TextInput
                    value={form.versatileDamage}
                    onChange={(v) => set("versatileDamage", v)}
                    placeholder="1d10"
                  />
                </Field>
              )}

              {(!form.melee || form.properties.includes("thrown")) && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Range (normal ft)">
                    <TextInput
                      value={form.rangeNormal}
                      onChange={(v) => set("rangeNormal", v)}
                      placeholder="80"
                      numeric
                    />
                  </Field>
                  <Field label="Range (long ft)">
                    <TextInput
                      value={form.rangeLong}
                      onChange={(v) => set("rangeLong", v)}
                      placeholder="320"
                      numeric
                    />
                  </Field>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Magic bonus">
                  <TextInput
                    value={form.magicBonus}
                    onChange={(v) => set("magicBonus", v)}
                    placeholder="0"
                    numeric
                  />
                </Field>
                <CheckboxField
                  label="Proficient"
                  checked={form.proficient}
                  onChange={(v) => set("proficient", v)}
                />
              </div>
            </>
          )}

          {form.kind === "armor" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Armor category">
                  <Select
                    value={form.armorCategory}
                    onChange={(v) =>
                      set(
                        "armorCategory",
                        v as "light" | "medium" | "heavy" | "shield",
                      )
                    }
                    options={ARMOR_CATEGORY_OPTIONS.map((c) => ({
                      value: c,
                      label: c,
                    }))}
                  />
                </Field>
                <Field
                  label={
                    form.armorCategory === "shield" ? "Shield bonus" : "Base AC"
                  }
                >
                  <TextInput
                    value={form.baseAC}
                    onChange={(v) => set("baseAC", v)}
                    placeholder={form.armorCategory === "shield" ? "2" : "14"}
                    numeric
                  />
                </Field>
              </div>
              {form.armorCategory !== "shield" && (
                <div className="grid grid-cols-2 gap-3 items-end">
                  <Field label="Min STR (optional)">
                    <TextInput
                      value={form.strengthRequirement}
                      onChange={(v) => set("strengthRequirement", v)}
                      placeholder="—"
                      numeric
                    />
                  </Field>
                  <CheckboxField
                    label="Stealth disadvantage"
                    checked={form.stealthDisadvantage}
                    onChange={(v) => set("stealthDisadvantage", v)}
                  />
                </div>
              )}
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity">
              <TextInput
                value={form.quantity}
                onChange={(v) => set("quantity", v)}
                numeric
              />
            </Field>
            <Field label="Weight (lb)">
              <TextInput
                value={form.weight}
                onChange={(v) => set("weight", v)}
                numeric
              />
            </Field>
          </div>

          {equippable && (
            <CheckboxField
              label="Equipped"
              checked={form.equipped}
              onChange={(v) => set("equipped", v)}
            />
          )}

          <Field label="Notes (optional)">
            <TextInput
              value={form.description}
              onChange={(v) => set("description", v)}
              placeholder="Description, properties, attunement…"
            />
          </Field>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{
              background: "var(--scene-border)",
              color: "var(--scene-text-primary)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
          >
            {saving ? "Saving…" : item ? "Save changes" : "Add item"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tiny form primitives ───────────────────────────────────────────────────────

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span
        className="text-xs uppercase tracking-widest block mb-1"
        style={{ color: "var(--scene-text-muted)" }}
      >
        {label}
      </span>
      {children}
    </label>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
  numeric,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  numeric?: boolean
  autoFocus?: boolean
}) {
  return (
    <input
      type={numeric ? "number" : "text"}
      inputMode={numeric ? "numeric" : undefined}
      value={value}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-md text-sm bg-transparent outline-none"
      style={{
        border: "1px solid var(--scene-border)",
        color: "var(--scene-text-primary)",
      }}
    />
  )
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-md text-sm outline-none capitalize"
      style={{
        border: "1px solid var(--scene-border)",
        color: "var(--scene-text-primary)",
        background: "var(--scene-bg)",
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors h-[38px]"
      style={{
        border: "1px solid var(--scene-border)",
        background: checked
          ? "color-mix(in srgb, var(--scene-accent) 14%, transparent)"
          : "transparent",
        color: checked ? "var(--scene-accent)" : "var(--scene-text-muted)",
      }}
    >
      <span
        className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
        style={{
          border: `1.5px solid ${
            checked ? "var(--scene-accent)" : "var(--scene-border)"
          }`,
          background: checked ? "var(--scene-accent)" : "transparent",
        }}
      >
        {checked && <Check className="h-3 w-3" style={{ color: "var(--scene-bg)" }} />}
      </span>
      {label}
    </button>
  )
}
