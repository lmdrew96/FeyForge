"use client"

import { useMemo, useState } from "react"
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
  ChevronDown,
  Plus,
  Trash2,
  Heart,
  Shield,
  Skull,
} from "lucide-react"
import { EncounterDetails, DifficultyBadge, hasEncounterDetails } from "@/components/encounters/encounter-details"
import { MonsterAttacksPanel } from "@/components/session/monster-attacks-panel"
import { partitionHomebrew } from "@/lib/homebrew"

type SessionId = Id<"partySessions">

// 14 core conditions + Concentrating (a spell-tracking flag, not a true
// condition — surfaced here so the DM can flag it and get a CON-save prompt on
// damage). Exhaustion is a level track, handled elsewhere.
const CONDITIONS = [
  "Blinded", "Charmed", "Concentrating", "Deafened", "Frightened", "Grappled",
  "Incapacitated", "Invisible", "Paralyzed", "Petrified",
  "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious",
]

const CONDITION_COLORS: Record<string, string> = {
  Blinded: "#6b7280", Charmed: "#ec4899", Concentrating: "#7b68c8",
  Deafened: "#6b7280", Frightened: "#f59e0b", Grappled: "#8b5cf6",
  Incapacitated: "#ef4444", Invisible: "#a1a1aa", Paralyzed: "#ef4444",
  Petrified: "#78716c", Poisoned: "#22c55e", Prone: "#94a3b8",
  Restrained: "#8b5cf6", Stunned: "#ef4444", Unconscious: "#1f2937",
}

const TYPE_LABEL: Record<string, string> = {
  pc: "PC",
  npc: "NPC",
  monster: "Monster",
}

const rollD20 = () => Math.floor(Math.random() * 20) + 1

// ── DM tracker ──────────────────────────────────────────────────────────────────

