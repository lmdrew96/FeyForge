"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import { Plus, Minus, Trash2, Pencil, Sword, Shield, Package, Zap, ChevronDown, Sparkles } from "lucide-react"
import type { AbilityScores } from "@/lib/character/types"
import {
  weaponAttackInfo,
  itemToStoredData,
  type ItemCategory,
  type SheetItem,
} from "@/lib/character/sheet-items"
import { applyGrants, reverseGrants, appliedSummary } from "@/lib/character/feats"

// 5e: a character can be attuned to at most three magic items at once.
const MAX_ATTUNEMENT = 3
import { partitionHomebrew } from "@/lib/homebrew"
import { ItemEditorDialog } from "@/components/character/item-editor"
import type { DiceRollResult } from "@/lib/dice-store"

// The sheet's roll helpers, passed down from the page's useSheetRoll(). `roll`
// returns the roll result so attacks can read the natural d20 (crit detection).
export type SheetRollFn = (label: string, mod: number) => DiceRollResult | null
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

// Categories where a quantity stepper makes sense — the table-frequent stackables
// (arrows, potions, rations, coins-worth-of-treasure). Weapons/armor/magic/tools
// are effectively singletons, so they keep the plain ×N display.
const COUNTABLE: ItemCategory[] = ["consumable", "gear", "treasure"]

// ── Attacks ───────────────────────────────────────────────────────────────────

