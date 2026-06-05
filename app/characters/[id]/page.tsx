"use client"

import { use, useEffect, useMemo, useRef, useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id, Doc } from "@/convex/_generated/dataModel"
import { AppShell } from "@/components/app-shell"
import Link from "next/link"
import { ArrowLeft, Heart, Pencil, Shield, Zap, Wind, Plus, Trash2, Moon, Eye, ChevronsUp, X, Sparkles, Skull, Dices, Award, Search, Check } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  ABILITIES,
  ABILITY_ABBREVIATIONS,
  SKILLS,
  SKILL_DISPLAY_NAMES,
  CLASS_COLORS,
  getAbilityModifier,
  formatModifier,
  getProficiencyBonus,
} from "@/lib/character/constants"
import type { Ability, Skill } from "@/lib/character/constants"
import { getDarkvisionRange, getFightingStylesAtLevel } from "@/lib/character/character-data"
import { getXPProgress, getXPForLevel, getLevelFromXP, getXPToNextLevel } from "@/lib/character/experience"
import { getCasterType, hpGainForLevel, avgHitDieRoll, recomputeSpellcasting, initSpellcasting, isAsiLevel } from "@/lib/character/leveling"
import {
  FEATS,
  type FeatData,
  type AppliedGrants,
  featNeedsChoices,
  autoResolve,
  applyGrants,
  reverseGrants,
  appliedSummary,
} from "@/lib/character/feats"
import { resolveEdition, type Edition } from "@/lib/editions"
import { deriveCharacter } from "@/lib/character/derive-character"
import {
  useSheetRoll,
  RollModeBar,
  SheetRollCard,
} from "@/components/character/sheet-roll"
import {
  StatBox,
  AbilityScoresGrid,
  SavingThrowsCard,
  SkillsCard,
  SensesCard,
} from "@/components/character/stat-blocks"
import { AttacksSection, InventorySection } from "./inventory"
import { SpellbookSection } from "@/components/character/spellbook"
import { ResourcesSection } from "@/components/character/resources"
import { WildshapeSection, CompanionsSection } from "@/components/character/creature-sheet"
import { InvocationsSection } from "@/components/character/invocations-section"
import { ManeuversSection } from "@/components/character/maneuvers-section"
import { getClassResources, type ResourceRow } from "@/lib/character/resources"

// ── Stat computation ──────────────────────────────────────────────────────────

type CharDoc = Doc<"characters">


