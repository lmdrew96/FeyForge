"use client"

/**
 * Step 2: Ability Scores
 * Point buy, standard array, or roll for abilities
 */

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Dices, RotateCcw } from "lucide-react"
import type { CharacterCreationData, AbilityScores } from "@/lib/character/types"
import { 
  ABILITIES, 
  ABILITY_ABBREVIATIONS,
  STANDARD_ARRAY,
  POINT_BUY_COSTS,
  POINT_BUY_TOTAL,
  POINT_BUY_MIN,
  POINT_BUY_MAX,
  getAbilityModifier,
  formatModifier,
} from "@/lib/character/constants"
import type { Ability } from "@/lib/character/constants"

type AbilityMethod = "pointBuy" | "standardArray" | "roll" | "manual"

interface Step2AbilitiesProps {
  data: CharacterCreationData
  onUpdate: (updates: Partial<CharacterCreationData>) => void
  racialBonuses?: Partial<AbilityScores>
}

const ABILITY_DESCRIPTIONS: Record<Ability, string> = {
  strength: "Physical power, melee attacks",
  dexterity: "Agility, reflexes, ranged attacks",
  constitution: "Health, stamina, endurance",
  intelligence: "Knowledge, logic, arcane magic",
  wisdom: "Perception, insight, divine magic",
  charisma: "Force of personality, social skills",
}

