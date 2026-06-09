"use client"

// Shared item editor — the weapon/armor/gear authoring form with SRD autofill.
// Extracted from the character inventory so the /homebrew library can reuse the
// SAME form (full fidelity + autofill) for authoring homebrew items. Persistence
// is injected via `onSubmit` so the caller owns it: the inventory writes a
// characterProperties row; /homebrew writes a homebrew row. SrdSearch also merges
// the caller's homebrew items into the autofill (inventory passes them; the
// homebrew authoring surface doesn't, so it stays SRD-only).

import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { X, Search, Check, FlaskConical } from "lucide-react"
import {
  DAMAGE_TYPES,
  ABILITIES,
  ABILITY_ABBREVIATIONS,
  SKILLS,
  SKILL_DISPLAY_NAMES,
  type DamageType,
  type Ability,
  type Skill,
} from "@/lib/character/constants"
import type { AppliedGrants } from "@/lib/character/feats"
import type { Modifier } from "@/lib/character/types"
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
  rowToItem,
  type ItemCategory,
  type SheetItem,
  type StoredItemData,
} from "@/lib/character/sheet-items"
import type { HomebrewItem } from "@/lib/homebrew"

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
  // attunement + grants (authored for character items and homebrew templates)
  requiresAttunement: boolean
  grantAbility: "" | Ability
  grantSaveProf: "" | Ability
  grantSkillProf: "" | Skill
  grantExpertise: "" | Skill
  grantHp: string
  grantText: string
  // "Set ability to N" (Headband of Intellect etc.) — ability + target score.
  grantSetAbility: "" | Ability
  grantSetValue: string
  // Flat AC bonus while attuned/equipped (Ring/Cloak of Protection). Stored as a
  // live armorClass Modifier, not a baked grant.
  acBonus: string
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
    requiresAttunement: item?.requiresAttunement ?? false,
    grantAbility: item?.grants?.ability ?? "",
    grantSaveProf: item?.grants?.saveProficiency ?? "",
    grantSkillProf: item?.grants?.skillProficiencies?.[0] ?? "",
    grantExpertise: item?.grants?.skillExpertise?.[0] ?? "",
    grantHp: item?.grants?.hp ? String(item.grants.hp) : "",
    grantText: item?.grants?.text ?? "",
    grantSetAbility: item?.grants?.setAbility?.ability ?? "",
    grantSetValue: item?.grants?.setAbility?.value ? String(item.grants.setAbility.value) : "",
    acBonus: String(item?.modifiers?.find((m) => m.target === "armorClass")?.value ?? 0),
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
// StoredItemData.category (7 values) → the form's 3 kinds, so homebrew items land
// in the right autofill tab.
function homebrewKindOf(category: string): Kind {
  return category === "weapon" ? "weapon" : category === "armor" ? "armor" : "gear"
}

type SearchResult = {
  name: string
  hint: string
  pick: () => void
  homebrew?: boolean
}