// Derived from equipped weapons. Tapping the weapon rolls 1d20 + to-hit through
// the sheet's adv/dis-aware roller; tapping damage rolls the weapon dice + ability
// mod. A one-shot crit toggle doubles the damage dice on the next damage roll.
export function AttacksSection({
  level,
  weaponProficiencies,
  abilities,
  weapons,
  fightingStyleId,
  critRange = 20,
  roll,
  rollExpr,
}: {
  level: number
  weaponProficiencies: string[]
  abilities: AbilityScores
  weapons: SheetItem[]
  fightingStyleId?: string
  /** Lowest natural d20 that crits (Champion: 19 @ L3, 18 @ L15). Default 20. */
  critRange?: number
  roll: SheetRollFn
  rollExpr: SheetRollExprFn
}) {
  const [crit, setCrit] = useState(false)

  // Roll a weapon attack, then auto-arm the crit toggle if the natural d20 (the
  // kept die, after adv/dis) lands in an EXPANDED crit range — so a Champion's
  // 19-20 (or 18-20) doubles damage without the player tracking it. Only fires
  // when the range is widened (critRange < 20); a plain nat 20 stays manual, as
  // it is for everyone else.
  const rollAttack = (label: string, mod: number) => {
    const result = roll(label, mod)
    const natural = result?.terms[0]?.rolls[0]
    if (critRange < 20 && typeof natural === "number" && natural >= critRange) {
      setCrit(true)
      toast.success(`Critical hit! Natural ${natural} — tap damage to roll doubled dice.`)
    }
  }

  const attacks = useMemo(
    () =>
      weapons.map((w) =>
        weaponAttackInfo(
          level,
          weaponProficiencies,
          abilities,
          w,
          fightingStyleId,
          weapons.length === 1,
        ),
      ),
    [weapons, level, weaponProficiencies, abilities, fightingStyleId],
  )

  const rollDamage = (label: string, expr: string) => {
    rollExpr(label, expr, { crit })
    if (crit) setCrit(false)
  }

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2
            className="text-xs uppercase tracking-widest"
            style={{ color: "var(--scene-text-muted)" }}
          >
            Attacks
          </h2>
          {critRange < 20 && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              style={{
                background: "color-mix(in srgb, var(--scene-accent) 14%, transparent)",
                color: "var(--scene-accent)",
              }}
              title="Improved Critical — your weapon attacks crit on this range, applied automatically"
            >
              Crits {critRange}–20
            </span>
          )}
        </div>
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
                onClick={() => rollAttack(`${atk.name} attack`, atk.attackBonus)}
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
  char,
  characterId,
  items,
  nextOrder,
}: {
  // Needed to bake/reverse attunement grants into the character doc.
  char: Doc<"characters">
  characterId: Id<"characters">
  items: SheetItem[]
  nextOrder: number
}) {
  const addProperty = useMutation(api.characters.addProperty)
  const updateProperty = useMutation(api.characters.updateProperty)
  const removeProperty = useMutation(api.characters.removeProperty)
  const updateCharacter = useMutation(api.characters.update)
  const createHomebrew = useMutation(api.homebrew.create)

  const attunedCount = items.filter((i) => i.attuned).length

  // Your homebrew items (+ any shared to your campaigns) ride the SRD autofill.
  const homebrewDocs = useQuery(api.homebrew.listForBuilder)
  const homebrewItems = useMemo(
    () => partitionHomebrew(homebrewDocs).items,
    [homebrewDocs],
  )

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
      // Reverse a still-attuned item's baked grants before deleting it, so the
      // bonus never strands on the character with no way to undo it.
      if (item.attuned && item.grants) {
        const patch = reverseGrants(char, item.grants)
        if (Object.keys(patch).length) await updateCharacter({ id: char._id, ...patch })
      }
      await removeProperty({ id: item.id as Id<"characterProperties"> })
      toast.success("Item removed.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove item.")
    }
  }

  // Attune/unattune a magic item: bakes (applyGrants) or reverses (reverseGrants)
  // its grants into the character doc — equip-independent — then flips the stored
  // `attuned` flag. Mirrors the feat add/remove flow on the sheet page.
  const setAttuned = async (item: SheetItem, next: boolean) => {
    if (next && !item.attuned && attunedCount >= MAX_ATTUNEMENT) {
      toast.error(`You can only be attuned to ${MAX_ATTUNEMENT} items at once.`)
      return
    }
    try {
      if (item.grants) {
        const patch = next
          ? applyGrants(char, item.grants)
          : reverseGrants(char, item.grants)
        if (Object.keys(patch).length) await updateCharacter({ id: char._id, ...patch })
      }
      await updateProperty({
        id: item.id as Id<"characterProperties">,
        data: { ...itemToStoredData(item), attuned: next },
      })
      toast.success(next ? `Attuned to ${item.name}.` : `Unattuned from ${item.name}.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't change attunement.")
    }
  }

  // Set an item's quantity (clamped at 1 — use Delete/Use to reach zero). data is
  // patched as a whole blob, so spread the existing data and override quantity.
  const setQuantity = async (item: SheetItem, qty: number) => {
    const next = Math.max(1, Math.floor(qty))
    if (next === (item.quantity ?? 1)) return
    try {
      await updateProperty({
        id: item.id as Id<"characterProperties">,
        data: { ...itemToStoredData(item), quantity: next },
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update quantity.")
    }
  }

  // Use one of a consumable: decrement by 1, or remove it when the last is spent.
  const useConsumable = async (item: SheetItem) => {
    const qty = item.quantity ?? 1
    try {
      if (qty > 1) {
        await updateProperty({
          id: item.id as Id<"characterProperties">,
          data: { ...itemToStoredData(item), quantity: qty - 1 },
        })
        toast.success(`Used ${item.name} — ${qty - 1} left.`)
      } else {
        await removeProperty({ id: item.id as Id<"characterProperties"> })
        toast.success(`Used your last ${item.name}.`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't use item.")
    }
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2
            className="text-xs uppercase tracking-widest"
            style={{ color: "var(--scene-text-muted)" }}
          >
            Inventory
          </h2>
          {(attunedCount > 0 || items.some((i) => i.requiresAttunement)) && (
            <span
              className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              style={{
                background: "color-mix(in srgb, var(--scene-accent) 12%, transparent)",
                color: "var(--scene-accent)",
              }}
              title="Attunement slots used (5e limit: 3)"
            >
              <Sparkles className="h-3 w-3" />
              Attunement {attunedCount}/{MAX_ATTUNEMENT}
            </span>
          )}
        </div>
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
                    <ItemRow
                      key={item.id}
                      item={item}
                      isLast={i === groupItems.length - 1}
                      equippable={equippable}
                      countable={COUNTABLE.includes(item.category as ItemCategory)}
                      attunementFull={attunedCount >= MAX_ATTUNEMENT}
                      onEquip={toggleEquip}
                      onEdit={setEditing}
                      onRemove={handleRemove}
                      onSetQuantity={setQuantity}
                      onUse={useConsumable}
                      onAttune={setAttuned}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {(adding || editing) && (
        <ItemEditorDialog
          item={editing}
          homebrewItems={homebrewItems}
          onSubmit={async ({ name, data, equipped }) => {
            if (editing) {
              await updateProperty({
                id: editing.id as Id<"characterProperties">,
                name,
                equipped,
                data,
              })
              toast.success("Item updated.")
            } else {
              await addProperty({
                characterId,
                type: "item",
                name,
                active: true,
                equipped,
                orderIndex: nextOrder,
                data,
              })
              toast.success("Item added.")
            }
          }}
          onSaveAsHomebrew={async ({ name, data }) => {
            await createHomebrew({ kind: "item", name, data })
            toast.success(`"${name}" saved to your homebrew.`)
          }}
          onClose={() => {
            setAdding(false)
            setEditing(null)
          }}
        />
      )}
    </section>
  )
}

// A single inventory row. Collapsed it stays scannable (name · subtitle ·
// quantity · equipped badge); a quantity stepper sits inline for stackables (the
// everyday "+1 arrow / −1 potion" loop). Tapping the row expands a small action
// tray with the contextual verb (Use for consumables) plus equip/edit/delete —
// so the collapsed row never carries five buttons (nd-design: keep it clean).
function ItemRow({
  item,
  isLast,
  equippable,
  countable,
  attunementFull,
  onEquip,
  onEdit,
  onRemove,
  onSetQuantity,
  onUse,
  onAttune,
}: {
  item: SheetItem
  isLast: boolean
  equippable: boolean
  countable: boolean
  attunementFull: boolean
  onEquip: (item: SheetItem) => void
  onEdit: (item: SheetItem) => void
  onRemove: (item: SheetItem) => void
  onSetQuantity: (item: SheetItem, qty: number) => void
  onUse: (item: SheetItem) => void
  onAttune: (item: SheetItem, next: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const qty = item.quantity ?? 1
  const grantText = item.grants ? appliedSummary(item.grants) : ""
  const attuneBlocked = attunementFull && !item.attuned

  return (
    <div
      style={{
        borderBottom: isLast ? "none" : "1px solid var(--scene-border)",
        opacity: item.active ? 1 : 0.55,
      }}
    >
      {/* Collapsed header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex-1 min-w-0 text-left"
          aria-expanded={open}
        >
          <div className="flex items-center gap-2">
            <span
              className="text-sm font-medium truncate"
              style={{ color: "var(--scene-text-primary)" }}
            >
              {item.name}
            </span>
            {item.equipped && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-md flex-shrink-0"
                style={{
                  background: "color-mix(in srgb, var(--scene-accent) 16%, transparent)",
                  color: "var(--scene-accent)",
                }}
              >
                Equipped
              </span>
            )}
            {item.attuned && (
              <span
                className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md flex-shrink-0"
                style={{
                  background: "color-mix(in srgb, var(--scene-accent) 16%, transparent)",
                  color: "var(--scene-accent)",
                }}
              >
                <Sparkles className="h-2.5 w-2.5" />
                Attuned
              </span>
            )}
            {!countable && qty > 1 && (
              <span
                className="text-xs tabular-nums"
                style={{ color: "var(--scene-text-muted)" }}
              >
                ×{qty}
              </span>
            )}
          </div>
          <span className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
            {itemSubtitle(item)}
          </span>
        </button>

        {countable && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => onSetQuantity(item, qty - 1)}
              disabled={qty <= 1}
              className="p-1 rounded transition-opacity hover:opacity-80 disabled:opacity-30"
              style={{ color: "var(--scene-text-muted)", border: "1px solid var(--scene-border)" }}
              aria-label={`Decrease ${item.name}`}
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span
              className="text-sm tabular-nums w-6 text-center"
              style={{ color: "var(--scene-text-primary)" }}
            >
              {qty}
            </span>
            <button
              onClick={() => onSetQuantity(item, qty + 1)}
              className="p-1 rounded transition-opacity hover:opacity-80"
              style={{ color: "var(--scene-text-muted)", border: "1px solid var(--scene-border)" }}
              aria-label={`Increase ${item.name}`}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <button
          onClick={() => setOpen((o) => !o)}
          className="p-1.5 rounded transition-transform flex-shrink-0"
          style={{
            color: "var(--scene-text-muted)",
            transform: open ? "rotate(180deg)" : undefined,
          }}
          aria-label={open ? "Collapse" : "Expand"}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {/* Expanded action tray */}
      {open && (
        <div className="px-3 pb-2.5">
          {item.requiresAttunement && grantText && (
            <p className="text-xs mb-2" style={{ color: "var(--scene-text-muted)" }}>
              Attune to gain: {grantText}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
          {item.requiresAttunement && (
            <button
              onClick={() => onAttune(item, !item.attuned)}
              disabled={attuneBlocked}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{
                background: item.attuned
                  ? "var(--scene-accent)"
                  : "color-mix(in srgb, var(--scene-accent) 14%, transparent)",
                color: item.attuned ? "var(--scene-bg)" : "var(--scene-accent)",
                border: "1px solid color-mix(in srgb, var(--scene-accent) 32%, transparent)",
              }}
              title={
                attuneBlocked
                  ? "You're already attuned to 3 items"
                  : item.attuned
                    ? "Unattune (removes its bonuses)"
                    : "Attune (applies its bonuses)"
              }
            >
              <Sparkles className="h-3.5 w-3.5" />
              {item.attuned ? "Attuned" : attuneBlocked ? "Attune (3/3)" : "Attune"}
            </button>
          )}
          {item.category === "consumable" && (
            <button
              onClick={() => onUse(item)}
              className="px-3 py-1.5 rounded-md text-sm font-semibold transition-opacity hover:opacity-90"
              style={{
                background: "color-mix(in srgb, var(--scene-accent) 14%, transparent)",
                color: "var(--scene-accent)",
                border: "1px solid color-mix(in srgb, var(--scene-accent) 32%, transparent)",
              }}
              title="Use one (decrements quantity)"
            >
              Use
            </button>
          )}
          {equippable && (
            <button
              onClick={() => onEquip(item)}
              className="px-3 py-1.5 rounded-md text-sm font-medium transition-opacity hover:opacity-80"
              style={{
                background: item.equipped
                  ? "color-mix(in srgb, var(--scene-accent) 16%, transparent)"
                  : "var(--scene-border)",
                color: item.equipped ? "var(--scene-accent)" : "var(--scene-text-primary)",
              }}
            >
              {item.equipped ? "Unequip" : "Equip"}
            </button>
          )}
          <button
            onClick={() => onEdit(item)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-opacity hover:opacity-80"
            style={{ background: "var(--scene-border)", color: "var(--scene-text-primary)" }}
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button
            onClick={() => onRemove(item)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-opacity hover:opacity-80"
            style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
          </div>
        </div>
      )}
    </div>
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

