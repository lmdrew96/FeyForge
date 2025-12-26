"use client"

/**
 * Step 3: Skills
 * Skill proficiency selection based on class
 */

import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import type { CharacterCreationData } from "@/lib/character/types"
import { 
  SKILLS, 
  SKILL_DISPLAY_NAMES,
  ABILITY_ABBREVIATIONS,
  getAbilityModifier,
  formatModifier,
} from "@/lib/character/constants"
import type { Skill, Ability } from "@/lib/character/constants"

interface Step3SkillsProps {
  data: CharacterCreationData
  onUpdate: (updates: Partial<CharacterCreationData>) => void
  availableSkills: Skill[]
  maxSkillChoices: number
  backgroundSkills?: string[]
  abilities?: Record<Ability, number>
}

export function Step3Skills({ 
  data, 
  onUpdate, 
  availableSkills, 
  maxSkillChoices,
  backgroundSkills = [],
  abilities,
}: Step3SkillsProps) {
  const selectedSkills = data.skillProficiencies || []
  const remainingChoices = maxSkillChoices - selectedSkills.length

  const toggleSkill = (skill: Skill) => {
    if (selectedSkills.includes(skill)) {
      onUpdate({
        skillProficiencies: selectedSkills.filter(s => s !== skill),
      })
    } else if (selectedSkills.length < maxSkillChoices) {
      onUpdate({
        skillProficiencies: [...selectedSkills, skill],
      })
    }
  }

  // Group skills by ability
  const skillsByAbility: Record<Ability, Skill[]> = {
    strength: [],
    dexterity: [],
    constitution: [],
    intelligence: [],
    wisdom: [],
    charisma: [],
  }

  for (const [skill, ability] of Object.entries(SKILLS)) {
    skillsByAbility[ability as Ability].push(skill as Skill)
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="font-serif text-2xl font-bold text-gold-gradient">Choose Skills</h2>
        <p className="text-muted-foreground mt-2">
          Select {maxSkillChoices} skill proficiencies from your class options
        </p>
      </div>

      {/* Selection Counter */}
      <div className="flex justify-center mb-6">
        <Badge 
          variant={remainingChoices === 0 ? "default" : "secondary"}
          className="text-lg px-4 py-1"
        >
          {remainingChoices === 0 
            ? "All skills selected!" 
            : `${remainingChoices} choice${remainingChoices !== 1 ? "s" : ""} remaining`
          }
        </Badge>
      </div>

      {/* Background Skills Notice */}
      {backgroundSkills.length > 0 && (
        <div className="p-3 rounded-lg bg-accent/30 border border-border text-center mb-6">
          <p className="text-sm text-muted-foreground">
            <span className="text-foreground font-medium">Background skills: </span>
            {backgroundSkills.join(", ")}
          </p>
        </div>
      )}

      {/* Skills Grid by Ability */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {(Object.entries(skillsByAbility) as [Ability, Skill[]][]).map(([ability, skills]) => {
          const relevantSkills = skills.filter(s => availableSkills.includes(s))
          if (relevantSkills.length === 0) return null

          const abilityScore = abilities?.[ability] || 10
          const abilityMod = getAbilityModifier(abilityScore)

          return (
            <div key={ability} className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="uppercase text-xs">
                  {ABILITY_ABBREVIATIONS[ability]}
                </Badge>
                {abilities && (
                  <span className="text-xs text-muted-foreground">
                    ({formatModifier(abilityMod)})
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {relevantSkills.map((skill) => {
                  const isSelected = selectedSkills.includes(skill)
                  const isFromBackground = backgroundSkills.some(
                    bs => bs.toLowerCase() === SKILL_DISPLAY_NAMES[skill].toLowerCase()
                  )
                  const isDisabled = !isSelected && selectedSkills.length >= maxSkillChoices

                  return (
                    <div
                      key={skill}
                      className={`flex items-center gap-3 p-2 rounded-lg border transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10"
                          : isFromBackground
                          ? "border-accent bg-accent/20"
                          : "border-border bg-card hover:border-primary/50"
                      } ${isDisabled && !isSelected ? "opacity-50" : ""}`}
                    >
                      <Checkbox
                        id={skill}
                        checked={isSelected}
                        disabled={isFromBackground || isDisabled}
                        onCheckedChange={() => toggleSkill(skill)}
                        className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                      <Label
                        htmlFor={skill}
                        className={`flex-1 cursor-pointer ${
                          isSelected ? "text-primary font-medium" : "text-foreground"
                        } ${isFromBackground ? "text-muted-foreground" : ""}`}
                      >
                        {SKILL_DISPLAY_NAMES[skill]}
                        {isFromBackground && (
                          <span className="text-xs text-muted-foreground ml-2">(Background)</span>
                        )}
                      </Label>
                      {abilities && (
                        <span className="text-xs text-muted-foreground">
                          {formatModifier(abilityMod)}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* All other skills (not available from class) */}
      <div className="mt-8 pt-6 border-t border-border">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">
          Other Skills (not available from your class)
        </h3>
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {(Object.keys(SKILLS) as Skill[])
            .filter(s => !availableSkills.includes(s))
            .map((skill) => {
              const ability = SKILLS[skill]
              const isFromBackground = backgroundSkills.some(
                bs => bs.toLowerCase() === SKILL_DISPLAY_NAMES[skill].toLowerCase()
              )

              return (
                <div
                  key={skill}
                  className={`flex items-center gap-2 p-2 rounded-lg border border-border ${
                    isFromBackground ? "bg-accent/20" : "bg-muted/30"
                  } opacity-60`}
                >
                  <span className="text-sm text-muted-foreground">
                    {SKILL_DISPLAY_NAMES[skill]}
                  </span>
                  <Badge variant="outline" className="ml-auto text-xs">
                    {ABILITY_ABBREVIATIONS[ability]}
                  </Badge>
                  {isFromBackground && (
                    <span className="text-xs text-primary">✓</span>
                  )}
                </div>
              )
            })}
        </div>
      </div>
    </div>
  )
}
