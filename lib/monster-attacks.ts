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
// To-hit and saves are phrased differently in the 2014 vs 2024 SRD, so we match
// BOTH dialects (the parser stays edition-agnostic — the bundle, homebrew, and any
// future edition toggle all flow through here):
//   2014  "Melee Weapon Attack: +9 to hit"   ·  "DC 18 Dexterity saving throw"
//   2024  "Melee Attack Roll: +9, reach …"   ·  "Dexterity Saving Throw: DC 18"
const TO_HIT_RE = /([+-]?\d+)\s+to hit/i
const ATTACK_ROLL_RE = /Attack Roll:\s*([+-]?\d+)/i
const SAVE_RE = new RegExp(`DC\\s+(\\d+)\\s+(${ABILITIES})\\s+saving throw`, "i")
const SAVE_2024_RE = new RegExp(`(${ABILITIES})\\s+Saving Throw:\\s*DC\\s+(\\d+)`, "i")
const REACH_RE = /\b(reach\s+\d+\s*ft\.?|range\s+\d+\/\d+\s*ft\.?|range\s+\d+\s*ft\.?)/i
// Damage clauses, in ONE global pass so riders are caught and nothing is double-counted.
// Two shapes, dice tried FIRST so it consumes its own average number before the flat
// alternative can mis-read it:
//   dice → "<avg> (<count>d<sides>[ ± <bonus>]) <type> damage"  e.g. "17 (2d10 + 6) piercing damage"
//   flat → "<amount> <type> damage"                             e.g. "1 piercing damage" (Bat, Crab, Rat…)
// Flat-damage attacks (no dice clause) are real SRD weapon attacks — without this branch
// they parse to zero damage and the combat tracker can't apply their hits.
const DAMAGE_RE =
  /(\d+)\s*\(\s*(\d+)d(\d+)\s*(?:([+-])\s*(\d+))?\s*\)\s*([a-zA-Z]+)\s+damage|(\d+)\s+([a-zA-Z]+)\s+damage/gi

function parseDamage(desc: string): DamagePart[] {
  const parts: DamagePart[] = []
  DAMAGE_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = DAMAGE_RE.exec(desc)) !== null) {
    if (m[2] !== undefined) {
      // dice clause
      const bonus = m[4] ? (m[4] === "-" ? -1 : 1) * parseInt(m[5], 10) : 0
      parts.push({ count: parseInt(m[2], 10), sides: parseInt(m[3], 10), bonus, type: m[6].toLowerCase() })
    } else {
      // flat clause — no dice; modeled as 0 dice + a flat bonus so avgDamage/damageExpr
      // and the roller all treat it as a constant.
      parts.push({ count: 0, sides: 0, bonus: parseInt(m[7], 10), type: m[8].toLowerCase() })
    }
  }
  return parts
}

export function parseMonsterAttacks(actions: MonsterAction[] | undefined): MonsterAttack[] {
  if (!actions) return []
  return actions.map((a) => {
    const desc = a.desc ?? ""
    // to-hit: prefer the structured bonus (an explicit 0 is a real +0 attack only
    // if the prose also says "to hit"); else scrape the prose.
    const hasToHitProse = /to hit/i.test(desc) || /attack roll:/i.test(desc)
    // 2014 "+9 to hit" or 2024 "Attack Roll: +9" — both capture the bonus in [1].
    const toHitProse = TO_HIT_RE.exec(desc) ?? ATTACK_ROLL_RE.exec(desc)
    const toHit =
      typeof a.attack_bonus === "number" && (a.attack_bonus !== 0 || hasToHitProse)
        ? a.attack_bonus
        : toHitProse
          ? parseInt(toHitProse[1], 10)
          : null

    // 2014 "DC 18 Dexterity saving throw" ([1]=dc, [2]=ability) or 2024 "Dexterity
    // Saving Throw: DC 18" ([1]=ability, [2]=dc). The two are mutually exclusive.
    const saveM = SAVE_RE.exec(desc)
    const save2024 = saveM ? null : SAVE_2024_RE.exec(desc)
    const save = saveM
      ? { dc: parseInt(saveM[1], 10), ability: saveM[2] }
      : save2024
        ? { dc: parseInt(save2024[2], 10), ability: save2024[1] }
        : null

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
  if (p.count === 0) return String(p.bonus) // flat damage — no dice to roll, crit-safe
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
