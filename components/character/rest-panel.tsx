"use client"

import { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id, Doc } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import { Heart, Moon, Wind, Skull, Dices, BatteryLow, Minus, Plus } from "lucide-react"
import type { ResourceRow } from "@/lib/character/resources"
import type { Edition } from "@/lib/editions"
import { MAX_EXHAUSTION, exhaustionEffects } from "@/lib/character/exhaustion"

// Shared vitals/recovery cluster — HP editing, short/long rest, and death saves.
// Extracted from app/characters/[id]/page.tsx so both the full standalone sheet
// and the in-session "Sheet" tab (components/session/character-sheet-panel.tsx)
// drive the SAME mutations and reset logic — the numbers can't drift between the
// two surfaces. Pure UI: every component depends only on Convex mutations, props,
// scene CSS tokens, and toast; no derivation or page-local state.

type CharDoc = Doc<"characters">

export function HpEditor({ char }: { char: CharDoc }) {
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

export function RestPanel({
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

// Exhaustion level track (0–6) — persistent state alongside HP, NOT an
// in-combat condition. Shows the edition-correct effects in force at the
// current level (2014: cumulative tiers; 2024: −2/level to d20 Tests, −5 ft/
// level Speed, death at 6). A long rest reduces it by 1 (handled server-side).
export function ExhaustionPanel({ char, edition }: { char: CharDoc; edition: Edition }) {
  const doSet = useMutation(api.characters.setExhaustion)
  const level = char.exhaustion ?? 0
  const effects = exhaustionEffects(level, edition)
  const accent = level === 0 ? "var(--scene-text-muted)" : level >= 4 ? "#ef4444" : "#f59e0b"

  const set = (n: number) =>
    doSet({ id: char._id, level: n }).catch(() => toast.error("Failed to update exhaustion."))

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
    >
      <div className="flex items-center gap-1.5 mb-3">
        <BatteryLow className="h-3.5 w-3.5" style={{ color: accent }} />
        <span className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
          Exhaustion
        </span>
        <span className="ml-auto text-xs" style={{ color: "var(--scene-text-muted)" }}>
          long rest −1
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => set(level - 1)}
          disabled={level <= 0}
          aria-label="Reduce exhaustion"
          className="p-1.5 rounded transition-opacity hover:opacity-80 disabled:opacity-30"
          style={{ color: "var(--scene-text-muted)", border: "1px solid var(--scene-border)" }}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <div className="flex items-center gap-1 flex-1 justify-center" title={`Exhaustion level ${level}`}>
          {Array.from({ length: MAX_EXHAUSTION }, (_, i) => (
            <button
              key={i}
              onClick={() => set(level === i + 1 ? i : i + 1)}
              aria-label={`Set exhaustion to ${i + 1}`}
              className="w-4 h-4 rounded-full transition-transform active:scale-90 hover:opacity-80"
              style={{
                background: i < level ? accent : "transparent",
                border: `1.5px solid ${i < level ? accent : "var(--scene-border)"}`,
              }}
            />
          ))}
        </div>
        <button
          onClick={() => set(level + 1)}
          disabled={level >= MAX_EXHAUSTION}
          aria-label="Increase exhaustion"
          className="p-1.5 rounded transition-opacity hover:opacity-80 disabled:opacity-30"
          style={{ color: "var(--scene-text-muted)", border: "1px solid var(--scene-border)" }}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {effects.length > 0 && (
        <ul className="mt-3 space-y-0.5">
          {effects.map((fx) => (
            <li key={fx} className="text-xs" style={{ color: accent }}>
              {fx}
            </li>
          ))}
        </ul>
      )}
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
export function DyingPanel({ char }: { char: CharDoc }) {
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
