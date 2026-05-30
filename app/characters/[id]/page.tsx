"use client"

import { use, useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id, Doc } from "@/convex/_generated/dataModel"
import { AppShell } from "@/components/app-shell"
import Link from "next/link"
import { ArrowLeft, Heart, Pencil, Shield, Zap, Wind, Plus, Trash2, Moon, Eye, ChevronsUp, X } from "lucide-react"
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
import { getDarkvisionRange } from "@/lib/character/character-data"
import { getXPProgress, getXPForLevel, getLevelFromXP, getXPToNextLevel } from "@/lib/character/experience"
import { getCasterType, hpGainForLevel, avgHitDieRoll, recomputeSpellcasting } from "@/lib/character/leveling"
import { useDiceStore, rollExpression } from "@/lib/dice-store"

// ── Stat computation ──────────────────────────────────────────────────────────

type CharDoc = Doc<"characters">

function computeStats(char: CharDoc) {
  const racialBonuses = char.racialBonuses ?? {}
  const totalAbilities = Object.fromEntries(
    ABILITIES.map((a) => [a, char.baseAbilities[a] + (racialBonuses[a] ?? 0)])
  ) as Record<Ability, number>

  const mods = Object.fromEntries(
    ABILITIES.map((a) => [a, getAbilityModifier(totalAbilities[a])])
  ) as Record<Ability, number>

  const profBonus = getProficiencyBonus(char.level)

  const saveMods = Object.fromEntries(
    ABILITIES.map((a) => {
      const isProficient = char.savingThrowProficiencies.includes(a)
      return [a, mods[a] + (isProficient ? profBonus : 0)]
    })
  ) as Record<Ability, number>

  const skillMods = Object.fromEntries(
    (Object.keys(SKILLS) as Skill[]).map((skill) => {
      const ability = SKILLS[skill] as Ability
      const isExpert = char.skillExpertise.includes(skill)
      const isProficient = char.skillProficiencies.includes(skill)
      const bonus = isExpert ? profBonus * 2 : isProficient ? profBonus : 0
      return [skill, mods[ability] + bonus]
    })
  ) as Record<Skill, number>

  const passivePerception = 10 + skillMods.perception
  const initiative = mods.dexterity
  const unarmoredAC = 10 + mods.dexterity

  return { totalAbilities, mods, profBonus, saveMods, skillMods, passivePerception, initiative, unarmoredAC }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatBox({ label, value, sub, onClick }: { label: string; value: string | number; sub?: string; onClick?: () => void }) {
  const inner = (
    <>
      <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--scene-text-muted)" }}>
        {label}
      </div>
      <div className="text-xl font-bold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
        {value}
      </div>
      {sub && <div className="text-xs mt-0.5" style={{ color: "var(--scene-text-muted)" }}>{sub}</div>}
    </>
  )
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="flex flex-col items-center justify-center rounded-lg p-3 text-center w-full transition-transform active:scale-95 hover:opacity-90"
        style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
        title={`Roll ${label}`}
      >
        {inner}
      </button>
    )
  }
  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg p-3 text-center"
      style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
    >
      {inner}
    </div>
  )
}

function AbilityBlock({ ability, total, mod, onRoll }: { ability: Ability; total: number; mod: number; onRoll: () => void }) {
  return (
    <button
      onClick={onRoll}
      className="flex flex-col items-center rounded-lg py-3 px-2 w-full transition-transform active:scale-95 hover:opacity-90"
      style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
      title={`Roll ${ABILITY_ABBREVIATIONS[ability]} check`}
    >
      <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--scene-text-muted)" }}>
        {ABILITY_ABBREVIATIONS[ability]}
      </div>
      <div
        className="w-10 h-10 rounded-md flex items-center justify-center text-lg font-bold mb-1"
        style={{
          background: "color-mix(in srgb, var(--scene-accent) 12%, var(--scene-surface))",
          border: "1px solid color-mix(in srgb, var(--scene-accent) 25%, transparent)",
          color: "var(--scene-text-primary)",
          fontFamily: "var(--font-cinzel)",
        }}
      >
        {total}
      </div>
      <div className="text-sm font-semibold" style={{ color: "var(--scene-accent)" }}>
        {formatModifier(mod)}
      </div>
    </button>
  )
}

