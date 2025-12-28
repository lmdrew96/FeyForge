"use client"

import type React from "react"

import { useState } from "react"
import { useCharacterStore } from "@/lib/character-store"
import { races, classes, backgrounds, alignments } from "@/lib/character-data"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import {
  Check,
  ChevronDown,
  User,
  Sparkles,
  Footprints,
  Ruler,
  Heart,
  Zap,
  Shield,
  Swords,
  Axe,
  Music,
  Leaf,
  Hand,
  Cross,
  Target,
  Sword,
  Flame,
  Eye,
  BookOpen,
  Wrench,
  Languages,
} from "lucide-react"

const classIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  Axe,
  Music,
  Sparkles,
  Leaf,
  Shield,
  Hand,
  Cross,
  Target,
  Sword,
  Flame,
  Eye,
  BookOpen,
}

export function StepBasics() {
  const { character, updateCharacter } = useCharacterStore()
  const [expandedRace, setExpandedRace] = useState<string | null>(null)
  const [expandedClass, setExpandedClass] = useState<string | null>(null)
  const [expandedBackground, setExpandedBackground] = useState<string | null>(null)

  const selectedRace = races.find((r) => r.value === character.race)

  return (
    <div className="space-y-8 min-w-0">
      {/* Character Name */}
      <div className="space-y-3">
        <Label htmlFor="name" className="text-lg font-semibold flex items-center gap-2 text-foreground">
          <Sparkles className="h-4 w-4 text-fey-gold shrink-0" />
          Character Name
        </Label>
        <Input
          id="name"
          placeholder="Enter your hero's name..."
          value={character.name}
          onChange={(e) => updateCharacter({ name: e.target.value })}
          className="h-12 text-lg bg-card border-2 border-border focus:border-fey-cyan transition-colors"
        />
      </div>

      {/* Race Selection - existing collapsible list */}
      <div className="space-y-3">
        <Label className="text-lg font-semibold flex items-center gap-2 text-foreground">
          <Sparkles className="h-4 w-4 text-fey-cyan shrink-0" />
          Race
        </Label>
        <div className="space-y-2">
          {races.map((race) => {
            const isSelected = character.race === race.value
            const isExpanded = expandedRace === race.value

            return (
              <Collapsible
                key={race.value}
                open={isExpanded}
                onOpenChange={(open) => setExpandedRace(open ? race.value : null)}
              >
                <div
                  className={cn(
                    "rounded-lg border-2 transition-all duration-200 overflow-hidden",
                    isSelected ? "border-fey-cyan bg-fey-cyan/10" : "border-border bg-card hover:border-fey-purple/50",
                  )}
                >
                  <div className="flex items-center min-w-0">
                    <button
                      onClick={() => {
                        updateCharacter({ race: race.value, subrace: "" })
                        if (!isExpanded) setExpandedRace(race.value)
                      }}
                      className="flex-1 flex items-center gap-2 sm:gap-3 p-3 sm:p-4 text-left min-w-0 overflow-hidden"
                    >
                      <div
                        className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0",
                          isSelected ? "border-fey-cyan bg-fey-cyan" : "border-foreground/50",
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3 text-background" />}
                      </div>
                      <span className="font-medium text-foreground truncate">{race.label}</span>
                      {race.subraces.length > 0 && (
                        <span className="text-xs text-foreground/70 shrink-0">({race.subraces.length})</span>
                      )}
                    </button>
                    <CollapsibleTrigger asChild>
                      <button className="p-3 sm:p-4 hover:bg-secondary/50 transition-colors shrink-0">
                        <ChevronDown
                          className={cn(
                            "h-5 w-5 text-foreground/60 transition-transform duration-200",
                            isExpanded && "rotate-180",
                          )}
                        />
                      </button>
                    </CollapsibleTrigger>
                  </div>

                  <CollapsibleContent>
                    <div className="px-3 sm:px-4 pb-4 pt-2 border-t border-border/50 space-y-4 overflow-hidden">
                      <p className="text-sm text-foreground/80 italic break-words">{race.description}</p>
                      <div className="flex flex-wrap gap-3 sm:gap-4 text-sm">
                        <div className="flex items-center gap-1.5 text-fey-sage dark:text-fey-sage">
                          <Footprints className="h-4 w-4 shrink-0" />
                          <span className="font-medium">{race.speed} ft</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-fey-purple">
                          <Ruler className="h-4 w-4 shrink-0" />
                          <span className="font-medium">{race.size}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <span className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">
                          Racial Traits
                        </span>
                        <div className="flex flex-wrap gap-1.5 sm:gap-2 overflow-hidden">
                          {race.traits.map((trait) => (
                            <span
                              key={trait}
                              className="px-2 py-1 text-xs rounded-full bg-fey-cyan/15 text-fey-cyan font-medium border border-fey-cyan/30 max-w-full truncate"
                            >
                              {trait}
                            </span>
                          ))}
                        </div>
                      </div>
                      {race.subraces.length > 0 && isSelected && (
                        <div className="space-y-2">
                          <span className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">
                            Choose Subrace
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {race.subraces.map((subrace) => (
                              <button
                                key={subrace}
                                onClick={() => updateCharacter({ subrace })}
                                className={cn(
                                  "px-3 py-1.5 text-sm rounded-lg border-2 transition-all font-medium truncate max-w-full",
                                  character.subrace === subrace
                                    ? "border-fey-gold bg-fey-gold/15 text-fey-gold"
                                    : "border-border hover:border-fey-purple/50 text-foreground",
                                )}
                              >
                                {subrace}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )
          })}
        </div>
      </div>

      {/* Class Selection - existing collapsible list */}
      <div className="space-y-3">
        <Label className="text-lg font-semibold flex items-center gap-2 text-foreground">
          <Sparkles className="h-4 w-4 text-fey-purple shrink-0" />
          Class
        </Label>
        <div className="space-y-2">
          {classes.map((cls) => {
            const isSelected = character.characterClass === cls.value
            const isExpanded = expandedClass === cls.value
            const Icon = classIcons[cls.icon] || User // Default to User icon if not found

            return (
              <Collapsible
                key={cls.value}
                open={isExpanded}
                onOpenChange={(open) => setExpandedClass(open ? cls.value : null)}
              >
                <div
                  className={cn(
                    "rounded-lg border-2 transition-all duration-200 overflow-hidden",
                    isSelected
                      ? "border-fey-purple bg-fey-purple/10"
                      : "border-border bg-card hover:border-fey-cyan/50",
                  )}
                >
                  <div className="flex items-center min-w-0">
                    <button
                      onClick={() => {
                        updateCharacter({ characterClass: cls.value })
                        if (!isExpanded) setExpandedClass(cls.value)
                      }}
                      className="flex-1 flex items-center gap-2 sm:gap-3 p-3 sm:p-4 text-left min-w-0 overflow-hidden"
                    >
                      <div
                        className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0",
                          isSelected ? "border-fey-purple bg-fey-purple" : "border-foreground/50",
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3 text-background" />}
                      </div>
                      <Icon className="h-5 w-5 text-fey-purple shrink-0" />
                      <span className="font-medium text-foreground truncate">{cls.label}</span>
                      <span className="text-xs text-foreground/70 ml-auto mr-2 shrink-0">{cls.hitDie}</span>
                    </button>
                    <CollapsibleTrigger asChild>
                      <button className="p-3 sm:p-4 hover:bg-secondary/50 transition-colors shrink-0">
                        <ChevronDown
                          className={cn(
                            "h-5 w-5 text-foreground/60 transition-transform duration-200",
                            isExpanded && "rotate-180",
                          )}
                        />
                      </button>
                    </CollapsibleTrigger>
                  </div>

                  <CollapsibleContent>
                    <div className="px-3 sm:px-4 pb-4 pt-2 border-t border-border/50 space-y-4 overflow-hidden">
                      <p className="text-sm text-foreground/80 italic break-words">{cls.description}</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Heart className="h-4 w-4 text-red-500 dark:text-red-400 shrink-0" />
                          <span className="text-foreground/70">Hit Die:</span>
                          <span className="font-medium text-foreground">{cls.hitDie}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <Zap className="h-4 w-4 text-fey-gold shrink-0 mt-0.5" />
                          <span className="text-foreground/70 shrink-0">Primary:</span>
                          <span className="font-medium text-foreground break-words">{cls.primaryAbility}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-fey-sage shrink-0" />
                          <span className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">
                            Saving Throws
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                          {cls.savingThrows.map((save) => (
                            <span
                              key={save}
                              className="px-2 py-1 text-xs rounded-full bg-fey-sage/15 text-fey-forest dark:text-fey-sage font-medium border border-fey-sage/30"
                            >
                              {save}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Swords className="h-4 w-4 text-fey-purple shrink-0" />
                          <span className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">
                            Proficiencies
                          </span>
                        </div>
                        <p className="text-sm text-foreground/80 break-words">{cls.armorWeapons}</p>
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )
          })}
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-lg font-semibold flex items-center gap-2 text-foreground">
          <BookOpen className="h-4 w-4 text-fey-gold shrink-0" />
          Background
        </Label>
        <div className="space-y-2">
          {backgrounds.map((bg) => {
            const isSelected = character.background === bg.value
            const isExpanded = expandedBackground === bg.value

            return (
              <Collapsible
                key={bg.value}
                open={isExpanded}
                onOpenChange={(open) => setExpandedBackground(open ? bg.value : null)}
              >
                <div
                  className={cn(
                    "rounded-lg border-2 transition-all duration-200 overflow-hidden",
                    isSelected ? "border-fey-gold bg-fey-gold/10" : "border-border bg-card hover:border-fey-cyan/50",
                  )}
                >
                  <div className="flex items-center min-w-0">
                    <button
                      onClick={() => {
                        updateCharacter({ background: bg.value })
                        if (!isExpanded) setExpandedBackground(bg.value)
                      }}
                      className="flex-1 flex items-center gap-2 sm:gap-3 p-3 sm:p-4 text-left min-w-0 overflow-hidden"
                    >
                      <div
                        className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0",
                          isSelected ? "border-fey-gold bg-fey-gold" : "border-foreground/50",
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3 text-background" />}
                      </div>
                      <span className="font-medium text-foreground truncate min-w-0">{bg.label}</span>
                      <span className="text-xs text-foreground/70 ml-auto mr-2 shrink-0 hidden xs:inline truncate max-w-[100px] sm:max-w-none">
                        {bg.feature}
                      </span>
                    </button>
                    <CollapsibleTrigger asChild>
                      <button className="p-3 sm:p-4 hover:bg-secondary/50 transition-colors shrink-0">
                        <ChevronDown
                          className={cn(
                            "h-5 w-5 text-foreground/60 transition-transform duration-200",
                            isExpanded && "rotate-180",
                          )}
                        />
                      </button>
                    </CollapsibleTrigger>
                  </div>

                  <CollapsibleContent>
                    <div className="px-3 sm:px-4 pb-4 pt-2 border-t border-border/50 space-y-4 overflow-hidden">
                      <p className="text-sm text-foreground/80 italic break-words">{bg.description}</p>

                      {/* Skill Proficiencies */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-fey-cyan shrink-0" />
                          <span className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">
                            Skill Proficiencies
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                          {bg.skillProficiencies.map((skill) => (
                            <span
                              key={skill}
                              className="px-2 py-1 text-xs rounded-full bg-fey-cyan/15 text-fey-cyan font-medium border border-fey-cyan/30 max-w-full truncate"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Tool Proficiencies (if any) */}
                      {bg.toolProficiencies && bg.toolProficiencies.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Wrench className="h-4 w-4 text-fey-purple shrink-0" />
                            <span className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">
                              Tool Proficiencies
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            {bg.toolProficiencies.map((tool) => (
                              <span
                                key={tool}
                                className="px-2 py-1 text-xs rounded-full bg-fey-purple/15 text-fey-purple font-medium border border-fey-purple/30 max-w-full truncate"
                              >
                                {tool}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Languages (if any) */}
                      {bg.languages && bg.languages > 0 && (
                        <div className="flex items-center gap-2 text-sm flex-wrap">
                          <Languages className="h-4 w-4 text-fey-sage shrink-0" />
                          <span className="text-foreground/70">Languages:</span>
                          <span className="font-medium text-foreground">{bg.languages} of your choice</span>
                        </div>
                      )}

                      {/* Equipment */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Swords className="h-4 w-4 text-fey-gold shrink-0" />
                          <span className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">
                            Equipment
                          </span>
                        </div>
                        <p className="text-sm text-foreground/80 break-words">{bg.equipment}</p>
                      </div>

                      {/* Feature */}
                      <div className="p-3 rounded-lg bg-secondary/50 border border-border overflow-hidden">
                        <span className="text-xs font-semibold uppercase tracking-wide text-foreground break-words">
                          Feature: {bg.feature}
                        </span>
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )
          })}
        </div>
      </div>

      {/* Alignment - keeping as grid since it's a simple 3x3 matrix */}
      <div className="space-y-4">
        <Label className="text-lg font-semibold text-foreground">Alignment</Label>
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 max-w-md w-full">
          {alignments.map((row, rowIndex) =>
            row.map((alignment) => (
              <button
                key={alignment}
                onClick={() => updateCharacter({ alignment })}
                className={cn(
                  "p-1.5 sm:p-2 md:p-3 text-[10px] sm:text-xs md:text-sm rounded-lg border-2 transition-all duration-200 font-medium truncate",
                  character.alignment === alignment
                    ? "border-fey-gold bg-fey-gold/15 text-fey-gold"
                    : "border-border bg-card text-foreground hover:border-fey-purple/50",
                  rowIndex === 0 && character.alignment !== alignment && "text-fey-forest dark:text-fey-sage",
                  rowIndex === 2 && character.alignment !== alignment && "text-fey-purple dark:text-fey-purple",
                )}
              >
                {alignment}
              </button>
            )),
          )}
        </div>
      </div>
    </div>
  )
}