export function Step2Abilities({ data, onUpdate, racialBonuses = {} }: Step2AbilitiesProps) {
  const [method, setMethod] = useState<AbilityMethod>(data.abilityScoreMethod || "pointBuy")
  const [standardArrayAssignments, setStandardArrayAssignments] = useState<Partial<Record<Ability, number>>>({})

  const abilities = data.baseAbilities || {
    strength: 8,
    dexterity: 8,
    constitution: 8,
    intelligence: 8,
    wisdom: 8,
    charisma: 8,
  }

  // Calculate point buy cost
  const pointBuySpent = useMemo(() => {
    return ABILITIES.reduce((total, ability) => {
      const score = abilities[ability] || 8
      return total + (POINT_BUY_COSTS[score] || 0)
    }, 0)
  }, [abilities])

  const pointBuyRemaining = POINT_BUY_TOTAL - pointBuySpent

  // Update a single ability score
  const updateAbility = (ability: Ability, value: number) => {
    onUpdate({
      baseAbilities: {
        ...abilities,
        [ability]: value,
      },
      abilityScoreMethod: method,
    })
  }

  // Handle point buy slider change
  const handlePointBuyChange = (ability: Ability, value: number) => {
    const currentScore = abilities[ability] || 8
    const currentCost = POINT_BUY_COSTS[currentScore] || 0
    const newCost = POINT_BUY_COSTS[value] || 0
    const costDiff = newCost - currentCost

    // Only allow if we have enough points or reducing
    if (pointBuyRemaining - costDiff >= 0 || value < currentScore) {
      updateAbility(ability, value)
    }
  }

  // Roll 4d6 drop lowest for all abilities
  const rollAbilities = () => {
    const rollStat = () => {
      const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1)
      rolls.sort((a, b) => b - a)
      return rolls.slice(0, 3).reduce((a, b) => a + b, 0)
    }

    const newAbilities: AbilityScores = {
      strength: rollStat(),
      dexterity: rollStat(),
      constitution: rollStat(),
      intelligence: rollStat(),
      wisdom: rollStat(),
      charisma: rollStat(),
    }

    onUpdate({
      baseAbilities: newAbilities,
      abilityScoreMethod: "roll",
    })
  }

  // Reset to default point buy values
  const resetAbilities = () => {
    onUpdate({
      baseAbilities: {
        strength: 8,
        dexterity: 8,
        constitution: 8,
        intelligence: 8,
        wisdom: 8,
        charisma: 8,
      },
      abilityScoreMethod: method,
    })
    setStandardArrayAssignments({})
  }

  // Handle standard array assignment
  const handleStandardArrayAssign = (ability: Ability, value: number) => {
    // Remove any existing assignment of this value
    const newAssignments = { ...standardArrayAssignments }
    for (const [key, val] of Object.entries(newAssignments)) {
      if (val === value) {
        delete newAssignments[key as Ability]
      }
    }
    newAssignments[ability] = value
    setStandardArrayAssignments(newAssignments)

    // Update abilities based on assignments
    const newAbilities: AbilityScores = {
      strength: newAssignments.strength || 8,
      dexterity: newAssignments.dexterity || 8,
      constitution: newAssignments.constitution || 8,
      intelligence: newAssignments.intelligence || 8,
      wisdom: newAssignments.wisdom || 8,
      charisma: newAssignments.charisma || 8,
    }

    onUpdate({
      baseAbilities: newAbilities,
      abilityScoreMethod: "standardArray",
    })
  }

  // Get available standard array values
  const availableStandardArray = useMemo(() => {
    const assigned = Object.values(standardArrayAssignments)
    return [...STANDARD_ARRAY].filter(v => !assigned.includes(v))
  }, [standardArrayAssignments])

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="font-serif text-2xl font-bold text-gold-gradient">Ability Scores</h2>
        <p className="text-muted-foreground mt-2">Define your character's capabilities</p>
      </div>

      {/* Method Selection */}
      <div className="flex justify-center gap-2 mb-6">
        <Button
          type="button"
          variant={method === "pointBuy" ? "default" : "outline"}
          onClick={() => {
            setMethod("pointBuy")
            resetAbilities()
          }}
          size="sm"
        >
          Point Buy
        </Button>
        <Button
          type="button"
          variant={method === "standardArray" ? "default" : "outline"}
          onClick={() => {
            setMethod("standardArray")
            resetAbilities()
          }}
          size="sm"
        >
          Standard Array
        </Button>
        <Button
          type="button"
          variant={method === "roll" ? "default" : "outline"}
          onClick={() => {
            setMethod("roll")
            rollAbilities()
          }}
          size="sm"
        >
          <Dices className="h-4 w-4 mr-1" />
          Roll
        </Button>
      </div>

      {/* Point Buy Remaining */}
      {method === "pointBuy" && (
        <div className="text-center mb-6">
          <Badge 
            variant={pointBuyRemaining > 0 ? "secondary" : pointBuyRemaining === 0 ? "default" : "destructive"}
            className="text-lg px-4 py-1"
          >
            {pointBuyRemaining} points remaining
          </Badge>
        </div>
      )}

      {/* Standard Array Values */}
      {method === "standardArray" && (
        <div className="text-center mb-6">
          <p className="text-sm text-muted-foreground mb-2">Assign these values to your abilities:</p>
          <div className="flex justify-center gap-2 flex-wrap">
            {[...STANDARD_ARRAY].map((val) => {
              const isAssigned = Object.values(standardArrayAssignments).includes(val)
              return (
                <Badge 
                  key={val}
                  variant={isAssigned ? "secondary" : "outline"}
                  className={isAssigned ? "opacity-50" : ""}
                >
                  {val}
                </Badge>
              )
            })}
          </div>
        </div>
      )}

      {/* Ability Scores Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ABILITIES.map((ability) => {
          const baseScore = abilities[ability] || 8
          const racialBonus = racialBonuses[ability] || 0
          const finalScore = baseScore + racialBonus
          const modifier = getAbilityModifier(finalScore)

          return (
            <div
              key={ability}
              className="p-4 rounded-lg border border-border bg-card hover:border-primary/50 transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <Label className="text-foreground font-bold uppercase text-sm">
                    {ABILITY_ABBREVIATIONS[ability]}
                  </Label>
                  <p className="text-xs text-muted-foreground capitalize">{ability}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-foreground">{finalScore}</p>
                  <p className="text-sm text-primary font-medium">
                    {formatModifier(modifier)}
                  </p>
                </div>
              </div>

              {/* Point Buy Slider */}
              {method === "pointBuy" && (
                <div className="space-y-2">
                  <Slider
                    value={[baseScore]}
                    min={POINT_BUY_MIN}
                    max={POINT_BUY_MAX}
                    step={1}
                    onValueChange={([value]) => handlePointBuyChange(ability, value)}
                    className="my-2"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Base: {baseScore}</span>
                    <span>Cost: {POINT_BUY_COSTS[baseScore] || 0}</span>
                  </div>
                </div>
              )}

              {/* Standard Array Dropdown */}
              {method === "standardArray" && (
                <div className="flex gap-1 flex-wrap mt-2">
                  {[...STANDARD_ARRAY].map((val) => {
                    const isSelected = standardArrayAssignments[ability] === val
                    const isAvailable = availableStandardArray.includes(val) || isSelected
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => isAvailable && handleStandardArrayAssign(ability, val)}
                        disabled={!isAvailable}
                        className={`px-2 py-1 text-sm rounded border transition-all ${
                          isSelected
                            ? "border-primary bg-primary/20 text-primary"
                            : isAvailable
                            ? "border-border bg-card hover:border-primary/50 text-foreground"
                            : "border-border bg-muted text-muted-foreground cursor-not-allowed"
                        }`}
                      >
                        {val}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Roll Display */}
              {method === "roll" && (
                <div className="text-center mt-2">
                  <Badge variant="outline" className="text-xs">
                    Rolled: {baseScore}
                  </Badge>
                </div>
              )}

              {/* Racial Bonus */}
              {racialBonus > 0 && (
                <div className="mt-2 text-xs text-primary">
                  +{racialBonus} racial bonus
                </div>
              )}

              <p className="text-xs text-muted-foreground mt-2">{ABILITY_DESCRIPTIONS[ability]}</p>
            </div>
          )
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center gap-4 mt-6">
        {method === "roll" && (
          <Button
            type="button"
            variant="outline"
            onClick={rollAbilities}
            className="gap-2"
          >
            <Dices className="h-4 w-4" />
            Reroll All
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={resetAbilities}
          className="gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
      </div>
    </div>
  )
}
