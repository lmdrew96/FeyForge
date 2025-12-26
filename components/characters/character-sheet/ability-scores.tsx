"use client"

/**
 * Ability Scores Display Component
 * Shows the six ability scores with modifiers
 */

import { Card, CardContent } from "@/components/ui/card"
import type { AbilityScores, CalculatedStats } from "@/lib/character/types"
import type { Ability } from "@/lib/character/constants"
import { 
  ABILITIES, 
  ABILITY_ABBREVIATIONS, 
  formatModifier,
} from "@/lib/character/constants"

interface AbilityScoresDisplayProps {
  abilities: AbilityScores
  modifiers: Record<Ability, number>
  racialBonuses?: Partial<AbilityScores>
  onAbilityClick?: (ability: Ability) => void
}

export function AbilityScoresDisplay({ 
  abilities, 
  modifiers,
  racialBonuses,
  onAbilityClick,
}: AbilityScoresDisplayProps) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
      {ABILITIES.map((ability) => {
        const score = abilities[ability]
        const mod = modifiers[ability]
        const racialBonus = racialBonuses?.[ability]

        return (
          <Card 
            key={ability}
            className={`bg-card border-border transition-all ${
              onAbilityClick ? "cursor-pointer hover:border-primary/50 hover:shadow-lg" : ""
            }`}
            onClick={() => onAbilityClick?.(ability)}
          >
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase font-medium mb-1">
                {ABILITY_ABBREVIATIONS[ability]}
              </p>
              <p className="text-2xl font-bold text-foreground">
                {formatModifier(mod)}
              </p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <span className="text-sm text-muted-foreground">{score}</span>
                {racialBonus && racialBonus > 0 && (
                  <span className="text-xs text-primary">(+{racialBonus})</span>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

/**
 * Compact ability scores for sidebar display
 */
interface CompactAbilityScoresProps {
  abilities: AbilityScores
  modifiers: Record<Ability, number>
}

export function CompactAbilityScores({ abilities, modifiers }: CompactAbilityScoresProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {ABILITIES.map((ability) => (
        <div 
          key={ability}
          className="flex items-center justify-between p-2 rounded-lg bg-accent/30 border border-border"
        >
          <span className="text-xs font-medium text-muted-foreground uppercase">
            {ABILITY_ABBREVIATIONS[ability]}
          </span>
          <div className="text-right">
            <span className="text-sm font-bold text-foreground">
              {abilities[ability]}
            </span>
            <span className="text-xs text-primary ml-1">
              ({formatModifier(modifiers[ability])})
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
