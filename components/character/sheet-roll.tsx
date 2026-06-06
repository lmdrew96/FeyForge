"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { X } from "lucide-react"
import { toast } from "sonner"
import {
  useDiceStore,
  rollExpression,
  type RollMode,
  type DiceRollResult,
} from "@/lib/dice-store"
import { DiceScene, type SceneDie } from "@/components/dice/die-3d-scene"

// Roll-from-sheet primitives, shared by the standalone character sheet
// (app/characters/[id]) and the in-session sheet (the live-session "Sheet" tab)
// so a roll behaves identically wherever a character is being played.

const SHEET_ROLL_MODES: RollMode[] = ["normal", "advantage", "disadvantage"]
const SHEET_MODE_LABEL: Record<RollMode, string> = {
  normal: "Normal",
  advantage: "Advantage",
  disadvantage: "Disadvantage",
}

// d20 check/save/attack roll — applies the advantage/disadvantage toggle. Returns
// the roll result (or null on failure) so callers like attacks can read the
// natural d20 (e.g. to detect a crit at the character's crit range).
export type SheetRollFn = (label: string, mod: number) => DiceRollResult | null
// Arbitrary expression (e.g. weapon damage "1d8+3"), optionally a crit.
export type SheetRollExprFn = (
  label: string,
  expression: string,
  opts?: { crit?: boolean },
) => void

export interface SheetRoll {
  roll: SheetRollFn
  rollExpr: SheetRollExprFn
  mode: RollMode
  setMode: (m: RollMode) => void
  lastRoll: DiceRollResult | null
  rolling: boolean
  dismiss: () => void
}

// Shared roll-from-sheet hook: rolls 1d20 + the given modifier through the dice
// engine, honoring the sheet's advantage/disadvantage toggle. Drops the result
// into the shared history, toasts it, and surfaces it for the on-sheet dice card.
export function useSheetRoll(): SheetRoll {
  const addRoll = useDiceStore((s) => s.addRoll)
  const [mode, setMode] = useState<RollMode>("normal")
  const [lastRoll, setLastRoll] = useState<DiceRollResult | null>(null)
  const [rolling, setRolling] = useState(false)
  const rollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (rollTimer.current) clearTimeout(rollTimer.current)
    },
    [],
  )

  // Shared tail for every sheet roll: record it, surface the dice card, toast,
  // and (unless reduced-motion) run the brief tumble. Nat-20/nat-1 flair only
  // applies to d20 rolls, so damage rolls (a damage die first) never mis-flair.
  const surface = (result: DiceRollResult) => {
    addRoll(result)
    setLastRoll(result)
    const isD20 = result.terms[0]?.sides === 20
    const face = result.terms[0]?.rolls[0]
    const flair =
      isD20 && face === 20 ? " — nat 20!" : isD20 && face === 1 ? " — nat 1" : ""
    toast.success(`${result.label ?? "Roll"}: ${result.total}${flair}`)

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReduced) {
      setRolling(false)
      return
    }
    setRolling(true)
    if (rollTimer.current) clearTimeout(rollTimer.current)
    rollTimer.current = setTimeout(() => setRolling(false), 500)
  }

  // d20 check/save/attack roll — applies the advantage/disadvantage toggle.
  const roll: SheetRollFn = (label, mod) => {
    const sign = mod >= 0 ? "+" : "-"
    const result = rollExpression(`1d20${sign}${Math.abs(mod)}`, { label, mode })
    if (!result) return null
    surface(result)
    return result
  }

  // Arbitrary expression (e.g. weapon damage "1d8+3"). Damage isn't adv/dis, so
  // this never passes mode; crit doubles the dice (the engine handles it).
  const rollExpr: SheetRollExprFn = (label, expression, opts) => {
    const result = rollExpression(expression, { label, crit: opts?.crit })
    if (!result) {
      toast.error(`Couldn't roll "${expression}".`)
      return
    }
    surface(result)
  }

  return {
    roll,
    rollExpr,
    mode,
    setMode,
    lastRoll,
    rolling,
    dismiss: () => setLastRoll(null),
  }
}

