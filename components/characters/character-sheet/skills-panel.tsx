"use client"

/**
 * Skills Panel Component
 * Shows all skills with modifiers and proficiency indicators
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Target } from "lucide-react"
import type { Skill, Ability } from "@/lib/character/constants"
import { 
  SKILLS, 
  SKILL_DISPLAY_NAMES, 
  ABILITY_ABBREVIATIONS,
  formatModifier,
} from "@/lib/character/constants"

interface SkillsPanelProps {
  skillModifiers: Record<Skill, number>
  proficiencies: Skill[]
  expertise: Skill[]
  onSkillClick?: (skill: Skill) => void
}

export function SkillsPanel({ 
  skillModifiers, 
  proficiencies, 
  expertise,
  onSkillClick,
}: SkillsPanelProps) {
  // Sort skills alphabetically by display name
  const sortedSkills = (Object.keys(SKILLS) as Skill[]).sort((a, b) => 
    SKILL_DISPLAY_NAMES[a].localeCompare(SKILL_DISPLAY_NAMES[b])
  )

  const getProficiencyIndicator = (skill: Skill) => {
    if (expertise.includes(skill)) return { symbol: "◆", label: "Expertise", color: "text-yellow-400" }
    if (proficiencies.includes(skill)) return { symbol: "●", label: "Proficient", color: "text-primary" }
    return { symbol: "○", label: "Not Proficient", color: "text-muted-foreground" }
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Target className="h-4 w-4" />
          Skills
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px] px-4 pb-4">
          <div className="space-y-1">
            {sortedSkills.map((skill) => {
              const modifier = skillModifiers[skill]
              const ability = SKILLS[skill]
              const proficiency = getProficiencyIndicator(skill)

              return (
                <button
                  key={skill}
                  onClick={() => onSkillClick?.(skill)}
                  className={`w-full flex items-center gap-2 p-2 rounded-lg transition-all ${
                    onSkillClick 
                      ? "hover:bg-accent/50 cursor-pointer" 
                      : "cursor-default"
                  }`}
                >
                  <span className={`text-lg ${proficiency.color}`} title={proficiency.label}>
                    {proficiency.symbol}
                  </span>
                  <span className="flex-1 text-left text-sm text-foreground">
                    {SKILL_DISPLAY_NAMES[skill]}
                  </span>
                  <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                    {ABILITY_ABBREVIATIONS[ability]}
                  </Badge>
                  <span className={`text-sm font-bold ${modifier >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {formatModifier(modifier)}
                  </span>
                </button>
              )
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

/**
 * Compact skills list for smaller displays
 */
interface CompactSkillsListProps {
  skillModifiers: Record<Skill, number>
  proficiencies: Skill[]
  expertise: Skill[]
}

export function CompactSkillsList({ 
  skillModifiers, 
  proficiencies, 
  expertise,
}: CompactSkillsListProps) {
  // Only show proficient skills
  const proficientSkills = (Object.keys(SKILLS) as Skill[])
    .filter(s => proficiencies.includes(s) || expertise.includes(s))
    .sort((a, b) => SKILL_DISPLAY_NAMES[a].localeCompare(SKILL_DISPLAY_NAMES[b]))

  if (proficientSkills.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">No skill proficiencies</p>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {proficientSkills.map((skill) => (
        <Badge 
          key={skill} 
          variant={expertise.includes(skill) ? "default" : "secondary"}
          className="text-xs"
        >
          {SKILL_DISPLAY_NAMES[skill]} {formatModifier(skillModifiers[skill])}
        </Badge>
      ))}
    </div>
  )
}