function HpEditor({ char }: { char: CharDoc }) {
  const doUpdateHp = useMutation(api.characters.updateHp)

  const handleDelta = (delta: number) => {
    doUpdateHp({ id: char._id, delta }).catch(() => toast.error("Failed to update HP."))
  }

  const pct = char.hitPoints.max > 0 ? Math.max(0, char.hitPoints.current / char.hitPoints.max) : 0
  const barColor = pct > 0.5 ? "var(--scene-accent)" : pct > 0.25 ? "#f59e0b" : "#ef4444"

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
    >
      <div className="flex items-center gap-1.5 mb-3">
        <Heart className="h-3.5 w-3.5" style={{ color: "var(--scene-accent)" }} />
        <span className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
          Hit Points
        </span>
        {char.hitPoints.temp > 0 && (
          <span className="ml-auto text-xs" style={{ color: "var(--scene-highlight)" }}>
            +{char.hitPoints.temp} temp
          </span>
        )}
      </div>
      <div className="w-full h-2 rounded-full overflow-hidden mb-3" style={{ background: "var(--scene-border)" }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct * 100}%`, background: barColor }} />
      </div>
      <div className="flex gap-1.5 items-center">
        {([-5, -1] as const).map((d) => (
          <button
            key={d}
            onClick={() => handleDelta(d)}
            disabled={char.hitPoints.current === 0}
            className="flex-1 py-1.5 rounded text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-30"
            style={{ background: "#ef444420", color: "#ef4444", border: "1px solid #ef444444" }}
          >
            {d}
          </button>
        ))}
        <div
          className="flex-1 py-1.5 rounded text-center text-sm font-bold tabular-nums"
          style={{ background: "var(--scene-border)", color: "var(--scene-text-primary)", fontFamily: "var(--font-cinzel)" }}
        >
          {char.hitPoints.current}
          <span style={{ color: "var(--scene-text-muted)" }}>/{char.hitPoints.max}</span>
        </div>
        {([1, 5] as const).map((d) => (
          <button
            key={d}
            onClick={() => handleDelta(d)}
            disabled={char.hitPoints.current >= char.hitPoints.max}
            className="flex-1 py-1.5 rounded text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-30"
            style={{
              background: "color-mix(in srgb, var(--scene-accent) 18%, transparent)",
              color: "var(--scene-accent)",
              border: "1px solid color-mix(in srgb, var(--scene-accent) 38%, transparent)",
            }}
          >
            +{d}
          </button>
        ))}
      </div>
    </div>
  )
}

function RestPanel({
  char,
  resourceRows,
  shortRestResourceKeys,
}: {
  char: CharDoc
  resourceRows: ResourceRow[]
  shortRestResourceKeys: string[]
}) {
  const doSpendHitDie = useMutation(api.characters.spendHitDie)
  const doLongRest = useMutation(api.characters.longRest)
  const updateProperty = useMutation(api.characters.updateProperty)
  const [resting, setResting] = useState(false)

  const totalRemaining = char.hitDice.reduce((sum, d) => sum + (d.total - d.used), 0)
  const atFullHp = char.hitPoints.current >= char.hitPoints.max
  const hasShortRestResources = shortRestResourceKeys.length > 0

  const handleSpend = async (diceSize: number) => {
    try {
      const res = await doSpendHitDie({ id: char._id, diceSize })
      const modStr = res.conMod >= 0 ? `+${res.conMod}` : `${res.conMod}`
      toast.success(`d${res.diceSize}: rolled ${res.roll} ${modStr} CON → +${res.healed} HP`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't spend hit die.")
    }
  }

  // Reset spent class resources to full. `onlyKeys` limits a SHORT rest to its
  // short-rest resources; omitted (long rest) resets all. Client-side because the
  // longRest mutation only touches the character doc, not these property rows.
  const resetResources = async (onlyKeys?: string[]) => {
    await Promise.all(
      resourceRows
        .filter((r) => {
          const data = (r.data ?? {}) as { key?: string; used?: number }
          if ((data.used ?? 0) <= 0) return false
          return onlyKeys ? !!data.key && onlyKeys.includes(data.key) : true
        })
        .map((r) =>
          updateProperty({
            id: r._id as Id<"characterProperties">,
            data: { ...(r.data as object), used: 0 },
          }),
        ),
    )
  }

  const handleShortRest = async () => {
    try {
      await resetResources(shortRestResourceKeys)
      toast.success("Short rest — short-rest resources restored.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't complete short rest.")
    }
  }

  const handleLongRest = async () => {
    if (!confirm("Take a long rest? Restores HP, spell slots, class resources, and ~half your hit dice.")) return
    setResting(true)
    try {
      await doLongRest({ id: char._id })
      await resetResources()
      toast.success("Long rest complete — fully restored.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't complete long rest.")
    } finally {
      setResting(false)
    }
  }

  return (
    <div
      className="rounded-xl p-4 h-full"
      style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
    >
      <div className="flex items-center gap-1.5 mb-3">
        <Moon className="h-3.5 w-3.5" style={{ color: "var(--scene-accent)" }} />
        <span className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
          Rest
        </span>
        <span className="ml-auto text-xs" style={{ color: "var(--scene-text-muted)" }}>
          {totalRemaining} hit {totalRemaining === 1 ? "die" : "dice"} left
        </span>
      </div>

      {/* Short rest: spend hit dice, one pool of die sizes at a time */}
      <p className="text-xs mb-2" style={{ color: "var(--scene-text-muted)" }}>
        Short rest — spend a hit die to heal
      </p>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {char.hitDice.length === 0 && (
          <span className="text-xs" style={{ color: "var(--scene-text-muted)", opacity: 0.6 }}>
            No hit dice on this sheet.
          </span>
        )}
        {char.hitDice.map((pool) => {
          const remaining = pool.total - pool.used
          const disabled = remaining <= 0 || atFullHp
          return (
            <button
              key={pool.diceSize}
              onClick={() => handleSpend(pool.diceSize)}
              disabled={disabled}
              className="px-3 py-1.5 rounded text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-30"
              style={{
                background: "color-mix(in srgb, var(--scene-accent) 14%, transparent)",
                color: "var(--scene-accent)",
                border: "1px solid color-mix(in srgb, var(--scene-accent) 32%, transparent)",
              }}
              title={atFullHp ? "Already at full HP" : `Spend a d${pool.diceSize} (${remaining} left)`}
            >
              d{pool.diceSize}
              <span className="ml-1 text-xs tabular-nums" style={{ opacity: 0.7 }}>
                {remaining}/{pool.total}
              </span>
            </button>
          )
        })}
      </div>

      {/* Short rest — restores short-rest class resources (hit dice are spent above) */}
      {hasShortRestResources && (
        <button
          onClick={handleShortRest}
          title="Restores short-rest resources (Ki, Channel Divinity, etc.). Spend hit dice above to heal."
          className="w-full inline-flex items-center justify-center gap-2 py-2 mb-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80"
          style={{
            background: "color-mix(in srgb, var(--scene-accent) 14%, transparent)",
            color: "var(--scene-accent)",
            border: "1px solid color-mix(in srgb, var(--scene-accent) 32%, transparent)",
          }}
        >
          <Wind className="h-4 w-4" />
          Short Rest
        </button>
      )}

      {/* Long rest */}
      <button
        onClick={handleLongRest}
        disabled={resting}
        className="w-full inline-flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
        style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
      >
        <Moon className="h-4 w-4" />
        {resting ? "Resting…" : "Long Rest"}
      </button>
    </div>
  )
}

// Three clickable pips for one death-save track. Clicking pip i sets the count
// to i+1; clicking the last filled pip again clears it (toggle down).
function DeathSavePips({ count, color, label, onSet }: {
  count: number
  color: string
  label: string
  onSet: (n: number) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map((i) => {
        const filled = i < count
        return (
          <button
            key={i}
            onClick={() => onSet(count === i + 1 ? i : i + 1)}
            className="w-4 h-4 rounded-full transition-transform active:scale-90 hover:opacity-80"
            style={{
              background: filled ? color : "transparent",
              border: `1.5px solid ${filled ? color : "var(--scene-border)"}`,
            }}
            title={`${label} ${i + 1}`}
          />
        )
      })}
    </div>
  )
}

// Death-save panel — auto-surfaces when the character is at 0 HP (dying). Rolls a
// d20 server-side (RAW: nat-20 revives at 1 HP, nat-1 = two failures, 10+ success,
// else failure; 3 successes = stable, 3 failures = dead), with editable pips for
// manual correction and a Stabilize shortcut. Regaining any HP resets it (handled
// server-side in updateHp/spendHitDie), so the panel disappears on heal.
function DyingPanel({ char }: { char: CharDoc }) {
  const doSet = useMutation(api.characters.setDeathSaves)
  const doRoll = useMutation(api.characters.rollDeathSave)
  const [rolling, setRolling] = useState(false)

  const { successes, failures } = char.deathSaves
  const isDead = failures >= 3
  const isStable = successes >= 3
  const settled = isDead || isStable

  const set = (s: number, f: number) =>
    doSet({ id: char._id, successes: s, failures: f }).catch(() =>
      toast.error("Failed to update death saves."),
    )

  const handleRoll = async () => {
    setRolling(true)
    try {
      const res = await doRoll({ id: char._id })
      const tag = `Death save: ${res.roll}`
      if (res.outcome === "revived") toast.success(`${tag} (nat 20!) — ${char.name} regains 1 HP and is conscious.`)
      else if (res.outcome === "dead") toast.error(`${tag} — ${char.name} has died.`)
      else if (res.outcome === "stable") toast.success(`${tag} — ${char.name} is stable.`)
      else if (res.outcome === "success") toast.success(`${tag} — success (${res.successes}/3).`)
      else toast.error(`${tag} — failure (${res.failures}/3).`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't roll a death save.")
    } finally {
      setRolling(false)
    }
  }

  const status = isDead
    ? "Dead"
    : isStable
      ? "Stable — unconscious but no longer dying"
      : "Dying — roll a death save on your turn"

  return (
    <div
      className="rounded-xl p-4 mb-6"
      style={{
        background: "color-mix(in srgb, #ef4444 8%, var(--scene-surface))",
        border: "1px solid #ef444466",
      }}
    >
      <div className="flex items-center gap-1.5 mb-3">
        <Skull className="h-3.5 w-3.5" style={{ color: "#ef4444" }} />
        <span className="text-xs uppercase tracking-widest" style={{ color: "#ef4444" }}>
          Death Saves
        </span>
        <span className="ml-auto text-xs" style={{ color: "var(--scene-text-muted)" }}>
          {status}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold w-14" style={{ color: "#22c55e" }}>Success</span>
            <DeathSavePips count={successes} color="#22c55e" label="Success" onSet={(n) => set(n, failures)} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold w-14" style={{ color: "#ef4444" }}>Failure</span>
            <DeathSavePips count={failures} color="#ef4444" label="Failure" onSet={(n) => set(successes, n)} />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {!settled && (
            <button
              onClick={() => set(3, failures)}
              title="Stabilize (e.g. Spare the Dying or a successful Medicine check)"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80"
              style={{
                background: "color-mix(in srgb, #22c55e 14%, transparent)",
                color: "#22c55e",
                border: "1px solid color-mix(in srgb, #22c55e 38%, transparent)",
              }}
            >
              <Heart className="h-4 w-4" />
              Stabilize
            </button>
          )}
          <button
            onClick={handleRoll}
            disabled={rolling || settled}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ background: "#ef4444", color: "#fff" }}
            title={settled ? status : "Roll a d20 death saving throw"}
          >
            <Dices className="h-4 w-4" />
            {rolling ? "Rolling…" : "Roll Death Save"}
          </button>
        </div>
      </div>
    </div>
  )
}

// Add a hit die to the pool matching the class die size (or create the pool).
function incrementHitDice(hitDice: CharDoc["hitDice"], dieSize: number): CharDoc["hitDice"] {
  if (hitDice.some((d) => d.diceSize === dieSize)) {
    return hitDice.map((d) => (d.diceSize === dieSize ? { ...d, total: d.total + 1 } : d))
  }
  return [...hitDice, { diceSize: dieSize, total: 1, used: 0 }]
}

// Feat picker — searchable list of curated feats with a choice step for feats
// that require a decision (which ability, skills, expertise, damage type). Reused
// by the level-up flow and the Feats section. onSelect hands back the feat plus
// the resolved grants (AppliedGrants) so the caller can bake them in.
function FeatPicker({
  feats,
  knownIds,
  char,
  onSelect,
  onClose,
}: {
  feats: FeatData[]
  knownIds: Set<string>
  char: CharDoc
  onSelect: (feat: FeatData, applied: AppliedGrants) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState("")
  const [configuring, setConfiguring] = useState<FeatData | null>(null)
  const q = query.trim().toLowerCase()
  const results = feats
    .filter((f) => (q ? f.name.toLowerCase().includes(q) || f.description.toLowerCase().includes(q) : true))
    .sort((a, b) => a.name.localeCompare(b.name))

  const pick = (f: FeatData) => {
    if (knownIds.has(f.id)) return
    if (featNeedsChoices(f.effects)) setConfiguring(f)
    else onSelect(f, autoResolve(f, char.level))
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="rounded-xl p-5 w-full max-w-md max-h-[85vh] flex flex-col"
        style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 min-w-0">
            {configuring && (
              <button onClick={() => setConfiguring(null)} className="p-1 rounded hover:opacity-80 flex-shrink-0" style={{ color: "var(--scene-text-muted)" }} title="Back to feat list">
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <h2 className="text-lg font-bold truncate" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
              {configuring ? configuring.name : "Choose a feat"}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:opacity-80 flex-shrink-0" style={{ color: "var(--scene-text-muted)" }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {configuring ? (
          <FeatConfig feat={configuring} char={char} onConfirm={(applied) => onSelect(configuring, applied)} />
        ) : (
          <>
            <div className="relative mb-3">
              <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--scene-text-muted)" }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search feats…"
                autoFocus
                className="w-full pl-8 pr-3 py-2 rounded-md text-sm bg-transparent outline-none"
                style={{ border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
              />
            </div>

            <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-1.5">
              {results.length === 0 ? (
                <div className="px-1 py-3 text-sm" style={{ color: "var(--scene-text-muted)" }}>No matching feats.</div>
              ) : (
                results.map((f) => {
                  const known = knownIds.has(f.id)
                  const hasChoice = featNeedsChoices(f.effects)
                  return (
                    <button
                      key={f.id}
                      onClick={() => pick(f)}
                      disabled={known}
                      className="w-full text-left px-3 py-2.5 rounded-md transition-colors disabled:opacity-50"
                      style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium" style={{ color: "var(--scene-text-primary)" }}>{f.name}</span>
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}>
                          {f.category}
                        </span>
                        {hasChoice && !known && (
                          <span className="text-[10px] ml-auto flex-shrink-0" style={{ color: "var(--scene-accent)" }}>choices →</span>
                        )}
                        {known && <Check className="h-3.5 w-3.5 ml-auto flex-shrink-0" style={{ color: "var(--scene-accent)" }} />}
                      </div>
                      {f.prerequisite && (
                        <div className="text-[11px] mt-0.5" style={{ color: "var(--scene-accent)" }}>Requires: {f.prerequisite}</div>
                      )}
                      <div className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--scene-text-muted)" }}>{f.description}</div>
                    </button>
                  )
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// Choice step for a feat that requires decisions: pick the +1 ability, skill
// proficiencies, expertise, and/or a flavor option (e.g. damage type). Resolves
// to AppliedGrants on confirm.
function FeatConfig({
  feat,
  char,
  onConfirm,
}: {
  feat: FeatData
  char: CharDoc
  onConfirm: (applied: AppliedGrants) => void
}) {
  const e = feat.effects ?? {}
  const abilityOpts = e.abilityOptions ?? []
  const needAbility = abilityOpts.length > 1
  const [ability, setAbility] = useState<Ability | null>(abilityOpts.length === 1 ? abilityOpts[0] : null)
  const [skills, setSkills] = useState<Skill[]>([])
  const [expertise, setExpertise] = useState<Skill[]>([])
  const [text, setText] = useState<string>("")

  const allSkills = Object.keys(SKILLS) as Skill[]
  // Skills you can newly gain proficiency in (not already proficient).
  const skillPool = allSkills.filter((s) => !char.skillProficiencies.includes(s))
  // Skills eligible for expertise: ones you're proficient in (incl. just-chosen
  // here) and not already an expert in.
  const expertisePool = allSkills.filter(
    (s) => (char.skillProficiencies.includes(s) || skills.includes(s)) && !char.skillExpertise.includes(s),
  )

  const toggle = (list: Skill[], set: (v: Skill[]) => void, s: Skill, max: number) => {
    if (list.includes(s)) set(list.filter((x) => x !== s))
    else if (list.length < max) set([...list, s])
  }

  const ok =
    (!needAbility || !!ability) &&
    (!e.skillChoices || skills.length === e.skillChoices) &&
    (!e.expertiseChoices || expertise.length === e.expertiseChoices) &&
    (!e.textChoice || !!text)

  const confirm = () => {
    const g: AppliedGrants = {}
    if (ability) g.ability = ability
    if (e.saveProficiency && ability && !char.savingThrowProficiencies.includes(ability)) g.saveProficiency = ability
    if (skills.length) g.skillProficiencies = skills
    if (expertise.length) g.skillExpertise = expertise
    if (e.hpPerLevel) g.hp = e.hpPerLevel * char.level
    if (text) g.text = text
    onConfirm(g)
  }

  return (
    <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-4">
      <p className="text-xs leading-relaxed" style={{ color: "var(--scene-text-muted)" }}>{feat.description}</p>

      {needAbility && (
        <div>
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--scene-text-muted)" }}>
            +1 Ability{e.saveProficiency ? " (also grants its saving-throw proficiency)" : ""}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {abilityOpts.map((a) => (
              <button
                key={a}
                onClick={() => setAbility(a)}
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-opacity hover:opacity-80"
                style={{
                  background: ability === a ? "color-mix(in srgb, var(--scene-accent) 16%, transparent)" : "var(--scene-bg)",
                  color: ability === a ? "var(--scene-accent)" : "var(--scene-text-primary)",
                  border: `1px solid ${ability === a ? "color-mix(in srgb, var(--scene-accent) 40%, transparent)" : "var(--scene-border)"}`,
                }}
              >
                {ABILITY_ABBREVIATIONS[a]}
              </button>
            ))}
          </div>
        </div>
      )}

      {!!e.skillChoices && (
        <div>
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--scene-text-muted)" }}>
            Skill proficiency — pick {e.skillChoices} ({skills.length}/{e.skillChoices})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {skillPool.map((s) => (
              <SkillChip key={s} label={SKILL_DISPLAY_NAMES[s]} active={skills.includes(s)} onClick={() => toggle(skills, setSkills, s, e.skillChoices!)} />
            ))}
          </div>
        </div>
      )}

      {!!e.expertiseChoices && (
        <div>
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--scene-text-muted)" }}>
            Expertise — pick {e.expertiseChoices} ({expertise.length}/{e.expertiseChoices})
          </div>
          {expertisePool.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--scene-text-muted)" }}>No eligible skills (need a skill proficiency first).</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {expertisePool.map((s) => (
                <SkillChip key={s} label={SKILL_DISPLAY_NAMES[s]} active={expertise.includes(s)} onClick={() => toggle(expertise, setExpertise, s, e.expertiseChoices!)} />
              ))}
            </div>
          )}
        </div>
      )}

      {e.textChoice && (
        <div>
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--scene-text-muted)" }}>{e.textChoice.label}</div>
          {e.textChoice.options ? (
            <div className="flex flex-wrap gap-1.5">
              {e.textChoice.options.map((o) => (
                <SkillChip key={o} label={o} active={text === o} onClick={() => setText(o)} />
              ))}
            </div>
          ) : (
            <input
              value={text}
              onChange={(ev) => setText(ev.target.value)}
              placeholder={e.textChoice.label}
              className="w-full px-3 py-2 rounded-md text-sm bg-transparent outline-none"
              style={{ border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
            />
          )}
        </div>
      )}

      <button
        onClick={confirm}
        disabled={!ok}
        className="w-full py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
        style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
      >
        Add {feat.name}
      </button>
    </div>
  )
}

function SkillChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 rounded-md text-xs font-medium transition-opacity hover:opacity-80"
      style={{
        background: active ? "color-mix(in srgb, var(--scene-accent) 16%, transparent)" : "var(--scene-bg)",
        color: active ? "var(--scene-accent)" : "var(--scene-text-primary)",
        border: `1px solid ${active ? "color-mix(in srgb, var(--scene-accent) 40%, transparent)" : "var(--scene-border)"}`,
      }}
    >
      {label}
    </button>
  )
}

// Level-up modal. Bumps level, gains HP (average or rolled), adds a hit die,
// rescales caster slots + DC/attack (see lib/character/leveling.ts). At ASI
// levels it also offers an Ability Score Improvement vs feat choice. Other new
// class features are a guided manual step (add via Custom Properties below).
function LevelUpDialog({
  char,
  hitDie,
  conMod,
  spellAbilityMod,
  edition,
  onClose,
}: {
  char: CharDoc
  hitDie: number
  conMod: number
  spellAbilityMod: number
  edition: Edition
  onClose: () => void
}) {
  const doUpdate = useMutation(api.characters.update)
  const addProperty = useMutation(api.characters.addProperty)
  const updateProperty = useMutation(api.characters.updateProperty)
  const allProps = useQuery(api.characters.listAllProperties)
  const [hpMode, setHpMode] = useState<"average" | "roll">("average")
  const [rolled, setRolled] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const newLevel = Math.min(20, char.level + 1)
  const classId = char.characterClass.toLowerCase()
  const casterType = getCasterType(classId)

  // ASI / feat choice — only at this class's ASI levels (4/8/12/16/19, +Fighter/Rogue extras).
  const isAsi = isAsiLevel(classId, newLevel)
  const racialBonuses = (char.racialBonuses ?? {}) as Partial<Record<Ability, number>>
  const totals = Object.fromEntries(
    ABILITIES.map((a) => [a, char.baseAbilities[a] + (racialBonuses[a] ?? 0)]),
  ) as Record<Ability, number>

  const [choice, setChoice] = useState<"asi" | "feat">("asi")
  const [inc, setInc] = useState<Partial<Record<Ability, number>>>({})
  const [selectedFeat, setSelectedFeat] = useState<FeatData | null>(null)
  const [selectedApplied, setSelectedApplied] = useState<AppliedGrants | null>(null)
  const [featPickerOpen, setFeatPickerOpen] = useState(false)
  const [fightingStyleId, setFightingStyleId] = useState("")

  const spent = ABILITIES.reduce((n, a) => n + (inc[a] ?? 0), 0)
  const canApply = choice === "asi" ? spent === 2 : !!selectedFeat

  // +1/−1 an ability's pending ASI increase, capped at a 2-point budget, max +2
  // to any one ability, and never past a total score of 20 (RAW).
  const bump = (a: Ability, d: number) =>
    setInc((prev) => {
      const next = (prev[a] ?? 0) + d
      if (next < 0 || next > 2) return prev
      const others = ABILITIES.reduce((n, x) => n + (x === a ? 0 : prev[x] ?? 0), 0)
      if (others + next > 2) return prev
      if (d > 0 && totals[a] + next > 20) return prev
      return { ...prev, [a]: next }
    })

  const myProps = (allProps ?? []).filter((p) => p.characterId === char._id)
  const knownFeatIds = new Set(
    myProps
      .filter((p) => p.type === "feature")
      .map((p) => (p.data as { featId?: string } | undefined)?.featId)
      .filter(Boolean) as string[],
  )
  const featNextOrder = myProps.length ? Math.max(...myProps.map((p) => p.orderIndex)) + 1 : 0

  // Fighting style gained at THIS level (Paladin/Ranger @ 2; Fighter @ 1 is the
  // creation pick). Offer it only if the character doesn't already have one — that
  // also backfills Fighters built before the style picker shipped.
  const hasFightingStyle = myProps.some(
    (p) => p.type === "feature" && !!(p.data as { fightingStyleId?: string } | undefined)?.fightingStyleId,
  )
  const fightingStyleOptions = getFightingStylesAtLevel(classId, newLevel)
  const needsFightingStyle = fightingStyleOptions.length > 0 && !hasFightingStyle
  const selectedFightingStyle = fightingStyleOptions.find((s) => s.id === fightingStyleId)

  const rollHp = () => {
    setRolled(Math.floor(Math.random() * hitDie) + 1)
    setHpMode("roll")
  }
  const hpRoll = hpMode === "roll" ? rolled ?? avgHitDieRoll(hitDie) : undefined
  const hpGain = hpGainForLevel(hitDie, conMod, hpRoll)

  const oldProf = getProficiencyBonus(char.level)
  const newProf = getProficiencyBonus(newLevel)
  const profChanged = newProf !== oldProf

  const handleConfirm = async (skip = false) => {
    setSaving(true)
    try {
      const applyAsi = isAsi && !skip && choice === "asi" && spent === 2
      const applyFeat = isAsi && !skip && choice === "feat" && !!selectedFeat && !!selectedApplied
      // Feat grants for the stored fields (ability/saves/skills/expertise). HP is
      // handled separately below so it stacks with the level-up HP gain.
      let grants: ReturnType<typeof applyGrants> = {}
      if (applyFeat && selectedApplied) grants = applyGrants(char, selectedApplied)
      delete grants.hitPoints
      const featHp = applyFeat && selectedApplied?.hp ? selectedApplied.hp : 0
      // Tough already on the sheet → +2 HP at every level-up (RAW). Mutually
      // exclusive with featHp (can't take Tough you already have).
      const toughRow = myProps.find(
        (p) => p.type === "feature" && (p.data as { featId?: string } | undefined)?.featId === "tough",
      )
      const toughBonus = toughRow ? 2 : 0
      const newHitPoints = {
        ...char.hitPoints,
        max: char.hitPoints.max + hpGain + featHp + toughBonus,
        current: char.hitPoints.current + hpGain + featHp + toughBonus,
      }
      const spellcasting = char.spellcasting
        ? recomputeSpellcasting(char.spellcasting, classId, newLevel, spellAbilityMod, edition)
        : undefined
      let baseAbilities: typeof char.baseAbilities | undefined
      if (applyAsi) {
        baseAbilities = { ...char.baseAbilities }
        for (const a of ABILITIES) baseAbilities[a] = char.baseAbilities[a] + (inc[a] ?? 0)
      }
      await doUpdate({
        id: char._id,
        level: newLevel,
        experiencePoints: Math.max(char.experiencePoints, getXPForLevel(newLevel)),
        hitPoints: newHitPoints,
        hitDice: incrementHitDice(char.hitDice, hitDie),
        ...(spellcasting ? { spellcasting } : {}),
        ...(baseAbilities ? { baseAbilities } : {}),
        ...grants,
      })
      // Keep Tough's recorded HP grant in sync with the +2 just added, so removal
      // later reverses the full amount.
      if (toughRow) {
        const data = (toughRow.data ?? {}) as { applied?: AppliedGrants }
        await updateProperty({
          id: toughRow._id,
          data: { ...data, applied: { ...(data.applied ?? {}), hp: (data.applied?.hp ?? 0) + 2 } },
        })
      }
      if (applyFeat && selectedFeat && selectedApplied) {
        const summary = appliedSummary(selectedApplied)
        await addProperty({
          characterId: char._id,
          type: "feature",
          name: selectedApplied.text ? `${selectedFeat.name} (${selectedApplied.text})` : selectedFeat.name,
          description: summary ? `${selectedFeat.description}\n\n${summary}` : selectedFeat.description,
          source: "feat",
          active: true,
          orderIndex: featNextOrder,
          data: { featId: selectedFeat.id, category: selectedFeat.category, applied: selectedApplied },
        })
      }
      // Fighting style (Paladin/Ranger @ 2) → a descriptive feature, like the
      // Fighter's creation pick. Applies regardless of the ASI skip path.
      if (needsFightingStyle && selectedFightingStyle) {
        await addProperty({
          characterId: char._id,
          type: "feature",
          name: `Fighting Style: ${selectedFightingStyle.name}`,
          description: selectedFightingStyle.description,
          source: "Fighting Style",
          active: true,
          orderIndex: featNextOrder + (applyFeat ? 1 : 0),
          data: { fightingStyleId: selectedFightingStyle.id },
        })
      }
      const styleExtra = needsFightingStyle && selectedFightingStyle ? ` — Fighting Style: ${selectedFightingStyle.name}` : ""
      const extra = (applyAsi ? " (+ability scores)" : applyFeat ? ` — gained ${selectedFeat!.name}` : "") + styleExtra
      toast.success(`Leveled up to ${newLevel}! +${hpGain} HP${extra}.`)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't level up.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div
        className="rounded-xl p-5 w-full max-w-md max-h-[85vh] overflow-y-auto"
        style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ChevronsUp className="h-5 w-5" style={{ color: "var(--scene-accent)" }} />
            <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
              Level {char.level} → {newLevel}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:opacity-80" style={{ color: "var(--scene-text-muted)" }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* HP gain */}
        <div className="mb-4">
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--scene-text-muted)" }}>Hit Points</div>
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setHpMode("average")}
              className="flex-1 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-90"
              style={{
                background: hpMode === "average" ? "color-mix(in srgb, var(--scene-accent) 16%, transparent)" : "var(--scene-bg)",
                color: hpMode === "average" ? "var(--scene-accent)" : "var(--scene-text-primary)",
                border: `1px solid ${hpMode === "average" ? "color-mix(in srgb, var(--scene-accent) 40%, transparent)" : "var(--scene-border)"}`,
              }}
            >
              Average ({avgHitDieRoll(hitDie)})
            </button>
            <button
              onClick={rollHp}
              className="flex-1 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-90"
              style={{
                background: hpMode === "roll" ? "color-mix(in srgb, var(--scene-accent) 16%, transparent)" : "var(--scene-bg)",
                color: hpMode === "roll" ? "var(--scene-accent)" : "var(--scene-text-primary)",
                border: `1px solid ${hpMode === "roll" ? "color-mix(in srgb, var(--scene-accent) 40%, transparent)" : "var(--scene-border)"}`,
              }}
            >
              {hpMode === "roll" && rolled ? `Rolled ${rolled}` : `Roll d${hitDie}`}
            </button>
          </div>
          <p className="text-sm" style={{ color: "var(--scene-text-primary)" }}>
            Max HP <span className="font-bold" style={{ color: "var(--scene-accent)" }}>+{hpGain}</span>
            <span style={{ color: "var(--scene-text-muted)" }}> ({hpRoll ?? avgHitDieRoll(hitDie)} {conMod >= 0 ? "+" : "−"} {Math.abs(conMod)} CON, min 1) → {char.hitPoints.max + hpGain}</span>
          </p>
        </div>

        {/* Other gains */}
        <ul className="space-y-1.5 mb-4 text-sm" style={{ color: "var(--scene-text-primary)" }}>
          <li>• A d{hitDie} hit die added (now {char.hitDice.reduce((n, d) => n + d.total, 0) + 1} total)</li>
          {profChanged && (
            <li>• Proficiency bonus +{oldProf} → <span style={{ color: "var(--scene-accent)" }}>+{newProf}</span> (saves, skills, attacks rescale)</li>
          )}
          {(casterType === "full" || casterType === "half") && char.spellcasting && (
            <li>• Spell slots updated for level {newLevel}{profChanged ? "; spell save DC & attack rescaled" : ""}</li>
          )}
          {casterType === "pact" && char.spellcasting && (
            <li>• Pact Magic slots updated for level {newLevel}{profChanged ? "; spell save DC & attack rescaled" : ""}</li>
          )}
          {casterType !== "none" && !char.spellcasting && (
            <li style={{ color: "var(--scene-text-muted)" }}>• Enable spellcasting on your sheet to track spell slots</li>
          )}
        </ul>

        {/* ASI vs feat — only at ASI levels */}
        {isAsi && (
          <div className="mb-4">
            <div className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--scene-accent)" }}>
              Ability Score Improvement
            </div>
            <div className="flex gap-2 mb-3">
              {(["asi", "feat"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setChoice(c)}
                  className="flex-1 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-90"
                  style={{
                    background: choice === c ? "color-mix(in srgb, var(--scene-accent) 16%, transparent)" : "var(--scene-bg)",
                    color: choice === c ? "var(--scene-accent)" : "var(--scene-text-primary)",
                    border: `1px solid ${choice === c ? "color-mix(in srgb, var(--scene-accent) 40%, transparent)" : "var(--scene-border)"}`,
                  }}
                >
                  {c === "asi" ? "Ability Scores" : "Feat"}
                </button>
              ))}
            </div>

            {choice === "asi" ? (
              <div>
                <p className="text-xs mb-2" style={{ color: spent === 2 ? "var(--scene-text-muted)" : "var(--scene-accent)" }}>
                  {spent === 2 ? "2 points assigned." : `Assign ${2 - spent} more ${2 - spent === 1 ? "point" : "points"} — +2 to one ability or +1 to two.`}
                </p>
                <div className="space-y-1.5">
                  {ABILITIES.map((a) => {
                    const add = inc[a] ?? 0
                    const newScore = totals[a] + add
                    const canInc = spent < 2 && add < 2 && newScore < 20
                    return (
                      <div key={a} className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-wider w-10" style={{ color: "var(--scene-text-muted)" }}>
                          {ABILITY_ABBREVIATIONS[a]}
                        </span>
                        <span className="text-sm tabular-nums" style={{ color: "var(--scene-text-primary)" }}>
                          {totals[a]}
                          {add > 0 && <span style={{ color: "var(--scene-accent)" }}> → {newScore}</span>}
                        </span>
                        <div className="ml-auto flex items-center gap-1.5">
                          <button
                            onClick={() => bump(a, -1)}
                            disabled={add <= 0}
                            className="w-7 h-7 rounded text-sm font-bold transition-opacity hover:opacity-80 disabled:opacity-30"
                            style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
                          >
                            −
                          </button>
                          <span className="w-5 text-center text-sm tabular-nums" style={{ color: add > 0 ? "var(--scene-accent)" : "var(--scene-text-muted)" }}>
                            +{add}
                          </span>
                          <button
                            onClick={() => bump(a, +1)}
                            disabled={!canInc}
                            className="w-7 h-7 rounded text-sm font-bold transition-opacity hover:opacity-80 disabled:opacity-30"
                            style={{ background: "color-mix(in srgb, var(--scene-accent) 14%, transparent)", border: "1px solid color-mix(in srgb, var(--scene-accent) 32%, transparent)", color: "var(--scene-accent)" }}
                            title={newScore >= 20 ? "Already at 20 (RAW cap)" : undefined}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : selectedFeat ? (
              <div className="rounded-lg p-3" style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}>
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 flex-shrink-0" style={{ color: "var(--scene-accent)" }} />
                  <span className="text-sm font-medium" style={{ color: "var(--scene-text-primary)" }}>
                    {selectedApplied?.text ? `${selectedFeat.name} (${selectedApplied.text})` : selectedFeat.name}
                  </span>
                  <button onClick={() => setFeatPickerOpen(true)} className="ml-auto text-xs hover:opacity-80" style={{ color: "var(--scene-accent)" }}>
                    Change
                  </button>
                </div>
                {selectedApplied && appliedSummary(selectedApplied) && (
                  <p className="text-[11px] mt-1 font-medium" style={{ color: "var(--scene-accent)" }}>{appliedSummary(selectedApplied)}</p>
                )}
                <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--scene-text-muted)" }}>{selectedFeat.description}</p>
              </div>
            ) : (
              <button
                onClick={() => setFeatPickerOpen(true)}
                className="w-full py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80"
                style={{ background: "var(--scene-bg)", border: "1px dashed var(--scene-border)", color: "var(--scene-accent)" }}
              >
                Choose a feat…
              </button>
            )}
          </div>
        )}

        {/* Fighting Style — Paladin/Ranger at level 2 (required choice) */}
        {needsFightingStyle && (
          <div className="mb-4">
            <div className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--scene-accent)" }}>
              Fighting Style
            </div>
            <div className="flex flex-wrap gap-2">
              {fightingStyleOptions.map((fs) => (
                <button
                  key={fs.id}
                  onClick={() => setFightingStyleId((prev) => (prev === fs.id ? "" : fs.id))}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: fightingStyleId === fs.id ? "var(--scene-accent)" : "var(--scene-bg)",
                    color: fightingStyleId === fs.id ? "var(--scene-bg)" : "var(--scene-text-primary)",
                    border: `1px solid ${fightingStyleId === fs.id ? "var(--scene-accent)" : "var(--scene-border)"}`,
                  }}
                >
                  {fs.name}
                </button>
              ))}
            </div>
            {selectedFightingStyle && (
              <p className="text-xs mt-2 leading-relaxed" style={{ color: "var(--scene-text-muted)" }}>{selectedFightingStyle.description}</p>
            )}
          </div>
        )}

        {/* Features reminder */}
        <p className="text-xs rounded-lg p-3 mb-4" style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)", color: "var(--scene-text-muted)" }}>
          New class features at this level aren&apos;t added automatically — add them as Custom Properties below the sheet (check your class for level {newLevel}).
        </p>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ background: "var(--scene-border)", color: "var(--scene-text-primary)" }}
          >
            Cancel
          </button>
          <button
            onClick={() => handleConfirm(false)}
            disabled={saving || (isAsi && !canApply) || (needsFightingStyle && !fightingStyleId)}
            className="flex-1 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
            title={
              isAsi && !canApply
                ? choice === "asi" ? "Assign 2 ability points first" : "Choose a feat first"
                : needsFightingStyle && !fightingStyleId ? "Choose a fighting style first" : undefined
            }
          >
            {saving ? "Leveling…" : `Level up to ${newLevel}`}
          </button>
        </div>
        {isAsi && (
          <button
            onClick={() => handleConfirm(true)}
            disabled={saving}
            className="w-full mt-2 py-1.5 text-xs transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ color: "var(--scene-text-muted)" }}
          >
            Skip for now — choose your ASI or feat later
          </button>
        )}

        {featPickerOpen && (
          <FeatPicker
            feats={FEATS}
            knownIds={knownFeatIds}
            char={char}
            onSelect={(f, applied) => { setSelectedFeat(f); setSelectedApplied(applied); setChoice("feat"); setFeatPickerOpen(false) }}
            onClose={() => setFeatPickerOpen(false)}
          />
        )}
      </div>
    </div>
  )
}

// Experience bar + Add XP + Level Up entry point.
function ExperienceCard({ char, conMod, spellAbilityMod, hitDie, edition }: { char: CharDoc; conMod: number; spellAbilityMod: number; hitDie: number; edition: Edition }) {
  const doUpdate = useMutation(api.characters.update)
  const [levelUpOpen, setLevelUpOpen] = useState(false)
  const [addingXp, setAddingXp] = useState(false)
  const [xpInput, setXpInput] = useState("")

  const xp = char.experiencePoints
  const progress = getXPProgress(xp)
  const toNext = getXPToNextLevel(xp)
  const atMax = char.level >= 20
  const xpReady = !atMax && getLevelFromXP(xp) > char.level

  const handleAddXp = async () => {
    const amount = Math.floor(Number(xpInput))
    if (!Number.isFinite(amount) || amount === 0) {
      setAddingXp(false)
      setXpInput("")
      return
    }
    try {
      const newXP = Math.max(0, xp + amount)
      await doUpdate({ id: char._id, experiencePoints: newXP })
      if (getLevelFromXP(newXP) > char.level) toast.success("XP added — ready to level up!")
      else toast.success(`${amount > 0 ? "+" : ""}${amount.toLocaleString()} XP`)
    } catch {
      toast.error("Couldn't update XP.")
    } finally {
      setAddingXp(false)
      setXpInput("")
    }
  }

  return (
    <div className="rounded-xl p-4 mb-6" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
      <div className="flex items-center gap-1.5 mb-2">
        <ChevronsUp className="h-3.5 w-3.5" style={{ color: "var(--scene-accent)" }} />
        <span className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>Experience</span>
        <span className="ml-auto text-xs" style={{ color: "var(--scene-text-muted)" }}>
          {atMax ? "Max level" : `${xp.toLocaleString()} XP · ${toNext.toLocaleString()} to level ${char.level + 1}`}
        </span>
      </div>
      <div className="w-full h-2 rounded-full overflow-hidden mb-3" style={{ background: "var(--scene-border)" }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${atMax ? 100 : progress}%`, background: "var(--scene-accent)" }} />
      </div>

      {addingXp ? (
        <div className="flex gap-2">
          <input
            autoFocus
            type="number"
            value={xpInput}
            onChange={(e) => setXpInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddXp(); if (e.key === "Escape") { setAddingXp(false); setXpInput("") } }}
            placeholder="XP to add (e.g. 500)"
            className="flex-1 px-3 py-1.5 rounded-md text-sm bg-transparent outline-none"
            style={{ border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
          />
          <button onClick={handleAddXp} className="px-3 py-1.5 rounded-md text-sm font-medium hover:opacity-80" style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}>Add</button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => setAddingXp(true)}
            disabled={atMax}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ background: "var(--scene-border)", color: "var(--scene-text-primary)" }}
          >
            <Plus className="h-3.5 w-3.5" /> Add XP
          </button>
          <button
            onClick={() => setLevelUpOpen(true)}
            disabled={atMax}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
            style={
              xpReady
                ? { background: "var(--scene-accent)", color: "var(--scene-bg)" }
                : { background: "color-mix(in srgb, var(--scene-accent) 14%, transparent)", color: "var(--scene-accent)", border: "1px solid color-mix(in srgb, var(--scene-accent) 32%, transparent)" }
            }
            title={atMax ? "Already level 20" : xpReady ? "Your XP supports a higher level" : "Milestone level up"}
          >
            <ChevronsUp className="h-3.5 w-3.5" /> {atMax ? "Level 20" : "Level Up"}
          </button>
        </div>
      )}

      {levelUpOpen && (
        <LevelUpDialog char={char} hitDie={hitDie} conMod={conMod} spellAbilityMod={spellAbilityMod} edition={edition} onClose={() => setLevelUpOpen(false)} />
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const COINS = ["cp", "sp", "ep", "gp", "pp"] as const
type Coin = (typeof COINS)[number]

// Editable coin purse. Each field is uncontrolled (defaultValue) and commits on
// blur/Enter; the key forces a reset when the server value changes elsewhere
// (e.g. another device). Values clamp to non-negative integers server-side too.
function CurrencyEditor({ char }: { char: CharDoc }) {
  const doSet = useMutation(api.characters.setCurrency)

  const commit = (coin: Coin, raw: string) => {
    const parsed = Math.floor(Number(raw))
    const value = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
    if (value === char.currency[coin]) return
    doSet({ id: char._id, currency: { ...char.currency, [coin]: value } }).catch(() =>
      toast.error("Failed to update currency.")
    )
  }

  return (
    <div
      className="rounded-xl p-4 grid grid-cols-3 sm:grid-cols-5 gap-3 text-center"
      style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
    >
      {COINS.map((coin) => (
        <div key={coin}>
          <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--scene-text-muted)" }}>
            {coin}
          </div>
          <input
            key={`${coin}-${char.currency[coin]}`}
            type="number"
            min={0}
            inputMode="numeric"
            defaultValue={char.currency[coin]}
            onBlur={(e) => commit(coin, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur()
            }}
            className="w-full text-lg font-bold text-center bg-transparent outline-none rounded-md py-1 transition-colors"
            style={{
              fontFamily: "var(--font-cinzel)",
              color: "var(--scene-text-primary)",
              border: "1px solid var(--scene-border)",
            }}
            aria-label={`${coin} currency`}
          />
        </div>
      ))}
    </div>
  )
}

// Feats section — renders the character's feat features (type "feature", source
// "feat") and offers a standalone "Add feat" for feats gained outside level-up
// (level-1 origin feats, variant-human picks). Homebrew feats merge here later.
function FeatsSection({
  char,
  featRows,
  nextOrder,
}: {
  char: CharDoc
  featRows: Doc<"characterProperties">[]
  nextOrder: number
}) {
  const addProperty = useMutation(api.characters.addProperty)
  const removeProperty = useMutation(api.characters.removeProperty)
  const update = useMutation(api.characters.update)
  const [picking, setPicking] = useState(false)

  const knownIds = new Set(
    featRows.map((p) => (p.data as { featId?: string } | undefined)?.featId).filter(Boolean) as string[],
  )

  const handleAdd = async (feat: FeatData, applied: AppliedGrants) => {
    try {
      const patch = applyGrants(char, applied)
      if (Object.keys(patch).length) await update({ id: char._id, ...patch })
      const summary = appliedSummary(applied)
      await addProperty({
        characterId: char._id,
        type: "feature",
        name: applied.text ? `${feat.name} (${applied.text})` : feat.name,
        description: summary ? `${feat.description}\n\n${summary}` : feat.description,
        source: "feat",
        active: true,
        orderIndex: nextOrder,
        data: { featId: feat.id, category: feat.category, applied },
      })
      toast.success(`Gained ${feat.name}.`)
      setPicking(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add feat.")
    }
  }

  // Reverse the feat's baked-in grants (if any) before removing the row.
  const handleRemove = async (row: Doc<"characterProperties">) => {
    try {
      const applied = (row.data as { applied?: AppliedGrants } | undefined)?.applied
      if (applied) {
        const patch = reverseGrants(char, applied)
        if (Object.keys(patch).length) await update({ id: char._id, ...patch })
      }
      await removeProperty({ id: row._id })
      toast.success("Feat removed.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove feat.")
    }
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
          Feats
        </h2>
        <button
          onClick={() => setPicking(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-opacity hover:opacity-80"
          style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
        >
          <Plus className="h-4 w-4" /> Add feat
        </button>
      </div>

      {featRows.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
          No feats yet. Gain one by choosing &ldquo;Feat&rdquo; at an ASI level on level-up, or add one directly.
        </p>
      ) : (
        <div className="space-y-2">
          {featRows.map((p) => (
            <div
              key={p._id}
              className="flex items-start gap-3 rounded-lg px-4 py-3"
              style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
            >
              <Award className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: "var(--scene-accent)" }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: "var(--scene-text-primary)" }}>{p.name}</p>
                {p.description && (
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--scene-text-muted)" }}>{p.description}</p>
                )}
              </div>
              <button
                onClick={() => handleRemove(p)}
                className="p-1.5 rounded transition-opacity hover:opacity-80 flex-shrink-0"
                style={{ color: "var(--scene-text-muted)" }}
                title="Remove feat"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {picking && (
        <FeatPicker feats={FEATS} knownIds={knownIds} char={char} onSelect={handleAdd} onClose={() => setPicking(false)} />
      )}
    </section>
  )
}

function CustomPropertiesSection({ characterId }: { characterId: Id<"characters"> }) {
  const allProps = useQuery(api.characters.listAllProperties)
  const addProperty = useMutation(api.characters.addProperty)
  const updateProperty = useMutation(api.characters.updateProperty)
  const removeProperty = useMutation(api.characters.removeProperty)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [adding, setAdding] = useState(false)

  // Only freeform "custom" rows belong here — structured items (type "item")
  // render in the Inventory section, not as custom properties.
  const props = (allProps ?? [])
    .filter((p) => p.characterId === characterId && p.type === "custom")
    .sort((a, b) => a.orderIndex - b.orderIndex)

  const handleAdd = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error("Give the property a name.")
      return
    }
    setAdding(true)
    try {
      const nextOrder = props.length ? Math.max(...props.map((p) => p.orderIndex)) + 1 : 0
      await addProperty({
        characterId,
        type: "custom",
        name: trimmed,
        description: description.trim() || undefined,
        active: true,
        orderIndex: nextOrder,
        data: {},
      })
      setName("")
      setDescription("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add property.")
    } finally {
      setAdding(false)
    }
  }

  const handleToggle = async (id: Id<"characterProperties">, active: boolean) => {
    try {
      await updateProperty({ id, active: !active })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update property.")
    }
  }

  const handleRemove = async (id: Id<"characterProperties">) => {
    try {
      await removeProperty({ id })
      toast.success("Property removed.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove property.")
    }
  }

  return (
    <section className="mt-6">
      <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>
        Custom Properties
      </h2>

      <div className="space-y-2">
        {allProps === undefined && (
          <div className="h-12 rounded-lg animate-pulse" style={{ background: "var(--scene-surface)" }} />
        )}
        {allProps !== undefined && props.length === 0 && (
          <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
            No custom properties yet. Add freeform stats, traits, or notes below.
          </p>
        )}
        {props.map((p) => (
          <div
            key={p._id}
            className="flex items-start gap-3 rounded-lg px-4 py-3"
            style={{
              background: "var(--scene-surface)",
              border: "1px solid var(--scene-border)",
              opacity: p.active ? 1 : 0.55,
            }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: "var(--scene-text-primary)" }}>{p.name}</p>
              {p.description && (
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--scene-text-muted)" }}>
                  {p.description}
                </p>
              )}
            </div>
            <button
              onClick={() => handleToggle(p._id, p.active)}
              className="text-[10px] px-2 py-1 rounded-md transition-opacity hover:opacity-80 flex-shrink-0"
              style={{
                background: p.active ? "color-mix(in srgb, var(--scene-accent) 16%, transparent)" : "var(--scene-border)",
                color: p.active ? "var(--scene-accent)" : "var(--scene-text-muted)",
              }}
              title={p.active ? "Active — click to disable" : "Inactive — click to enable"}
            >
              {p.active ? "Active" : "Inactive"}
            </button>
            <button
              onClick={() => handleRemove(p._id)}
              className="p-1.5 rounded transition-opacity hover:opacity-80 flex-shrink-0"
              style={{ color: "var(--scene-text-muted)" }}
              title="Remove property"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div
        className="mt-3 rounded-lg p-4 space-y-2"
        style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd() }}
          placeholder="Property name (e.g. Lucky, Darkvision)"
          className="w-full px-3 py-2 rounded-md text-sm bg-transparent outline-none"
          style={{ border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd() }}
          placeholder="Description or value (optional)"
          className="w-full px-3 py-2 rounded-md text-sm bg-transparent outline-none"
          style={{ border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
        />
        <button
          onClick={handleAdd}
          disabled={adding}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
        >
          <Plus className="h-4 w-4" />
          {adding ? "Adding…" : "Add property"}
        </button>
      </div>
    </section>
  )
}

// Shown for a caster whose spellcasting block was never initialized (every
// character built before this feature, plus any class changed TO a caster on the
// edit page). One tap derives + saves the block via the existing update mutation —
// the same block new casters get at creation. Non-casters never see this.
function EnableSpellcastingCard({ char, edition }: { char: CharDoc; edition: Edition }) {
  const doUpdate = useMutation(api.characters.update)
  const [saving, setSaving] = useState(false)

  const handleEnable = async () => {
    const block = initSpellcasting(char.characterClass, char.level, char.baseAbilities, edition, char.racialBonuses)
    if (!block) return
    setSaving(true)
    try {
      await doUpdate({ id: char._id, spellcasting: block })
      toast.success("Spellcasting enabled.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't enable spellcasting.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mt-6">
      <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>
        Spellcasting
      </h2>
      <div
        className="rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3"
        style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
      >
        <p className="text-sm flex-1" style={{ color: "var(--scene-text-muted)" }}>
          {char.characterClass} is a spellcasting class. Enable spell tracking to manage spell slots,
          your spell save DC &amp; attack, and a spellbook.
        </p>
        <button
          onClick={handleEnable}
          disabled={saving}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50 flex-shrink-0"
          style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
        >
          <Sparkles className="h-4 w-4" />
          {saving ? "Enabling…" : "Enable spellcasting"}
        </button>
      </div>
    </section>
  )
}

export default function CharacterSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const char = useQuery(api.characters.get, { id: id as Id<"characters"> })
  // Hooks must run on every render — call before any early return (Rules of Hooks).
  const { roll, rollExpr, mode, setMode, lastRoll, rolling, dismiss } = useSheetRoll()
  const allProps = useQuery(api.characters.listAllProperties)
  // Resolve the character's campaign edition (for edition-aware spell counts).
  // Membership-gated query → null for a non-member, which resolveEdition defaults
  // to 2024; "skip" for a character with no campaign (also defaults to 2024).
  const campaign = useQuery(
    api.campaigns.get,
    char?.campaignId ? { campaignId: char.campaignId } : "skip",
  )

  if (char === undefined) {
    return (
      <AppShell>
        <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-xl h-32" style={{ background: "var(--scene-surface)" }} />
          ))}
        </div>
      </AppShell>
    )
  }

  if (!char) {
    return (
      <AppShell>
        <div className="p-6 max-w-4xl mx-auto text-center">
          <p className="text-sm mb-4" style={{ color: "var(--scene-text-muted)" }}>Character not found.</p>
          <Link href="/characters" className="text-sm hover:opacity-80 transition-opacity" style={{ color: "var(--scene-accent)" }}>
            ← Back to characters
          </Link>
        </div>
      </AppShell>
    )
  }

  const {
    totalAbilities, mods, profBonus, saveMods, skillMods, passivePerception, initiative,
    raceName, classColor, hitDie, darkvision,
    items, spells, grantedSpells, resourceRows, featRows, formRows, companionRows, invocationRows, maneuverRows, subclassId, casterType, edition,
    shortRestResourceKeys, equippedWeapons, fightingStyleId,
    armorClass, armorName, nextOrder,
    grantedFeatures, channelDivinityOptions, grantedProficiencies,
  } = deriveCharacter(char, allProps, campaign)

  // Merge subclass-granted bonus proficiencies into the displayed lists
  // (derive-live; deduped case-insensitively against what the class already has).
  const mergeProf = (base: string[], kind: "armor" | "weapon" | "tool") => {
    const extra = grantedProficiencies.filter((p) => p.kind === kind).map((p) => p.value)
    const seen = new Set(base.map((s) => s.toLowerCase()))
    return [...base, ...extra.filter((e) => !seen.has(e.toLowerCase()))]
  }

  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto pb-12">

        {/* Back + Edit */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/characters"
            className="inline-flex items-center gap-2 text-sm transition-opacity hover:opacity-80"
            style={{ color: "var(--scene-text-muted)" }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to characters
          </Link>
          <Link
            href={`/characters/${char._id}/edit`}
            className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md transition-opacity hover:opacity-80"
            style={{
              background: "var(--scene-surface)",
              color: "var(--scene-text-primary)",
              border: "1px solid var(--scene-border)",
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Link>
        </div>

        {/* Roll mode toggle — applies advantage/disadvantage to every sheet roll */}
        <RollModeBar mode={mode} setMode={setMode} />
        {lastRoll && (
          <SheetRollCard result={lastRoll} rolling={rolling} onDismiss={dismiss} />
        )}

        {/* Header */}
        <div
          className="rounded-xl p-5 mb-6"
          style={{
            background: "color-mix(in srgb, var(--scene-accent) 6%, var(--scene-surface))",
            border: "1px solid color-mix(in srgb, var(--scene-accent) 20%, var(--scene-border))",
          }}
        >
          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: "color-mix(in srgb, var(--scene-accent) 15%, var(--scene-surface))",
                border: "1px solid color-mix(in srgb, var(--scene-accent) 30%, transparent)",
              }}
            >
              <Shield className="h-7 w-7" style={{ color: "var(--scene-accent)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <h1
                className="text-2xl font-bold"
                style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
              >
                {char.name}
              </h1>
              <p className="text-sm mt-0.5" style={{ color: "var(--scene-text-muted)" }}>
                {raceName}{char.background ? ` · ${char.background}` : ""}
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", classColor)}>
                  {char.characterClass}
                </span>
                {char.subclass && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}>
                    {char.subclass}
                  </span>
                )}
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}>
                  Level {char.level}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}>
                  d{hitDie} hit die
                </span>
                {char.alignment && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}>
                    {char.alignment}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Experience + Level Up */}
        <ExperienceCard
          char={char}
          conMod={mods.constitution}
          spellAbilityMod={char.spellcasting ? mods[char.spellcasting.ability as Ability] : 0}
          hitDie={hitDie}
          edition={edition}
        />

        {/* HP + Class Resources (left) · Rest (right). Stacking resources under HP
            balances the column against the taller Rest card and avoids a lonely
            half-width card; ResourcesSection renders nothing for non-resource classes. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 items-start">
          <div className="flex flex-col gap-4">
            <HpEditor char={char} />
            <ResourcesSection
              characterId={char._id}
              classId={char.characterClass}
              level={char.level}
              mods={mods}
              edition={edition}
              subclassId={subclassId}
              resourceRows={resourceRows}
              nextOrder={nextOrder}
              resourceOptions={{ "channel-divinity": channelDivinityOptions }}
            />
          </div>
          <RestPanel char={char} resourceRows={resourceRows} shortRestResourceKeys={shortRestResourceKeys} />
        </div>

        {/* Death saves — auto-surface only while dying (0 HP) */}
        {char.hitPoints.current === 0 && <DyingPanel char={char} />}

        {/* Combat stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatBox label="Armor Class" value={armorClass} sub={armorName ?? "unarmored"} />
          <StatBox label="Initiative" value={formatModifier(initiative)} onClick={() => roll("Initiative", initiative)} />
          <StatBox label="Speed" value={`${char.speed} ft`} />
          <StatBox label="Prof Bonus" value={formatModifier(profBonus)} />
          <StatBox label="Passive Perc" value={passivePerception} />
          <StatBox label="Hit Dice" value={`${char.level}d${hitDie}`} />
          {char.inspiration && <StatBox label="Inspiration" value="✦" />}
        </div>

        {/* Attacks — derived from equipped weapons in the Inventory below */}
        <AttacksSection
          level={char.level}
          weaponProficiencies={char.weaponProficiencies}
          abilities={totalAbilities}
          weapons={equippedWeapons}
          fightingStyleId={fightingStyleId}
          roll={roll}
          rollExpr={rollExpr}
        />

        {/* Ability Scores */}
        <AbilityScoresGrid totalAbilities={totalAbilities} mods={mods} roll={roll} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <SavingThrowsCard
            savingThrowProficiencies={char.savingThrowProficiencies}
            saveMods={saveMods}
            roll={roll}
          />
          <SensesCard
            passivePerception={passivePerception}
            speed={char.speed}
            darkvision={darkvision}
          />
        </div>

        {/* Skills */}
        <SkillsCard
          skillProficiencies={char.skillProficiencies}
          skillExpertise={char.skillExpertise}
          skillMods={skillMods}
          roll={roll}
        />

        {/* Proficiencies & Languages */}
        <section className="mb-6">
          <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>
            Proficiencies & Languages
          </h2>
          <div
            className="rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4"
            style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
          >
            {[
              { label: "Armor", items: mergeProf(char.armorProficiencies, "armor") },
              { label: "Weapons", items: mergeProf(char.weaponProficiencies, "weapon") },
              { label: "Tools", items: mergeProf(char.toolProficiencies, "tool") },
              { label: "Languages", items: char.languages },
            ].filter(({ items }) => items.length > 0).map(({ label, items }) => (
              <div key={label}>
                <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--scene-text-muted)" }}>{label}</div>
                <p className="text-sm" style={{ color: "var(--scene-text-primary)" }}>{items.join(", ")}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Personality */}
        {(char.personalityTraits || char.ideals || char.bonds || char.flaws || char.backstory) && (
          <section className="mb-6">
            <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>
              Personality
            </h2>
            <div className="space-y-3">
              {[
                { label: "Personality Traits", value: char.personalityTraits },
                { label: "Ideals", value: char.ideals },
                { label: "Bonds", value: char.bonds },
                { label: "Flaws", value: char.flaws },
                { label: "Backstory", value: char.backstory },
              ].filter(({ value }) => !!value).map(({ label, value }) => (
                <div key={label} className="rounded-lg px-4 py-3" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
                  <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--scene-text-muted)" }}>{label}</div>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--scene-text-primary)" }}>{value}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Currency */}
        <section>
          <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>
            Currency
          </h2>
          <CurrencyEditor char={char} />
        </section>

        {/* Spellcasting — slots, spell save DC/attack, and the spellbook. Casters
            without a block yet (built before this feature) get a one-tap enable card.
            Gated on the CURRENT class being a caster, so a stale block from a class
            later changed to a non-caster (edit page) never shows a phantom spellbook. */}
        {casterType !== "none" &&
          (char.spellcasting ? (
            <SpellbookSection
              characterId={char._id}
              spellcasting={char.spellcasting}
              classId={char.characterClass}
              level={char.level}
              edition={edition}
              spells={spells}
              grantedSpells={grantedSpells}
              nextOrder={nextOrder}
              roll={roll}
            />
          ) : (
            <EnableSpellcastingCard char={char} edition={edition} />
          ))}

        {/* Eldritch Invocations (warlocks L2+) — chosen from a list, count-gated. */}
        <InvocationsSection
          characterId={char._id}
          classId={char.characterClass}
          level={char.level}
          invocationRows={invocationRows}
          nextOrder={nextOrder}
        />

        {/* Battle Master maneuvers (fighters) */}
        <ManeuversSection
          characterId={char._id}
          classId={char.characterClass}
          subclassId={subclassId}
          level={char.level}
          maneuverRows={maneuverRows}
          nextOrder={nextOrder}
        />

        {/* Wild Shape (druids L2+) + Companions — creature stat blocks attached to
            the character; derived live from alternateForm/companion property rows. */}
        <WildshapeSection
          characterId={char._id}
          classId={char.characterClass}
          level={char.level}
          subclass={char.subclass}
          formRows={formRows}
          mentalAbilities={{
            intelligence: totalAbilities.intelligence,
            wisdom: totalAbilities.wisdom,
            charisma: totalAbilities.charisma,
          }}
          nextOrder={nextOrder}
          roll={roll}
          rollExpr={rollExpr}
        />
        <CompanionsSection
          characterId={char._id}
          companionRows={companionRows}
          nextOrder={nextOrder}
          roll={roll}
          rollExpr={rollExpr}
        />

        {/* Inventory — weapons/armor/gear; equipped weapons feed Attacks, equipped armor sets AC */}
        <InventorySection characterId={char._id} items={items} nextOrder={nextOrder} />

        {/* Class Features — granted by class/subclass (read-only, derived live
            from class-grants; e.g. cleric domain features). */}
        {grantedFeatures.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>
              Class Features
            </h2>
            <div className="space-y-2">
              {grantedFeatures.map((f) => (
                <div key={f.id} className="rounded-lg px-4 py-3" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-semibold" style={{ color: "var(--scene-text-primary)" }}>{f.name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}>Lv {f.level}</span>
                    {f.uses && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "color-mix(in srgb, var(--scene-accent) 12%, transparent)", color: "var(--scene-accent)" }}>{f.uses}</span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--scene-text-muted)" }}>{f.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Feats — ASI-level picks + standalone origin/variant feats */}
        <FeatsSection char={char} featRows={featRows} nextOrder={nextOrder} />

        {/* Custom Properties */}
        <CustomPropertiesSection characterId={char._id} />

      </div>
    </AppShell>
  )
}
