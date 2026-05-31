"use client"

import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { toast } from "sonner"
import { Dices, Plus, Trash2, X, History } from "lucide-react"
import {
  useDiceStore,
  rollExpression,
  rollDie,
  parseDiceExpression,
  type RollMode,
  type DiceRollResult,
} from "@/lib/dice-store"
import { Die } from "@/components/dice/die"
import { DiceScene } from "@/components/dice/die-3d-scene"

const QUICK_DICE = [4, 6, 8, 10, 12, 20, 100]

const MODE_LABEL: Record<RollMode, string> = {
  normal: "Normal",
  advantage: "Advantage",
  disadvantage: "Disadvantage",
}

// A nat 20 / nat 1 on a single kept d20 is worth celebrating / mourning.
function critFlag(result: DiceRollResult): "nat20" | "nat1" | null {
  if (result.terms.length !== 1) return null
  const term = result.terms[0]
  if (term.sides !== 20 || term.rolls.length !== 1) return null
  if (term.rolls[0] === 20) return "nat20"
  if (term.rolls[0] === 1) return "nat1"
  return null
}

export default function DicePage() {
  const {
    rollHistory,
    addRoll,
    clearHistory,
    savedRolls,
    addSavedRoll,
    removeSavedRoll,
    currentResult,
    setCurrentResult,
    rollMode,
    setRollMode,
    crit,
    setCrit,
    isRolling,
    setIsRolling,
  } = useDiceStore()

  const [expression, setExpression] = useState("")
  const [saveName, setSaveName] = useState("")
  const [showSaveForm, setShowSaveForm] = useState(false)

  // Tumble timer — dice animate for ~500ms, then settle to their faces and the
  // total reveals. Cleared on re-roll and unmount so a fast clicker never leaves
  // a stuck animation.
  const rollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (rollTimer.current) clearTimeout(rollTimer.current)
    },
    [],
  )

  const isExpressionValid =
    expression.trim() === "" || parseDiceExpression(expression) !== null

  const doRoll = (result: DiceRollResult | null, source: string) => {
    if (!result) {
      toast.error(`Couldn't parse "${source}" — try something like 1d20+5 or 2d6`)
      return
    }
    addRoll(result) // also sets currentResult
    // Honor reduced-motion: skip the tumble entirely so dice + total appear at
    // their final values immediately. isRolling drives JS-side hiding, so the
    // CSS media query alone can't cover this — we have to branch here too.
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReduced) {
      setIsRolling(false)
      return
    }
    setIsRolling(true)
    if (rollTimer.current) clearTimeout(rollTimer.current)
    rollTimer.current = setTimeout(() => setIsRolling(false), 500)
  }

  // Re-displaying a past roll from history should never tumble.
  const showFromHistory = (roll: DiceRollResult) => {
    if (rollTimer.current) clearTimeout(rollTimer.current)
    setIsRolling(false)
    setCurrentResult(roll)
  }

  const handleRollExpression = () => {
    const expr = expression.trim()
    if (!expr) return
    doRoll(rollExpression(expr, { mode: rollMode, crit }), expr)
  }

  const handleQuickDie = (sides: number) => {
    // Quick dice ignore the typed expression; advantage only matters for d20.
    doRoll(
      rollDie(sides, {
        mode: sides === 20 ? rollMode : "normal",
        crit,
      }),
      `d${sides}`,
    )
  }

  const handleSavedRoll = (expr: string, label: string) => {
    doRoll(rollExpression(expr, { mode: rollMode, crit, label }), expr)
  }

  const handleSaveCurrent = () => {
    const expr = expression.trim()
    const name = saveName.trim()
    if (!expr || !name) {
      toast.error("Give the roll a name and an expression first")
      return
    }
    if (!parseDiceExpression(expr)) {
      toast.error("That expression isn't valid")
      return
    }
    addSavedRoll({ id: crypto.randomUUID(), name, expression: expr })
    setSaveName("")
    setShowSaveForm(false)
    toast.success(`Saved "${name}"`)
  }

  const flag = currentResult ? critFlag(currentResult) : null

  // Flatten every die (kept + dropped) for shape rendering + the perf gate.
  // Memoized on the result id so the array reference stays stable across unrelated
  // re-renders (typing, toggles) — otherwise the 3D scene would rebuild every key.
  const diceList = useMemo(
    () =>
      currentResult
        ? currentResult.terms.flatMap((term) => [
            ...term.rolls.map((r) => ({
              sides: term.sides,
              value: r,
              dropped: false,
            })),
            ...term.dropped.map((r) => ({
              sides: term.sides,
              value: r,
              dropped: true,
            })),
          ])
        : [],
    [currentResult],
  )
  // Render individual dice shapes only for a sane count; big handfuls (e.g. 8d6,
  // up to MAX_DICE=100) fall back to the compact number list to avoid jank.
  const showShapes = diceList.length > 0 && diceList.length <= 12

  return (
    <AppShell>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Dices size={28} style={{ color: "var(--scene-accent)" }} />
          <h1
            className="text-2xl font-bold"
            style={{
              fontFamily: "var(--font-cinzel)",
              color: "var(--scene-text-primary)",
            }}
          >
            Dice Roller
          </h1>
        </div>

        {/* ── Result display ──────────────────────────────────────────── */}
        <div
          className="rounded-xl p-8 mb-6 text-center transition-colors"
          style={{
            background: "var(--scene-surface)",
            border: `1px solid ${
              flag === "nat20"
                ? "var(--scene-accent)"
                : flag === "nat1"
                  ? "#ef4444"
                  : "var(--scene-border)"
            }`,
          }}
        >
          {currentResult ? (
            <div>
              <div
                className="text-xs uppercase tracking-widest mb-2 flex items-center justify-center gap-2 flex-wrap"
                style={{ color: "var(--scene-text-muted)" }}
              >
                <span>{currentResult.label ?? currentResult.expression}</span>
                {currentResult.isAdvantage && (
                  <span style={{ color: "var(--scene-accent)" }}>• ADV</span>
                )}
                {currentResult.isDisadvantage && (
                  <span style={{ color: "#ef4444" }}>• DIS</span>
                )}
                {currentResult.isCrit && (
                  <span style={{ color: "var(--scene-accent)" }}>• CRIT</span>
                )}
              </div>

              <div
                key={currentResult.id}
                className={`font-bold leading-none mb-3${isRolling ? "" : " dice-total-in"}`}
                style={{
                  fontFamily: "var(--font-cinzel)",
                  fontSize: "4rem",
                  visibility: isRolling ? "hidden" : "visible",
                  color:
                    flag === "nat20"
                      ? "var(--scene-accent)"
                      : flag === "nat1"
                        ? "#ef4444"
                        : "var(--scene-text-primary)",
                }}
              >
                {currentResult.total}
              </div>

              {flag === "nat20" && (
                <div
                  className="text-sm font-semibold mb-2"
                  style={{ color: "var(--scene-accent)" }}
                >
                  Natural 20!
                </div>
              )}
              {flag === "nat1" && (
                <div
                  className="text-sm font-semibold mb-2"
                  style={{ color: "#ef4444" }}
                >
                  Natural 1…
                </div>
              )}

              {/* Per-die breakdown — rendered as shapes for small rolls, or a
                  compact number list for big handfuls (8d6 etc.). */}
              {showShapes ? (
                <div>
                  <DiceScene dice={diceList} rolling={isRolling} />
                  {currentResult.modifier !== 0 && (
                    <div
                      className="text-2xl font-bold mt-1"
                      style={{
                        fontFamily: "var(--font-cinzel)",
                        color: "var(--scene-text-muted)",
                      }}
                    >
                      {currentResult.modifier > 0 ? "+" : "−"}
                      {Math.abs(currentResult.modifier)}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="flex items-center justify-center gap-2 flex-wrap text-sm font-mono"
                  style={{ color: "var(--scene-text-muted)" }}
                >
                  {currentResult.terms.map((term, ti) => (
                    <span key={ti} className="flex items-center gap-1">
                      {ti > 0 && <span>+</span>}
                      <span>
                        {term.rolls.map((r, ri) => (
                          <Fragment key={ri}>
                            {ri > 0 && ", "}
                            <span
                              style={{
                                color:
                                  term.sides === 20 && r === 20
                                    ? "var(--scene-accent)"
                                    : term.sides === 20 && r === 1
                                      ? "#ef4444"
                                      : "var(--scene-text-primary)",
                              }}
                            >
                              {r}
                            </span>
                          </Fragment>
                        ))}
                      </span>
                      <span style={{ opacity: 0.6 }}>(d{term.sides})</span>
                      {term.dropped.length > 0 && (
                        <span style={{ opacity: 0.4 }}>
                          [dropped {term.dropped.join(", ")}]
                        </span>
                      )}
                    </span>
                  ))}
                  {currentResult.modifier !== 0 && (
                    <span style={{ color: "var(--scene-text-primary)" }}>
                      {currentResult.modifier > 0 ? "+" : "−"}
                      {Math.abs(currentResult.modifier)}
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p style={{ color: "var(--scene-text-muted)" }}>
              Roll a die or type an expression to begin.
            </p>
          )}
        </div>

        {/* ── Mode + crit toggles ─────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {(["normal", "advantage", "disadvantage"] as RollMode[]).map((mode) => {
            const active = rollMode === mode
            return (
              <button
                key={mode}
                onClick={() => setRollMode(mode)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: active
                    ? "var(--scene-accent)"
                    : "var(--scene-surface)",
                  color: active
                    ? "var(--scene-bg)"
                    : "var(--scene-text-muted)",
                  border: "1px solid var(--scene-border)",
                }}
              >
                {MODE_LABEL[mode]}
              </button>
            )
          })}
          <button
            onClick={() => setCrit(!crit)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors ml-auto"
            style={{
              background: crit ? "var(--scene-accent)" : "var(--scene-surface)",
              color: crit ? "var(--scene-bg)" : "var(--scene-text-muted)",
              border: "1px solid var(--scene-border)",
            }}
            title="Double all damage dice (not modifiers)"
          >
            Crit ×2 dice
          </button>
        </div>

        {/* ── Quick dice ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {QUICK_DICE.map((sides) => (
            <button
              key={sides}
              onClick={() => handleQuickDie(sides)}
              className="flex-1 min-w-[60px] flex flex-col items-center gap-1.5 py-3 rounded-lg transition-transform active:scale-95"
              style={{
                background: "var(--scene-surface)",
                border: "1px solid var(--scene-border)",
              }}
              aria-label={`Roll d${sides}`}
            >
              <Die sides={sides} size={34} />
              <span
                className="text-xs font-bold"
                style={{
                  fontFamily: "var(--font-cinzel)",
                  color: "var(--scene-text-muted)",
                }}
              >
                d{sides}
              </span>
            </button>
          ))}
        </div>

        {/* ── Expression input ────────────────────────────────────────── */}
        <div className="mb-2 flex items-center gap-2">
          <input
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRollExpression()}
            placeholder="e.g. 1d8+3d6, 2d20+5, 1d4"
            className="flex-1 px-4 py-3 rounded-lg text-base font-mono outline-none"
            style={{
              background: "var(--scene-surface)",
              border: `1px solid ${
                isExpressionValid ? "var(--scene-border)" : "#ef4444"
              }`,
              color: "var(--scene-text-primary)",
            }}
          />
          <button
            onClick={handleRollExpression}
            disabled={!expression.trim() || !isExpressionValid}
            className="px-6 py-3 rounded-lg font-semibold transition-opacity disabled:opacity-40"
            style={{
              background: "var(--scene-accent)",
              color: "var(--scene-bg)",
              fontFamily: "var(--font-cinzel)",
            }}
          >
            Roll
          </button>
        </div>
        {!isExpressionValid && (
          <p className="text-xs mb-6" style={{ color: "#ef4444" }}>
            Invalid expression. Use forms like 1d20+5, 8d6, or 1d8+3d6.
          </p>
        )}
        {isExpressionValid && <div className="mb-6" />}

        {/* ── Saved rolls ─────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2
              className="text-sm uppercase tracking-widest"
              style={{ color: "var(--scene-text-muted)" }}
            >
              Saved Rolls
            </h2>
            <button
              onClick={() => setShowSaveForm((v) => !v)}
              className="flex items-center gap-1 text-xs"
              style={{ color: "var(--scene-accent)" }}
            >
              <Plus size={14} /> Save current
            </button>
          </div>

          {showSaveForm && (
            <div className="flex items-center gap-2 mb-3">
              <input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveCurrent()}
                placeholder="Name (e.g. Eldritch Blast)"
                className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                style={{
                  background: "var(--scene-surface)",
                  border: "1px solid var(--scene-border)",
                  color: "var(--scene-text-primary)",
                }}
              />
              <span
                className="text-xs font-mono px-2"
                style={{ color: "var(--scene-text-muted)" }}
              >
                {expression.trim() || "type an expression above"}
              </span>
              <button
                onClick={handleSaveCurrent}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
              >
                Save
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {savedRolls.length === 0 && (
              <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
                No saved rolls yet.
              </p>
            )}
            {savedRolls.map((roll) => (
              <div
                key={roll.id}
                className="flex items-center gap-2 pl-3 pr-1 py-1 rounded-lg group"
                style={{
                  background: "var(--scene-surface)",
                  border: "1px solid var(--scene-border)",
                }}
              >
                <button
                  onClick={() => handleSavedRoll(roll.expression, roll.name)}
                  className="flex items-center gap-2"
                >
                  <span
                    className="text-sm font-medium"
                    style={{ color: "var(--scene-text-primary)" }}
                  >
                    {roll.name}
                  </span>
                  <span
                    className="text-xs font-mono"
                    style={{ color: "var(--scene-text-muted)" }}
                  >
                    {roll.expression}
                  </span>
                </button>
                <button
                  onClick={() => removeSavedRoll(roll.id)}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: "var(--scene-text-muted)" }}
                  aria-label={`Delete ${roll.name}`}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── History ─────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2
              className="text-sm uppercase tracking-widest flex items-center gap-2"
              style={{ color: "var(--scene-text-muted)" }}
            >
              <History size={14} /> History
            </h2>
            {rollHistory.length > 0 && (
              <button
                onClick={() => {
                  clearHistory()
                  setCurrentResult(null)
                }}
                className="flex items-center gap-1 text-xs"
                style={{ color: "var(--scene-text-muted)" }}
              >
                <Trash2 size={14} /> Clear
              </button>
            )}
          </div>

          {rollHistory.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
              Your last 50 rolls will appear here.
            </p>
          ) : (
            <div className="space-y-1">
              {rollHistory.map((roll) => (
                <button
                  key={roll.id}
                  onClick={() => showFromHistory(roll)}
                  className="w-full flex items-center justify-between px-4 py-2 rounded-lg text-left transition-colors"
                  style={{
                    background: "var(--scene-surface)",
                    border: "1px solid var(--scene-border)",
                  }}
                >
                  <span
                    className="text-sm flex items-center gap-2 flex-wrap"
                    style={{ color: "var(--scene-text-muted)" }}
                  >
                    <span style={{ color: "var(--scene-text-primary)" }}>
                      {roll.label ?? roll.expression}
                    </span>
                    {roll.isAdvantage && <span className="text-xs">ADV</span>}
                    {roll.isDisadvantage && <span className="text-xs">DIS</span>}
                    {roll.isCrit && <span className="text-xs">CRIT</span>}
                  </span>
                  <span
                    className="text-lg font-bold"
                    style={{
                      fontFamily: "var(--font-cinzel)",
                      color: "var(--scene-text-primary)",
                    }}
                  >
                    {roll.total}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
