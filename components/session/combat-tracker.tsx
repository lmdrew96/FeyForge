"use client"

import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import {
  Swords,
  Play,
  Square,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  Heart,
  Shield,
  Skull,
} from "lucide-react"

type SessionId = Id<"partySessions">

// 14 core conditions (exhaustion is a level track, handled elsewhere).
const CONDITIONS = [
  "Blinded", "Charmed", "Deafened", "Frightened", "Grappled",
  "Incapacitated", "Invisible", "Paralyzed", "Petrified",
  "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious",
]

const CONDITION_COLORS: Record<string, string> = {
  Blinded: "#6b7280", Charmed: "#ec4899", Deafened: "#6b7280",
  Frightened: "#f59e0b", Grappled: "#8b5cf6", Incapacitated: "#ef4444",
  Invisible: "#a1a1aa", Paralyzed: "#ef4444", Petrified: "#78716c",
  Poisoned: "#22c55e", Prone: "#94a3b8", Restrained: "#8b5cf6",
  Stunned: "#ef4444", Unconscious: "#1f2937",
}

const TYPE_LABEL: Record<string, string> = {
  pc: "PC",
  npc: "NPC",
  monster: "Monster",
}

const rollD20 = () => Math.floor(Math.random() * 20) + 1

// ── DM tracker ──────────────────────────────────────────────────────────────────

