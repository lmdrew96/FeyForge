"use client"

import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { Character, CalculatedStats, CharacterUpdateInput } from "@/lib/character/types"
import { ABILITY_ABBREVIATIONS, ABILITIES, type Ability } from "@/lib/character/constants"

interface AbilityScoresPanelProps {
  character: Character
  calculatedStats: CalculatedStats | null
  isEditing: boolean
  onUpdate: (data: CharacterUpdateInput) => void
}

export function AbilityScoresPanel({ character, calculatedStats, isEditing, onUpdate }: AbilityScoresPanelProps) {
  const getModifier = (score: number) => Math.floor((score - 10) / 2)
  const formatModifier = (mod: number) => (mod >= 0 ? `+${mod}` : `${mod}`)

  const handleAbilityChange = (ability: Ability, value: string) => {
    const numValue = Number.parseInt(value) || 8
    onUpdate({
      baseAbilities: {
        ...character.baseAbilities,
        [ability]: Math.max(1, Math.min(30, numValue)),
      },
    })
  }

  return (
    <Card className="p-4 bg-card/80 backdrop-blur-sm border-fey-sage/30">
      <h2 className="text-lg font-display font-semibold mb-4 text-fey-gold">Ability Scores</h2>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {ABILITIES.map((ability) => {
          const baseScore = character.baseAbilities[ability]
          const racialBonus = character.racialBonuses?.[ability] || 0
          const totalScore = calculatedStats?.abilities[ability] ?? (baseScore + racialBonus)
          const modifier = calculatedStats?.abilityModifiers[ability] ?? getModifier(totalScore)

          return (
            <div
              key={ability}
              className="flex flex-col items-center p-3 rounded-lg bg-background/50 border border-fey-sage/20"
            >
              <span className="text-xs font-semibold text-muted-foreground mb-1">{ABILITY_ABBREVIATIONS[ability]}</span>
              <div className={`text-2xl font-bold mb-1 ${modifier >= 0 ? "text-fey-cyan" : "text-destructive"}`}>
                {formatModifier(modifier)}
              </div>
              {isEditing ? (
                <Input
                  type="number"
                  value={baseScore}
                  onChange={(e) => handleAbilityChange(ability, e.target.value)}
                  className="w-14 h-7 text-center text-sm bg-background border-fey-sage/30"
                  min={1}
                  max={30}
                />
              ) : (
                <span className="text-sm text-foreground">{totalScore}</span>
              )}
              {racialBonus > 0 && <span className="text-xs text-fey-cyan mt-1">+{racialBonus}</span>}
            </div>
          )
        })}
      </div>

      {/* Derived Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-fey-sage/20">
        <StatBlock
          label="Proficiency"
          value={`+${calculatedStats?.proficiencyBonus ?? Math.floor((character.level - 1) / 4) + 2}`}
        />
        <StatBlock
          label="Initiative"
          value={formatModifier(calculatedStats?.initiative ?? getModifier(character.baseAbilities.dexterity))}
        />
        <StatBlock
          label="Armor Class"
          value={(calculatedStats?.armorClass ?? 10).toString()}
        />
        <StatBlock
          label="Speed"
          value={`${calculatedStats?.speed ?? character.speed} ft`}
        />
      </div>
    </Card>
  )
}

function StatBlock({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex flex-col items-center p-2 rounded-lg bg-fey-forest/10">
      <span className="text-xs text-muted-foreground mb-1">{label}</span>
      <span className="font-bold text-foreground">{value}</span>
    </div>
  )
}
