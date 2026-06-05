/**
 * Wildshape forms + companions — the data layer. Both are "a creature stat block
 * attached to a character": a Druid's Wild Shape beast, a Ranger's beast companion,
 * a Find Familiar, a summon. Stored as `characterProperties` rows (type
 * "alternateForm" / "companion") in the generic `data` blob — NO schema change.
 *
 * A stored stat block is a self-contained SNAPSHOT (so it survives even if Open5e
 * changes) plus the live mutable bits (current HP, active/summoned). Attacks are
 * re-parsed from the stored Open5e `actions` at render via lib/monster-attacks.
 *
 * v1 = 2014 ruleset. Wild Shape CR limits are edition-stable enough for 2014; the
 * 2024 Wild Shape rework is deferred (see the wildshape/companions patch).
 */

import type { Ability } from "./constants"
import type { Open5eMonster, MonsterAction } from "@/lib/open5e-api"

// Self-contained stat-block snapshot persisted in characterProperties.data.
export interface StatBlockSnapshot {
  creatureName: string
  creatureSlug?: string
  size?: string
  type?: string
  cr?: string
  ac: number
  maxHp: number
  speed: Record<string, number>
  abilities: Record<Ability, number>
  actions?: MonsterAction[]
}

// Stored blob for an alternate form (Wild Shape, Polymorph). `active` = currently
// transformed into this one (only one form is active at a time, enforced in the UI).
export interface StoredFormData extends StatBlockSnapshot {
  formSource: "wildshape" | "polymorph" | "other"
  currentHp: number
  active: boolean
}

// Stored blob for a companion (familiar / beast companion / mount / summon).
export interface StoredCompanionData extends StatBlockSnapshot {
  companionType: "familiar" | "animalCompanion" | "mount" | "summon" | "other"
  customName?: string
  currentHp: number
}

const ABILITY_KEYS: Ability[] = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
]

// Open5e monster → a stat-block snapshot. Defensive about missing fields so a
// sparse SRD entry never produces NaN HP/AC.
export function monsterToStatBlock(m: Open5eMonster): StatBlockSnapshot {
  return {
    creatureName: m.name,
    creatureSlug: m.slug,
    size: m.size,
    type: m.type,
    cr: m.challenge_rating,
    ac: m.armor_class ?? 10,
    maxHp: m.hit_points ?? 1,
    speed: m.speed ?? { walk: 30 },
    abilities: {
      strength: m.strength ?? 10,
      dexterity: m.dexterity ?? 10,
      constitution: m.constitution ?? 10,
      intelligence: m.intelligence ?? 10,
      wisdom: m.wisdom ?? 10,
      charisma: m.charisma ?? 10,
    },
    actions: m.actions,
  }
}

export function monsterToForm(
  m: Open5eMonster,
  formSource: StoredFormData["formSource"] = "wildshape",
): StoredFormData {
  const snap = monsterToStatBlock(m)
  return { ...snap, formSource, currentHp: snap.maxHp, active: false }
}

export function monsterToCompanion(
  m: Open5eMonster,
  companionType: StoredCompanionData["companionType"] = "animalCompanion",
): StoredCompanionData {
  const snap = monsterToStatBlock(m)
  return { ...snap, companionType, currentHp: snap.maxHp }
}

// Convex row (data: any) → typed stored blob, defaulting safely.
export function rowToForm(row: { _id: string; name: string; data: unknown }): StoredFormData & { rowId: string } {
  const d = (row.data ?? {}) as Partial<StoredFormData>
  return {
    rowId: row._id,
    creatureName: d.creatureName ?? row.name,
    creatureSlug: d.creatureSlug,
    size: d.size,
    type: d.type,
    cr: d.cr,
    ac: d.ac ?? 10,
    maxHp: d.maxHp ?? 1,
    speed: d.speed ?? { walk: 30 },
    abilities: d.abilities ?? defaultAbilities(),
    actions: d.actions,
    formSource: d.formSource ?? "wildshape",
    currentHp: d.currentHp ?? d.maxHp ?? 1,
    active: d.active ?? false,
  }
}

export function rowToCompanion(row: { _id: string; name: string; data: unknown }): StoredCompanionData & { rowId: string } {
  const d = (row.data ?? {}) as Partial<StoredCompanionData>
  return {
    rowId: row._id,
    creatureName: d.creatureName ?? row.name,
    creatureSlug: d.creatureSlug,
    size: d.size,
    type: d.type,
    cr: d.cr,
    ac: d.ac ?? 10,
    maxHp: d.maxHp ?? 1,
    speed: d.speed ?? { walk: 30 },
    abilities: d.abilities ?? defaultAbilities(),
    actions: d.actions,
    companionType: d.companionType ?? "animalCompanion",
    customName: d.customName,
    currentHp: d.currentHp ?? d.maxHp ?? 1,
  }
}

function defaultAbilities(): Record<Ability, number> {
  return Object.fromEntries(ABILITY_KEYS.map((a) => [a, 10])) as Record<Ability, number>
}

// ── Wild Shape rules (2014 SRD) ──────────────────────────────────────────────────

// The maximum beast challenge rating a druid can Wild Shape into (2014):
//   base:  L2 → CR 1/4, L4 → 1/2, L8 → 1.
//   Circle of the Moon: L2 → CR 1, then L6+ → druid level / 3 (rounded down).
// (Movement restrictions — no fly until L8, no swim until L4 — are surfaced as a
// note in the UI rather than filtered, since they don't change the CR pool.)
export function wildShapeMaxCR(druidLevel: number, isMoonCircle: boolean): number {
  if (isMoonCircle) {
    if (druidLevel >= 6) return Math.floor(druidLevel / 3)
    return druidLevel >= 2 ? 1 : 0
  }
  if (druidLevel >= 8) return 1
  if (druidLevel >= 4) return 0.5
  if (druidLevel >= 2) return 0.25
  return 0
}

// A short label for a CR limit ("1/4", "1/2", "1", "6").
export function crLabel(cr: number): string {
  if (cr === 0.25) return "1/4"
  if (cr === 0.5) return "1/2"
  return String(cr)
}

// Detect Circle of the Moon from a stored subclass string (name or id, free text
// tolerant). Moon raises the Wild Shape CR pool and grants combat forms.
export function isMoonCircle(subclass?: string): boolean {
  return !!subclass && subclass.toLowerCase().includes("moon")
}