// Sticky advantage/disadvantage selector for every roll made from the sheet.
// Mirrors the dice page's three-way mode so the mental model carries over.
export function RollModeBar({
  mode,
  setMode,
}: {
  mode: RollMode
  setMode: (m: RollMode) => void
}) {
  return (
    <div
      className="sticky top-12 md:top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2.5 mb-5"
      style={{
        background: "color-mix(in srgb, var(--scene-bg) 88%, transparent)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        borderBottom: "1px solid var(--scene-border)",
      }}
    >
      <div className="flex items-center gap-2 max-w-4xl mx-auto">
        <span
          className="text-xs uppercase tracking-widest hidden sm:inline"
          style={{ color: "var(--scene-text-muted)" }}
        >
          Roll mode
        </span>
        <div className="flex gap-1.5 flex-1 sm:flex-none">
          {SHEET_ROLL_MODES.map((m) => {
            const active = mode === m
            const accent =
              m === "disadvantage" ? "#ef4444" : "var(--scene-accent)"
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                style={{
                  background: active ? accent : "var(--scene-surface)",
                  color: active ? "var(--scene-bg)" : "var(--scene-text-muted)",
                  border: "1px solid var(--scene-border)",
                }}
              >
                {SHEET_MODE_LABEL[m]}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Floating, dismissable card showing the most recent sheet roll as real dice —
// always visible regardless of scroll position, so a skill rolled at the bottom
// of the sheet still shows its dice. Sits above the mobile bottom nav.
export function SheetRollCard({
  result,
  rolling,
  onDismiss,
}: {
  result: DiceRollResult
  rolling: boolean
  onDismiss: () => void
}) {
  const dice: SceneDie[] = useMemo(
    () =>
      result.terms.flatMap((term) => [
        ...term.rolls.map((r) => ({ sides: term.sides, value: r, dropped: false })),
        ...term.dropped.map((r) => ({ sides: term.sides, value: r, dropped: true })),
      ]),
    [result],
  )

  const face = result.terms[0]?.rolls[0]
  const isNat20 = result.terms[0]?.sides === 20 && face === 20
  const isNat1 = result.terms[0]?.sides === 20 && face === 1
  const totalColor = isNat20
    ? "var(--scene-accent)"
    : isNat1
      ? "#ef4444"
      : "var(--scene-text-primary)"

  return (
    <div
      className="fixed z-40 left-3 right-3 md:left-auto md:right-6 md:w-72 bottom-[calc(3.5rem_+_0.75rem_+_env(safe-area-inset-bottom))] md:bottom-6 rounded-xl p-4 shadow-xl"
      style={{
        background: "var(--scene-surface)",
        border: `1px solid ${
          isNat20
            ? "var(--scene-accent)"
            : isNat1
              ? "#ef4444"
              : "var(--scene-border)"
        }`,
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className="text-xs uppercase tracking-widest flex-1 truncate"
          style={{ color: "var(--scene-text-muted)" }}
        >
          {result.label ?? result.expression}
        </span>
        {result.isAdvantage && (
          <span
            className="text-xs font-semibold"
            style={{ color: "var(--scene-accent)" }}
          >
            ADV
          </span>
        )}
        {result.isDisadvantage && (
          <span className="text-xs font-semibold" style={{ color: "#ef4444" }}>
            DIS
          </span>
        )}
        <button
          onClick={onDismiss}
          aria-label="Dismiss roll"
          className="p-0.5 rounded transition-opacity hover:opacity-80"
          style={{ color: "var(--scene-text-muted)" }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div
        className="font-bold leading-none text-center"
        style={{
          fontFamily: "var(--font-cinzel)",
          fontSize: "2.75rem",
          color: totalColor,
          visibility: rolling ? "hidden" : "visible",
        }}
      >
        {result.total}
      </div>
      {isNat20 && (
        <div
          className="text-center text-xs font-semibold"
          style={{ color: "var(--scene-accent)" }}
        >
          Natural 20!
        </div>
      )}
      {isNat1 && (
        <div
          className="text-center text-xs font-semibold"
          style={{ color: "#ef4444" }}
        >
          Natural 1…
        </div>
      )}

      <DiceScene
        dice={dice}
        rolling={rolling}
        showNumbers={dice.length > 1 || result.modifier !== 0}
      />
    </div>
  )
}
