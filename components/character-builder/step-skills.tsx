"use client"

import { useCharacterStore } from "@/lib/character-store"
import { skills, languages, toolProficiencies } from "@/lib/character-data"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { Sparkles, X } from "lucide-react"

const MAX_SKILLS = 4 // Varies by class, simplified for demo

export function StepSkills() {
  const { character, updateCharacter } = useCharacterStore()

  const toggleSkill = (skillName: string) => {
    const current = character.skillProficiencies
    if (current.includes(skillName)) {
      updateCharacter({ skillProficiencies: current.filter((s) => s !== skillName) })
    } else if (current.length < MAX_SKILLS) {
      updateCharacter({ skillProficiencies: [...current, skillName] })
    }
  }

  const addLanguage = (lang: string) => {
    if (!character.languages.includes(lang)) {
      updateCharacter({ languages: [...character.languages, lang] })
    }
  }

  const removeLanguage = (lang: string) => {
    if (lang !== "Common") {
      updateCharacter({ languages: character.languages.filter((l) => l !== lang) })
    }
  }

  const addTool = (tool: string) => {
    if (!character.toolProficiencies.includes(tool)) {
      updateCharacter({ toolProficiencies: [...character.toolProficiencies, tool] })
    }
  }

  const removeTool = (tool: string) => {
    updateCharacter({ toolProficiencies: character.toolProficiencies.filter((t) => t !== tool) })
  }

  // Group skills by ability
  const skillsByAbility = skills.reduce(
    (acc, skill) => {
      if (!acc[skill.ability]) acc[skill.ability] = []
      acc[skill.ability].push(skill)
      return acc
    },
    {} as Record<string, typeof skills>,
  )

  return (
    <div className="space-y-8 min-w-0">
      {/* Skills Selection */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <Label className="text-lg font-semibold flex items-center gap-2 text-foreground">
            <Sparkles className="h-4 w-4 text-fey-cyan shrink-0" />
            Skill Proficiencies
          </Label>
          <Badge
            variant="outline"
            className={cn(
              "text-sm px-3 py-1 font-medium shrink-0 self-start sm:self-auto",
              character.skillProficiencies.length >= MAX_SKILLS
                ? "border-fey-gold text-fey-gold"
                : "border-fey-cyan text-fey-cyan",
            )}
          >
            {character.skillProficiencies.length} / {MAX_SKILLS}
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {Object.entries(skillsByAbility).map(([ability, abilitySkills]) => (
            <Card key={ability} className="bg-card border-2 border-border min-w-0 overflow-hidden">
              <CardHeader className="pb-2 px-3 sm:px-4">
                <CardTitle className="text-sm font-bold text-fey-purple">{ability}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-3 sm:px-4">
                {abilitySkills.map((skill) => {
                  const isSelected = character.skillProficiencies.includes(skill.name)
                  const isDisabled = !isSelected && character.skillProficiencies.length >= MAX_SKILLS

                  return (
                    <div
                      key={skill.name}
                      className={cn(
                        "flex items-center gap-2 sm:gap-3 p-2 rounded-lg transition-colors cursor-pointer min-w-0 overflow-hidden",
                        isSelected && "bg-fey-cyan/10",
                        isDisabled && "opacity-50 cursor-not-allowed",
                      )}
                      onClick={() => !isDisabled && toggleSkill(skill.name)}
                    >
                      <Checkbox
                        checked={isSelected}
                        disabled={isDisabled}
                        className="data-[state=checked]:bg-fey-cyan data-[state=checked]:border-fey-cyan border-foreground/50 shrink-0"
                      />
                      <span
                        className={cn(
                          "text-sm truncate",
                          isSelected ? "text-foreground font-medium" : "text-foreground/80",
                        )}
                      >
                        {skill.name}
                      </span>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Languages */}
      <div className="space-y-4">
        <Label className="text-lg font-semibold flex items-center gap-2 text-foreground">
          <Sparkles className="h-4 w-4 text-fey-gold shrink-0" />
          Languages
        </Label>

        <div className="flex flex-wrap gap-2 mb-3 overflow-hidden">
          {character.languages.map((lang) => (
            <Badge
              key={lang}
              variant="secondary"
              className="px-3 py-1 bg-secondary text-foreground flex items-center gap-2 max-w-full"
            >
              <span className="truncate">{lang}</span>
              {lang !== "Common" && (
                <button onClick={() => removeLanguage(lang)} className="hover:text-destructive shrink-0">
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>

        <div className="flex gap-2">
          <Select onValueChange={addLanguage}>
            <SelectTrigger className="w-full sm:max-w-xs bg-card border-2 border-border focus:border-fey-cyan">
              <SelectValue placeholder="Add a language..." />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {languages
                .filter((l) => !character.languages.includes(l))
                .map((lang) => (
                  <SelectItem key={lang} value={lang}>
                    {lang}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tool Proficiencies */}
      <div className="space-y-4">
        <Label className="text-lg font-semibold flex items-center gap-2 text-foreground">
          <Sparkles className="h-4 w-4 text-fey-purple shrink-0" />
          Tool Proficiencies
        </Label>

        <div className="flex flex-wrap gap-2 mb-3 overflow-hidden">
          {character.toolProficiencies.map((tool) => (
            <Badge
              key={tool}
              variant="secondary"
              className="px-3 py-1 bg-fey-purple/20 text-fey-purple font-medium border border-fey-purple/30 flex items-center gap-2 max-w-full"
            >
              <span className="truncate">{tool}</span>
              <button onClick={() => removeTool(tool)} className="hover:text-destructive shrink-0">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {character.toolProficiencies.length === 0 && (
            <span className="text-sm text-foreground/70 italic">No tools selected</span>
          )}
        </div>

        <div className="flex gap-2">
          <Select onValueChange={addTool}>
            <SelectTrigger className="w-full sm:max-w-xs bg-card border-2 border-border focus:border-fey-cyan">
              <SelectValue placeholder="Add a tool proficiency..." />
            </SelectTrigger>
            <SelectContent className="bg-card border-border max-h-60">
              {toolProficiencies
                .filter((t) => !character.toolProficiencies.includes(t))
                .map((tool) => (
                  <SelectItem key={tool} value={tool}>
                    {tool}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
