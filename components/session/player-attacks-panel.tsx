"use client"

import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { rollToFeedArgs } from "@/lib/session-rolls"
import { deriveCharacter } from "@/lib/character/derive-character"
import { useSheetRoll, SheetRollCard } from "@/components/character/sheet-roll"
import { AttacksSection } from "@/app/characters/[id]/inventory"
import type { RollMode } from "@/lib/dice-store"

// The player's own weapon attacks, surfaced INSIDE the Live tab's combat view so
// attacking doesn't require a round-trip to the Sheet tab. Exactly the sheet's
// attack stack — deriveCharacter + AttacksSection + the adv/dis-aware roller —
// with every roll broadcast to the table's shared feed, so the numbers and
// behavior can't drift from the in-session sheet.

const MODES: RollMode[] = ["normal", "advantage", "disadvantage"]
const MODE_LABEL: Record<RollMode, string> = {
  normal: "Normal",
  advantage: "ADV",
  disadvantage: "DIS",
}

export function PlayerAttacksPanel({
  sessionId,
  campaignId,
  characterId,
}: {
  sessionId: Id<"partySessions">
  campaignId: Id<"campaigns">
  characterId: Id<"characters">
}) {
  const char = useQuery(api.characters.get, { id: characterId })
  const allProps = useQuery(api.characters.listAllProperties)
  const campaign = useQuery(api.campaigns.get, { campaignId })
  const pushRoll = useMutation(api.sessionRolls.pushRoll)
  // Same hook as the in-session sheet — rolls land in history, toast, and the
  // live feed (fire-and-forget; a feed failure never blocks the local roll).
  const { roll, rollExpr, mode, setMode, lastRoll, rolling, dismiss } = useSheetRoll({
    onRoll: (result) => {
      if (!char) return
      void pushRoll({ sessionId, ...rollToFeedArgs(result, char.name) }).catch(() => {})
    },
  })

  if (!char) return null

  const { totalAbilities, equippedWeapons, fightingStyleId, critRange } = deriveCharacter(
    char,
    allProps,
    campaign,
  )

  // Nothing to attack with — stay quiet (equipping happens on the sheet).
  if (equippedWeapons.length === 0) return null

  return (
    <div className="mt-4">
      {/* Compact adv/dis toggle — the sheet's sticky RollModeBar is too heavy here. */}
      <div className="flex items-center justify-end gap-1.5 mb-2">
        <span className="text-[10px] uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
          Roll mode
        </span>
        {MODES.map((m) => {
          const active = mode === m
          const accent = m === "disadvantage" ? "#ef4444" : "var(--scene-accent)"
          return (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="px-2 py-1 rounded text-[11px] font-medium transition-colors"
              style={{
                background: active ? accent : "var(--scene-surface)",
                color: active ? "var(--scene-bg)" : "var(--scene-text-muted)",
                border: "1px solid var(--scene-border)",
              }}
            >
              {MODE_LABEL[m]}
            </button>
          )
        })}
      </div>

      <AttacksSection
        level={char.level}
        weaponProficiencies={char.weaponProficiencies}
        abilities={totalAbilities}
        weapons={equippedWeapons}
        fightingStyleId={fightingStyleId}
        critRange={critRange}
        roll={roll}
        rollExpr={rollExpr}
      />

      {lastRoll && <SheetRollCard result={lastRoll} rolling={rolling} onDismiss={dismiss} />}
    </div>
  )
}