export function DMCombatTracker({ sessionId, campaignId }: { sessionId: SessionId; campaignId: Id<"campaigns"> }) {
  const combat = useQuery(api.liveCombat.getCombat, { sessionId })
  const partyMembers = useQuery(api.liveSessions.getPartyMembers, { sessionId })
  const addableCreatures = useQuery(api.liveCombat.listAddableCreatures, { sessionId })
  // Saved encounters for THIS campaign — loadable into combat (generate→save→run).
  const savedEncounters = useQuery(api.encounters.list)
  // Homebrew monsters (own + campaign-shared) so the attack panel can roll a custom
  // creature's attacks. Memoized for a stable identity (the panel keys an effect on it).
  const homebrewDocs = useQuery(api.homebrew.listForBuilder)
  const homebrewMonsters = useMemo(() => partitionHomebrew(homebrewDocs).monsters, [homebrewDocs])
  const campaignEncounters = useMemo(
    () => (savedEncounters ?? []).filter((e) => e.campaignId === campaignId),
    [savedEncounters, campaignId],
  )

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
  const doRollDeathSave = useMutation(api.liveCombat.rollDeathSave)
  const doSetTempHp = useMutation(api.liveCombat.setTempHp)

  // Apply HP damage/heal; if a concentrating combatant was hit, prompt the save.
  const handleAdjustHp = async (combatantId: string, amount: number) => {
    try {
      const res = await doAdjustHp({ sessionId, combatantId, amount })
      if (res?.concentrationDC) {
        toast.warning(`${res.name}: concentration save — DC ${res.concentrationDC}`)
      }
    } catch {
      toast.error("Failed to update HP.")
    }
  }

  // Set temporary HP (absolute value, doesn't stack with current/max). RAW: temp
  // HP from a new source replaces rather than adds, so a direct set is correct.
  const handleSetTempHp = (combatantId: string, currentTemp: number) => {
    const input = window.prompt("Set temporary HP:", String(currentTemp))
    if (input === null) return
    const temp = Math.max(0, Math.floor(Number(input)) || 0)
    doSetTempHp({ sessionId, combatantId, temp }).catch(() => toast.error("Failed to set temp HP."))
  }

  const handleRollDeathSave = async (combatantId: string) => {
    try {
      const res = await doRollDeathSave({ sessionId, combatantId })
      const tail =
        res.outcome === "revived"
          ? "natural 20 — back up at 1 HP!"
          : res.outcome === "dead"
            ? "and falls — that's 3 failures."
            : res.outcome === "stable"
              ? "— stabilized (3 successes)."
              : `(${res.successes}✓ / ${res.failures}✗)`
      const fn = res.outcome === "dead" ? toast.error : res.outcome === "revived" || res.outcome === "stable" ? toast.success : toast.message
      fn(`${res.name} rolled ${res.roll} ${tail}`)
    } catch {
      toast.error("Failed to roll death save.")
    }
  }

  const [monsterName, setMonsterName] = useState("")
  const [monsterHp, setMonsterHp] = useState("")
  const [monsterAc, setMonsterAc] = useState("")
  const [monsterInit, setMonsterInit] = useState("")
  const [expandedConditions, setExpandedConditions] = useState<string | null>(null)
  const [expandedAttacks, setExpandedAttacks] = useState<string | null>(null)
  const [loadingSaved, setLoadingSaved] = useState(false)
  const [expandedSaved, setExpandedSaved] = useState<string | null>(null)

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

  // Drop a player's active Wild Shape form or companion into initiative as its OWN
  // combatant (separate-combatant model). type "npc" + the owner's userId (so they
  // see exact HP) but NO characterId — the HP→character sync no-ops, so the druid's
  // real HP is never touched.
  const handleAddCreature = async (cr: NonNullable<typeof addableCreatures>[number]) => {
    try {
      await doAdd({
        sessionId,
        combatant: {
          id: crypto.randomUUID(),
          name: `${cr.name} (${cr.ownerName})`,
          type: "npc",
          initiative: rollD20() + cr.initiativeBonus,
          initiativeBonus: cr.initiativeBonus,
          armorClass: cr.ac,
          hitPoints: { current: cr.currentHp, max: cr.maxHp, temp: 0 },
          conditions: [],
          userId: cr.ownerUserId,
        },
      })
      toast.success(`${cr.name} joined the fight.`)
    } catch {
      toast.error("Failed to add creature.")
    }
  }

  // Load a saved encounter's monsters into combat. Rebuild CLEAN combatants that
  // match combatantInputValidator EXACTLY (no notes/isActive/characterId — Convex
  // rejects extra fields), with fresh ids and freshly-rolled initiative. Not
  // started → start with party + monsters; active → add each monster.
  const handleLoadSaved = async (encId: string) => {
    const enc = campaignEncounters.find((e) => e._id === encId)
    if (!enc || loadingSaved) return
    setLoadingSaved(true)
    const monsters = enc.combatants.map((c) => ({
      id: crypto.randomUUID(),
      name: c.name,
      type: "monster" as const,
      initiative: rollD20() + (c.initiativeBonus ?? 0),
      initiativeBonus: c.initiativeBonus ?? 0,
      armorClass: c.armorClass ?? 10,
      hitPoints: {
        current: c.hitPoints?.current ?? 1,
        max: c.hitPoints?.max ?? 1,
        temp: c.hitPoints?.temp ?? 0,
      },
      conditions: [] as string[],
    }))
    try {
      if (isActive) {
        for (const m of monsters) await doAdd({ sessionId, combatant: m })
        toast.success(`Added ${monsters.length} combatant${monsters.length === 1 ? "" : "s"} from “${enc.name}.”`)
      } else {
        const party = (partyMembers ?? [])
          .filter((m) => m.character)
          .map((m) => {
            const char = m.character!
            return {
              id: crypto.randomUUID(),
              name: char.name,
              type: "pc" as const,
              initiative: rollD20(),
              initiativeBonus: 0,
              armorClass: 10,
              hitPoints: { current: char.hitPoints.current, max: char.hitPoints.max, temp: char.hitPoints.temp },
              conditions: [] as string[],
              characterId: char._id,
              userId: m.userId,
            }
          })
        await doStart({ sessionId, combatants: [...party, ...monsters] })
        toast.success(`Combat started with “${enc.name}.”`)
      }
    } catch {
      toast.error("Failed to load the encounter.")
    } finally {
      setLoadingSaved(false)
    }
  }

  // This campaign's saved encounters, each expandable to reveal its run-time
  // flavor (read-aloud, tactics, scaling, treasure) so it stays reachable
  // mid-session — and Load to start combat (or add monsters to an active fight).
  const savedLoader =
    campaignEncounters.length > 0 ? (
      <div className="space-y-1.5 text-left">
        {campaignEncounters.map((e) => {
          const expandable = hasEncounterDetails(e.details)
          const isOpen = expandedSaved === e._id
          return (
            <div key={e._id} className="rounded-md overflow-hidden" style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}>
              <div className="flex items-center gap-2 px-2.5 py-2">
                <button
                  onClick={() => expandable && setExpandedSaved(isOpen ? null : e._id)}
                  disabled={!expandable}
                  className="flex flex-1 items-center gap-2 min-w-0 text-left transition-opacity enabled:hover:opacity-80 disabled:cursor-default"
                  title={expandable ? "Show encounter details" : undefined}
                >
                  {expandable ? (
                    isOpen ? <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--scene-accent)" }} /> : <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--scene-accent)" }} />
                  ) : (
                    <Swords className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--scene-accent)" }} />
                  )}
                  <span className="truncate text-sm" style={{ color: "var(--scene-text-primary)" }}>{e.name}</span>
                  <DifficultyBadge difficulty={e.details?.difficulty} />
                  <span className="flex-shrink-0 text-[11px]" style={{ color: "var(--scene-text-muted)" }}>({e.combatants.length})</span>
                </button>
                <button
                  onClick={() => handleLoadSaved(e._id)}
                  disabled={loadingSaved}
                  className="flex-shrink-0 inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
                  title={isActive ? "Add this encounter's monsters to combat" : "Start combat with the party + these monsters"}
                >
                  {isActive ? <Plus className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  {isActive ? "Add" : "Load"}
                </button>
              </div>
              {isOpen && expandable && (
                <div className="px-2.5 pb-2.5" style={{ borderTop: "1px solid var(--scene-border)" }}>
                  <div className="pt-2.5">
                    <EncounterDetails details={e.details} />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    ) : null

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
          {savedLoader && (
            <div className="mt-5 max-w-md mx-auto">
              <p className="text-[11px] uppercase tracking-widest mb-2 text-left" style={{ color: "var(--scene-text-muted)" }}>
                Saved encounters
              </p>
              {savedLoader}
              <p className="text-[11px] mt-1.5 text-left" style={{ color: "var(--scene-text-muted)" }}>
                Load starts combat with the party + that encounter&apos;s monsters. Expand to read its details.
              </p>
            </div>
          )}
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
                      <button
                        onClick={() => handleRollDeathSave(c.id)}
                        className="ml-auto text-xs px-2 py-1 rounded font-medium transition-opacity hover:opacity-80"
                        style={{ background: "color-mix(in srgb, #ef4444 14%, transparent)", color: "#ef4444", border: "1px solid color-mix(in srgb, #ef4444 32%, transparent)" }}
                        title="Roll a death saving throw (nat 20 revives, nat 1 = two failures)"
                      >
                        Roll save
                      </button>
                    </div>
                  )}
                </div>

                {/* HP controls */}
                {hp && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <HpButton label="−5" color="#ef4444" onClick={() => handleAdjustHp(c.id, -5)} />
                    <HpButton label="−1" color="#ef4444" onClick={() => handleAdjustHp(c.id, -1)} />
                    <HpButton label="+1" color="var(--scene-accent)" onClick={() => handleAdjustHp(c.id, 1)} />
                    <HpButton label="+5" color="var(--scene-accent)" onClick={() => handleAdjustHp(c.id, 5)} />
                    <HpButton label="TMP" color="var(--scene-highlight)" onClick={() => handleSetTempHp(c.id, hp.temp)} />
                  </div>
                )}

                {/* Row actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {c.type !== "pc" && (
                    <button
                      onClick={() => setExpandedAttacks(expandedAttacks === c.id ? null : c.id)}
                      className="p-1.5 rounded transition-opacity hover:opacity-80"
                      style={{ color: expandedAttacks === c.id ? "var(--scene-accent)" : "var(--scene-text-muted)" }}
                      aria-label={`Roll ${c.name} attacks`}
                      title="Roll attacks"
                    >
                      <Swords className="h-3.5 w-3.5" />
                    </button>
                  )}
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

              {/* Monster / NPC attack roller (DM rolls to-hit + damage, applies it) */}
              {expandedAttacks === c.id && c.type !== "pc" && (
                <MonsterAttacksPanel
                  monsterName={c.name}
                  homebrewMonsters={homebrewMonsters}
                  targets={combat.combatants
                    .filter((x) => x.id !== c.id)
                    .map((x) => ({ id: x.id, name: x.name, type: x.type }))}
                  onApply={(targetId, amount) => handleAdjustHp(targetId, -amount)}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Party creatures — drop a player's active Wild Shape form or companion in */}
      {addableCreatures && addableCreatures.length > 0 && (
        <div className="rounded-xl p-3" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
          <p className="text-[11px] uppercase tracking-widest mb-2" style={{ color: "var(--scene-text-muted)" }}>Party creatures</p>
          <div className="flex flex-wrap gap-2">
            {addableCreatures.map((cr, i) => (
              <button
                key={`${cr.ownerUserId}-${cr.name}-${i}`}
                onClick={() => handleAddCreature(cr)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-opacity hover:opacity-80"
                style={{ background: "var(--scene-bg)", color: "var(--scene-text-primary)", border: "1px solid var(--scene-border)" }}
              >
                <Plus className="h-3.5 w-3.5" style={{ color: "var(--scene-accent)" }} />
                {cr.name}
                <span style={{ color: "var(--scene-text-muted)" }}>· {cr.ownerName} · {cr.kind === "form" ? "Wild Shape" : "companion"}</span>
              </button>
            ))}
          </div>
        </div>
      )}

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
        {savedLoader && (
          <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--scene-border)" }}>
            <p className="text-[11px] uppercase tracking-widest mb-2" style={{ color: "var(--scene-text-muted)" }}>
              Saved encounters
            </p>
            {savedLoader}
          </div>
        )}
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
