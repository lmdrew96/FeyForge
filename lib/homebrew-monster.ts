import type { MonsterAction } from "./open5e-api"
import { parseMonsterAttacks } from "./monster-attacks"

// ── Homebrew monster action synthesis ─────────────────────────────────────────
// A homebrew monster stores its actions in the open5e MonsterAction shape, with the
// `desc` synthesized here in SRD prose format so lib/monster-attacks.ts parses the
// to-hit / damage / save out of it exactly as it does for a real SRD creature — zero
// parser changes, so the combat tracker rolls a custom monster's attacks unchanged.
// The /homebrew form authors the structured MonsterActionInput; the tracker only ever
// sees the resulting MonsterAction. The edit form reverses the synthesis by re-running
// that same parser (actionToInput) — the single source of truth for the prose format.

export interface MonsterActionInput {
  name: string
  kind: "melee" | "ranged" | "save" | "other"
  toHit: number
  range: string // reach/range value only, e.g. "5 ft." or "80/320 ft."
  damageDice: string // "1d8"
  damageBonus: number
  damageType: string
  saveDC: number
  saveAbility: string // full ability name, e.g. "Dexterity"
  desc: string // extra flavor (melee/ranged/save) OR the whole body (other)
}

export const CR_OPTIONS = [
  "0", "1/8", "1/4", "1/2", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
  "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23",
  "24", "25", "26", "27", "28", "29", "30",
]
export const DAMAGE_TYPES = [
  "slashing", "piercing", "bludgeoning", "fire", "cold", "lightning", "thunder",
  "acid", "poison", "necrotic", "radiant", "psychic", "force",
]
export const SAVE_ABILITIES = [
  "Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma",
]

// Average damage for the "<avg> (XdY ± Z) <type> damage" SRD clause the parser keys on.
export const attackAvg = (count: number, sides: number, bonus: number): number =>
  Math.max(1, Math.floor((count * (sides + 1)) / 2 + bonus))

// "1d8" + 3 + "slashing" → "7 (1d8 + 3) slashing damage". Empty if dice unparseable.
export function damageClause(dice: string, bonus: number, type: string): string {
  const m = /(\d+)\s*d\s*(\d+)/i.exec(dice)
  if (!m) return ""
  const count = parseInt(m[1], 10)
  const sides = parseInt(m[2], 10)
  const avg = attackAvg(count, sides, bonus)
  const b = bonus > 0 ? ` + ${bonus}` : bonus < 0 ? ` - ${Math.abs(bonus)}` : ""
  const t = type.trim() || "bludgeoning"
  return `${avg} (${count}d${sides}${b}) ${t} damage`
}

// Structured input → an open5e MonsterAction with SRD-format `desc` the tracker parses.
export function synthesizeAction(a: MonsterActionInput): MonsterAction {
  const name = a.name.trim()
  const extra = a.desc.trim()
  if (a.kind === "other") {
    return { name, desc: extra }
  }
  const dmg = damageClause(a.damageDice, a.damageBonus, a.damageType)
  const dice = a.damageDice.trim()
  const damageFields = {
    ...(dice ? { damage_dice: dice } : {}),
    ...(a.damageBonus ? { damage_bonus: a.damageBonus } : {}),
  }
  if (a.kind === "save") {
    const desc =
      `${name || "The target"} must make a DC ${a.saveDC} ${a.saveAbility} saving throw` +
      (dmg ? `, taking ${dmg} on a failed save, or half as much on a success.` : ".") +
      (extra ? ` ${extra}` : "")
    return { name, desc, ...damageFields }
  }
  const verb = a.kind === "melee" ? "Melee Weapon Attack" : "Ranged Weapon Attack"
  const reachWord = a.kind === "melee" ? "reach" : "range"
  const reach = a.range.trim() || (a.kind === "melee" ? "5 ft." : "80/320 ft.")
  const sign = a.toHit >= 0 ? `+${a.toHit}` : `${a.toHit}`
  const hit = dmg ? ` Hit: ${dmg}.` : ""
  const desc =
    `${verb}: ${sign} to hit, ${reachWord} ${reach}, one target.${hit}` +
    (extra ? ` ${extra}` : "")
  return { name, desc, attack_bonus: a.toHit, ...damageFields }
}

// Reverse: re-run the live parser so the edit form shows the same fields the tracker
// reads. Freeform `extra` flavor isn't separated back out (v1) — only "other" keeps its
// full body editable.
export function actionToInput(a: MonsterAction): MonsterActionInput {
  const [parsed] = parseMonsterAttacks([a])
  const part = parsed?.damage[0]
  const kind: MonsterActionInput["kind"] =
    parsed?.kind === "area"
      ? "save"
      : parsed?.kind === "ranged"
        ? "ranged"
        : parsed?.kind === "melee"
          ? "melee"
          : "other"
  return {
    name: a.name,
    kind,
    toHit: parsed?.toHit ?? a.attack_bonus ?? 0,
    range: parsed?.reach ? parsed.reach.replace(/^(reach|range)\s+/i, "") : "",
    damageDice: part ? `${part.count}d${part.sides}` : a.damage_dice ?? "",
    damageBonus: part ? part.bonus : a.damage_bonus ?? 0,
    damageType: part ? part.type : "slashing",
    saveDC: parsed?.save?.dc ?? 13,
    saveAbility: parsed?.save?.ability ?? "Dexterity",
    desc: kind === "other" ? a.desc : "",
  }
}