function SrdSearch({
  kind,
  onPick,
  homebrewItems,
}: {
  kind: Kind
  onPick: (prefill: Partial<FormState>) => void
  // Your homebrew items, surfaced above the SRD matches. Browsable even with an
  // empty query (the list is short, unlike the hundreds of SRD items) so you can
  // find one you forgot the name of. Undefined on the homebrew authoring surface,
  // which stays SRD-only.
  homebrewItems?: HomebrewItem[]
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

  // Your homebrew items of this kind — shown first, and visible even before you
  // type. Picking one prefills the whole form via the same SheetItem→FormState
  // path the sheet uses (rowToItem → initialForm).
  const homebrewResults = useMemo<SearchResult[]>(() => {
    const mine = (homebrewItems ?? []).filter(
      (it) => homebrewKindOf(it.data.category) === kind,
    )
    const matches = q
      ? mine.filter((it) => it.name.toLowerCase().includes(q))
      : mine
    return matches.slice(0, 8).map((it) => ({
      name: it.name,
      hint: "homebrew",
      homebrew: true,
      pick: () =>
        onPick(
          initialForm(
            rowToItem({ _id: it.id, name: it.name, active: true, data: it.data }),
          ),
        ),
    }))
  }, [homebrewItems, kind, q, onPick])

  const srdResults = useMemo<SearchResult[]>(() => {
    if (!q) return []
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

  const results = useMemo<SearchResult[]>(
    () => [...homebrewResults, ...srdResults],
    [homebrewResults, srdResults],
  )

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
          placeholder={
            homebrewResults.length || homebrewItems?.length
              ? `Search your items + SRD ${kindLabel}…`
              : `Search SRD ${kindLabel} to autofill…`
          }
          className="w-full pl-8 pr-3 py-2 rounded-md text-sm bg-transparent outline-none"
          style={{
            border: "1px solid var(--scene-border)",
            color: "var(--scene-text-primary)",
          }}
        />
      </div>
      {(query.trim() || results.length > 0) && (
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
                key={(r.homebrew ? "hb:" : "srd:") + r.name}
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
                  {r.homebrew && (
                    <span style={{ color: "var(--scene-highlight)" }}>★ </span>
                  )}
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

export function ItemEditorDialog({
  item,
  onSubmit,
  onSaveAsHomebrew,
  homebrewItems,
  mode = "character",
  onClose,
}: {
  item: SheetItem | null
  // Persist the built item. The caller owns it: inventory writes a
  // characterProperties row; /homebrew writes a homebrew row. `equipped` is
  // meaningless for homebrew authoring (ignore it there).
  onSubmit: (args: {
    name: string
    data: StoredItemData
    equipped: boolean
  }) => Promise<void>
  // Optional "Save as homebrew" action (character add-mode only): banks the
  // current form to your homebrew library without adding it to the sheet.
  onSaveAsHomebrew?: (args: { name: string; data: StoredItemData }) => Promise<void>
  homebrewItems?: HomebrewItem[]
  // "character" shows the equip toggle + (optional) save-as-homebrew; "homebrew"
  // is the library authoring surface (no equip, no save-as-homebrew, SRD-only autofill).
  mode?: "character" | "homebrew"
  onClose: () => void
}) {
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

    // Attunement + grants, shared across all kinds. `attuned` is set on the sheet
    // (not here) — preserve it so a non-grant edit doesn't drop it.
    const attunement: Pick<StoredItemData, "requiresAttunement" | "attuned" | "grants" | "modifiers"> = {}
    if (form.requiresAttunement) {
      attunement.requiresAttunement = true
      const grants: AppliedGrants = {}
      if (form.grantAbility) grants.ability = form.grantAbility
      if (form.grantSaveProf) grants.saveProficiency = form.grantSaveProf
      if (form.grantSkillProf) grants.skillProficiencies = [form.grantSkillProf]
      if (form.grantExpertise) grants.skillExpertise = [form.grantExpertise]
      const ghp = toInt(form.grantHp, 0)
      if (ghp) grants.hp = ghp
      if (form.grantText.trim()) grants.text = form.grantText.trim()
      // "Set ability to N" (floor) — author-time grant carries only ability+value;
      // the pre-attune score is captured on the sheet so unattune restores it.
      const setVal = toInt(form.grantSetValue, 0)
      if (form.grantSetAbility && setVal > 0) {
        grants.setAbility = { ability: form.grantSetAbility, value: setVal }
      }
      if (Object.keys(grants).length) attunement.grants = grants
      // Flat AC bonus → a live armorClass modifier. Applies while attuned via the
      // relaxed getAllModifiers gate; no bake/reverse needed — AC is derived.
      const ac = toInt(form.acBonus, 0)
      if (ac !== 0) {
        attunement.modifiers = [
          { id: "item-ac", source: "item", target: "armorClass", type: "add", value: ac, active: true },
        ]
      }
    }
    // `attuned` is per-character runtime state — never written onto a homebrew template.
    if (item?.attuned && mode !== "homebrew") attunement.attuned = true

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
        ...attunement,
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
        ...attunement,
      }
    }

    return { category: form.gearCategory, quantity, weight, description, ...attunement }
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
      await onSubmit({ name, data, equipped: form.equipped })
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save item.")
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAsHomebrew = async () => {
    if (!onSaveAsHomebrew) return
    const name = form.name.trim()
    if (!name) {
      toast.error("Give the item a name.")
      return
    }
    const data = buildData()
    if (!data) return
    // Homebrew templates now carry attunement/grants/modifiers (the validator
    // accepts them). Only `attuned` is stripped — it's per-character runtime
    // state, never part of a reusable template.
    const homebrewData = { ...data }
    delete homebrewData.attuned
    setSaving(true)
    try {
      await onSaveAsHomebrew({ name, data: homebrewData })
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save to homebrew.")
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
            {mode === "homebrew"
              ? item
                ? "Edit homebrew item"
                : "New homebrew item"
              : item
                ? "Edit item"
                : "Add item"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:opacity-80"
            style={{ color: "var(--scene-text-muted)" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* SRD autofill — search Open5e (+ your homebrew) and prefill the form
            (add-mode only). On the homebrew authoring surface, homebrewItems is
            undefined → SRD-only, so you don't autofill a homebrew item from itself. */}
        {!item && (
          <SrdSearch
            kind={form.kind}
            onPick={(prefill) => setForm((f) => ({ ...f, ...prefill }))}
            homebrewItems={homebrewItems}
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

          {equippable && mode === "character" && (
            <CheckboxField
              label="Equipped"
              checked={form.equipped}
              onChange={(v) => set("equipped", v)}
            />
          )}

          {(mode === "character" || mode === "homebrew") && (
            <div
              className="rounded-md p-3 space-y-3"
              style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}
            >
              <div
                className="text-xs uppercase tracking-widest"
                style={{ color: "var(--scene-text-muted)" }}
              >
                Magic &amp; attunement
              </div>
              {item?.attuned ? (
                <p className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
                  This item is attuned. Unattune it on your sheet to change attunement
                  or its granted bonuses.
                </p>
              ) : (
                <>
                  <CheckboxField
                    label="Requires attunement"
                    checked={form.requiresAttunement}
                    onChange={(v) => set("requiresAttunement", v)}
                  />
                  {form.requiresAttunement && (
                    <>
                      <p className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
                        Bonuses applied while attuned:
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="+1 Ability">
                          <Select
                            value={form.grantAbility}
                            onChange={(v) => set("grantAbility", v as "" | Ability)}
                            options={[
                              { value: "", label: "None" },
                              ...ABILITIES.map((a) => ({ value: a, label: ABILITY_ABBREVIATIONS[a] })),
                            ]}
                          />
                        </Field>
                        <Field label="Save proficiency">
                          <Select
                            value={form.grantSaveProf}
                            onChange={(v) => set("grantSaveProf", v as "" | Ability)}
                            options={[
                              { value: "", label: "None" },
                              ...ABILITIES.map((a) => ({ value: a, label: ABILITY_ABBREVIATIONS[a] })),
                            ]}
                          />
                        </Field>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Skill proficiency">
                          <Select
                            value={form.grantSkillProf}
                            onChange={(v) => set("grantSkillProf", v as "" | Skill)}
                            options={[
                              { value: "", label: "None" },
                              ...(Object.keys(SKILLS) as Skill[]).map((s) => ({
                                value: s,
                                label: SKILL_DISPLAY_NAMES[s],
                              })),
                            ]}
                          />
                        </Field>
                        <Field label="Skill expertise">
                          <Select
                            value={form.grantExpertise}
                            onChange={(v) => set("grantExpertise", v as "" | Skill)}
                            options={[
                              { value: "", label: "None" },
                              ...(Object.keys(SKILLS) as Skill[]).map((s) => ({
                                value: s,
                                label: SKILL_DISPLAY_NAMES[s],
                              })),
                            ]}
                          />
                        </Field>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Bonus HP">
                          <TextInput
                            value={form.grantHp}
                            onChange={(v) => set("grantHp", v)}
                            placeholder="0"
                            numeric
                          />
                        </Field>
                        <Field label="AC bonus">
                          <TextInput
                            value={form.acBonus}
                            onChange={(v) => set("acBonus", v)}
                            placeholder="0"
                            numeric
                          />
                        </Field>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Set ability">
                          <Select
                            value={form.grantSetAbility}
                            onChange={(v) => set("grantSetAbility", v as "" | Ability)}
                            options={[
                              { value: "", label: "None" },
                              ...ABILITIES.map((a) => ({ value: a, label: ABILITY_ABBREVIATIONS[a] })),
                            ]}
                          />
                        </Field>
                        <Field label="to score">
                          <TextInput
                            value={form.grantSetValue}
                            onChange={(v) => set("grantSetValue", v)}
                            placeholder="19"
                            numeric
                          />
                        </Field>
                      </div>
                      <Field label="Other (note)">
                        <TextInput
                          value={form.grantText}
                          onChange={(v) => set("grantText", v)}
                          placeholder="e.g. advantage on saves vs. fear"
                        />
                      </Field>
                    </>
                  )}
                </>
              )}
            </div>
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

        {/* Bank the current form to your homebrew library (character add-mode). */}
        {!item && mode === "character" && onSaveAsHomebrew && (
          <button
            onClick={handleSaveAsHomebrew}
            disabled={saving}
            className="w-full mt-2 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50 flex items-center justify-center gap-1.5"
            style={{
              border: "1px solid var(--scene-border)",
              color: "var(--scene-text-muted)",
            }}
          >
            <FlaskConical className="h-4 w-4" /> Save to homebrew
          </button>
        )}
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