// Shared roll-from-sheet hook: rolls 1d20 + the given modifier through the dice
// engine, drops it into the shared history, and toasts the result. Rolls
// normally (no adv/dis) — the dice page is where advantage is chosen.
function useSheetRoll() {
  const addRoll = useDiceStore((s) => s.addRoll)
  return (label: string, mod: number) => {
    const sign = mod >= 0 ? "+" : "-"
    const result = rollExpression(`1d20${sign}${Math.abs(mod)}`, { label })
    if (!result) return
    addRoll(result)
    const face = result.terms[0]?.rolls[0]
    const flair = face === 20 ? " — nat 20!" : face === 1 ? " — nat 1" : ""
    toast.success(`${label}: ${result.total}${flair}`)
  }
}

function ProfDot({ level }: { level: "none" | "proficient" | "expert" }) {
  return (
    <span
      className="w-3 h-3 rounded-full flex-shrink-0 inline-block"
      style={{
        background: level === "none" ? "transparent" : "var(--scene-accent)",
        border: level === "none"
          ? "1.5px solid var(--scene-border)"
          : level === "expert"
          ? "2px solid var(--scene-highlight)"
          : "none",
      }}
    />
  )
}

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

function RestPanel({ char }: { char: CharDoc }) {
  const doSpendHitDie = useMutation(api.characters.spendHitDie)
  const doLongRest = useMutation(api.characters.longRest)
  const [resting, setResting] = useState(false)

  const totalRemaining = char.hitDice.reduce((sum, d) => sum + (d.total - d.used), 0)
  const atFullHp = char.hitPoints.current >= char.hitPoints.max

  const handleSpend = async (diceSize: number) => {
    try {
      const res = await doSpendHitDie({ id: char._id, diceSize })
      const modStr = res.conMod >= 0 ? `+${res.conMod}` : `${res.conMod}`
      toast.success(`d${res.diceSize}: rolled ${res.roll} ${modStr} CON → +${res.healed} HP`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't spend hit die.")
    }
  }

  const handleLongRest = async () => {
    if (!confirm("Take a long rest? Restores HP, spell slots, and ~half your hit dice.")) return
    setResting(true)
    try {
      await doLongRest({ id: char._id })
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

// Death-saves cell for the combat strip — editable success/failure pips.
function DeathSavesBox({ char }: { char: CharDoc }) {
  const doSet = useMutation(api.characters.setDeathSaves)
  const set = (successes: number, failures: number) => {
    doSet({ id: char._id, successes, failures }).catch(() => toast.error("Failed to update death saves."))
  }
  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg p-3 text-center"
      style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
    >
      <div className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--scene-text-muted)" }}>
        Death Saves
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold w-3" style={{ color: "#22c55e" }}>✓</span>
          <DeathSavePips
            count={char.deathSaves.successes}
            color="#22c55e"
            label="Success"
            onSet={(n) => set(n, char.deathSaves.failures)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold w-3" style={{ color: "#ef4444" }}>✗</span>
          <DeathSavePips
            count={char.deathSaves.failures}
            color="#ef4444"
            label="Failure"
            onSet={(n) => set(char.deathSaves.successes, n)}
          />
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

// Level-up modal. Bumps level, gains HP (average or rolled), adds a hit die,
// rescales caster slots + DC/attack (see lib/character/leveling.ts). New class
// features are a guided manual step (add via Custom Properties below).
function LevelUpDialog({
  char,
  hitDie,
  conMod,
  spellAbilityMod,
  onClose,
}: {
  char: CharDoc
  hitDie: number
  conMod: number
  spellAbilityMod: number
  onClose: () => void
}) {
  const doUpdate = useMutation(api.characters.update)
  const [hpMode, setHpMode] = useState<"average" | "roll">("average")
  const [rolled, setRolled] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const newLevel = Math.min(20, char.level + 1)
  const classId = char.characterClass.toLowerCase()
  const casterType = getCasterType(classId)

  const rollHp = () => {
    setRolled(Math.floor(Math.random() * hitDie) + 1)
    setHpMode("roll")
  }
  const hpRoll = hpMode === "roll" ? rolled ?? avgHitDieRoll(hitDie) : undefined
  const hpGain = hpGainForLevel(hitDie, conMod, hpRoll)

  const oldProf = getProficiencyBonus(char.level)
  const newProf = getProficiencyBonus(newLevel)
  const profChanged = newProf !== oldProf

  const handleConfirm = async () => {
    setSaving(true)
    try {
      const newHitPoints = {
        ...char.hitPoints,
        max: char.hitPoints.max + hpGain,
        current: char.hitPoints.current + hpGain,
      }
      const spellcasting = char.spellcasting
        ? recomputeSpellcasting(char.spellcasting, classId, newLevel, spellAbilityMod)
        : undefined
      await doUpdate({
        id: char._id,
        level: newLevel,
        experiencePoints: Math.max(char.experiencePoints, getXPForLevel(newLevel)),
        hitPoints: newHitPoints,
        hitDice: incrementHitDice(char.hitDice, hitDie),
        ...(spellcasting ? { spellcasting } : {}),
      })
      toast.success(`Leveled up to ${newLevel}! +${hpGain} HP.`)
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
          {casterType === "pact" && (
            <li style={{ color: "var(--scene-text-muted)" }}>• Warlock Pact Magic — adjust slots manually (DC/attack {profChanged ? "rescaled" : "unchanged"})</li>
          )}
        </ul>

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
            onClick={handleConfirm}
            disabled={saving}
            className="flex-1 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
          >
            {saving ? "Leveling…" : `Level up to ${newLevel}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// Experience bar + Add XP + Level Up entry point.
function ExperienceCard({ char, conMod, spellAbilityMod, hitDie }: { char: CharDoc; conMod: number; spellAbilityMod: number; hitDie: number }) {
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
        <LevelUpDialog char={char} hitDie={hitDie} conMod={conMod} spellAbilityMod={spellAbilityMod} onClose={() => setLevelUpOpen(false)} />
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

function CustomPropertiesSection({ characterId }: { characterId: Id<"characters"> }) {
  const allProps = useQuery(api.characters.listAllProperties)
  const addProperty = useMutation(api.characters.addProperty)
  const updateProperty = useMutation(api.characters.updateProperty)
  const removeProperty = useMutation(api.characters.removeProperty)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [adding, setAdding] = useState(false)

  const props = (allProps ?? [])
    .filter((p) => p.characterId === characterId)
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

export default function CharacterSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const char = useQuery(api.characters.get, { id: id as Id<"characters"> })
  // Hooks must run on every render — call before any early return (Rules of Hooks).
  const roll = useSheetRoll()

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

  const { totalAbilities, mods, profBonus, saveMods, skillMods, passivePerception, initiative, unarmoredAC } = computeStats(char)
  const raceName = char.subrace ? `${char.subrace} ${char.race}` : char.race
  const classColor = CLASS_COLORS[char.characterClass.toLowerCase()] ?? "bg-gray-600 text-white"
  const hitDie = char.hitDice[0]?.diceSize ?? 8
  const darkvision = getDarkvisionRange(char.race, char.subrace)

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
        />

        {/* HP + Rest */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <HpEditor char={char} />
          <RestPanel char={char} />
        </div>

        {/* Combat stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatBox label="Armor Class" value={unarmoredAC} sub="unarmored" />
          <StatBox label="Initiative" value={formatModifier(initiative)} onClick={() => roll("Initiative", initiative)} />
          <StatBox label="Speed" value={`${char.speed} ft`} />
          <StatBox label="Prof Bonus" value={formatModifier(profBonus)} />
          <StatBox label="Passive Perc" value={passivePerception} />
          <StatBox label="Hit Dice" value={`${char.level}d${hitDie}`} />
          <DeathSavesBox char={char} />
          {char.inspiration && <StatBox label="Inspiration" value="✦" />}
        </div>

        {/* Ability Scores */}
        <section className="mb-6">
          <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>
            Ability Scores
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {ABILITIES.map((ability) => (
              <AbilityBlock
                key={ability}
                ability={ability}
                total={totalAbilities[ability]}
                mod={mods[ability]}
                onRoll={() => roll(`${ABILITY_ABBREVIATIONS[ability]} check`, mods[ability])}
              />
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Saving Throws */}
          <section>
            <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>
              Saving Throws
            </h2>
            <div className="rounded-xl overflow-hidden" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
              {ABILITIES.map((ability, i) => {
                const isProficient = char.savingThrowProficiencies.includes(ability)
                return (
                  <button
                    key={ability}
                    onClick={() => roll(`${ABILITY_ABBREVIATIONS[ability]} save`, saveMods[ability])}
                    className="flex items-center gap-3 px-4 py-2.5 w-full text-left transition-opacity hover:opacity-80"
                    style={{ borderBottom: i < ABILITIES.length - 1 ? "1px solid var(--scene-border)" : "none" }}
                    title={`Roll ${ABILITY_ABBREVIATIONS[ability]} save`}
                  >
                    <ProfDot level={isProficient ? "proficient" : "none"} />
                    <span className="text-sm flex-1" style={{ color: "var(--scene-text-primary)" }}>
                      {ABILITY_ABBREVIATIONS[ability]}
                    </span>
                    <span
                      className="text-sm font-semibold tabular-nums"
                      style={{ color: isProficient ? "var(--scene-accent)" : "var(--scene-text-muted)" }}
                    >
                      {formatModifier(saveMods[ability])}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Senses + Spellcasting */}
          <section>
            <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>
              Senses
            </h2>
            <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5" style={{ color: "var(--scene-text-muted)" }} />
                  <span className="text-sm" style={{ color: "var(--scene-text-primary)" }}>Passive Perception</span>
                </div>
                <span className="text-sm font-semibold" style={{ color: "var(--scene-text-primary)" }}>{passivePerception}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wind className="h-3.5 w-3.5" style={{ color: "var(--scene-text-muted)" }} />
                  <span className="text-sm" style={{ color: "var(--scene-text-primary)" }}>Speed</span>
                </div>
                <span className="text-sm font-semibold" style={{ color: "var(--scene-text-primary)" }}>{char.speed} ft</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="h-3.5 w-3.5" style={{ color: "var(--scene-text-muted)" }} />
                  <span className="text-sm" style={{ color: "var(--scene-text-primary)" }}>Darkvision</span>
                </div>
                <span className="text-sm font-semibold" style={{ color: "var(--scene-text-primary)" }}>
                  {darkvision > 0 ? `${darkvision} ft` : "—"}
                </span>
              </div>
            </div>

            {char.spellcasting && (
              <>
                <h2 className="text-xs uppercase tracking-widest mt-4 mb-3" style={{ color: "var(--scene-text-muted)" }}>
                  Spellcasting
                </h2>
                <div className="rounded-xl p-4 space-y-2" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "var(--scene-text-muted)" }}>Ability</span>
                    <span className="font-medium capitalize" style={{ color: "var(--scene-text-primary)" }}>{char.spellcasting.ability}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "var(--scene-text-muted)" }}>Save DC</span>
                    <span className="font-medium" style={{ color: "var(--scene-text-primary)" }}>{char.spellcasting.spellSaveDC}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "var(--scene-text-muted)" }}>Attack Bonus</span>
                    <span className="font-medium" style={{ color: "var(--scene-text-primary)" }}>{formatModifier(char.spellcasting.spellAttackBonus)}</span>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>

        {/* Skills */}
        <section className="mb-6">
          <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>
            Skills
          </h2>
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
            <div className="grid grid-cols-1 sm:grid-cols-2">
              {(Object.keys(SKILLS) as Skill[]).map((skill, i, arr) => {
                const ability = SKILLS[skill] as Ability
                const isExpert = char.skillExpertise.includes(skill)
                const isProficient = char.skillProficiencies.includes(skill)
                const level: "none" | "proficient" | "expert" = isExpert ? "expert" : isProficient ? "proficient" : "none"
                const half = Math.ceil(arr.length / 2)
                const isRightCol = i >= half
                const isLastInLeftCol = i === half - 1
                const isLastInRightCol = i === arr.length - 1
                return (
                  <button
                    key={skill}
                    onClick={() => roll(SKILL_DISPLAY_NAMES[skill], skillMods[skill])}
                    className="flex items-center gap-3 px-4 py-2 w-full text-left transition-opacity hover:opacity-80"
                    style={{
                      borderBottom: (!isRightCol && !isLastInLeftCol) || (isRightCol && !isLastInRightCol)
                        ? "1px solid var(--scene-border)"
                        : "none",
                      borderRight: !isRightCol ? "1px solid var(--scene-border)" : "none",
                    }}
                    title={`Roll ${SKILL_DISPLAY_NAMES[skill]}`}
                  >
                    <ProfDot level={level} />
                    <span className="text-sm flex-1" style={{ color: "var(--scene-text-primary)" }}>
                      {SKILL_DISPLAY_NAMES[skill]}
                    </span>
                    <span className="text-xs mr-2" style={{ color: "var(--scene-text-muted)" }}>
                      {ABILITY_ABBREVIATIONS[ability]}
                    </span>
                    <span
                      className="text-sm font-semibold tabular-nums w-8 text-right"
                      style={{ color: level !== "none" ? "var(--scene-accent)" : "var(--scene-text-muted)" }}
                    >
                      {formatModifier(skillMods[skill])}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </section>

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
              { label: "Armor", items: char.armorProficiencies },
              { label: "Weapons", items: char.weaponProficiencies },
              { label: "Tools", items: char.toolProficiencies },
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

        {/* Custom Properties */}
        <CustomPropertiesSection characterId={char._id} />

      </div>
    </AppShell>
  )
}
