"use client"

import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { Character } from "@/lib/characters-store"
import { races, subraces } from "@/lib/character-data"

interface AbilityScoresPanelProps {
  character: Character
  isEditing: boolean
  onUpdate: (data: Partial<Character>) => void
}

const abilityInfo = [
  { key: "strength", abbr: "STR", label: "Strength" },
  { key: "dexterity", abbr: "DEX", label: "Dexterity" },
  { key: "constitution", abbr: "CON", label: "Constitution" },
  { key: "intelligence", abbr: "INT", label: "Intelligence" },
  { key: "wisdom", abbr: "WIS", label: "Wisdom" },
  { key: "charisma", abbr: "CHA", label: "Charisma" },
] as const

export function AbilityScoresPanel({ character, isEditing, onUpdate }: AbilityScoresPanelProps) {
  // Calculate racial bonuses
  const getRacialBonuses = () => {
    const bonuses: Record<string, number> = {}
    const race = races.find((r) => r.value === character.race)
    if (race?.abilityBonuses) {
      Object.entries(race.abilityBonuses).forEach(([key, value]) => {
        bonuses[key] = (bonuses[key] || 0) + value
      })
    }
    if (character.subrace && subraces[character.race]) {
      const sub = subraces[character.race].find((s) => s.label === character.subrace)
      if (sub?.abilityBonuses) {
        Object.entries(sub.abilityBonuses).forEach(([key, value]) => {
          bonuses[key] = (bonuses[key] || 0) + value
        })
      }
    }
    return bonuses
  }

  const racialBonuses = getRacialBonuses()

  const getModifier = (score: number) => Math.floor((score - 10) / 2)
  const formatModifier = (mod: number) => (mod >= 0 ? `+${mod}` : `${mod}`)

  const handleAbilityChange = (key: string, value: string) => {
    const numValue = Number.parseInt(value) || 8
    onUpdate({
      abilities: {
        ...character.abilities,
        [key]: numValue,
      },
    })
  }

  return (
    <Card className="p-4 bg-card/80 backdrop-blur-sm border-fey-sage/30">
      <h2 className="text-lg font-display font-semibold mb-4 text-fey-gold">Ability Scores</h2>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {abilityInfo.map(({ key, abbr }) => {
          const baseScore = character.abilities[key as keyof typeof character.abilities]
          const bonus = racialBonuses[key] || 0
          const totalScore = baseScore + bonus
          const modifier = getModifier(totalScore)

          return (
            <div
              key={key}
              className="flex flex-col items-center p-3 rounded-lg bg-background/50 border border-fey-sage/20"
            >
              <span className="text-xs font-semibold text-muted-foreground mb-1">{abbr}</span>
              <div className={`text-2xl font-bold mb-1 ${modifier >= 0 ? "text-fey-cyan" : "text-destructive"}`}>
                {formatModifier(modifier)}
              </div>
              {isEditing ? (
                <Input
                  type="number"
                  value={baseScore}
                  onChange={(e) => handleAbilityChange(key, e.target.value)}
                  className="w-14 h-7 text-center text-sm bg-background border-fey-sage/30"
                  min={1}
                  max={20}
                />
              ) : (
                <span className="text-sm text-foreground">{totalScore}</span>
              )}
              {bonus > 0 && <span className="text-xs text-fey-cyan mt-1">+{bonus}</span>}
            </div>
          )
        })}
      </div>

      {/* Derived Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-fey-sage/20">
        <StatBlock
          label="Proficiency"
          value={`+${character.proficiencyBonus}`}
          isEditing={isEditing}
          onChange={(v) => onUpdate({ proficiencyBonus: Number.parseInt(v) || 2 })}
        />
        <StatBlock
          label="Initiative"
          value={formatModifier(character.initiative)}
          isEditing={isEditing}
          onChange={(v) => onUpdate({ initiative: Number.parseInt(v) || 0 })}
        />
        <StatBlock
          label="Armor Class"
          value={character.armorClass.toString()}
          isEditing={isEditing}
          onChange={(v) => onUpdate({ armorClass: Number.parseInt(v) || 10 })}
        />
        <StatBlock
          label="Speed"
          value={`${character.speed} ft`}
          isEditing={isEditing}
          onChange={(v) => onUpdate({ speed: Number.parseInt(v) || 30 })}
          suffix=" ft"
        />
      </div>
    </Card>
  )
}

function StatBlock({
  label,
  value,
  isEditing,
  onChange,
  suffix = "",
}: {
  label: string
  value: string
  isEditing: boolean
  onChange: (v: string) => void
  suffix?: string
}) {
  return (
    <div className="flex flex-col items-center p-2 rounded-lg bg-fey-forest/10">
      <span className="text-xs text-muted-foreground mb-1">{label}</span>
      {isEditing ? (
        <Input
          type="text"
          value={value.replace(suffix, "").replace("+", "")}
          onChange={(e) => onChange(e.target.value)}
          className="w-16 h-7 text-center text-sm bg-background border-fey-sage/30"
        />
      ) : (
        <span className="text-lg font-bold text-foreground">{value}</span>
      )}
    </div>
  )
}
