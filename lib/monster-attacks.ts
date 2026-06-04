// Turn an open5e creature's `actions` into rollable monster attacks for the live
// combat tracker. The DM taps an attack → the tracker rolls to-hit + damage via
// lib/dice-store (which already does adv/dis on the d20 and crit-doubles only the
// damage dice). This module is PURE — it just parses; the UI does the rolling — so
// it stays trivially testable.
//
// Source of truth, in order of trust:
//   - to-hit  → structured `attack_bonus` (verified live), else "+X to hit" prose.
//   - damage  → desc prose, because it carries the TYPE (slashing/fire/…) and any
//               RIDER damage ("plus 7 (2d6) fire damage") that the structured
//               `damage_dice`/`damage_bonus` (primary only) omit. Structured damage
//               is a fallback when the prose has nothing parseable.
//   - save    → "DC N <Ability> saving throw" (breath weapons et al.).
// Actions with neither a to-hit nor save+damage (Multiattack, Frightful Presence)
// are kept as NON-rollable info lines so nothing silently disappears from the panel.

import type { MonsterAction } from "./open5e-api"

export type DamagePart = { count: number; sides: number; bonus: number; type: string }

export type MonsterAttack = {
  name: string
  rollable: boolean // false → render as a read-only info line (Multiattack, …)
  kind: "melee" | "ranged" | "area" | "other"
  toHit: number | null // null for save-based or info actions
  save: { dc: number; ability: string } | null
  reach: string | null // "reach 5 ft." / "range 80/320 ft." — display only
  damage: DamagePart[]
  desc: string
}

const ABILITIES = "Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma"
const TO_HIT_RE = /([+-]?\d+)\s+to hit/i
const SAVE_RE = new RegExp(`DC\\s+(\\d+)\\s+(${ABILITIES})\\s+saving throw`, "i")
const REACH_RE = /\b(reach\s+\d+\s*ft\.?|range\s+\d+\/\d+\s*ft\.?|range\s+\d+\s*ft\.?)/i
// "<avg> (<count>d<sides>[ ± <bonus>]) <type> damage" — matches the primary clause
// AND every rider ("plus 7 (2d6) fire damage") in one global pass.
const DAMAGE_RE = /\d+\s*\(\s*(\d+)d(\d+)\s*(?:([+-])\s*(\d+))?\s*\)\s*([a-zA-Z]+)\s+damage/gi

function parseDamage(desc: string): DamagePart[] {
  const parts: DamagePart[] = []
  DAMAGE_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = DAMAGE_RE.exec(desc)) !== null) {
    const bonus = m[3] ? (m[3] === "-" ? -1 : 1) * parseInt(m[4], 10) : 0
    parts.push({ count: parseInt(m[1], 10), sides: parseInt(m[2], 10), bonus, type: m[5].toLowerCase() })
  }
  return parts
}

export function parseMonsterAttacks(actions: MonsterAction[] | undefined): MonsterAttack[] {
  if (!actions) return []
  return actions.map((a) => {
    const desc = a.desc ?? ""
    // to-hit: prefer the structured bonus (an explicit 0 is a real +0 attack only
    // if the prose also says "to hit"); else scrape the prose.
    const hasToHitProse = /to hit/i.test(desc)
    const toHitProse = TO_HIT_RE.exec(desc)
    const toHit =
      typeof a.attack_bonus === "number" && (a.attack_bonus !== 0 || hasToHitProse)
        ? a.attack_bonus
        : toHitProse
          ? parseInt(toHitProse[1], 10)
          : null

    const saveM = SAVE_RE.exec(desc)
    const save = saveM ? { dc: parseInt(saveM[1], 10), ability: saveM[2] } : null

    let damage = parseDamage(desc)
    if (damage.length === 0 && a.damage_dice) {
      const dm = /(\d+)d(\d+)/.exec(a.damage_dice)
      if (dm) damage = [{ count: +dm[1], sides: +dm[2], bonus: a.damage_bonus ?? 0, type: "damage" }]
    }

    const reachM = REACH_RE.exec(desc)
    const kind: MonsterAttack["kind"] = /melee/i.test(desc)
      ? "melee"
      : /ranged/i.test(desc)
        ? "ranged"
        : save
          ? "area"
          : "other"
    // Rollable = a weapon attack (has a to-hit) OR a save that deals damage (breath
    // weapon). A save with no damage (Frightful Presence) stays info-only.
    const rollable = toHit !== null || (save !== null && damage.length > 0)
    return {
      name: a.name,
      rollable,
      kind,
      toHit: rollable ? toHit : null,
      save,
      reach: reachM ? reachM[1] : null,
      damage,
      desc,
    }
  })
}

// ── Expression builders for lib/dice-store's roller ───────────────────────────────
// Kept SEPARATE so the to-hit is its own single-d20 expression (adv/dis only applies
// to a lone d20) and each damage part rolls independently (per-type breakdown + crit
// doubling handled by the roller's `crit` flag).

export const toHitExpr = (toHit: number): string =>
  toHit >= 0 ? `1d20+${toHit}` : `1d20-${Math.abs(toHit)}`

export const damageExpr = (p: DamagePart): string => {
  const base = `${p.count}d${p.sides}`
  if (p.bonus > 0) return `${base}+${p.bonus}`
  if (p.bonus < 0) return `${base}-${Math.abs(p.bonus)}`
  return base
}

// Average damage across all parts — the at-a-glance number on an un-rolled attack.
export const avgDamage = (parts: DamagePart[]): number =>
  Math.floor(parts.reduce((s, p) => s + (p.count * (p.sides + 1)) / 2 + p.bonus, 0))

// Strip the DM's per-instance label off a tracker name so the open5e search hits the
// base creature: "Goblin 2" / "Goblin B" / "Goblin (wounded)" / "Goblin #3" → "Goblin".
export const baseMonsterName = (name: string): string =>
  name
    .replace(/\s*[(#].*$/, "") // " (wounded)", " #3"
    .replace(/\s+\d+$/, "") // trailing number
    .replace(/\s+[A-Z]$/, "") // trailing single capital letter
    .trim() || name
