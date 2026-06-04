/**
 * Sheet spellbook: storage↔model mapping for spells, mirroring sheet-items.ts.
 *
 * Spells live as `characterProperties` rows (`{ type:"spell", name, data:{...} }`)
 * exactly like inventory items — the row's name carries the spell name, the blob
 * below carries the rest. The `spellcasting` block on the character (slots / DC /
 * attack / ability) is separate; this module is only the per-spell payload + the
 * Open5e → stored conversion the picker uses.
 *
 * Kept Convex-free (generic row type) so it stays pure domain; Convex Docs
 * structurally satisfy SpellRow.
 */

import type { Open5eSpell } from "../open5e-api"

// The blob kept in `characterProperties.data` for one spell. `level` 0 = cantrip.
// `slug` is the Open5e id (homebrew spells, when they land, simply omit it).
export interface StoredSpellData {
  slug?: string
  level: number
  school?: string
  castingTime?: string
  range?: string
  components?: string // raw "V, S, M"
  material?: string
  duration?: string
  concentration?: boolean
  ritual?: boolean
  description?: string
  higherLevel?: string // upcast text from Open5e `higher_level`
  // For prepared/spellbook casters: whether this spell is currently prepared.
  // Ignored for known casters (everything known is castable). Cantrips are always
  // prepared, so this never gates a level-0 spell.
  prepared?: boolean
}

// A characterProperties row, generically typed (Convex Docs satisfy it).
export interface SpellRow {
  _id: string
  name: string
  active: boolean
  data: unknown
}

// A flat spell the sheet renders, row id hoisted alongside the stored fields.
export type SheetSpell = StoredSpellData & {
  id: string
  name: string
  active: boolean
}

// Convex row → flat SheetSpell. Spread `data` first; default `level` to 0 so a
// malformed row degrades to a cantrip rather than NaN-sorting the spell list.
export function rowToSpell(row: SpellRow): SheetSpell {
  const data = (row.data ?? {}) as StoredSpellData
  return {
    ...data,
    id: row._id,
    name: row.name,
    active: row.active,
    level: typeof data.level === "number" ? data.level : 0,
  }
}

// Open5e exposes ritual/concentration as the strings "true"/"false".
const truthy = (s?: string): boolean => (s ?? "").toLowerCase() === "true"

// Open5e spell → stored blob. Keeps the descriptive fields for display + the
// upcast prose; damage-dice parsing is intentionally out of scope for v1 (cast
// rolls the spell attack + shows the DC; damage is rolled manually).
export function spellToStored(s: Open5eSpell): StoredSpellData {
  return {
    slug: s.slug,
    level: s.level_int,
    school: s.school,
    castingTime: s.casting_time,
    range: s.range,
    components: s.components,
    material: s.material || undefined,
    duration: s.duration,
    concentration: truthy(s.concentration),
    ritual: truthy(s.ritual),
    description: s.desc,
    higherLevel: s.higher_level || undefined,
  }
}

// Spell-level label for section headers: "Cantrips", "1st", "2nd", …
export function spellLevelLabel(level: number): string {
  if (level <= 0) return "Cantrips"
  const suffix =
    level === 1 ? "st" : level === 2 ? "nd" : level === 3 ? "rd" : "th"
  return `${level}${suffix}`
}

// Group spells by level (cantrips first), each group name-sorted. Drives the
// spellbook's sectioned list.
export function groupSpellsByLevel(
  spells: SheetSpell[],
): { level: number; spells: SheetSpell[] }[] {
  const byLevel = new Map<number, SheetSpell[]>()
  for (const spell of spells) {
    const list = byLevel.get(spell.level) ?? []
    list.push(spell)
    byLevel.set(spell.level, list)
  }
  return [...byLevel.keys()]
    .sort((a, b) => a - b)
    .map((level) => ({
      level,
      spells: byLevel.get(level)!.sort((a, b) => a.name.localeCompare(b.name)),
    }))
}
