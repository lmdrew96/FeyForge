"use client"

import type React from "react"

import { useCharacterStore } from "@/lib/character-store"
import { abilities, standardArray, races, subraces } from "@/lib/character-data"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { Minus, Plus, Sparkles, RefreshCw } from "lucide-react"

const POINT_BUY_COSTS: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
}

function getModifier(score: number): string {
  const mod = Math.floor((score - 10) / 2)
  return mod >= 0 ? `+${mod}` : `${mod}`
}

function getRacialBonuses(raceValue: string, subraceValue: string): Record<string, number> {
  const bonuses: Record<string, number> = {}

  const race = races.find((r) => r.value === raceValue)
  if (race?.abilityBonuses) {
    for (const [ability, bonus] of Object.entries(race.abilityBonuses)) {
      bonuses[ability] = (bonuses[ability] || 0) + bonus
    }
  }

  // Add subrace bonuses
  const raceSubraces = subraces[raceValue]
  if (raceSubraces && subraceValue) {
    const subrace = raceSubraces.find((s) => s.label === subraceValue)
    if (subrace?.abilityBonuses) {
      for (const [ability, bonus] of Object.entries(subrace.abilityBonuses)) {
        bonuses[ability] = (bonuses[ability] || 0) + bonus
      }
    }
  }

  return bonuses
}

