"use client"

/**
 * Saving Throws Panel Component
 * Shows saving throw modifiers with proficiency indicators
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield } from "lucide-react"
import type { Ability } from "@/lib/character/constants"
import { 
  ABILITIES, 
  ABILITY_ABBREVIATIONS,
  formatModifier,
} from "@/lib/character/constants"

interface SavingThrowsPanelProps {
  savingThrows: Record<Ability, number>
  proficiencies: Ability[]
  onSaveClick?: (ability: Ability) => void
}

export function SavingThrowsPanel({ 
  savingThrows, 
  proficiencies,
  onSaveClick,
}: SavingThrowsPanelProps) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Saving Throws
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1">
          {ABILITIES.map((ability) => {
            const modifier = savingThrows[ability]
            const isProficient = proficiencies.includes(ability)

            return (
              <button
                key={ability}
                onClick={() => onSaveClick?.(ability)}
                className={`w-full flex items-center gap-2 p-2 rounded-lg transition-all ${
                  onSaveClick 
                    ? "hover:bg-accent/50 cursor-pointer" 
                    : "cursor-default"
                }`}
              >
                <span 
                  className={`text-lg ${isProficient ? "text-primary" : "text-muted-foreground"}`}
                  title={isProficient ? "Proficient" : "Not Proficient"}
                >
                  {isProficient ? "●" : "○"}
                </span>
                <span className="flex-1 text-left text-sm text-foreground capitalize">
                  {ability}
                </span>
                <span className={`text-sm font-bold ${modifier >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {formatModifier(modifier)}
                </span>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Compact saving throws display
 */
interface CompactSavingThrowsProps {
  savingThrows: Record<Ability, number>
  proficiencies: Ability[]
}

export function CompactSavingThrows({ 
  savingThrows, 
  proficiencies,
}: CompactSavingThrowsProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {ABILITIES.map((ability) => {
        const modifier = savingThrows[ability]
        const isProficient = proficiencies.includes(ability)

        return (
          <div 
            key={ability}
            className={`flex items-center justify-between p-2 rounded-lg border ${
              isProficient 
                ? "bg-primary/10 border-primary/50" 
                : "bg-card border-border"
            }`}
          >
            <span className="text-xs font-medium text-muted-foreground uppercase">
              {ABILITY_ABBREVIATIONS[ability]}
            </span>
            <span className={`text-sm font-bold ${modifier >= 0 ? "text-green-500" : "text-red-500"}`}>
              {formatModifier(modifier)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
