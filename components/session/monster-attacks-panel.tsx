"use client"

// The per-combatant attack roller in the DM combat tracker. Expands under a
// monster/NPC row: resolves the creature's SRD stat block by name (open5e, already
// browser-cached + wotc-srd filtered), lists its rollable attacks, and rolls to-hit
// + damage on tap via lib/dice-store (adv/dis on the d20, crit-doubles damage dice).
// A rolled hit can be applied straight to a target combatant's HP — the loop the
// initiative tracker was missing. No backend: pure client, no schema, no deploy.

import { useEffect, useState } from "react"
import { Dices, Loader2, ShieldAlert } from "lucide-react"
import { open5eApi, type Open5eMonster } from "@/lib/open5e-api"
import {
  parseMonsterAttacks,
  toHitExpr,
  damageExpr,
  avgDamage,
  baseMonsterName,
  type MonsterAttack,
} from "@/lib/monster-attacks"
import { rollExpression, type RollMode } from "@/lib/dice-store"
import type { HomebrewMonster } from "@/lib/homebrew"

type Target = { id: string; name: string; type: string }

type RollResult = {
  toHitTotal: number | null
  kept: number | null
  nat20: boolean
  nat1: boolean
  dmg: { type: string; total: number }[]
  damageTotal: number
}

// Best name match: exact (case-insensitive) first, then a startsWith, then the
// shortest result (so "goblin" prefers "Goblin" over "Hobgoblin Captain").
function pickMonster(monsters: Open5eMonster[], base: string): Open5eMonster | null {
  if (monsters.length === 0) return null
  const lc = base.toLowerCase()
  return (
    monsters.find((m) => m.name.toLowerCase() === lc) ??
    monsters.find((m) => m.name.toLowerCase().startsWith(lc)) ??
    [...monsters].sort((a, b) => a.name.length - b.name.length)[0]
  )
}

const MODES: { value: RollMode; label: string }[] = [
  { value: "advantage", label: "Adv" },
  { value: "normal", label: "Normal" },
  { value: "disadvantage", label: "Dis" },
]

