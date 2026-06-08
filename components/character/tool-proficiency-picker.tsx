"use client"

import { useMemo } from "react"
import { partitionToolProficiencies, effectivePicks } from "@/lib/character/tool-choices"

interface ToolProficiencyPickerProps {
  // Raw class + background tool proficiencies (may include "One type of …" choices).
  rawTools: string[]
  // Player's picks, keyed by ToolChoice.id. Owned by the parent so the picks
  // survive a remount (the guided flow re-creates its step components each render).
  selections: Record<string, string[]>
  onSelectionsChange: (next: Record<string, string[]>) => void
}

// Renders a character's granted tool proficiencies: fixed ones as static chips, and
// each "one type of <category>" choice as a dropdown (or N dropdowns for a multi-
// pick like the Bard's three instruments). Fully controlled + effect-free — every
// slot defaults to the first available option, so a concrete tool is always chosen
// even before the player touches it.
export function ToolProficiencyPicker({
  rawTools,
  selections,
  onSelectionsChange,
}: ToolProficiencyPickerProps) {
  const { fixed, choices } = useMemo(() => partitionToolProficiencies(rawTools), [rawTools])

  if (fixed.length === 0 && choices.length === 0) return null

  const setPick = (choiceId: string, slot: number, value: string) => {
    const choice = choices.find((c) => c.id === choiceId)
    if (!choice) return
    // Write back the full effective array so every slot becomes explicit (no
    // surprise default-shifting when one slot changes).
    const next = effectivePicks(choice, selections[choiceId])
    next[slot] = value
    onSelectionsChange({ ...selections, [choiceId]: next })
  }

  return (
    <div className="space-y-3">
      {fixed.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {fixed.map((t) => (
            <span
              key={t}
              className="text-xs px-2.5 py-1 rounded-full"
              style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {choices.map((c) => {
        const picks = effectivePicks(c, selections[c.id])
        return (
          <div key={c.id} className="space-y-1.5">
            <p className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
              {c.label}
              {c.count > 1 ? ` — choose ${c.count}` : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              {picks.map((current, slot) => {
                // Keep multi-picks distinct: hide options taken by sibling slots.
                const taken = new Set(picks.filter((_, k) => k !== slot))
                return (
                  <select
                    key={slot}
                    value={current}
                    onChange={(e) => setPick(c.id, slot, e.target.value)}
                    className="px-3 py-2 rounded-lg text-sm cursor-pointer"
                    style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
                  >
                    {c.options
                      .filter((o) => o === current || !taken.has(o))
                      .map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                  </select>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