export function StepAbilities() {
  const { character, updateCharacter } = useCharacterStore()

  const racialBonuses = getRacialBonuses(character.race, character.subrace)

  const calculatePointsUsed = () => {
    return Object.values(character.abilities).reduce((total, score) => {
      return total + (POINT_BUY_COSTS[score] || 0)
    }, 0)
  }

  const pointsUsed = calculatePointsUsed()
  const pointsRemaining = 27 - pointsUsed

  const updateAbility = (ability: keyof typeof character.abilities, delta: number) => {
    const currentValue = character.abilities[ability]
    const newValue = currentValue + delta

    if (newValue < 8 || newValue > 15) return
    if (delta > 0 && pointsRemaining <= 0) return

    const newCost = POINT_BUY_COSTS[newValue] - POINT_BUY_COSTS[currentValue]
    if (delta > 0 && newCost > pointsRemaining) return

    updateCharacter({
      abilities: {
        ...character.abilities,
        [ability]: newValue,
      },
    })
  }

  const setAbility = (ability: keyof typeof character.abilities, value: number) => {
    updateCharacter({
      abilities: {
        ...character.abilities,
        [ability]: Math.max(1, Math.min(20, value)),
      },
    })
  }

  const resetAbilities = () => {
    updateCharacter({
      abilities: {
        strength: 8,
        dexterity: 8,
        constitution: 8,
        intelligence: 8,
        wisdom: 8,
        charisma: 8,
      },
    })
  }

  const assignStandardArray = (abilityKey: string, value: number) => {
    const currentAbilityWithValue = Object.entries(character.abilities).find(([, v]) => v === value)?.[0]

    if (currentAbilityWithValue && currentAbilityWithValue !== abilityKey) {
      const currentValue = character.abilities[abilityKey as keyof typeof character.abilities]
      updateCharacter({
        abilities: {
          ...character.abilities,
          [abilityKey]: value,
          [currentAbilityWithValue]: currentValue,
        },
      })
    } else {
      updateCharacter({
        abilities: {
          ...character.abilities,
          [abilityKey]: value,
        },
      })
    }
  }

  const AbilityCard = ({
    ability,
    children,
  }: {
    ability: { key: string; label: string; abbr: string }
    children: React.ReactNode
  }) => {
    const baseScore = character.abilities[ability.key as keyof typeof character.abilities]
    const racialBonus = racialBonuses[ability.key] || 0
    const finalScore = baseScore + racialBonus

    return (
      <Card className="bg-card border-2 border-border">
        <CardContent className="p-4 text-center">
          <div className="text-xs font-bold text-fey-purple uppercase tracking-wide mb-1">{ability.abbr}</div>
          

          {children}

          {racialBonus > 0 && <div className="mt-2 text-xs text-fey-cyan font-semibold">+{racialBonus} racial</div>}

          <div className="mt-2 pt-2 border-t border-border">
            <div className="flex items-center justify-center gap-2">
              <span className="text-xs text-foreground/70 font-medium">Final:</span>
              <span className="text-xl font-bold text-foreground">{finalScore}</span>
            </div>
            <div className="text-lg font-semibold text-fey-gold">{getModifier(finalScore)}</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {character.race && (
        <div className="p-3 bg-fey-cyan/10 border border-fey-cyan/30 rounded-lg overflow-hidden">
          <p className="text-sm text-foreground break-words">
            <span className="font-medium">Selected Race:</span>{" "}
            <span className="text-fey-cyan font-semibold">
              {races.find((r) => r.value === character.race)?.label}
              {character.subrace && ` (${character.subrace})`}
            </span>
            {Object.keys(racialBonuses).length > 0 && (
              <span className="block sm:inline sm:ml-2 text-foreground/80 mt-1 sm:mt-0">
                — Bonuses:{" "}
                {Object.entries(racialBonuses)
                  .map(
                    ([ability, bonus]) =>
                      `+${bonus} ${ability.charAt(0).toUpperCase() + ability.slice(1, 3).toUpperCase()}`,
                  )
                  .join(", ")}
              </span>
            )}
          </p>
        </div>
      )}

      <Tabs
        value={character.abilityMethod}
        onValueChange={(value) => updateCharacter({ abilityMethod: value as typeof character.abilityMethod })}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3 bg-secondary h-auto p-1">
          <TabsTrigger
            value="pointBuy"
            className="text-[10px] sm:text-sm py-2 px-1 sm:px-3 data-[state=active]:bg-fey-cyan data-[state=active]:text-accent-foreground"
          >
            Point Buy
          </TabsTrigger>
          <TabsTrigger
            value="standardArray"
            className="text-[10px] sm:text-sm py-2 px-1 sm:px-3 data-[state=active]:bg-fey-cyan data-[state=active]:text-accent-foreground"
          >
            Standard
          </TabsTrigger>
          <TabsTrigger
            value="manual"
            className="text-[10px] sm:text-sm py-2 px-1 sm:px-3 data-[state=active]:bg-fey-cyan data-[state=active]:text-accent-foreground"
          >
            Manual
          </TabsTrigger>
        </TabsList>

        {/* Point Buy */}
        <TabsContent value="pointBuy" className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6 p-3 sm:p-4 bg-secondary/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-fey-gold flex-shrink-0" />
              <span className="font-semibold text-foreground text-sm sm:text-base">Points:</span>
              <span
                className={cn(
                  "font-bold text-xl sm:text-2xl",
                  pointsRemaining > 5 ? "text-fey-cyan" : pointsRemaining > 0 ? "text-fey-gold" : "text-destructive",
                )}
              >
                {pointsRemaining}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={resetAbilities}
              className="border-border hover:border-fey-purple bg-transparent"
            >
              <RefreshCw className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Reset</span>
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
            {abilities.map((ability) => {
              const score = character.abilities[ability.key as keyof typeof character.abilities]
              return (
                <AbilityCard key={ability.key} ability={ability}>
                  <div className="flex items-center justify-center gap-1 sm:gap-2 mb-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 sm:h-8 sm:w-8 border-border hover:border-fey-cyan hover:bg-fey-cyan/10 bg-transparent"
                      onClick={() => updateAbility(ability.key as keyof typeof character.abilities, -1)}
                      disabled={score <= 8}
                    >
                      <Minus className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                    <div className="w-8 sm:w-12 text-center">
                      <div className="text-xl sm:text-2xl font-bold text-foreground/80">{score}</div>
                      <div className="text-[8px] sm:text-[10px] text-foreground/60 font-medium">base</div>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 sm:h-8 sm:w-8 border-border hover:border-fey-cyan hover:bg-fey-cyan/10 bg-transparent"
                      onClick={() => updateAbility(ability.key as keyof typeof character.abilities, 1)}
                      disabled={score >= 15 || pointsRemaining <= 0}
                    >
                      <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                  </div>
                  <div className="text-[10px] sm:text-xs text-foreground/70 font-medium">
                    Cost: {POINT_BUY_COSTS[score]}
                  </div>
                </AbilityCard>
              )
            })}
          </div>
        </TabsContent>

        {/* Standard Array */}
        <TabsContent value="standardArray" className="mt-6">
          <div className="mb-6 p-4 bg-secondary/50 rounded-lg">
            <p className="text-sm text-foreground/80">
              Assign these values to your abilities:{" "}
              <span className="font-semibold text-fey-cyan">{standardArray.join(", ")}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
            {abilities.map((ability) => {
              const score = character.abilities[ability.key as keyof typeof character.abilities]
              return (
                <AbilityCard key={ability.key} ability={ability}>
                  <select
                    value={score}
                    onChange={(e) => assignStandardArray(ability.key, Number.parseInt(e.target.value))}
                    className="w-full h-8 sm:h-10 text-center text-base sm:text-lg font-bold bg-secondary border-2 border-border rounded-lg focus:border-fey-cyan text-foreground"
                  >
                    {standardArray.map((val) => (
                      <option key={val} value={val}>
                        {val}
                      </option>
                    ))}
                  </select>
                  <div className="text-[8px] sm:text-[10px] text-foreground/60 font-medium mt-1">base</div>
                </AbilityCard>
              )
            })}
          </div>
        </TabsContent>

        {/* Manual Entry */}
        <TabsContent value="manual" className="mt-6">
          <div className="mb-6 p-4 bg-secondary/50 rounded-lg">
            <p className="text-sm text-foreground/80">Enter your base ability scores directly (1-20).</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
            {abilities.map((ability) => {
              const score = character.abilities[ability.key as keyof typeof character.abilities]
              return (
                <AbilityCard key={ability.key} ability={ability}>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={score}
                    onChange={(e) =>
                      setAbility(ability.key as keyof typeof character.abilities, Number.parseInt(e.target.value) || 8)
                    }
                    className="text-center text-base sm:text-lg font-bold h-8 sm:h-10 bg-secondary border-2 border-border focus:border-fey-cyan"
                  />
                  <div className="text-[8px] sm:text-[10px] text-foreground/60 font-medium mt-1">base</div>
                </AbilityCard>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