export function MonsterAttacksPanel({
  monsterName,
  targets,
  onApply,
  homebrewMonsters = [],
}: {
  monsterName: string
  targets: Target[]
  onApply: (targetId: string, amount: number) => void
  homebrewMonsters?: HomebrewMonster[]
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "none">("loading")
  const [attacks, setAttacks] = useState<MonsterAttack[]>([])
  const [mode, setMode] = useState<RollMode>("normal")
  const [results, setResults] = useState<Record<number, RollResult>>({})
  // Default the damage target to the first PC (the usual victim), else anyone.
  const [targetId, setTargetId] = useState<string>(
    () => (targets.find((t) => t.type === "pc") ?? targets[0])?.id ?? "",
  )

  useEffect(() => {
    let cancelled = false
    setStatus("loading")
    setResults({})
    const base = baseMonsterName(monsterName)

    // Homebrew monsters resolve FIRST, by name — they have no open5e entry, and a
    // same-named custom creature should shadow the SRD one. Match the full tracker
    // name, then the index-stripped base ("Gloomstalker 1" → "Gloomstalker").
    const lc = monsterName.trim().toLowerCase()
    const baseLc = base.toLowerCase()
    const hb =
      homebrewMonsters.find((m) => m.name.toLowerCase() === lc) ??
      homebrewMonsters.find((m) => m.name.toLowerCase() === baseLc)
    if (hb) {
      const parsed = parseMonsterAttacks(hb.actions)
      setAttacks(parsed)
      setStatus(parsed.length > 0 ? "ready" : "none")
      return () => {
        cancelled = true
      }
    }

    open5eApi
      .getMonsters({ search: base })
      .then((monsters) => {
        if (cancelled) return
        const match = pickMonster(monsters, base)
        const parsed = match ? parseMonsterAttacks(match.actions) : []
        setAttacks(parsed)
        setStatus(parsed.length > 0 ? "ready" : "none")
      })
      .catch(() => {
        if (!cancelled) setStatus("none")
      })
    return () => {
      cancelled = true
    }
  }, [monsterName, homebrewMonsters])

  const doRoll = (attack: MonsterAttack, i: number) => {
    let toHitTotal: number | null = null
    let kept: number | null = null
    let nat20 = false
    let nat1 = false
    if (attack.toHit !== null) {
      const r = rollExpression(toHitExpr(attack.toHit), { mode })
      if (r) {
        toHitTotal = r.total
        kept = r.terms.find((t) => t.sides === 20)?.rolls[0] ?? null
        nat20 = kept === 20
        nat1 = kept === 1
      }
    }
    // Crit (nat 20) doubles the damage dice; the roller handles that via `crit`.
    const dmg = attack.damage.map((p) => {
      const r = rollExpression(damageExpr(p), { crit: nat20 })
      return { type: p.type, total: r ? Math.max(0, r.total) : 0 }
    })
    const damageTotal = dmg.reduce((s, d) => s + d.total, 0)
    setResults((prev) => ({ ...prev, [i]: { toHitTotal, kept, nat20, nat1, dmg, damageTotal } }))
  }

  const rollable = attacks.filter((a) => a.rollable)
  const info = attacks.filter((a) => !a.rollable)

  return (
    <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--scene-border)" }}>
      {status === "loading" && (
        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--scene-text-muted)" }}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Looking up attacks…
        </div>
      )}

      {status === "none" && (
        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--scene-text-muted)" }}>
          <ShieldAlert className="h-3.5 w-3.5" /> No SRD attacks found for “{monsterName}.” Use the ±HP buttons.
        </div>
      )}

      {status === "ready" && (
        <>
          {/* Roll mode + damage target */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <div className="inline-flex rounded-md overflow-hidden" style={{ border: "1px solid var(--scene-border)" }}>
              {MODES.map((m) => {
                const on = mode === m.value
                return (
                  <button
                    key={m.value}
                    onClick={() => setMode(m.value)}
                    className="px-2 py-1 text-[11px] font-medium transition-colors"
                    style={{
                      background: on ? "var(--scene-accent)" : "transparent",
                      color: on ? "var(--scene-bg)" : "var(--scene-text-muted)",
                    }}
                  >
                    {m.label}
                  </button>
                )
              })}
            </div>
            {targets.length > 0 && (
              <label className="flex items-center gap-1 text-[11px]" style={{ color: "var(--scene-text-muted)" }}>
                vs
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="rounded px-1.5 py-1 text-[11px] outline-none"
                  style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
                >
                  {targets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {/* Rollable attacks */}
          <div className="space-y-1.5">
            {rollable.map((attack, idx) => {
              const i = attacks.indexOf(attack)
              const res = results[i]
              return (
                <div
                  key={`${attack.name}-${idx}`}
                  className="rounded-md p-2"
                  style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}
                >
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium" style={{ color: "var(--scene-text-primary)" }}>
                        {attack.name}
                      </span>
                      <span className="ml-2 text-[11px]" style={{ color: "var(--scene-text-muted)" }}>
                        {attack.toHit !== null
                          ? `${attack.toHit >= 0 ? "+" : ""}${attack.toHit} to hit`
                          : attack.save
                            ? `DC ${attack.save.dc} ${attack.save.ability.slice(0, 3)}`
                            : ""}
                        {attack.reach ? ` · ${attack.reach}` : ""}
                        {attack.damage.length > 0 ? ` · ~${avgDamage(attack.damage)} dmg` : ""}
                      </span>
                    </div>
                    <button
                      onClick={() => doRoll(attack, i)}
                      className="flex flex-shrink-0 items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80"
                      style={{ background: "color-mix(in srgb, var(--scene-accent) 16%, transparent)", color: "var(--scene-accent)", border: "1px solid color-mix(in srgb, var(--scene-accent) 38%, transparent)" }}
                    >
                      <Dices className="h-3.5 w-3.5" /> Roll
                    </button>
                  </div>

                  {res && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 pt-2" style={{ borderTop: "1px dashed var(--scene-border)" }}>
                      {res.toHitTotal !== null && (
                        <span
                          className="text-sm font-bold tabular-nums"
                          style={{ color: res.nat20 ? "#22c55e" : res.nat1 ? "#ef4444" : "var(--scene-text-primary)" }}
                          title={res.kept !== null ? `d20: ${res.kept}` : undefined}
                        >
                          {res.nat1 ? "Nat 1 — miss" : `${res.toHitTotal} to hit`}
                          {res.nat20 ? " · CRIT" : ""}
                        </span>
                      )}
                      {!res.nat1 && res.dmg.length > 0 && (
                        <span className="text-sm tabular-nums" style={{ color: "var(--scene-text-primary)" }}>
                          {res.dmg.map((d, di) => (
                            <span key={di}>
                              {di > 0 ? " + " : ""}
                              <span style={{ fontWeight: 600 }}>{d.total}</span>{" "}
                              <span style={{ color: "var(--scene-text-muted)" }}>{d.type}</span>
                            </span>
                          ))}
                        </span>
                      )}
                      {!res.nat1 && res.damageTotal > 0 && targetId && (
                        <button
                          onClick={() => onApply(targetId, res.damageTotal)}
                          className="ml-auto flex-shrink-0 rounded px-2 py-1 text-xs font-medium transition-opacity hover:opacity-80"
                          style={{ background: "color-mix(in srgb, #ef4444 14%, transparent)", color: "#ef4444", border: "1px solid color-mix(in srgb, #ef4444 32%, transparent)" }}
                        >
                          Apply {res.damageTotal} →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Non-rollable actions (Multiattack, save-or-suck) — kept visible as a
              quick reference so nothing silently disappears. */}
          {info.length > 0 && (
            <div className="mt-2 space-y-1">
              {info.map((a, idx) => (
                <p key={`${a.name}-${idx}`} className="text-[11px] leading-snug" style={{ color: "var(--scene-text-muted)" }}>
                  <span className="font-medium" style={{ color: "var(--scene-text-primary)" }}>{a.name}.</span> {a.desc}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
