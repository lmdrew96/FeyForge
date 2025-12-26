"use client"

/**
 * Character Builder - Main Component
 * Multi-step wizard for creating D&D 5e characters
 */

import { useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react"

import { Step1Basics } from "./step-1-basics"
import { Step2Abilities } from "./step-2-abilities"
import { Step3Skills } from "./step-3-skills"
import { Step4Equipment } from "./step-4-equipment"
import { Step5Details } from "./step-5-details"

import { useCharacterBuilderStore } from "@/lib/character-builder-store"
import { validateCharacter } from "@/lib/character/validators"
import { calculateAllStats } from "@/lib/character/calculations"
import type { Character, CharacterCreationData, HitDice } from "@/lib/character/types"
import type { Skill } from "@/lib/character/constants"
import { ABILITIES, CLASS_HIT_DICE, getAbilityModifier } from "@/lib/character/constants"

const STEPS = [
  { id: 1, name: "Basics", description: "Name & Alignment" },
  { id: 2, name: "Abilities", description: "Ability Scores" },
  { id: 3, name: "Skills", description: "Proficiencies" },
  { id: 4, name: "Equipment", description: "Starting Gear" },
  { id: 5, name: "Details", description: "Personality & Backstory" },
]

// Default available skills for classes (simplified)
const CLASS_SKILLS: Record<string, Skill[]> = {
  fighter: ["acrobatics", "animalHandling", "athletics", "history", "insight", "intimidation", "perception", "survival"],
  wizard: ["arcana", "history", "insight", "investigation", "medicine", "religion"],
  rogue: ["acrobatics", "athletics", "deception", "insight", "intimidation", "investigation", "perception", "performance", "persuasion", "sleightOfHand", "stealth"],
  cleric: ["history", "insight", "medicine", "persuasion", "religion"],
  bard: ["acrobatics", "animalHandling", "arcana", "athletics", "deception", "history", "insight", "intimidation", "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleightOfHand", "stealth", "survival"],
  default: ["athletics", "acrobatics", "stealth", "arcana", "history", "investigation", "nature", "religion", "animalHandling", "insight", "medicine", "perception", "survival", "deception", "intimidation", "performance", "persuasion"],
}

const CLASS_SKILL_CHOICES: Record<string, number> = {
  fighter: 2,
  wizard: 2,
  rogue: 4,
  cleric: 2,
  bard: 3,
  default: 2,
}

interface CharacterBuilderProps {
  onComplete?: (character: Character) => void
  onCancel?: () => void
  initialData?: Partial<CharacterCreationData>
}

export function CharacterBuilder({ onComplete, onCancel, initialData }: CharacterBuilderProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const { data, updateData, reset } = useCharacterBuilderStore()

  // Initialize with any provided data
  useState(() => {
    if (initialData) {
      Object.entries(initialData).forEach(([key, value]) => {
        if (value !== undefined) {
          updateData({ [key]: value })
        }
      })
    }
  })

  const handleNext = useCallback(() => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1)
    }
  }, [currentStep])

  const handlePrevious = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }, [currentStep])

  const handleStepChange = useCallback((step: number) => {
    if (step >= 1 && step <= STEPS.length) {
      setCurrentStep(step)
    }
  }, [])

  const buildCharacter = useCallback((): Character => {
    const id = crypto.randomUUID()
    const now = new Date()

    // Calculate base abilities
    const baseAbilities = {
      strength: data.baseAbilities?.strength || 10,
      dexterity: data.baseAbilities?.dexterity || 10,
      constitution: data.baseAbilities?.constitution || 10,
      intelligence: data.baseAbilities?.intelligence || 10,
      wisdom: data.baseAbilities?.wisdom || 10,
      charisma: data.baseAbilities?.charisma || 10,
    }

    // Add racial bonuses
    const racialBonuses = data.racialBonuses || {}

    // Get hit die for class
    const classKey = data.class?.toLowerCase() || "fighter"
    const hitDieSize = CLASS_HIT_DICE[classKey as keyof typeof CLASS_HIT_DICE] || 10

    // Calculate max HP (level 1: max hit die + CON mod)
    const conScore = baseAbilities.constitution + (racialBonuses.constitution || 0)
    const conMod = getAbilityModifier(conScore)
    const maxHP = hitDieSize + conMod

    // Build hit dice array
    const hitDice: HitDice[] = [{
      diceSize: hitDieSize,
      total: 1,
      used: 0,
    }]

    const character: Character = {
      id,
      name: data.name || "Unnamed Hero",
      race: data.race || "Human",
      subrace: data.subrace,
      class: data.class || "Fighter",
      subclass: undefined,
      level: 1,
      experiencePoints: 0,
      background: data.background || "Folk Hero",
      alignment: data.alignment || "True Neutral",
      
      baseAbilities,
      racialBonuses,
      
      hitPoints: {
        current: maxHP,
        max: maxHP,
        temp: 0,
      },
      hitDice,
      deathSaves: {
        successes: 0,
        failures: 0,
      },
      speed: 30, // Default speed, should be based on race
      inspiration: false,
      
      savingThrowProficiencies: [],
      skillProficiencies: data.skillProficiencies || [],
      skillExpertise: [],
      armorProficiencies: [],
      weaponProficiencies: [],
      toolProficiencies: data.toolProficiencies || [],
      languages: data.languages || ["Common"],
      
      currency: {
        cp: 0,
        sp: 0,
        ep: 0,
        gp: data.startingGold || 0,
        pp: 0,
      },
      
      spellcasting: undefined,
      properties: data.startingEquipment || [],
      
      personalityTraits: data.personalityTraits,
      ideals: data.ideals,
      bonds: data.bonds,
      flaws: data.flaws,
      backstory: data.backstory,
      
      createdAt: now,
      updatedAt: now,
    }

    return character
  }, [data])

  const handleComplete = useCallback(() => {
    const character = buildCharacter()
    
    // Validate
    const validationResult = validateCharacter(character)
    if (!validationResult.valid) {
      console.warn("Character validation warnings:", validationResult.errors)
    }

    // Calculate stats
    const stats = calculateAllStats(character)
    
    // Call completion handler
    onComplete?.(character)
    
    // Reset builder state
    reset()
  }, [buildCharacter, onComplete, reset])

  const handleCancel = useCallback(() => {
    reset()
    onCancel?.()
  }, [onCancel, reset])

  const progress = (currentStep / STEPS.length) * 100

  // Get available skills and max choices based on class
  const classKey = (data.class?.toLowerCase() || "default") as keyof typeof CLASS_SKILLS
  const availableSkills = CLASS_SKILLS[classKey] || CLASS_SKILLS.default
  const maxSkillChoices = CLASS_SKILL_CHOICES[classKey] || CLASS_SKILL_CHOICES.default

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1Basics data={data} onUpdate={updateData} />
      case 2:
        return <Step2Abilities data={data} onUpdate={updateData} racialBonuses={data.racialBonuses} />
      case 3:
        return (
          <Step3Skills 
            data={data} 
            onUpdate={updateData} 
            availableSkills={availableSkills}
            maxSkillChoices={maxSkillChoices}
          />
        )
      case 4:
        return <Step4Equipment data={data} onUpdate={updateData} />
      case 5:
        return <Step5Details data={data} onUpdate={updateData} />
      default:
        return null
    }
  }

  const canGoNext = () => {
    switch (currentStep) {
      case 1:
        return !!data.name && data.name.trim().length > 0
      case 2:
        return !!data.baseAbilities
      case 3:
        return true
      case 4:
        return true
      case 5:
        return true
      default:
        return true
    }
  }

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          {/* Step Indicators */}
          <div className="flex items-center justify-between mb-4">
            {STEPS.map((step, index) => (
              <button
                key={step.id}
                onClick={() => handleStepChange(step.id)}
                className={`flex flex-col items-center gap-1 transition-colors ${
                  step.id === currentStep
                    ? "text-primary"
                    : step.id < currentStep
                    ? "text-green-500"
                    : "text-muted-foreground"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                    step.id === currentStep
                      ? "border-primary bg-primary/10"
                      : step.id < currentStep
                      ? "border-green-500 bg-green-500/10"
                      : "border-muted-foreground"
                  }`}
                >
                  {step.id < currentStep ? <Check className="h-4 w-4" /> : step.id}
                </div>
                <span className="text-xs font-medium hidden sm:block">{step.name}</span>
              </button>
            ))}
          </div>

          {/* Progress Bar */}
          <Progress value={progress} className="h-2" />

          {/* Current Step Info */}
          <div className="mt-4 text-center">
            <h2 className="font-serif text-lg font-bold text-foreground">
              Step {currentStep}: {STEPS[currentStep - 1].name}
            </h2>
            <p className="text-sm text-muted-foreground">
              {STEPS[currentStep - 1].description}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          {renderStep()}
          
          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t border-border">
            <Button 
              variant="outline" 
              onClick={handlePrevious}
              disabled={currentStep === 1}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
            
            {currentStep < STEPS.length ? (
              <Button 
                onClick={handleNext}
                disabled={!canGoNext()}
              >
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button 
                onClick={handleComplete}
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="h-4 w-4 mr-2" />
                Create Character
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cancel Button */}
      {onCancel && (
        <div className="flex justify-center">
          <Button variant="ghost" onClick={handleCancel} className="text-muted-foreground">
            <X className="h-4 w-4 mr-2" />
            Cancel Character Creation
          </Button>
        </div>
      )}
    </div>
  )
}
