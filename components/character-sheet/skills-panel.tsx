"use client"

import type React from "react"

import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import type { Character, CalculatedStats, CharacterUpdateInput } from "@/lib/character/types"
import { ABILITIES, type Ability, ABILITY_ABBREVIATIONS } from "@/lib/character/constants"
import { skills } from "@/lib/character-data"
import { Brain, Dumbbell, Eye, Heart, MessageSquare, Sparkles } from "lucide-react"

interface SkillsPanelProps {
  character: Character
  calculatedStats: CalculatedStats | null
  isEditing: boolean
  onUpdate: (data: CharacterUpdateInput) => void
}

const abilityIcons: Record<string, React.ReactNode> = {
  STR: <Dumbbell className="h-3 w-3" />,
  DEX: <Sparkles className="h-3 w-3" />,
  CON: <Heart className="h-3 w-3" />,
  INT: <Brain className="h-3 w-3" />,
  WIS: <Eye className="h-3 w-3" />,
  CHA: <MessageSquare className="h-3 w-3" />,
}

const abilityToKey: Record<string, Ability> = {
  STR: "strength",
  DEX: "dexterity",
  CON: "constitution",
  INT: "intelligence",
  WIS: "wisdom",
  CHA: "charisma",
}

export function SkillsPanel({ character, calculatedStats, isEditing, onUpdate }: SkillsPanelProps) {
  const getModifier = (score: number) => Math.floor((score - 10) / 2)
  const formatModifier = (mod: number) => (mod >= 0 ? `+${mod}` : `${mod}`)

  const proficiencyBonus = calculatedStats?.proficiencyBonus ?? Math.floor((character.level - 1) / 4) + 2

  const toggleSkillProficiency = (skillName: string) => {
    const current = character.skillProficiencies as string[]
    const updated = current.includes(skillName) ? current.filter((s) => s !== skillName) : [...current, skillName]
    onUpdate({ skillProficiencies: updated as any })
  }

  const getSkillModifier = (skillName: string, abilityAbbr: string) => {
    const abilityKey = abilityToKey[abilityAbbr]
    // Use calculated stats if available, otherwise compute from base
    const abilityMod = calculatedStats?.abilityModifiers[abilityKey] ?? getModifier(character.baseAbilities[abilityKey])
    const isProficient = (character.skillProficiencies as string[]).includes(skillName)
    return abilityMod + (isProficient ? proficiencyBonus : 0)
  }

  // Group skills by ability for better scanning
  const groupedSkills = skills.reduce(
    (acc, skill) => {
      if (!acc[skill.ability]) acc[skill.ability] = []
      acc[skill.ability].push(skill)
      return acc
    },
    {} as Record<string, typeof skills>,
  )

  const abilityOrder = ["STR", "DEX", "CON", "INT", "WIS", "CHA"]

  return (
    <Card className="p-4 bg-card/80 backdrop-blur-sm border-fey-sage/30">
      <h2 className="text-lg font-display font-semibold mb-4 text-fey-gold">Skills</h2>

      <div className="space-y-4">
        {abilityOrder.map((ability) => {
          const abilitySkills = groupedSkills[ability]
          if (!abilitySkills) return null

          return (
            <div key={ability}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-fey-cyan">{abilityIcons[ability]}</span>
                <span className="text-xs font-semibold text-muted-foreground">{ability}</span>
              </div>
              <div className="space-y-1">
                {abilitySkills.map((skill) => {
                  const isProficient = (character.skillProficiencies as string[]).includes(skill.name)
                  const modifier = getSkillModifier(skill.name, skill.ability)

                  return (
                    <div
                      key={skill.name}
                      className={`flex items-center justify-between py-1.5 px-2 rounded-md transition-colors ${
                        isProficient ? "bg-fey-forest/10" : "hover:bg-background/50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isEditing ? (
                          <Checkbox
                            checked={isProficient}
                            onCheckedChange={() => toggleSkillProficiency(skill.name)}
                            className="data-[state=checked]:bg-fey-forest data-[state=checked]:border-fey-forest"
                          />
                        ) : (
                          <div
                            className={`w-3 h-3 rounded-full ${
                              isProficient ? "bg-fey-forest" : "border border-fey-sage/50"
                            }`}
                          />
                        )}
                        <span
                          className={`text-sm ${isProficient ? "font-medium text-foreground" : "text-muted-foreground"}`}
                        >
                          {skill.name}
                        </span>
                      </div>
                      <span
                        className={`text-sm font-semibold ${isProficient ? "text-fey-cyan" : "text-muted-foreground"}`}
                      >
                        {formatModifier(modifier)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Saving Throws */}
      <div className="mt-6 pt-4 border-t border-fey-sage/20">
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">Saving Throws</h3>
        <div className="grid grid-cols-2 gap-2">
          {abilityOrder.map((ability) => {
            const abilityKey = abilityToKey[ability]
            const saveProficiencies = character.savingThrowProficiencies as string[]
            const isProficient =
              saveProficiencies.includes(abilityKey) ||
              saveProficiencies.includes(ability.toLowerCase())
            const abilityMod = calculatedStats?.abilityModifiers[abilityKey] ?? getModifier(character.baseAbilities[abilityKey])
            const modifier = abilityMod + (isProficient ? proficiencyBonus : 0)

            return (
              <div
                key={ability}
                className={`flex items-center justify-between py-1.5 px-2 rounded-md ${
                  isProficient ? "bg-fey-forest/10" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${isProficient ? "bg-fey-forest" : "border border-fey-sage/50"}`}
                  />
                  <span className="text-sm text-muted-foreground">{ability}</span>
                </div>
                <span className={`text-sm font-semibold ${isProficient ? "text-fey-cyan" : "text-muted-foreground"}`}>
                  {formatModifier(modifier)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