export function DMCombatTracker({ sessionId }: { sessionId: SessionId }) {
  const combat = useQuery(api.liveCombat.getCombat, { sessionId })
  const partyMembers = useQuery(api.liveSessions.getPartyMembers, { sessionId })

  const doStart = useMutation(api.liveCombat.startCombat)
  const doEnd = useMutation(api.liveCombat.endCombat)
  const doNext = useMutation(api.liveCombat.nextTurn)
  const doPrev = useMutation(api.liveCombat.previousTurn)
  const doAdd = useMutation(api.liveCombat.addCombatant)
  const doRemove = useMutation(api.liveCombat.removeCombatant)
  const doAdjustHp = useMutation(api.liveCombat.adjustHp)
  const doToggleCondition = useMutation(api.liveCombat.toggleCondition)
  const doSetInitiative = useMutation(api.liveCombat.setInitiative)
  const doSetDeathSaves = useMutation(api.liveCombat.setDeathSaves)

  const [monsterName, setMonsterName] = useState("")
  const [monsterHp, setMonsterHp] = useState("")
  const [monsterAc, setMonsterAc] = useState("")
  const [monsterInit, setMonsterInit] = useState("")
  const [expandedConditions, setExpandedConditions] = useState<string | null>(null)

  const isActive = combat !== null && combat !== undefined

  // Build the starting line-up from the joined party, rolling initiative for each.
  const handleStart = async () => {
    const members = (partyMembers ?? []).filter((m) => m.character)
    const combatants = members.map((m) => {
      const char = m.character!
      return {
        id: crypto.randomUUID(),
        name: char.name,
        type: "pc" as const,
        initiative: rollD20(), // DM can edit; no Dex mod stored on the live row
        initiativeBonus: 0,
        armorClass: 10,
        hitPoints: {
          current: char.hitPoints.current,
          max: char.hitPoints.max,
          temp: char.hitPoints.temp,
        },
        conditions: [] as string[],
        characterId: char._id,
        userId: m.userId,
      }
    })
    try {
      await doStart({ sessionId, combatants })
      toast.success("Combat started — roll for initiative!")
    } catch {
      toast.error("Failed to start combat.")
    }
  }

  const handleAddMonster = async () => {
    const name = monsterName.trim()
    if (!name) return
    const hp = parseInt(monsterHp, 10) || 1
    const ac = parseInt(monsterAc, 10) || 10
    const init = monsterInit.trim() ? parseInt(monsterInit, 10) : rollD20()
    try {
      await doAdd({
        sessionId,
        combatant: {
          id: crypto.randomUUID(),
          name,
          type: "monster",
          initiative: init,
          initiativeBonus: 0,
          armorClass: ac,
          hitPoints: { current: hp, max: hp, temp: 0 },
          conditions: [],
        },
      })
      setMonsterName("")
      setMonsterHp("")
      setMonsterAc("")
      setMonsterInit("")
    } catch {
      toast.error("Failed to add combatant.")
    }
  }

  // ── Not started yet ──
  if (combat === undefined) {
    return (
      <div className="animate-pulse rounded-xl h-32" style={{ background: "var(--scene-surface)" }} />
    )
  }

  if (!isActive) {
    const joinable = (partyMembers ?? []).filter((m) => m.character).length
    return (
      <section>
        <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>
          Combat
        </h2>
        <div
          className="rounded-xl p-6 text-center"
          style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
        >
          <Swords className="h-8 w-8 mx-auto mb-3" style={{ color: "var(--scene-accent)", opacity: 0.5 }} />
          <p className="text-sm mb-4" style={{ color: "var(--scene-text-muted)" }}>
            {joinable > 0
              ? `Start an encounter with ${joinable} party member${joinable !== 1 ? "s" : ""} — initiative is rolled automatically (edit as needed).`
              : "No players have joined yet. You can start combat and add monsters, or wait for the party."}
          </p>
          <button
            onClick={handleStart}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-opacity hover:opacity-80"
            style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
          >
            <Play className="h-4 w-4" /> Start Combat
          </button>
        </div>
      </section>
    )
  }

  return (
    <section>
      {/* Header: round + turn controls */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs uppercase tracking-widest flex items-center gap-2" style={{ color: "var(--scene-text-muted)" }}>
          <Swords className="h-3.5 w-3.5" style={{ color: "var(--scene-accent)" }} />
          Combat — Round {combat.round}
        </h2>
        <button
          onClick={() => {
            if (!confirm("End combat?")) return
            doEnd({ sessionId }).catch(() => toast.error("Failed to end combat."))
          }}
          className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-opacity hover:opacity-80"
          style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}
        >
          <Square className="h-3 w-3" /> End
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => doPrev({ sessionId }).catch(() => {})}
          className="flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80"
          style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)", color: "var(--scene-text-muted)" }}
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </button>
        <button
          onClick={() => doNext({ sessionId }).catch(() => {})}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
        >
          Next Turn <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Initiative order */}
      <div className="space-y-2 mb-4">
        {combat.combatants.map((c) => {
          const hp = c.hitPoints
          const pct = hp && hp.max > 0 ? Math.max(0, hp.current / hp.max) : 0
          const barColor = pct > 0.5 ? "var(--scene-accent)" : pct > 0.25 ? "#f59e0b" : "#ef4444"
          const isDown = hp ? hp.current <= 0 : false
          return (
            <div
              key={c.id}
              className="rounded-lg p-3 transition-all"
              style={{
                background: c.isActive
                  ? "color-mix(in srgb, var(--scene-accent) 12%, var(--scene-surface))"
                  : "var(--scene-surface)",
                border: c.isActive
                  ? "1px solid var(--scene-accent)"
                  : "1px solid var(--scene-border)",
                boxShadow: c.isActive ? "0 0 12px var(--scene-accent-glow)" : "none",
                opacity: isDown ? 0.6 : 1,
              }}
            >
              <div className="flex items-center gap-3">
                {/* Initiative (editable) */}
                <input
                  type="number"
                  value={c.initiative}
                  onChange={(e) =>
                    doSetInitiative({
                      sessionId,
                      combatantId: c.id,
                      initiative: parseInt(e.target.value, 10) || 0,
                    }).catch(() => {})
                  }
                  className="w-10 text-center text-sm font-bold rounded bg-transparent outline-none tabular-nums"
                  style={{ color: "var(--scene-text-primary)", border: "1px solid var(--scene-border)" }}
                  aria-label={`${c.name} initiative`}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold truncate" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
                      {c.name}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}>
                      {TYPE_LABEL[c.type]}
                    </span>
                    {c.armorClass !== undefined && (
                      <span className="text-xs flex items-center gap-0.5 flex-shrink-0" style={{ color: "var(--scene-text-muted)" }}>
                        <Shield className="h-3 w-3" /> {c.armorClass}
                      </span>
                    )}
                  </div>
                  {hp && (
                    <div className="mt-1.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs tabular-nums" style={{ color: "var(--scene-text-muted)" }}>
                          {hp.current}/{hp.max}{hp.temp > 0 ? ` (+${hp.temp})` : ""}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--scene-border)" }}>
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct * 100}%`, background: barColor }} />
                      </div>
                    </div>
                  )}
                  {/* Conditions */}
                  {c.conditions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {c.conditions.map((cond) => (
                        <span key={cond} className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${CONDITION_COLORS[cond] ?? "#6b7280"}22`, color: CONDITION_COLORS[cond] ?? "#6b7280", border: `1px solid ${CONDITION_COLORS[cond] ?? "#6b7280"}44` }}>
                          {cond}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Death saves for downed PCs */}
                  {c.type === "pc" && isDown && (
                    <div className="flex items-center gap-2 mt-2">
                      <Skull className="h-3.5 w-3.5" style={{ color: "#ef4444" }} />
                      <DeathSaveDots
                        label="Successes"
                        color="var(--scene-accent)"
                        count={c.deathSaves?.successes ?? 0}
                        onSet={(n) =>
                          doSetDeathSaves({
                            sessionId,
                            combatantId: c.id,
                            successes: n,
                            failures: c.deathSaves?.failures ?? 0,
                          }).catch(() => {})
                        }
                      />
                      <DeathSaveDots
                        label="Failures"
                        color="#ef4444"
                        count={c.deathSaves?.failures ?? 0}
                        onSet={(n) =>
                          doSetDeathSaves({
                            sessionId,
                            combatantId: c.id,
                            successes: c.deathSaves?.successes ?? 0,
                            failures: n,
                          }).catch(() => {})
                        }
                      />
                    </div>
                  )}
                </div>

                {/* HP controls */}
                {hp && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <HpButton label="−5" color="#ef4444" onClick={() => doAdjustHp({ sessionId, combatantId: c.id, amount: -5 }).catch(() => {})} />
                    <HpButton label="−1" color="#ef4444" onClick={() => doAdjustHp({ sessionId, combatantId: c.id, amount: -1 }).catch(() => {})} />
                    <HpButton label="+1" color="var(--scene-accent)" onClick={() => doAdjustHp({ sessionId, combatantId: c.id, amount: 1 }).catch(() => {})} />
                    <HpButton label="+5" color="var(--scene-accent)" onClick={() => doAdjustHp({ sessionId, combatantId: c.id, amount: 5 }).catch(() => {})} />
                  </div>
                )}

                {/* Row actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => setExpandedConditions(expandedConditions === c.id ? null : c.id)}
                    className="p-1.5 rounded transition-opacity hover:opacity-80"
                    style={{ color: "var(--scene-text-muted)" }}
                    aria-label="Toggle conditions"
                  >
                    <Heart className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => doRemove({ sessionId, combatantId: c.id }).catch(() => {})}
                    className="p-1.5 rounded transition-opacity hover:opacity-80"
                    style={{ color: "var(--scene-text-muted)" }}
                    aria-label={`Remove ${c.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Condition picker */}
              {expandedConditions === c.id && (
                <div className="flex flex-wrap gap-1.5 mt-3 pt-3" style={{ borderTop: "1px solid var(--scene-border)" }}>
                  {CONDITIONS.map((cond) => {
                    const on = c.conditions.includes(cond)
                    return (
                      <button
                        key={cond}
                        onClick={() => doToggleCondition({ sessionId, combatantId: c.id, condition: cond }).catch(() => {})}
                        className="text-xs px-2 py-1 rounded transition-all"
                        style={{
                          background: on ? `${CONDITION_COLORS[cond] ?? "#6b7280"}22` : "var(--scene-border)",
                          color: on ? CONDITION_COLORS[cond] ?? "#6b7280" : "var(--scene-text-muted)",
                          border: on ? `1px solid ${CONDITION_COLORS[cond] ?? "#6b7280"}66` : "1px solid transparent",
                        }}
                      >
                        {cond}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add monster */}
      <div className="rounded-xl p-3" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            value={monsterName}
            onChange={(e) => setMonsterName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddMonster()}
            placeholder="Monster / NPC name…"
            className="flex-1 min-w-[140px] px-3 py-2 rounded-md text-sm bg-transparent outline-none"
            style={{ border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
          />
          <input
            value={monsterInit}
            onChange={(e) => setMonsterInit(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddMonster()}
            placeholder="Init"
            type="number"
            className="w-16 px-2 py-2 rounded-md text-sm bg-transparent outline-none text-center"
            style={{ border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
            title="Initiative (rolled if blank)"
          />
          <input
            value={monsterHp}
            onChange={(e) => setMonsterHp(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddMonster()}
            placeholder="HP"
            type="number"
            className="w-16 px-2 py-2 rounded-md text-sm bg-transparent outline-none text-center"
            style={{ border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
          />
          <input
            value={monsterAc}
            onChange={(e) => setMonsterAc(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddMonster()}
            placeholder="AC"
            type="number"
            className="w-16 px-2 py-2 rounded-md text-sm bg-transparent outline-none text-center"
            style={{ border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
          />
          <button
            onClick={handleAddMonster}
            disabled={!monsterName.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>
    </section>
  )
}

function HpButton({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-8 py-1 rounded text-xs font-bold transition-opacity hover:opacity-80"
      style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color, border: `1px solid color-mix(in srgb, ${color} 35%, transparent)` }}
    >
      {label}
    </button>
  )
}

// Three clickable dots; clicking dot N sets the count to N, clicking the filled
// last dot clears back to N-1.
function DeathSaveDots({
  label,
  color,
  count,
  onSet,
}: {
  label: string
  color: string
  count: number
  onSet: (n: number) => void
}) {
  return (
    <div className="flex items-center gap-1" title={label}>
      {[1, 2, 3].map((n) => (
        <button
          key={n}
          onClick={() => onSet(count === n ? n - 1 : n)}
          className="w-3 h-3 rounded-full transition-all"
          style={{
            background: n <= count ? color : "transparent",
            border: `1px solid ${color}`,
          }}
          aria-label={`${label} ${n}`}
        />
      ))}
    </div>
  )
}

// ── Player combat view (read-only) ──────────────────────────────────────────────

export function PlayerCombatView({ sessionId }: { sessionId: SessionId }) {
  const combat = useQuery(api.liveCombat.getCombat, { sessionId })

  // Nothing rendered until combat is live — keeps the player view quiet otherwise.
  if (!combat) return null

  const BAND_LABEL: Record<string, string> = {
    healthy: "Healthy",
    bloodied: "Bloodied",
    down: "Down",
  }
  const BAND_COLOR: Record<string, string> = {
    healthy: "var(--scene-accent)",
    bloodied: "#f59e0b",
    down: "#ef4444",
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Swords className="h-3.5 w-3.5" style={{ color: "var(--scene-accent)" }} />
        <h2 className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-accent)" }}>
          Combat — Round {combat.round}
        </h2>
      </div>
      <div className="space-y-2">
        {combat.combatants.map((c) => {
          const hp = c.hitPoints
          const pct = hp && hp.max > 0 ? Math.max(0, hp.current / hp.max) : 0
          const barColor = pct > 0.5 ? "var(--scene-accent)" : pct > 0.25 ? "#f59e0b" : "#ef4444"
          return (
            <div
              key={c.id}
              className="rounded-lg p-3 transition-all"
              style={{
                background: c.isActive
                  ? "color-mix(in srgb, var(--scene-accent) 12%, var(--scene-surface))"
                  : "var(--scene-surface)",
                border: c.isActive ? "1px solid var(--scene-accent)" : "1px solid var(--scene-border)",
                boxShadow: c.isActive ? "0 0 12px var(--scene-accent-glow)" : "none",
              }}
            >
              <div className="flex items-center gap-3">
                <span className="w-8 text-center text-sm font-bold tabular-nums" style={{ color: c.isActive ? "var(--scene-accent)" : "var(--scene-text-muted)" }}>
                  {c.initiative}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold truncate" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
                      {c.name}
                    </span>
                    {c.isMine && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}>
                        You
                      </span>
                    )}
                    {c.isActive && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 animate-pulse" style={{ background: "color-mix(in srgb, var(--scene-accent) 25%, transparent)", color: "var(--scene-accent)" }}>
                        Turn
                      </span>
                    )}
                  </div>
                  {/* Own/PC exact HP bar, or monster health band */}
                  {hp ? (
                    <div className="mt-1.5">
                      <span className="text-xs tabular-nums" style={{ color: "var(--scene-text-muted)" }}>
                        {hp.current}/{hp.max}{hp.temp > 0 ? ` (+${hp.temp})` : ""}
                      </span>
                      <div className="w-full h-1.5 rounded-full overflow-hidden mt-1" style={{ background: "var(--scene-border)" }}>
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct * 100}%`, background: barColor }} />
                      </div>
                    </div>
                  ) : (
                    c.healthBand && (
                      <span className="text-xs mt-1 inline-block px-2 py-0.5 rounded-full" style={{ background: `color-mix(in srgb, ${BAND_COLOR[c.healthBand]} 18%, transparent)`, color: BAND_COLOR[c.healthBand] }}>
                        {BAND_LABEL[c.healthBand]}
                      </span>
                    )
                  )}
                  {c.conditions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {c.conditions.map((cond) => (
                        <span key={cond} className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${CONDITION_COLORS[cond] ?? "#6b7280"}22`, color: CONDITION_COLORS[cond] ?? "#6b7280", border: `1px solid ${CONDITION_COLORS[cond] ?? "#6b7280"}44` }}>
                          {cond}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
