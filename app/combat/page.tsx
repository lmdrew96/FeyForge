"use client"

import { AppShell } from "@/components/app-shell"
import { InitiativeList } from "@/components/combat/initiative-list"
import { AddCombatantDialog } from "@/components/combat/add-combatant-dialog"
import { QuickDiceRoller } from "@/components/combat/quick-dice-roller"
import { RoundCounter } from "@/components/combat/round-counter"
import { SaveEncounterDialog, LoadEncounterDialog } from "@/components/combat/save-load-encounter"

export default function CombatPage() {
  return (
    <AppShell pageTitle="Combat Tracker">
      <div className="p-3 sm:p-4 lg:p-6 max-w-6xl mx-auto w-full">
        <div className="flex flex-wrap items-center justify-end gap-2 mb-4">
          <SaveEncounterDialog />
          <LoadEncounterDialog />
          <AddCombatantDialog />
        </div>

        {/* Mobile: Single column, Desktop: Two columns */}
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
          {/* Main Initiative List */}
          <div className="flex-1 min-w-0 space-y-4">
            <RoundCounter />
            <InitiativeList />
          </div>

          {/* Sidebar - Quick Dice */}
          <div className="w-full lg:w-80 flex-shrink-0">
            <div className="lg:sticky lg:top-20 space-y-4">
              <QuickDiceRoller />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
