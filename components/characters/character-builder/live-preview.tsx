"use client"

/**
 * Live Preview Panel
 * Shows real-time character stats during creation
 */

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Shield, 
  Heart, 
  Zap, 
  Footprints,
  Swords,
  Eye,
  Star,
} from "lucide-react"
import type { CharacterCreationData } from "@/lib/character/types"
import type { Open5eRace, Open5eClass } from "@/lib/open5e-api"
import { 
  ABILITIES, 
  ABILITY_ABBREVIATIONS,
  getAbilityModifier, 
  formatModifier,
  getProficiencyBonus,
  CLASS_HIT_DICE,
  SKILL_DISPLAY_NAMES,
} from "@/lib/character/constants"
import type { Ability, Skill } from "@/lib/character/constants"

interface LivePreviewProps {
  data: CharacterCreationData
  raceData: Open5eRace | null
  classData: Open5eClass | null
}

export function LivePreview({ data, raceData, classData }: LivePreviewProps) {
  // Calculate final ability scores with racial bonuses
  const finalAbilities = useMemo(() => {
    const result: Record<Ability, number> = {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    }
    
    for (const ability of ABILITIES) {
      const base = data.baseAbilities?.[ability] ?? 10
      const racial = data.racialBonuses?.[ability] ?? 0
      result[ability] = base + racial
    }
    
    return result
  }, [data.baseAbilities, data.racialBonuses])

  // Calculate modifiers
  const modifiers = useMemo(() => {
    const result: Record<Ability, number> = {} as Record<Ability, number>
    for (const ability of ABILITIES) {
      result[ability] = getAbilityModifier(finalAbilities[ability])
    }
    return result
  }, [finalAbilities])

  // Calculate combat stats
  const stats = useMemo(() => {
    const level = 1 // Always level 1 during creation
    const profBonus = getProficiencyBonus(level)
    const conMod = modifiers.constitution
    const dexMod = modifiers.dexterity
    const wisMod = modifiers.wisdom
    
    // Hit die from class
    const className = data.class?.toLowerCase() || "fighter"
    const hitDie = CLASS_HIT_DICE[className] || 10
    
    // Max HP at level 1
    const maxHP = hitDie + conMod
    
    // Base AC (no armor)
    const baseAC = 10 + dexMod
    
    // Speed from race
    const speed = raceData?.speed?.walk || 30
    
    // Initiative
    const initiative = dexMod
    
    // Passive perception
    const perceptionProf = data.skillProficiencies?.includes("perception" as Skill)
    const passivePerception = 10 + wisMod + (perceptionProf ? profBonus : 0)
    
    return {
      level,
      profBonus,
      maxHP,
      baseAC,
      speed,
      initiative,
      passivePerception,
      hitDie,
    }
  }, [data.class, data.skillProficiencies, modifiers, raceData])

  // Get features preview
  const features = useMemo(() => {
    const featureList: string[] = []
    
    // Racial traits
    if (raceData?.traits) {
      // Parse traits string or use array
      if (typeof raceData.traits === "string") {
        // Extract trait names (usually in bold or headers)
        const traitMatches = raceData.traits.match(/\*\*([^*]+)\*\*/g)
        if (traitMatches) {
          featureList.push(...traitMatches.map(t => t.replace(/\*\*/g, "")).slice(0, 4))
        }
      }
    }
    
    // Add racial vision if applicable
    if (raceData?.vision) {
      featureList.push(raceData.vision)
    }
    
    return featureList
  }, [raceData])

  const hasData = data.race || data.class

  return (
    <Card className="bg-card/50 border-primary/20 h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-serif flex items-center gap-2">
          <Eye className="h-4 w-4 text-primary" />
          Character Preview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[calc(100vh-280px)]">
          {!hasData ? (
            <div className="text-center text-muted-foreground py-8">
              <p className="text-sm">Select a race and class to see your character preview</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Character Summary */}
              <div className="text-center pb-2">
                <h3 className="font-medium text-lg">
                  {data.name || "Unnamed Hero"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Level {stats.level} {data.subrace || data.race || "?"} {data.class || "?"}
                </p>
                {data.background && (
                  <Badge variant="outline" className="mt-1">
                    {data.background}
                  </Badge>
                )}
              </div>

              <Separator />

              {/* Combat Stats */}
              <div className="grid grid-cols-2 gap-2">
                <StatBox 
                  icon={<Heart className="h-4 w-4 text-red-500" />}
                  label="HP"
                  value={Math.max(1, stats.maxHP)}
                />
                <StatBox 
                  icon={<Shield className="h-4 w-4 text-blue-500" />}
                  label="AC"
                  value={stats.baseAC}
                  note="unarmored"
                />
                <StatBox 
                  icon={<Zap className="h-4 w-4 text-yellow-500" />}
                  label="Initiative"
                  value={formatModifier(stats.initiative)}
                />
                <StatBox 
                  icon={<Footprints className="h-4 w-4 text-green-500" />}
                  label="Speed"
                  value={`${stats.speed}ft`}
                />
              </div>

              <Separator />

              {/* Ability Scores */}
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                  <Swords className="h-3 w-3" />
                  Ability Scores
                </h4>
                <div className="grid grid-cols-3 gap-1.5">
                  {ABILITIES.map((ability) => (
                    <div
                      key={ability}
                      className="bg-muted/50 rounded p-1.5 text-center"
                    >
                      <div className="text-[10px] text-muted-foreground uppercase">
                        {ABILITY_ABBREVIATIONS[ability]}
                      </div>
                      <div className="text-sm font-bold">
                        {finalAbilities[ability]}
                      </div>
                      <div className="text-xs text-primary">
                        {formatModifier(modifiers[ability])}
                      </div>
                      {(data.racialBonuses?.[ability] ?? 0) > 0 && (
                        <div className="text-[9px] text-green-500">
                          +{data.racialBonuses![ability]}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Proficiency & Other Stats */}
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Proficiency Bonus</span>
                  <span className="font-medium">{formatModifier(stats.profBonus)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Hit Die</span>
                  <span className="font-medium">1d{stats.hitDie}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Passive Perception</span>
                  <span className="font-medium">{stats.passivePerception}</span>
                </div>
              </div>

              {/* Skills */}
              {data.skillProficiencies && data.skillProficiencies.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium mb-2">Skill Proficiencies</h4>
                    <div className="flex flex-wrap gap-1">
                      {data.skillProficiencies.map((skill) => (
                        <Badge key={skill} variant="secondary" className="text-xs">
                          {SKILL_DISPLAY_NAMES[skill as Skill] || skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Features Preview */}
              {features.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                      <Star className="h-3 w-3" />
                      Racial Traits
                    </h4>
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      {features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-1">
                          <span className="text-primary">•</span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

              {/* Languages */}
              {data.languages && data.languages.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium mb-1">Languages</h4>
                    <p className="text-xs text-muted-foreground">
                      {data.languages.join(", ")}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

interface StatBoxProps {
  icon: React.ReactNode
  label: string
  value: string | number
  note?: string
}

function StatBox({ icon, label, value, note }: StatBoxProps) {
  return (
    <div className="bg-muted/50 rounded-lg p-2 text-center">
      <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
        {icon}
        <span className="text-[10px] uppercase">{label}</span>
      </div>
      <div className="text-lg font-bold">{value}</div>
      {note && <div className="text-[9px] text-muted-foreground">{note}</div>}
    </div>
  )
}
