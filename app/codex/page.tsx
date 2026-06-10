"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { AppShell } from "@/components/app-shell"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import {
  open5eApi,
  type Open5eSpell,
  type Open5eMonster,
  type Open5eMagicItem,
  type Open5eCondition,
} from "@/lib/open5e-api"
import { useCodexStore, type CodexCategory } from "@/lib/codex-store"
import { partitionHomebrew } from "@/lib/homebrew"
import type { StoredItemData } from "@/lib/character/sheet-items"
import { ABILITIES, ABILITY_ABBREVIATIONS, getAbilityModifier, formatModifier } from "@/lib/character/constants"
import { SRD_RULES, RULES_CATEGORIES, type RulesEntry } from "@/lib/data/srd-rules"
import { EDITIONS, EDITION_LABELS, type Edition } from "@/lib/editions"
import {
  Search,
  Star,
  ArrowLeft,
  AlertCircle,
  Sparkles,
  Skull,
  Gem,
  Activity,
  FlaskConical,
  ScrollText,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ── Categories the browser supports (a subset of the store's CodexCategory) ────

// SRD categories are fetched live from Open5e; "homebrew" is sourced from the
// user's own library (api.homebrew.listForBuilder) and is shaped differently —
// no slug, spans all item categories — so it travels its own data/detail path.
type SrdCategory = "spells" | "monsters" | "magicitems" | "conditions"
type Category = SrdCategory | "homebrew" | "rules"

// A homebrew item adapted for the Codex: the doc id stands in for `slug` (homebrew
// has none) so the slug-keyed list/bookmark/select machinery works unchanged.
// `ownerName` is set only for items a friend (or campaign-mate) shared with you.
interface CodexHomebrewItem {
  slug: string
  name: string
  data: StoredItemData
  ownerName?: string
}

type Entry = Open5eSpell | Open5eMonster | Open5eMagicItem | Open5eCondition | CodexHomebrewItem | RulesEntry

const TABS: { id: Category; label: string; icon: typeof Sparkles }[] = [
  { id: "spells", label: "Spells", icon: Sparkles },
  { id: "monsters", label: "Monsters", icon: Skull },
  { id: "magicitems", label: "Magic Items", icon: Gem },
  { id: "conditions", label: "Conditions", icon: Activity },
  { id: "rules", label: "Rules", icon: ScrollText },
  { id: "homebrew", label: "Homebrew", icon: FlaskConical },
]

interface CodexData {
  spells: Open5eSpell[]
  monsters: Open5eMonster[]
  magicitems: Open5eMagicItem[]
  conditions: Open5eCondition[]
}

const FETCHERS: { [K in SrdCategory]: () => Promise<CodexData[K]> } = {
  spells: () => open5eApi.getSpells(),
  monsters: () => open5eApi.getMonsters(),
  magicitems: () => open5eApi.getMagicItems(),
  conditions: () => open5eApi.getConditions(),
}

// Stable id for the bookmark store — slug is only unique within a category.
const entryId = (category: Category, slug: string) => `${category}:${slug}`

// ── Formatting helpers ─────────────────────────────────────────────────────────

const spellLevelLabel = (levelInt: number) => (levelInt === 0 ? "Cantrip" : `Level ${levelInt}`)

function formatSpeed(speed: Record<string, number>): string {
  const walk = speed.walk !== undefined ? `${speed.walk} ft.` : null
  const others = Object.entries(speed)
    .filter(([k]) => k !== "walk")
    .map(([k, v]) => `${k} ${v} ft.`)
  return [walk, ...others].filter(Boolean).join(", ") || "—"
}

// CR strings sort numerically ("1/8" < "1/4" < "1" < "5").
function crSortValue(cr: string): number {
  if (cr.includes("/")) {
    const [n, d] = cr.split("/").map(Number)
    return d ? n / d : 0
  }
  return Number(cr) || 0
}

// Creature sizes in their natural (smallest→largest) order.
const SIZE_ORDER = ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"]

// Magic-item rarity in ascending order; unknown rarities sort last.
const RARITY_ORDER = ["common", "uncommon", "rare", "very rare", "legendary", "artifact"]
function rarityRank(rarity: string): number {
  const i = RARITY_ORDER.indexOf((rarity ?? "").toLowerCase())
  return i === -1 ? RARITY_ORDER.length : i
}

// A spell's dnd_class is a comma-joined string ("Bard, Cleric, Wizard").
function spellClasses(s: Open5eSpell): string[] {
  return (s.dnd_class ?? "").split(",").map((c) => c.trim()).filter(Boolean)
}

// ── Shared bits ──────────────────────────────────────────────────────────────

function BookmarkStar({ active, onClick, size = 16 }: { active: boolean; onClick: (e: React.MouseEvent) => void; size?: number }) {
  return (
    <button
      onClick={onClick}
      className="p-1 rounded transition-transform active:scale-90 hover:opacity-80 flex-shrink-0"
      title={active ? "Remove bookmark" : "Bookmark"}
      aria-label={active ? "Remove bookmark" : "Bookmark"}
    >
      <Star
        style={{
          width: size,
          height: size,
          color: active ? "var(--scene-accent)" : "var(--scene-text-muted)",
          fill: active ? "var(--scene-accent)" : "none",
        }}
      />
    </button>
  )
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === undefined || value === null || value === "" || value === "—") return null
  return (
    <div className="flex gap-2 text-sm">
      <span className="font-semibold flex-shrink-0" style={{ color: "var(--scene-text-muted)" }}>{label}:</span>
      <span style={{ color: "var(--scene-text-primary)" }}>{value}</span>
    </div>
  )
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full"
      style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}
    >
      {children}
    </span>
  )
}

