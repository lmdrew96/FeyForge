"use client"

import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { rollToFeedArgs } from "@/lib/session-rolls"
import { deriveCharacter } from "@/lib/character/derive-character"
import { useSheetRoll, SheetRollCard } from "@/components/character/sheet-roll"
import { AttacksSection } from "@/app/characters/[id]/inventory"
import { SpellbookSection } from "@/components/character/spellbook"
import type { RollMode } from "@/lib/dice-store"

// The player's own combat actions — weapon attacks AND spellcasting — surfaced
// INSIDE the Live tab's combat view so acting doesn't require a round-trip to the
// Sheet tab. Exactly the sheet's attack + spellbook stacks (deriveCharacter +
// AttacksSection + SpellbookSection + the adv/dis-aware roller) with every roll
// broadcast to the table's shared feed, so the numbers and behavior can't drift
// from the in-session sheet. Casting spends slots locally (same as the sheet);
// the spell-attack roll broadcasts because it goes through the shared roller.

const MODES: RollMode[] = ["normal", "advantage", "disadvantage"]
const MODE_LABEL: Record<RollMode, string> = {
  normal: "Normal",
  advantage: "ADV",
  disadvantage: "DIS",
}

export function PlayerCombatActions({
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

  const {
    totalAbilities,
    equippedWeapons,
    fightingStyleId,
    critRange,
    spells,
    grantedSpells,
    subclassId,
    casterType,
    edition,
    nextOrder,
  } = deriveCharacter(char, allProps, campaign)

  const hasAttacks = equippedWeapons.length > 0
  // Casters who never enabled spellcasting enable it on their full sheet, not here
  // — so we only show the spellbook once the block exists (mirrors the Sheet tab).
  const isCaster = casterType !== "none" && !!char.spellcasting

  // Nothing to attack or cast with — stay quiet (equipping / enabling happens on
  // the sheet).
  if (!hasAttacks && !isCaster) return null

  return (
    <div className="mt-4">
      {/* Compact adv/dis toggle — the sheet's sticky RollModeBar is too heavy here.
          One toggle drives BOTH the weapon attacks and the spell-attack roll. */}
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

      {hasAttacks && (
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
      )}

      {/* Spellcasting — slots, save DC/attack, cast from the spellbook. Same
          component + mutations as the sheet, so slots can't drift between them. */}
      {isCaster && char.spellcasting && (
        <SpellbookSection
          characterId={char._id}
          spellcasting={char.spellcasting}
          classId={char.characterClass}
          subclassId={subclassId}
          level={char.level}
          edition={edition}
          spells={spells}
          grantedSpells={grantedSpells}
          nextOrder={nextOrder}
          roll={roll}
        />
      )}

      {lastRoll && <SheetRollCard result={lastRoll} rolling={rolling} onDismiss={dismiss} />}
    </div>
  )
}
