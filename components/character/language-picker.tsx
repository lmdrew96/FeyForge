"use client"

import { useMemo } from "react"
import {
  partitionRaceLanguages,
  effectiveLanguagePicks,
  ALL_LANGUAGES,
} from "@/lib/character/language-choices"

interface LanguagePickerProps {
  // The selected race's language list (may include "One of your choice" entries).
  raceLanguages: string[]
  // The selected background's bonus-language count (BackgroundData.languages).
  backgroundLanguageCount: number
  // Player's picks, a flat array indexed by choice slot. Owned by the parent so the
  // picks survive a remount (the guided flow re-creates its step components).
  selections: string[]
  onSelectionsChange: (next: string[]) => void
}

// Renders a character's languages: the ones their race grants outright as static
// chips, and one dropdown per free-choice slot (race "of your choice" placeholders
// plus the background's bonus count). Fully controlled + effect-free — every slot
// defaults to the first available language, so a concrete language is always chosen
// even before the player touches it. Mirrors ToolProficiencyPicker.
export function LanguagePicker({
  raceLanguages,
  backgroundLanguageCount,
  selections,
  onSelectionsChange,
}: LanguagePickerProps) {
  const { fixed, choiceCount } = useMemo(
    () => partitionRaceLanguages(raceLanguages),
    [raceLanguages],
  )
  const total = choiceCount + Math.max(0, backgroundLanguageCount)

  if (fixed.length === 0 && total === 0) return null

  const picks = effectiveLanguagePicks(total, fixed, selections)
  const fixedSet = new Set(fixed.map((f) => f.toLowerCase()))

  const setPick = (slot: number, value: string) => {
    // Write back the full effective array so every slot becomes explicit (no
    // surprise default-shifting when one slot changes).
    const next = effectiveLanguagePicks(total, fixed, selections)
    next[slot] = value
    onSelectionsChange(next)
  }

  return (
    <div className="space-y-3">
      {fixed.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {fixed.map((l) => (
            <span
              key={l}
              className="text-xs px-2.5 py-1 rounded-full"
              style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
            >
              {l}
            </span>
          ))}
        </div>
      )}

      {total > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
            {total > 1 ? `Languages of your choice — choose ${total}` : "Language of your choice"}
          </p>
          <div className="flex flex-wrap gap-2">
            {picks.map((current, slot) => {
              // Keep picks distinct: hide languages already fixed or taken by a
              // sibling slot (but always keep this slot's current value selectable).
              const taken = new Set(picks.filter((_, k) => k !== slot).map((p) => p.toLowerCase()))
              return (
                <select
                  key={slot}
                  value={current}
                  onChange={(e) => setPick(slot, e.target.value)}
                  className="px-3 py-2 rounded-lg text-sm cursor-pointer"
                  style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
                >
                  {ALL_LANGUAGES.filter(
                    (o) =>
                      o === current ||
                      (!fixedSet.has(o.toLowerCase()) && !taken.has(o.toLowerCase())),
                  ).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