function ActionBlock({ title, entries }: { title: string; entries?: { name: string; desc: string }[] }) {
  if (!entries || entries.length === 0) return null
  return (
    <div className="mt-4">
      <h4 className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--scene-text-muted)" }}>{title}</h4>
      <div className="space-y-2">
        {entries.map((a, i) => (
          <div key={`${a.name}-${i}`}>
            <span className="text-sm font-semibold italic" style={{ color: "var(--scene-text-primary)" }}>{a.name}. </span>
            <span className="text-sm" style={{ color: "var(--scene-text-primary)" }}>{a.desc}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Detail renderers ───────────────────────────────────────────────────────────

function SpellDetail({ s }: { s: Open5eSpell }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Pill>{spellLevelLabel(s.level_int)}</Pill>
        <Pill>{s.school}</Pill>
        {s.ritual === "yes" && <Pill>Ritual</Pill>}
        {s.concentration === "yes" && <Pill>Concentration</Pill>}
      </div>
      <div className="space-y-1">
        <FieldRow label="Casting Time" value={s.casting_time} />
        <FieldRow label="Range" value={s.range} />
        <FieldRow label="Components" value={s.material ? `${s.components} (${s.material})` : s.components} />
        <FieldRow label="Duration" value={s.duration} />
        <FieldRow label="Classes" value={s.dnd_class} />
      </div>
      <div className="pt-1">
        <MarkdownRenderer content={s.desc} variant="scene" />
        {s.higher_level && (
          <div className="mt-2">
            <span className="text-sm font-semibold italic" style={{ color: "var(--scene-text-primary)" }}>At Higher Levels. </span>
            <MarkdownRenderer content={s.higher_level} variant="scene" className="inline" />
          </div>
        )}
      </div>
    </div>
  )
}

function MonsterDetail({ m }: { m: Open5eMonster }) {
  return (
    <div className="space-y-3">
      <p className="text-sm italic" style={{ color: "var(--scene-text-muted)" }}>
        {m.size} {m.type}{m.subtype ? ` (${m.subtype})` : ""}, {m.alignment}
      </p>
      <div className="space-y-1">
        <FieldRow label="Armor Class" value={`${m.armor_class}${m.armor_desc ? ` (${m.armor_desc})` : ""}`} />
        <FieldRow label="Hit Points" value={`${m.hit_points}${m.hit_dice ? ` (${m.hit_dice})` : ""}`} />
        <FieldRow label="Speed" value={formatSpeed(m.speed)} />
        <FieldRow label="Challenge" value={m.challenge_rating} />
      </div>

      {/* Ability scores */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 py-2">
        {ABILITIES.map((a) => {
          const score = m[a]
          return (
            <div
              key={a}
              className="rounded-md py-2 text-center"
              style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}
            >
              <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
                {ABILITY_ABBREVIATIONS[a]}
              </div>
              <div className="text-sm font-bold" style={{ color: "var(--scene-text-primary)" }}>{score}</div>
              <div className="text-xs" style={{ color: "var(--scene-accent)" }}>{formatModifier(getAbilityModifier(score))}</div>
            </div>
          )
        })}
      </div>

      <div className="space-y-1">
        <FieldRow label="Senses" value={m.senses} />
        <FieldRow label="Languages" value={m.languages} />
        <FieldRow label="Damage Resistances" value={m.damage_resistances} />
        <FieldRow label="Damage Immunities" value={m.damage_immunities} />
        <FieldRow label="Damage Vulnerabilities" value={m.damage_vulnerabilities} />
        <FieldRow label="Condition Immunities" value={m.condition_immunities} />
      </div>

      <ActionBlock title="Traits" entries={m.special_abilities} />
      <ActionBlock title="Actions" entries={m.actions} />
      <ActionBlock title="Reactions" entries={m.reactions} />
      <ActionBlock title="Legendary Actions" entries={m.legendary_actions} />
    </div>
  )
}

function ItemDetail({ it }: { it: Open5eMagicItem }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Pill>{it.type}</Pill>
        <Pill>{it.rarity}</Pill>
        {it.requires_attunement && it.requires_attunement.toLowerCase().startsWith("requires") && <Pill>Attunement</Pill>}
      </div>
      <MarkdownRenderer content={it.desc} variant="scene" />
    </div>
  )
}

function ConditionDetail({ c }: { c: Open5eCondition }) {
  return <MarkdownRenderer content={c.desc} variant="scene" />
}

function RulesDetail({
  r,
  edition,
  onNavigate,
}: {
  r: RulesEntry
  edition: Edition
  onNavigate: (slug: string) => void
}) {
  // seeAlso slugs that resolve AND are visible in the active edition — a
  // delta entry's cross-edition twin (grapple-2014 → grapple-2024) is reached
  // via the edition toggle, not a jump-chip.
  const related = (r.seeAlso ?? [])
    .map((slug) => SRD_RULES.find((e) => e.slug === slug))
    .filter((e): e is RulesEntry => Boolean(e) && (e!.edition === "both" || e!.edition === edition))
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Pill>{r.category}</Pill>
        {r.edition !== "both" && <Pill>{EDITION_LABELS[r.edition]} only</Pill>}
      </div>
      <MarkdownRenderer content={r.body} variant="scene" />
      {related.length > 0 && (
        <div className="pt-1">
          <h4 className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--scene-text-muted)" }}>
            See also
          </h4>
          <div className="flex flex-wrap gap-2">
            {related.map((e) => (
              <button
                key={e.slug}
                onClick={() => onNavigate(e.slug)}
                className="text-xs px-2.5 py-1 rounded-full transition-opacity hover:opacity-80"
                style={{ background: "var(--scene-border)", color: "var(--scene-text-primary)" }}
              >
                {e.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Homebrew items are StoredItemData (the inventory form's blob), not Open5e-shaped,
// so they get their own renderer covering the weapon/armor/magic fields the form
// can author. Mirrors the inventory's read-only item view at reference altitude.
function HomebrewItemDetail({ it }: { it: CodexHomebrewItem }) {
  const d = it.data
  const damage = d.damageDice
    ? `${d.damageDice}${d.damageType ? ` ${d.damageType}` : ""}${d.magicBonus ? ` (+${d.magicBonus})` : ""}`
    : undefined
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Pill>{d.category}</Pill>
        {d.rarity && <Pill>{d.rarity}</Pill>}
        {d.weaponType && <Pill>{d.weaponType}</Pill>}
        {d.armorCategory && <Pill>{d.armorCategory}</Pill>}
        {d.requiresAttunement && <Pill>Attunement</Pill>}
      </div>
      {it.ownerName && (
        <p className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
          Shared by {it.ownerName}
        </p>
      )}
      <div className="space-y-1">
        {/* Weapon */}
        <FieldRow label="Damage" value={damage} />
        <FieldRow label="Versatile" value={d.versatileDamage} />
        <FieldRow
          label="Range"
          value={d.range ? `${d.range.normal}${d.range.long ? `/${d.range.long}` : ""} ft.` : undefined}
        />
        <FieldRow label="Properties" value={d.properties && d.properties.length > 0 ? d.properties.join(", ") : undefined} />
        {/* Armor */}
        <FieldRow label="Base AC" value={d.baseAC} />
        <FieldRow label="Strength Req." value={d.strengthRequirement} />
        <FieldRow label="Stealth" value={d.stealthDisadvantage ? "Disadvantage" : undefined} />
        {/* Common */}
        <FieldRow label="Weight" value={d.weight ? `${d.weight} lb.` : undefined} />
        <FieldRow label="Quantity" value={d.quantity && d.quantity > 1 ? d.quantity : undefined} />
      </div>
      {d.description && (
        <div className="pt-1">
          <MarkdownRenderer content={d.description} variant="scene" />
        </div>
      )}
    </div>
  )
}

// ── List-row subtitles ─────────────────────────────────────────────────────────

function rowSubtitle(category: Category, entry: Entry): string {
  switch (category) {
    case "spells": {
      const s = entry as Open5eSpell
      return `${spellLevelLabel(s.level_int)} · ${s.school}`
    }
    case "monsters": {
      const m = entry as Open5eMonster
      return `CR ${m.challenge_rating} · ${m.size} ${m.type}`
    }
    case "magicitems": {
      const it = entry as Open5eMagicItem
      return `${it.rarity} · ${it.type}`
    }
    case "conditions":
      return "Condition"
    case "rules": {
      const r = entry as RulesEntry
      return r.edition === "both" ? r.category : `${r.category} · ${EDITION_LABELS[r.edition]} only`
    }
    case "homebrew": {
      const it = entry as CodexHomebrewItem
      const base = [it.data.rarity, it.data.category].filter(Boolean).join(" · ") || "Homebrew item"
      return it.ownerName ? `${base} · by ${it.ownerName}` : base
    }
  }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CodexPage() {
  const activeCategory = useCodexStore((s) => s.activeCategory)
  const setActiveCategory = useCodexStore((s) => s.setActiveCategory)
  const searchQuery = useCodexStore((s) => s.searchQuery)
  const setSearchQuery = useCodexStore((s) => s.setSearchQuery)
  const clearSearch = useCodexStore((s) => s.clearSearch)
  const addBookmark = useCodexStore((s) => s.addBookmark)
  const removeBookmark = useCodexStore((s) => s.removeBookmark)
  const bookmarks = useCodexStore((s) => s.bookmarks)
  const rulesEdition = useCodexStore((s) => s.rulesEdition)
  const setRulesEdition = useCodexStore((s) => s.setRulesEdition)

  // Persisted store may hold a category this browser doesn't render (equipment/rules).
  const category: Category = (TABS.some((t) => t.id === activeCategory) ? activeCategory : "spells") as Category

  const [cache, setCache] = useState<Partial<CodexData>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false)

  // Per-category filters
  const [spellLevel, setSpellLevel] = useState<string>("all")
  const [spellClass, setSpellClass] = useState<string>("all")
  const [spellSchool, setSpellSchool] = useState<string>("all")
  const [monsterCr, setMonsterCr] = useState<string>("all")
  const [monsterType, setMonsterType] = useState<string>("all")
  const [monsterSize, setMonsterSize] = useState<string>("all")
  const [itemRarity, setItemRarity] = useState<string>("all")
  const [itemType, setItemType] = useState<string>("all")
  const [homebrewCategory, setHomebrewCategory] = useState<string>("all")
  const [rulesCategory, setRulesCategory] = useState<string>("all")
  // Sort key — "name" everywhere, plus a category-natural option (level/cr/rarity).
  const [sortBy, setSortBy] = useState<string>("name")

  // Homebrew comes from the user's own library (auth/membership-gated server-side),
  // not Open5e — so it bypasses the FETCHERS/cache path below.
  const homebrewDocs = useQuery(api.homebrew.listForBuilder)
  const homebrewItems = useMemo<CodexHomebrewItem[]>(() => {
    // listForBuilder attributes shared entries with ownerName; partitionHomebrew
    // drops it, so re-join by doc id (CodexHomebrewItem.slug === doc._id).
    const ownerById = new Map((homebrewDocs ?? []).map((d) => [d._id as string, d.ownerName]))
    return partitionHomebrew(homebrewDocs).items.map((it) => ({
      slug: it.id,
      name: it.name,
      data: it.data,
      ownerName: ownerById.get(it.id),
    }))
  }, [homebrewDocs])

  // Rules are static local data (no fetch). "both" entries show in either
  // edition; delta entries (grapple, exhaustion, …) swap with the toggle.
  const rulesEntries = useMemo<RulesEntry[]>(
    () => SRD_RULES.filter((r) => r.edition === "both" || r.edition === rulesEdition),
    [rulesEdition],
  )

  // Search is transient — don't carry a stale query in from a previous visit
  // (the store persists to localStorage).
  useEffect(() => {
    clearSearch()
  }, [clearSearch])

  // Fetch the active category's full SRD list once; the client caches in IndexedDB.
  // Homebrew is reactive (useQuery above), so skip the fetch path entirely.
  useEffect(() => {
    if (category === "homebrew" || category === "rules") return
    if (cache[category]) return
    let cancelled = false
    setLoading(true)
    setError(null)
    FETCHERS[category]()
      .then((data) => {
        if (cancelled) return
        setCache((prev) => ({ ...prev, [category]: data }))
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't reach the Open5e reference. Check your connection and retry.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [category, cache])

  const list: Entry[] =
    category === "homebrew"
      ? homebrewItems
      : category === "rules"
        ? rulesEntries
        : ((cache[category as SrdCategory] ?? []) as Entry[])
  // Homebrew has no Open5e fetch — its loading/error reflect the reactive query.
  // Rules are local, so they never load or error.
  const displayLoading = category === "homebrew" ? homebrewDocs === undefined : category === "rules" ? false : loading
  const displayError = category === "homebrew" || category === "rules" ? null : error

  const isBookmarked = useMemo(() => {
    const ids = new Set(bookmarks.map((b) => b.id))
    return (slug: string) => ids.has(entryId(category, slug))
  }, [bookmarks, category])

  const toggleBookmark = (entry: Entry) => {
    const id = entryId(category, entry.slug)
    if (bookmarks.some((b) => b.id === id)) {
      removeBookmark(id)
    } else {
      addBookmark({ id, category: category as CodexCategory, name: entry.name, slug: entry.slug })
    }
  }

  // Available CR / rarity options derived from the loaded list
  const crOptions = useMemo(() => {
    if (category !== "monsters") return []
    const set = new Set((list as Open5eMonster[]).map((m) => m.challenge_rating))
    return Array.from(set).sort((a, b) => crSortValue(a) - crSortValue(b))
  }, [category, list])

  const rarityOptions = useMemo(() => {
    if (category !== "magicitems") return []
    return Array.from(new Set((list as Open5eMagicItem[]).map((i) => i.rarity).filter(Boolean)))
      .sort((a, b) => rarityRank(a) - rarityRank(b))
  }, [category, list])

  const spellClassOptions = useMemo(() => {
    if (category !== "spells") return []
    const set = new Set<string>()
    for (const s of list as Open5eSpell[]) for (const c of spellClasses(s)) set.add(c)
    return Array.from(set).sort()
  }, [category, list])

  const spellSchoolOptions = useMemo(() => {
    if (category !== "spells") return []
    return Array.from(new Set((list as Open5eSpell[]).map((s) => s.school).filter(Boolean))).sort()
  }, [category, list])

  const monsterTypeOptions = useMemo(() => {
    if (category !== "monsters") return []
    return Array.from(new Set((list as Open5eMonster[]).map((m) => m.type).filter(Boolean))).sort()
  }, [category, list])

  const monsterSizeOptions = useMemo(() => {
    if (category !== "monsters") return []
    const present = new Set((list as Open5eMonster[]).map((m) => m.size).filter(Boolean))
    return SIZE_ORDER.filter((s) => present.has(s))
  }, [category, list])

  const itemTypeOptions = useMemo(() => {
    if (category !== "magicitems") return []
    return Array.from(new Set((list as Open5eMagicItem[]).map((i) => i.type).filter(Boolean))).sort()
  }, [category, list])

  const homebrewCategoryOptions = useMemo(() => {
    if (category !== "homebrew") return []
    return Array.from(new Set((list as CodexHomebrewItem[]).map((i) => i.data.category).filter(Boolean))).sort()
  }, [category, list])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const result = list
      .filter((e) => {
        if (!q) return true
        // Rules also match on body text — a player searching "opportunity" or
        // "difficult terrain" should find the entry, not just exact names.
        if (category === "rules") {
          const r = e as RulesEntry
          return r.name.toLowerCase().includes(q) || r.body.toLowerCase().includes(q)
        }
        return e.name.toLowerCase().includes(q)
      })
      .filter((e) => (bookmarkedOnly ? isBookmarked(e.slug) : true))
      .filter((e) => {
        // Every active filter must match (AND / narrowing).
        if (category === "spells") {
          const s = e as Open5eSpell
          if (spellLevel !== "all" && String(s.level_int) !== spellLevel) return false
          if (spellClass !== "all" && !spellClasses(s).some((c) => c.toLowerCase() === spellClass.toLowerCase())) return false
          if (spellSchool !== "all" && s.school !== spellSchool) return false
        }
        if (category === "monsters") {
          const m = e as Open5eMonster
          if (monsterCr !== "all" && m.challenge_rating !== monsterCr) return false
          if (monsterType !== "all" && m.type !== monsterType) return false
          if (monsterSize !== "all" && m.size !== monsterSize) return false
        }
        if (category === "magicitems") {
          const it = e as Open5eMagicItem
          if (itemRarity !== "all" && it.rarity !== itemRarity) return false
          if (itemType !== "all" && it.type !== itemType) return false
        }
        if (category === "homebrew") {
          const it = e as CodexHomebrewItem
          if (homebrewCategory !== "all" && it.data.category !== homebrewCategory) return false
        }
        if (category === "rules") {
          const r = e as RulesEntry
          if (rulesCategory !== "all" && r.category !== rulesCategory) return false
        }
        return true
      })

    const byName = (a: Entry, b: Entry) => a.name.localeCompare(b.name)
    result.sort((a, b) => {
      if (sortBy === "level" && category === "spells") {
        const d = (a as Open5eSpell).level_int - (b as Open5eSpell).level_int
        return d !== 0 ? d : byName(a, b)
      }
      if (sortBy === "cr" && category === "monsters") {
        const d = crSortValue((a as Open5eMonster).challenge_rating) - crSortValue((b as Open5eMonster).challenge_rating)
        return d !== 0 ? d : byName(a, b)
      }
      if (sortBy === "rarity" && category === "magicitems") {
        const d = rarityRank((a as Open5eMagicItem).rarity) - rarityRank((b as Open5eMagicItem).rarity)
        return d !== 0 ? d : byName(a, b)
      }
      return byName(a, b)
    })
    return result
  }, [
    list, searchQuery, bookmarkedOnly, isBookmarked, category, sortBy,
    spellLevel, spellClass, spellSchool, monsterCr, monsterType, monsterSize, itemRarity, itemType,
    homebrewCategory, rulesCategory,
  ])

  const selected = useMemo(
    () => (selectedSlug ? list.find((e) => e.slug === selectedSlug) ?? null : null),
    [list, selectedSlug]
  )

  const switchCategory = (next: Category) => {
    setActiveCategory(next)
    setSelectedSlug(null)
    setBookmarkedOnly(false)
    clearSearch()
    setSpellLevel("all")
    setSpellClass("all")
    setSpellSchool("all")
    setMonsterCr("all")
    setMonsterType("all")
    setMonsterSize("all")
    setItemRarity("all")
    setItemType("all")
    setHomebrewCategory("all")
    setRulesCategory("all")
    setSortBy("name")
  }

  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-6xl mx-auto pb-12">
        <div className="mb-5">
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
            Codex
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--scene-text-muted)" }}>
            {category === "homebrew"
              ? "Your homebrew library, browsable alongside the SRD."
              : category === "rules"
                ? "Quick SRD rules reference for the table — actions, cover, resting, conditions, and edition deltas."
                : "SRD reference, pulled live from Open5e."}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const active = tab.id === category
            return (
              <button
                key={tab.id}
                onClick={() => switchCategory(tab.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
                style={{
                  background: active ? "var(--scene-accent)" : "var(--scene-surface)",
                  color: active ? "var(--scene-bg)" : "var(--scene-text-primary)",
                  border: `1px solid ${active ? "var(--scene-accent)" : "var(--scene-border)"}`,
                }}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] lg:gap-6 lg:items-start">
          {/* List + controls (hidden on mobile when a detail is open) */}
          <div className={cn(selected ? "hidden lg:block" : "block")}>
            {/* Search */}
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2 mb-3"
              style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
            >
              <Search className="h-4 w-4 flex-shrink-0" style={{ color: "var(--scene-text-muted)" }} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${TABS.find((t) => t.id === category)?.label.toLowerCase()}…`}
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: "var(--scene-text-primary)" }}
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {category === "spells" && (
                <>
                  <FilterSelect value={spellLevel} onChange={setSpellLevel} label="Level">
                    <option value="all">All levels</option>
                    {Array.from({ length: 10 }, (_, i) => (
                      <option key={i} value={String(i)}>{spellLevelLabel(i)}</option>
                    ))}
                  </FilterSelect>
                  <FilterSelect value={spellClass} onChange={setSpellClass} label="Class">
                    <option value="all">All classes</option>
                    {spellClassOptions.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </FilterSelect>
                  <FilterSelect value={spellSchool} onChange={setSpellSchool} label="School">
                    <option value="all">All schools</option>
                    {spellSchoolOptions.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </FilterSelect>
                </>
              )}
              {category === "monsters" && (
                <>
                  <FilterSelect value={monsterCr} onChange={setMonsterCr} label="CR">
                    <option value="all">All CRs</option>
                    {crOptions.map((cr) => (
                      <option key={cr} value={cr}>CR {cr}</option>
                    ))}
                  </FilterSelect>
                  <FilterSelect value={monsterType} onChange={setMonsterType} label="Type">
                    <option value="all">All types</option>
                    {monsterTypeOptions.map((t) => (
                      <option key={t} value={t} className="capitalize">{t}</option>
                    ))}
                  </FilterSelect>
                  <FilterSelect value={monsterSize} onChange={setMonsterSize} label="Size">
                    <option value="all">All sizes</option>
                    {monsterSizeOptions.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </FilterSelect>
                </>
              )}
              {category === "magicitems" && (
                <>
                  <FilterSelect value={itemRarity} onChange={setItemRarity} label="Rarity">
                    <option value="all">All rarities</option>
                    {rarityOptions.map((r) => (
                      <option key={r} value={r} className="capitalize">{r}</option>
                    ))}
                  </FilterSelect>
                  <FilterSelect value={itemType} onChange={setItemType} label="Type">
                    <option value="all">All types</option>
                    {itemTypeOptions.map((t) => (
                      <option key={t} value={t} className="capitalize">{t}</option>
                    ))}
                  </FilterSelect>
                </>
              )}
              {category === "homebrew" && homebrewCategoryOptions.length > 0 && (
                <FilterSelect value={homebrewCategory} onChange={setHomebrewCategory} label="Category">
                  <option value="all">All categories</option>
                  {homebrewCategoryOptions.map((c) => (
                    <option key={c} value={c} className="capitalize">{c}</option>
                  ))}
                </FilterSelect>
              )}
              {category === "rules" && (
                <>
                  <FilterSelect value={rulesCategory} onChange={setRulesCategory} label="Category">
                    <option value="all">All categories</option>
                    {RULES_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </FilterSelect>
                  <EditionToggle value={rulesEdition} onChange={setRulesEdition} />
                </>
              )}
              {category !== "conditions" && category !== "homebrew" && category !== "rules" && (
                <FilterSelect value={sortBy} onChange={setSortBy} label="Sort by">
                  <option value="name">Sort: Name</option>
                  {category === "spells" && <option value="level">Sort: Level</option>}
                  {category === "monsters" && <option value="cr">Sort: CR</option>}
                  {category === "magicitems" && <option value="rarity">Sort: Rarity</option>}
                </FilterSelect>
              )}
              <button
                onClick={() => setBookmarkedOnly((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-opacity hover:opacity-90"
                style={{
                  background: bookmarkedOnly ? "color-mix(in srgb, var(--scene-accent) 16%, transparent)" : "var(--scene-surface)",
                  color: bookmarkedOnly ? "var(--scene-accent)" : "var(--scene-text-muted)",
                  border: `1px solid ${bookmarkedOnly ? "color-mix(in srgb, var(--scene-accent) 38%, transparent)" : "var(--scene-border)"}`,
                }}
              >
                <Star className="h-3.5 w-3.5" style={{ fill: bookmarkedOnly ? "var(--scene-accent)" : "none" }} />
                Bookmarked
              </button>
            </div>

            {/* List states */}
            {displayLoading && (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-14 rounded-lg animate-pulse" style={{ background: "var(--scene-surface)" }} />
                ))}
              </div>
            )}

            {!displayLoading && displayError && (
              <div
                className="rounded-lg p-4 flex items-start gap-3"
                style={{ background: "var(--scene-surface)", border: "1px solid #ef444444" }}
              >
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: "#ef4444" }} />
                <div className="flex-1">
                  <p className="text-sm" style={{ color: "var(--scene-text-primary)" }}>{displayError}</p>
                  <button
                    onClick={() => setCache((prev) => ({ ...prev, [category]: undefined }))}
                    className="text-sm mt-2 underline hover:opacity-80"
                    style={{ color: "var(--scene-accent)" }}
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}

            {!displayLoading && !displayError && (
              <>
                <p className="text-xs mb-2" style={{ color: "var(--scene-text-muted)" }}>
                  {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
                </p>
                <div className="rounded-xl overflow-hidden" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
                  {filtered.length === 0 && (
                    <p className="text-sm p-4" style={{ color: "var(--scene-text-muted)" }}>
                      {bookmarkedOnly
                        ? "No bookmarks in this category yet."
                        : category === "homebrew"
                          ? "No homebrew items yet. Create some in the Homebrew workshop to browse them here."
                          : "Nothing matches your search."}
                    </p>
                  )}
                  <div className="max-h-[70vh] overflow-y-auto">
                    {filtered.map((entry, i) => (
                      // Row is a div with two sibling buttons (select + bookmark);
                      // a button can't nest a button (hydration error).
                      <div
                        key={entry.slug}
                        className="flex items-center gap-3 px-4 py-2.5"
                        style={{
                          borderBottom: i < filtered.length - 1 ? "1px solid var(--scene-border)" : "none",
                          background: entry.slug === selectedSlug ? "color-mix(in srgb, var(--scene-accent) 10%, transparent)" : "transparent",
                        }}
                      >
                        <button
                          onClick={() => setSelectedSlug(entry.slug)}
                          className="flex-1 min-w-0 text-left transition-opacity hover:opacity-80"
                        >
                          <p className="text-sm font-medium truncate" style={{ color: "var(--scene-text-primary)" }}>{entry.name}</p>
                          <p className="text-xs truncate" style={{ color: "var(--scene-text-muted)" }}>{rowSubtitle(category, entry)}</p>
                        </button>
                        <BookmarkStar
                          active={isBookmarked(entry.slug)}
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleBookmark(entry)
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Detail pane */}
          <div className={cn(selected ? "block" : "hidden lg:block")}>
            {!selected ? (
              <div
                className="rounded-xl p-8 text-center hidden lg:block"
                style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
              >
                <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
                  Select an entry to see its details.
                </p>
              </div>
            ) : (
              <div
                className="rounded-xl p-5 lg:sticky lg:top-6"
                style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
              >
                {/* Mobile back */}
                <button
                  onClick={() => setSelectedSlug(null)}
                  className="lg:hidden inline-flex items-center gap-1.5 text-sm mb-3 hover:opacity-80"
                  style={{ color: "var(--scene-text-muted)" }}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to list
                </button>

                <div className="flex items-start justify-between gap-3 mb-3">
                  <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
                    {selected.name}
                  </h2>
                  <BookmarkStar active={isBookmarked(selected.slug)} onClick={() => toggleBookmark(selected)} size={20} />
                </div>

                <div className="max-h-[75vh] overflow-y-auto pr-1">
                  {category === "spells" && <SpellDetail s={selected as Open5eSpell} />}
                  {category === "monsters" && <MonsterDetail m={selected as Open5eMonster} />}
                  {category === "magicitems" && <ItemDetail it={selected as Open5eMagicItem} />}
                  {category === "conditions" && <ConditionDetail c={selected as Open5eCondition} />}
                  {category === "rules" && (
                    <RulesDetail r={selected as RulesEntry} edition={rulesEdition} onNavigate={setSelectedSlug} />
                  )}
                  {category === "homebrew" && <HomebrewItemDetail it={selected as CodexHomebrewItem} />}

                  <p className="text-xs mt-5 pt-3" style={{ color: "var(--scene-text-muted)", borderTop: "1px solid var(--scene-border)" }}>
                    {category === "homebrew"
                      ? (selected as CodexHomebrewItem).ownerName
                        ? `Shared by ${(selected as CodexHomebrewItem).ownerName}`
                        : "Source: Your homebrew library"
                      : category === "rules"
                        ? "Source: SRD 5.1 / 5.2 · paraphrased · CC BY 4.0"
                        : `Source: ${(selected as Entry & { document__title?: string }).document__title ?? "SRD"} · via Open5e`}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function FilterSelect({
  value,
  onChange,
  label,
  children,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  children: React.ReactNode
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="px-3 py-1.5 rounded-lg text-sm outline-none cursor-pointer"
      style={{ background: "var(--scene-surface)", color: "var(--scene-text-primary)", border: "1px solid var(--scene-border)" }}
    >
      {children}
    </select>
  )
}

// Segmented 2014/2024 control for the Rules tab — picks which ruleset's text
// the edition-divergent entries display.
function EditionToggle({ value, onChange }: { value: Edition; onChange: (e: Edition) => void }) {
  return (
    <div
      className="inline-flex items-center rounded-lg p-0.5"
      style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
      role="group"
      aria-label="Ruleset edition"
    >
      {EDITIONS.map((ed) => {
        const active = ed === value
        return (
          <button
            key={ed}
            onClick={() => onChange(ed)}
            aria-pressed={active}
            className="px-3 py-1 rounded-md text-sm font-medium transition-opacity hover:opacity-90"
            style={{
              background: active ? "var(--scene-accent)" : "transparent",
              color: active ? "var(--scene-bg)" : "var(--scene-text-muted)",
            }}
          >
            {EDITION_LABELS[ed]}
          </button>
        )
      })}
    </div>
  )
}
