"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  races,
  classes,
  backgrounds,
  abilities,
  skills,
  calculateModifier,
  formatModifier,
  type Character,
} from "@/lib/dnd-data"
import { useCharacterStore } from "@/lib/character-store"
import { Heart, Shield, Zap, Footprints, Edit2, Save, Dices } from "lucide-react"
import { useState } from "react"

interface CharacterSheetProps {
  character: Character
}

export function CharacterSheet({ character }: CharacterSheetProps) {
  const updateCharacter = useCharacterStore((state) => state.updateCharacter)
  const [editingHP, setEditingHP] = useState(false)
  const [tempHP, setTempHP] = useState(character.hitPoints.current.toString())

  const race = races.find((r) => r.id === character.race)
  const charClass = classes.find((c) => c.id === character.class)
  const background = backgrounds.find((b) => b.id === character.background)

  const proficiencyBonus = Math.ceil(character.level / 4) + 1

  const handleHPSave = () => {
    const newHP = Number.parseInt(tempHP) || 0
    updateCharacter(character.id, {
      hitPoints: {
        ...character.hitPoints,
        current: Math.min(Math.max(0, newHP), character.hitPoints.max),
      },
    })
    setEditingHP(false)
  }

  const hpPercentage = (character.hitPoints.current / character.hitPoints.max) * 100

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-card border-border border-glow">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="font-serif text-3xl font-bold text-gold-gradient">{character.name}</h1>
              <p className="text-muted-foreground mt-1">
                Level {character.level} {race?.name} {charClass?.name}
              </p>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className="border-border text-muted-foreground">
                  {background?.name}
                </Badge>
                <Badge variant="outline" className="border-border text-muted-foreground">
                  {character.alignment}
                </Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="border-border bg-transparent">
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button size="sm" className="bg-primary">
                <Dices className="h-4 w-4 mr-2" />
                Roll
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column - Combat Stats */}
        <div className="space-y-4">
          {/* HP */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Heart className="h-4 w-4 text-blood-red" />
                Hit Points
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                {editingHP ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={tempHP}
                      onChange={(e) => setTempHP(e.target.value)}
                      className="w-20 bg-input border-border"
                    />
                    <span className="text-muted-foreground">/ {character.hitPoints.max}</span>
                    <Button size="sm" onClick={handleHPSave}>
                      <Save className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <button onClick={() => setEditingHP(true)} className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-foreground">{character.hitPoints.current}</span>
                    <span className="text-muted-foreground">/ {character.hitPoints.max}</span>
                  </button>
                )}
              </div>
              <Progress value={hpPercentage} className="mt-3 h-2 bg-muted" />
              {character.hitPoints.temp > 0 && (
                <p className="text-xs text-primary mt-2">+{character.hitPoints.temp} Temp HP</p>
              )}
            </CardContent>
          </Card>

          {/* AC, Initiative, Speed */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-card border-border">
              <CardContent className="p-4 text-center">
                <Shield className="h-5 w-5 mx-auto text-primary" />
                <p className="text-2xl font-bold text-foreground mt-2">{character.armorClass}</p>
                <p className="text-xs text-muted-foreground">AC</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4 text-center">
                <Zap className="h-5 w-5 mx-auto text-primary" />
                <p className="text-2xl font-bold text-foreground mt-2">{formatModifier(character.initiative)}</p>
                <p className="text-xs text-muted-foreground">Initiative</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4 text-center">
                <Footprints className="h-5 w-5 mx-auto text-primary" />
                <p className="text-2xl font-bold text-foreground mt-2">{character.speed}</p>
                <p className="text-xs text-muted-foreground">Speed</p>
              </CardContent>
            </Card>
          </div>

          {/* Proficiency Bonus */}
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center justify-between">
              <span className="text-muted-foreground">Proficiency Bonus</span>
              <span className="text-2xl font-bold text-primary">+{proficiencyBonus}</span>
            </CardContent>
          </Card>
        </div>

        {/* Middle Column - Ability Scores */}
        <div className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-serif text-foreground">Ability Scores</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {abilities.map((ability) => {
                const score = character.abilityScores[ability.id as keyof typeof character.abilityScores]
                const mod = calculateModifier(score)
                return (
                  <div key={ability.id} className="p-3 rounded-lg border border-border bg-accent/30 text-center">
                    <p className="text-xs text-muted-foreground font-medium">{ability.abbr}</p>
                    <p className="text-2xl font-bold text-gold-gradient">{formatModifier(mod)}</p>
                    <p className="text-sm text-muted-foreground">{score}</p>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Saving Throws */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-serif text-foreground">Saving Throws</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {abilities.map((ability) => {
                const score = character.abilityScores[ability.id as keyof typeof character.abilityScores]
                const mod = calculateModifier(score)
                const isProficient = charClass?.savingThrows.includes(ability.id)
                const totalMod = isProficient ? mod + proficiencyBonus : mod
                return (
                  <div key={ability.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3 h-3 rounded-full border ${isProficient ? "bg-primary border-primary" : "border-border"}`}
                      />
                      <span className="text-sm text-foreground">{ability.name}</span>
                    </div>
                    <span className={`font-medium ${isProficient ? "text-primary" : "text-muted-foreground"}`}>
                      {formatModifier(totalMod)}
                    </span>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Skills */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-serif text-foreground">Skills</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {skills.map((skill) => {
              const abilityScore = character.abilityScores[skill.ability as keyof typeof character.abilityScores]
              const mod = calculateModifier(abilityScore)
              const isProficient = character.proficiencies.includes(skill.id)
              const totalMod = isProficient ? mod + proficiencyBonus : mod
              const abilityAbbr = abilities.find((a) => a.id === skill.ability)?.abbr

              return (
                <div key={skill.id} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2.5 h-2.5 rounded-full border ${isProficient ? "bg-primary border-primary" : "border-border"}`}
                    />
                    <span className="text-sm text-foreground">{skill.name}</span>
                    <span className="text-xs text-muted-foreground">({abilityAbbr})</span>
                  </div>
                  <span className={`text-sm font-medium ${isProficient ? "text-primary" : "text-muted-foreground"}`}>
                    {formatModifier(totalMod)}
                  </span>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row - Features & Traits */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-serif text-foreground">Features & Traits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {character.features.map((feature) => (
                <Badge key={feature} variant="outline" className="border-primary/50 text-foreground">
                  {feature}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-serif text-foreground">Personality</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {character.personalityTraits && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Traits</p>
                <p className="text-sm text-foreground">{character.personalityTraits}</p>
              </div>
            )}
            {character.ideals && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Ideals</p>
                <p className="text-sm text-foreground">{character.ideals}</p>
              </div>
            )}
            {character.bonds && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Bonds</p>
                <p className="text-sm text-foreground">{character.bonds}</p>
              </div>
            )}
            {character.flaws && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Flaws</p>
                <p className="text-sm text-foreground">{character.flaws}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
