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
  Dices,
} from "lucide-react"
import { EncounterDetails, DifficultyBadge, hasEncounterDetails } from "@/components/encounters/encounter-details"
import { MonsterAttacksPanel } from "@/components/session/monster-attacks-panel"
import { PlayerAttacksPanel } from "@/components/session/player-attacks-panel"
import { partitionHomebrew, rawHomebrewId, type HomebrewMonster } from "@/lib/homebrew"
import { open5eApi, type Open5eMonster } from "@/lib/open5e-api"
import { baseMonsterName } from "@/lib/monster-attacks"
import { rollExpression } from "@/lib/dice-store"
import { rollToFeedArgs } from "@/lib/session-rolls"
import { resolveEdition } from "@/lib/editions"
import { MAX_EXHAUSTION, exhaustionSummary } from "@/lib/character/exhaustion"

type SessionId = Id<"partySessions">

// 14 core conditions + Concentrating (a spell-tracking flag, not a true
// condition — surfaced here so the DM can flag it and get a CON-save prompt on
// damage). Exhaustion is a 0–6 level track with its own stepper in the picker
// (lib/character/exhaustion.ts), not a toggle in this list.
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
  // Persistent NPCs in this campaign that carry a "fights as…" stat block — droppable
  // into combat as a named combatant fighting from the referenced stat block.
  const allNpcs = useQuery(api.npcs.list)
  const statblockNpcs = useMemo(
    () => (allNpcs ?? []).filter((n) => n.campaignId === campaignId && n.statblockRef),
    [allNpcs, campaignId],
  )
  // DM-controlled characters (DMPCs) in this campaign, droppable into combat as full
  // PC-type combatants. Excludes any already in the fight (dedup by characterId).
  const myCharacters = useQuery(api.characters.list)
  const dmpcs = useMemo(() => {
    const inCombat = new Set((combat?.combatants ?? []).map((c) => c.characterId).filter(Boolean))
    return (myCharacters ?? []).filter(
      (c) => c.campaignId === campaignId && c.dmControlled && !inCombat.has(c._id),
    )
  }, [myCharacters, campaignId, combat])

  // Real derive-live AC + Dex-mod initiative for party PCs + DMPCs. Computed
  // server-side (the DM can't read other players' characterProperties from the
  // client) — see liveCombat.getPartyCombatStats. Used to build PC combatants with
  // correct AC/initiative instead of the old flat d20 / hardcoded AC 10.
  const partyCombatStats = useQuery(api.liveCombat.getPartyCombatStats, { sessionId })
  const combatStatByChar = useMemo(() => {
    const map = new Map<string, { armorClass: number; initiativeBonus: number }>()
    for (const s of partyCombatStats ?? []) {
      map.set(s.characterId, { armorClass: s.armorClass, initiativeBonus: s.initiativeBonus })
    }
    return map
  }, [partyCombatStats])

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
  const doSetExhaustion = useMutation(api.liveCombat.setExhaustion)
  // Campaign edition drives the exhaustion-effects hint (2014 tiers vs 2024 −2/level).
  const campaign = useQuery(api.campaigns.get, { campaignId })
  const edition = resolveEdition(campaign?.edition)

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
  // SRD monster quick-add — the full SRD list is lazy-loaded on first focus
  // (cached 24h in IndexedDB by the client), then filtered locally.
  const [monsterQuery, setMonsterQuery] = useState("")
  const [srdMonsters, setSrdMonsters] = useState<Open5eMonster[]>([])
  const [srdLoading, setSrdLoading] = useState(false)
  const [srdLoaded, setSrdLoaded] = useState(false)
  const [srdError, setSrdError] = useState(false)
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
      const stat = combatStatByChar.get(char._id)
      const initBonus = stat?.initiativeBonus ?? 0
      return {
        id: crypto.randomUUID(),
        name: char.name,
        type: "pc" as const,
        // Party PCs start UNROLLED — each player rolls their own initiative from
        // their combat view (d20 + real Dex mod). initiativeBonus carries the mod
        // for tiebreaks and the DM's roll-for-them button; AC is the real derived AC.
        initiative: 0,
        awaitingRoll: true,
        initiativeBonus: initBonus,
        armorClass: stat?.armorClass ?? 10,
        hitPoints: {
          current: char.hitPoints.current,
          max: char.hitPoints.max,
          temp: char.hitPoints.temp,
        },
        conditions: [] as string[],
        exhaustion: char.exhaustion,
        characterId: char._id,
        userId: m.userId,
      }
    })
    try {
      await doStart({ sessionId, combatants })
      toast.success("Combat started — players, roll initiative!")
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

  // Lazy-load the SRD monster list the first time the DM focuses the search.
  const ensureSrdMonsters = () => {
    if (srdLoaded || srdLoading) return
    setSrdLoading(true)
    open5eApi
      .getMonsters()
      .then((m) => {
        setSrdMonsters(m)
        setSrdLoaded(true)
      })
      .catch(() => setSrdError(true))
      .finally(() => setSrdLoading(false))
  }

  const srdMatches = useMemo(() => {
    const q = monsterQuery.trim().toLowerCase()
    if (!q) return []
    return srdMonsters.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 20)
  }, [monsterQuery, srdMonsters])

  const hbMatches = useMemo(() => {
    const q = monsterQuery.trim().toLowerCase()
    if (!q) return []
    return homebrewMonsters.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 8)
  }, [monsterQuery, homebrewMonsters])

  // Disambiguate duplicates the way the encounter builder does: the first stays
  // bare ("Goblin"), the next becomes "Goblin 2"… so the DM can tell them apart and
  // the attack panel still resolves them (baseMonsterName strips the suffix).
  const nextDupName = (base: string): string => {
    const n = (combat?.combatants ?? []).filter((c) => baseMonsterName(c.name) === base).length
    return n === 0 ? base : `${base} ${n + 1}`
  }

  const addMonsterCombatant = async (name: string, ac: number, hp: number, dexMod: number) => {
    try {
      await doAdd({
        sessionId,
        combatant: {
          id: crypto.randomUUID(),
          name: nextDupName(name),
          type: "monster",
          initiative: rollD20() + dexMod,
          initiativeBonus: dexMod,
          armorClass: ac,
          hitPoints: { current: hp, max: hp, temp: 0 },
          conditions: [],
        },
      })
      toast.success(`Added ${name}.`)
      setMonsterQuery("")
    } catch {
      toast.error("Failed to add monster.")
    }
  }

  const handleAddSrdMonster = (m: Open5eMonster) =>
    addMonsterCombatant(m.name, m.armor_class, m.hit_points, Math.floor((m.dexterity - 10) / 2))

  const handleAddHbMonster = (m: HomebrewMonster) =>
    addMonsterCombatant(m.name, m.armorClass, m.hitPoints, Math.floor((m.dexterity - 10) / 2))

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

  // Drop a persistent NPC into combat as a NAMED combatant ("Lord Vthain") that
  // fights from its referenced stat block. type "npc" → no death saves (drops at 0,
  // 5e-correct); carries the statblockRef so the attack panel resolves the real stat
  // block, not the NPC's name. AC/HP/Dex are read from the referenced stat block.
  const handleAddNpc = async (npc: (typeof statblockNpcs)[number]) => {
    const ref = npc.statblockRef
    if (!ref) return
    try {
      let ac = 10
      let hp = 1
      let dexMod = 0
      if (ref.kind === "homebrew") {
        const hb = homebrewMonsters.find((m) => rawHomebrewId(m.id) === ref.homebrewId)
        if (!hb) {
          toast.error(`${npc.name}'s homebrew stat block wasn't found.`)
          return
        }
        ac = hb.armorClass
        hp = hb.hitPoints
        dexMod = Math.floor((hb.dexterity - 10) / 2)
      } else {
        const monsters = await open5eApi.getMonsters({ search: ref.monsterName })
        const m =
          monsters.find((x) => x.name.toLowerCase() === ref.monsterName.toLowerCase()) ?? monsters[0]
        if (!m) {
          toast.error(`Couldn't find the “${ref.monsterName}” stat block.`)
          return
        }
        ac = m.armor_class
        hp = m.hit_points
        dexMod = Math.floor((m.dexterity - 10) / 2)
      }
      await doAdd({
        sessionId,
        combatant: {
          id: crypto.randomUUID(),
          name: npc.name,
          type: "npc",
          initiative: rollD20() + dexMod,
          initiativeBonus: dexMod,
          armorClass: ac,
          hitPoints: { current: hp, max: hp, temp: 0 },
          conditions: [],
          statblockRef: ref,
        },
      })
      toast.success(`${npc.name} entered the fight.`)
    } catch {
      toast.error("Failed to add NPC.")
    }
  }

  // Drop a DMPC (DM-controlled character) into combat as a full PC-type combatant —
  // identical shape to a party PC (sheet HP, characterId for HP write-through, death
  // saves at 0 HP). Attacks come from its sheet, like any PC. userId is the DM (the
  // character's owner), so HP shows exact to the DM and party-visible like a PC.
  const handleAddDmpc = async (char: (typeof dmpcs)[number]) => {
    try {
      const stat = combatStatByChar.get(char._id)
      const initBonus = stat?.initiativeBonus ?? 0
      await doAdd({
        sessionId,
        combatant: {
          id: crypto.randomUUID(),
          name: char.name,
          type: "pc",
          // d20 + real Dex mod; real derived AC (same as a party PC).
          initiative: rollD20() + initBonus,
          initiativeBonus: initBonus,
          armorClass: stat?.armorClass ?? 10,
          hitPoints: {
            current: char.hitPoints.current,
            max: char.hitPoints.max,
            temp: char.hitPoints.temp,
          },
          conditions: [],
          exhaustion: char.exhaustion,
          characterId: char._id,
          userId: char.userId,
          isDmpc: true,
        },
      })
      toast.success(`${char.name} joined the party.`)
    } catch {
      toast.error("Failed to add DMPC.")
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
            const stat = combatStatByChar.get(char._id)
            const initBonus = stat?.initiativeBonus ?? 0
            return {
              id: crypto.randomUUID(),
              name: char.name,
              type: "pc" as const,
              initiative: 0, // players roll their own (see handleStart)
              awaitingRoll: true,
              initiativeBonus: initBonus,
              armorClass: stat?.armorClass ?? 10,
              hitPoints: { current: char.hitPoints.current, max: char.hitPoints.max, temp: char.hitPoints.temp },
              conditions: [] as string[],
              exhaustion: char.exhaustion,
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
              ? `Start an encounter with ${joinable} party member${joinable !== 1 ? "s" : ""} — players roll their own initiative; monsters and NPCs roll as you add them.`
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
                {/* Initiative — editable once rolled; while a player's roll is
                    pending, a dice button lets the DM roll on their behalf. */}
                {c.awaitingRoll ? (
                  <button
                    onClick={() =>
                      doSetInitiative({
                        sessionId,
                        combatantId: c.id,
                        initiative: rollD20() + (c.initiativeBonus ?? 0),
                      }).catch(() => {})
                    }
                    className="w-10 py-1.5 flex items-center justify-center rounded transition-opacity hover:opacity-80"
                    style={{
                      color: "var(--scene-accent)",
                      border: "1px dashed color-mix(in srgb, var(--scene-accent) 45%, transparent)",
                    }}
                    aria-label={`Roll initiative for ${c.name}`}
                    title={`Waiting on the player — tap to roll for ${c.name} (d20 + Dex)`}
                  >
                    <Dices className="h-4 w-4" />
                  </button>
                ) : (
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
                )}

                {/* Name + badges — wraps instead of truncating into oblivion */}
                <div className="flex-1 min-w-0 flex items-center gap-x-2 gap-y-0.5 flex-wrap">
                  <span className="text-sm sm:text-base font-semibold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
                    {c.name}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}>
                    {c.isDmpc ? "DMPC" : TYPE_LABEL[c.type]}
                  </span>
                  {c.armorClass !== undefined && (
                    <span className="text-xs flex items-center gap-0.5 flex-shrink-0" style={{ color: "var(--scene-text-muted)" }}>
                      <Shield className="h-3 w-3" /> {c.armorClass}
                    </span>
                  )}
                </div>

                {/* Row actions — finger-sized targets */}
                <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                  {c.type !== "pc" && (
                    <button
                      onClick={() => setExpandedAttacks(expandedAttacks === c.id ? null : c.id)}
                      className="p-2 rounded transition-opacity hover:opacity-80"
                      style={{ color: expandedAttacks === c.id ? "var(--scene-accent)" : "var(--scene-text-muted)" }}
                      aria-label={`Roll ${c.name} attacks`}
                      title="Roll attacks"
                    >
                      <Swords className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setExpandedConditions(expandedConditions === c.id ? null : c.id)}
                    className="p-2 rounded transition-opacity hover:opacity-80"
                    style={{ color: expandedConditions === c.id ? "var(--scene-accent)" : "var(--scene-text-muted)" }}
                    aria-label="Toggle conditions"
                    title="Conditions & exhaustion"
                  >
                    <Heart className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => doRemove({ sessionId, combatantId: c.id }).catch(() => {})}
                    className="p-2 rounded transition-opacity hover:opacity-80"
                    style={{ color: "var(--scene-text-muted)" }}
                    aria-label={`Remove ${c.name}`}
                    title="Remove from combat"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* HP — full-width bar + roomy adjust buttons (was crammed beside the name) */}
              {hp && (
                <div className="mt-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--scene-text-primary)" }}>
                      {hp.current}<span style={{ color: "var(--scene-text-muted)" }}>/{hp.max}</span>{hp.temp > 0 ? <span style={{ color: "var(--scene-highlight)" }}> +{hp.temp}</span> : null}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--scene-border)" }}>
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct * 100}%`, background: barColor }} />
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    <HpButton label="−5" color="#ef4444" onClick={() => handleAdjustHp(c.id, -5)} />
                    <HpButton label="−1" color="#ef4444" onClick={() => handleAdjustHp(c.id, -1)} />
                    <HpButton label="+1" color="var(--scene-accent)" onClick={() => handleAdjustHp(c.id, 1)} />
                    <HpButton label="+5" color="var(--scene-accent)" onClick={() => handleAdjustHp(c.id, 5)} />
                    <HpButton label="TMP" color="var(--scene-highlight)" onClick={() => handleSetTempHp(c.id, hp.temp)} />
                  </div>
                </div>
              )}

              {/* Conditions + exhaustion level */}
              {(c.conditions.length > 0 || (c.exhaustion ?? 0) > 0) && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {c.conditions.map((cond) => (
                    <span key={cond} className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${CONDITION_COLORS[cond] ?? "#6b7280"}22`, color: CONDITION_COLORS[cond] ?? "#6b7280", border: `1px solid ${CONDITION_COLORS[cond] ?? "#6b7280"}44` }}>
                      {cond}
                    </span>
                  ))}
                  {(c.exhaustion ?? 0) > 0 && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{ background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b44" }}
                      title={exhaustionSummary(c.exhaustion ?? 0, edition)}
                    >
                      Exhaustion {c.exhaustion}
                    </span>
                  )}
                </div>
              )}

              {/* Death saves for downed PCs */}
              {c.type === "pc" && isDown && (
                <div className="flex items-center gap-2 mt-2.5">
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
                    className="ml-auto text-xs px-2.5 py-1.5 rounded font-medium transition-opacity hover:opacity-80"
                    style={{ background: "color-mix(in srgb, #ef4444 14%, transparent)", color: "#ef4444", border: "1px solid color-mix(in srgb, #ef4444 32%, transparent)" }}
                    title="Roll a death saving throw (nat 20 revives, nat 1 = two failures)"
                  >
                    Roll save
                  </button>
                </div>
              )}

              {/* Condition picker */}
              {expandedConditions === c.id && (
                <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--scene-border)" }}>
                  <div className="flex flex-wrap gap-1.5">
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
                  {/* Exhaustion — a 0–6 level track, not a toggle. PC levels write
                      through to the character sheet and persist after combat. */}
                  <div
                    className="flex items-center gap-2 mt-2.5"
                    title={(c.exhaustion ?? 0) > 0 ? exhaustionSummary(c.exhaustion ?? 0, edition) : "Exhaustion level"}
                  >
                    <span className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
                      Exhaustion
                    </span>
                    <button
                      onClick={() => doSetExhaustion({ sessionId, combatantId: c.id, level: (c.exhaustion ?? 0) - 1 }).catch(() => {})}
                      disabled={(c.exhaustion ?? 0) <= 0}
                      aria-label={`Reduce ${c.name} exhaustion`}
                      className="px-2 py-0.5 rounded text-xs font-bold transition-opacity hover:opacity-80 disabled:opacity-30"
                      style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}
                    >
                      −
                    </button>
                    <span className="text-xs font-bold tabular-nums w-4 text-center" style={{ color: (c.exhaustion ?? 0) > 0 ? "#f59e0b" : "var(--scene-text-muted)" }}>
                      {c.exhaustion ?? 0}
                    </span>
                    <button
                      onClick={() => doSetExhaustion({ sessionId, combatantId: c.id, level: (c.exhaustion ?? 0) + 1 }).catch(() => {})}
                      disabled={(c.exhaustion ?? 0) >= MAX_EXHAUSTION}
                      aria-label={`Increase ${c.name} exhaustion`}
                      className="px-2 py-0.5 rounded text-xs font-bold transition-opacity hover:opacity-80 disabled:opacity-30"
                      style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}
                    >
                      +
                    </button>
                    {(c.exhaustion ?? 0) > 0 && (
                      <span className="text-[11px] truncate" style={{ color: "#f59e0b" }}>
                        {exhaustionSummary(c.exhaustion ?? 0, edition)}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Monster / NPC attack roller (DM rolls to-hit + damage, applies it) */}
              {expandedAttacks === c.id && c.type !== "pc" && (
                <MonsterAttacksPanel
                  monsterName={c.name}
                  statblockRef={c.statblockRef}
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

      {/* DMPCs — DM-controlled allies, added as full PC-type combatants (sheet HP,
          death saves, attacks from their own sheet). */}
      {dmpcs.length > 0 && (
        <div className="rounded-xl p-3 mb-3" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
          <p className="text-[11px] uppercase tracking-widest mb-2" style={{ color: "var(--scene-text-muted)" }}>DMPCs</p>
          <div className="flex flex-wrap gap-2">
            {dmpcs.map((char) => (
              <button
                key={char._id}
                onClick={() => handleAddDmpc(char)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-opacity hover:opacity-80"
                style={{ background: "var(--scene-bg)", color: "var(--scene-text-primary)", border: "1px solid var(--scene-border)" }}
              >
                <Plus className="h-3.5 w-3.5" style={{ color: "var(--scene-accent)" }} />
                {char.name}
                <span style={{ color: "var(--scene-text-muted)" }}>· Lv {char.level} {char.characterClass}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* NPCs — drop a persistent NPC that has a stat block into the fight, labeled
          with its own name but fighting from the referenced stat block. */}
      {statblockNpcs.length > 0 && (
        <div className="rounded-xl p-3 mb-3" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
          <p className="text-[11px] uppercase tracking-widest mb-2" style={{ color: "var(--scene-text-muted)" }}>NPCs</p>
          <div className="flex flex-wrap gap-2">
            {statblockNpcs.map((npc) => (
              <button
                key={npc._id}
                onClick={() => handleAddNpc(npc)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-opacity hover:opacity-80"
                style={{ background: "var(--scene-bg)", color: "var(--scene-text-primary)", border: "1px solid var(--scene-border)" }}
                title={npc.statblockRef?.kind === "srd" ? `Fights as ${npc.statblockRef.monsterName}` : "Fights as a homebrew stat block"}
              >
                <Plus className="h-3.5 w-3.5" style={{ color: "var(--scene-accent)" }} />
                {npc.name}
                <span style={{ color: "var(--scene-text-muted)" }}>
                  · {npc.statblockRef?.kind === "srd" ? npc.statblockRef.monsterName : "homebrew"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add monster */}
      <div className="rounded-xl p-3" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
        {/* SRD (+ homebrew) monster quick-add — search and tap to drop a fully-
            statted combatant into the fight; attacks resolve by name in its panel. */}
        <div className="relative mb-2">
          <input
            value={monsterQuery}
            onChange={(e) => setMonsterQuery(e.target.value)}
            onFocus={ensureSrdMonsters}
            placeholder={srdLoading ? "Loading SRD monsters…" : "Search SRD monsters to add…"}
            className="w-full px-3 py-2 rounded-md text-sm bg-transparent outline-none"
            style={{ border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
          />
          {monsterQuery.trim() !== "" && (srdMatches.length > 0 || hbMatches.length > 0) && (
            <div
              className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded-md shadow-lg"
              style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
            >
              {hbMatches.map((m) => (
                <button
                  key={`hb-${m.id}`}
                  onClick={() => handleAddHbMonster(m)}
                  className="w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition-opacity hover:opacity-80"
                  style={{ borderBottom: "1px solid var(--scene-border)" }}
                >
                  <span className="truncate" style={{ color: "var(--scene-text-primary)" }}>
                    {m.name}
                    <span
                      className="ml-1.5 text-[10px] px-1 py-0.5 rounded-sm align-middle"
                      style={{ background: "color-mix(in srgb, var(--scene-accent) 18%, transparent)", color: "var(--scene-accent)" }}
                    >
                      HB
                    </span>
                  </span>
                  <span className="shrink-0 text-xs" style={{ color: "var(--scene-text-muted)" }}>
                    CR {m.challengeRating} · AC {m.armorClass} · {m.hitPoints} HP
                  </span>
                </button>
              ))}
              {srdMatches.map((m) => (
                <button
                  key={m.slug}
                  onClick={() => handleAddSrdMonster(m)}
                  className="w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition-opacity hover:opacity-80"
                  style={{ borderBottom: "1px solid var(--scene-border)" }}
                >
                  <span className="truncate" style={{ color: "var(--scene-text-primary)" }}>{m.name}</span>
                  <span className="shrink-0 text-xs" style={{ color: "var(--scene-text-muted)" }}>
                    CR {m.challenge_rating} · AC {m.armor_class} · {m.hit_points} HP
                  </span>
                </button>
              ))}
            </div>
          )}
          {srdError && (
            <p className="text-xs mt-1" style={{ color: "#ef4444" }}>
              Couldn&rsquo;t load SRD monsters — add manually below.
            </p>
          )}
          {monsterQuery.trim() !== "" && srdLoaded && srdMatches.length === 0 && hbMatches.length === 0 && (
            <p className="text-xs mt-1" style={{ color: "var(--scene-text-muted)" }}>
              No match — add manually below.
            </p>
          )}
        </div>

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
      className="flex-1 min-w-0 py-1.5 rounded text-xs font-bold transition-opacity hover:opacity-80"
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

// ── Player combat view ──────────────────────────────────────────────────────────

export function PlayerCombatView({
  sessionId,
  campaignId,
}: {
  sessionId: SessionId
  campaignId: Id<"campaigns">
}) {
  const combat = useQuery(api.liveCombat.getCombat, { sessionId })
  // The player's own derived AC + Dex-mod initiative (members can read party stats).
  // Used so "Roll initiative" writes the 5e-correct d20 + Dex mod and real AC.
  const myStats = useQuery(api.liveCombat.getPartyCombatStats, { sessionId })
  const doSetMyInitiative = useMutation(api.liveCombat.setMyInitiative)
  const pushRoll = useMutation(api.sessionRolls.pushRoll)

  const myStatByChar = useMemo(() => {
    const map = new Map<string, { armorClass: number; initiativeBonus: number }>()
    for (const s of myStats ?? []) {
      map.set(s.characterId, { armorClass: s.armorClass, initiativeBonus: s.initiativeBonus })
    }
    return map
  }, [myStats])

  // Player rolls their OWN initiative: d20 + real Dex mod, written to their combat
  // row (with real AC) and broadcast to the shared roll feed.
  const handleRollInitiative = async (
    c: NonNullable<typeof combat>["combatants"][number],
  ) => {
    const stat = c.characterId ? myStatByChar.get(c.characterId) : undefined
    const bonus = stat?.initiativeBonus ?? 0
    const ac = stat?.armorClass ?? 10
    const sign = bonus >= 0 ? "+" : "-"
    const result = rollExpression(`1d20${sign}${Math.abs(bonus)}`, { label: "Initiative" })
    if (!result) return
    try {
      await doSetMyInitiative({
        sessionId,
        combatantId: c.id,
        initiative: result.total,
        initiativeBonus: bonus,
        armorClass: ac,
      })
      void pushRoll({ sessionId, ...rollToFeedArgs(result, c.name) }).catch(() => {})
    } catch {
      toast.error("Couldn't roll initiative.")
    }
  }

  // Nothing rendered until combat is live — keeps the player view quiet otherwise.
  if (!combat) return null

  // The player's own PC combatant — anchors the in-combat attack panel below.
  // Wild Shape forms/companions carry isMine but no characterId, so they don't.
  const myPc = combat.combatants.find((c) => c.isMine && c.type === "pc" && c.characterId)

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
              {/* Header row: initiative · name + badges · roll-init */}
              <div className="flex items-center gap-2.5 sm:gap-3">
                <span className="w-8 text-center text-sm font-bold tabular-nums flex-shrink-0" style={{ color: c.isActive ? "var(--scene-accent)" : "var(--scene-text-muted)" }}>
                  {c.awaitingRoll ? "—" : c.initiative}
                </span>
                <div className="flex-1 min-w-0 flex items-center gap-x-2 gap-y-0.5 flex-wrap">
                  <span className="text-sm sm:text-base font-semibold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
                    {c.name}
                  </span>
                  {c.isMine && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}>
                      You
                    </span>
                  )}
                  {c.isDmpc && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}>
                      DMPC
                    </span>
                  )}
                  {c.isActive && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 animate-pulse" style={{ background: "color-mix(in srgb, var(--scene-accent) 25%, transparent)", color: "var(--scene-accent)" }}>
                      Turn
                    </span>
                  )}
                </div>
                {/* Roll your own initiative — d20 + your real Dex mod, into the
                    tracker. One roll: the button only shows while yours is pending
                    (the DM can still adjust the number afterwards). */}
                {c.isMine && c.awaitingRoll && (
                  <button
                    onClick={() => handleRollInitiative(c)}
                    aria-label="Roll your initiative"
                    className="flex-shrink-0 flex items-center gap-1 px-3 py-2 rounded-md text-xs font-medium transition-opacity hover:opacity-90 animate-pulse"
                    style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
                  >
                    <Dices className="h-3.5 w-3.5" /> Roll init
                  </button>
                )}
              </div>

              {/* Own/PC exact HP bar, or monster health band — full width */}
              {hp ? (
                <div className="mt-2">
                  <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--scene-text-primary)" }}>
                    {hp.current}<span style={{ color: "var(--scene-text-muted)" }}>/{hp.max}</span>{hp.temp > 0 ? <span style={{ color: "var(--scene-highlight)" }}> +{hp.temp}</span> : null}
                  </span>
                  <div className="w-full h-2 rounded-full overflow-hidden mt-1" style={{ background: "var(--scene-border)" }}>
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct * 100}%`, background: barColor }} />
                  </div>
                </div>
              ) : (
                c.healthBand && (
                  <span className="text-xs mt-2 inline-block px-2 py-0.5 rounded-full" style={{ background: `color-mix(in srgb, ${BAND_COLOR[c.healthBand]} 18%, transparent)`, color: BAND_COLOR[c.healthBand] }}>
                    {BAND_LABEL[c.healthBand]}
                  </span>
                )
              )}
              {(c.conditions.length > 0 || (c.exhaustion ?? 0) > 0) && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {c.conditions.map((cond) => (
                    <span key={cond} className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${CONDITION_COLORS[cond] ?? "#6b7280"}22`, color: CONDITION_COLORS[cond] ?? "#6b7280", border: `1px solid ${CONDITION_COLORS[cond] ?? "#6b7280"}44` }}>
                      {cond}
                    </span>
                  ))}
                  {(c.exhaustion ?? 0) > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b44" }}>
                      Exhaustion {c.exhaustion}
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Attack without leaving the Live tab — the player's own sheet attacks,
          rolls broadcast to the shared feed like any sheet roll. */}
      {myPc?.characterId && (
        <PlayerAttacksPanel
          sessionId={sessionId}
          campaignId={campaignId}
          characterId={myPc.characterId}
        />
      )}
    </section>
  )
}
