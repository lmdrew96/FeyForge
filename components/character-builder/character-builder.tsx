"use client"

import { useRouter } from "next/navigation"
import { useCharacterStore } from "@/lib/character-store"
import { useCharactersStore } from "@/lib/characters-store"
import { ProgressIndicator } from "./progress-indicator"
import { StepBasics } from "./step-basics"
import { StepAbilities } from "./step-abilities"
import { StepSkills } from "./step-skills"
import { StepEquipment } from "./step-equipment"
import { StepDetails } from "./step-details"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { AppShell } from "@/components/app-shell"
import { ArrowLeft, ArrowRight, Check } from "lucide-react"
import { cn } from "@/lib/utils"

const TOTAL_STEPS = 5

const stepTitles = [
  "Who is your hero?",
  "Forge your abilities",
  "Master your skills",
  "Gather your gear",
  "Tell your story",
]

export function CharacterBuilder() {
  const router = useRouter()
  const { currentStep, setStep, character, resetCharacter } = useCharacterStore()
  const { addCharacter } = useCharactersStore()

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return character.name && character.race && character.characterClass
      case 2:
        return true
      case 3:
        return true
      case 4:
        return character.equipmentChoice === "gold" || character.selectedEquipment.length > 0
      case 5:
        return true
      default:
        return true
    }
  }

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS && canProceed()) {
      setStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setStep(currentStep - 1)
    }
  }

  const handleComplete = () => {
    // Generate a unique ID for the new character
    const newId = `char-${Date.now()}`
    
    // Transform character builder data to full character format
    const newCharacter = {
      id: newId,
      name: character.name,
      race: character.race,
      subrace: character.subrace || "",
      characterClass: character.characterClass,
      level: 1,
      background: character.background || "",
      alignment: character.alignment || "",
      experiencePoints: 0,
      abilities: { ...character.abilities },
      skillProficiencies: [...character.skillProficiencies],
      savingThrowProficiencies: [],
      toolProficiencies: [...character.toolProficiencies],
      languages: [...character.languages],
      proficiencyBonus: 2,
      armorClass: 10 + Math.floor((character.abilities.dexterity - 10) / 2),
      initiative: Math.floor((character.abilities.dexterity - 10) / 2),
      speed: 30,
      hitPoints: {
        current: 10 + Math.floor((character.abilities.constitution - 10) / 2),
        max: 10 + Math.floor((character.abilities.constitution - 10) / 2),
        temp: 0,
      },
      hitDice: {
        total: 1,
        current: 1,
        type: "d8",
      },
      deathSaves: {
        successes: 0,
        failures: 0,
      },
      attacks: [],
      racialTraits: [],
      classFeatures: [],
      feats: [],
      equipment: character.selectedEquipment.map((name) => ({
        name,
        quantity: 1,
        weight: 0,
        equipped: false,
      })),
      currency: {
        cp: 0,
        sp: 0,
        ep: 0,
        gp: character.equipmentChoice === "gold" ? character.startingGold : 0,
        pp: 0,
      },
      personalityTraits: character.personalityTraits || "",
      ideals: character.ideals || "",
      bonds: character.bonds || "",
      flaws: character.flaws || "",
      backstory: character.backstory || "",
      age: character.age || "",
      height: character.height || "",
      weight: character.weight || "",
      eyes: character.eyes || "",
      skin: character.skin || "",
      hair: character.hair || "",
      imageUrl: character.imageUrl || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    
    // Add character to the store
    addCharacter(newCharacter)
    
    // Reset the builder
    resetCharacter()
    
    // Navigate to the new character's sheet
    router.push(`/characters/${newId}`)
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <StepBasics />
      case 2:
        return <StepAbilities />
      case 3:
        return <StepSkills />
      case 4:
        return <StepEquipment />
      case 5:
        return <StepDetails />
      default:
        return <StepBasics />
    }
  }

  return (
    <AppShell pageTitle="Create Character" showSidebar={true}>
      <div className="flex flex-col h-full w-full max-w-full overflow-x-hidden">
        {/* Progress */}
        <div className="bg-card/50 border-b border-border w-full">
          <div className="px-4 max-w-7xl mx-auto">
            <ProgressIndicator currentStep={currentStep} totalSteps={TOTAL_STEPS} />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 px-4 py-6 md:py-8 max-w-7xl mx-auto w-full">
          <Card className="bg-card/80 backdrop-blur-sm border-2 border-border shadow-xl w-full">
            <CardContent className="p-3 sm:p-4 md:p-8 w-full max-w-full overflow-x-hidden">
              {/* Step Title */}
              <h2 className="text-lg font-semibold text-fey-gold mb-6">{stepTitles[currentStep - 1]}</h2>

              {renderStep()}
            </CardContent>
          </Card>
        </div>

        <footer className="sticky bottom-0 z-20 bg-background/80 backdrop-blur-md border-t border-border w-full">
          <div className="px-4 py-4 max-w-7xl mx-auto w-full">
            <div className="flex items-center justify-between gap-2 sm:gap-4">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1}
                className={cn(
                  "h-10 sm:h-12 px-3 sm:px-4 border-2",
                  currentStep === 1
                    ? "border-border text-muted-foreground"
                    : "border-fey-purple text-fey-purple hover:bg-fey-purple/10",
                )}
              >
                <ArrowLeft className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Back</span>
              </Button>

              {/* Step indicator */}
              <div className="flex items-center gap-1">
                {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-2 h-2 rounded-full transition-all",
                      i + 1 === currentStep
                        ? "w-4 sm:w-6 bg-fey-cyan"
                        : i + 1 < currentStep
                          ? "bg-fey-cyan"
                          : "bg-secondary",
                    )}
                  />
                ))}
              </div>

              {currentStep < TOTAL_STEPS ? (
                <Button
                  onClick={handleNext}
                  disabled={!canProceed()}
                  className={cn(
                    "h-10 sm:h-12 px-3 sm:px-4",
                    canProceed()
                      ? "bg-fey-cyan hover:bg-fey-cyan/90 text-accent-foreground"
                      : "bg-secondary text-muted-foreground",
                  )}
                >
                  <span className="hidden sm:inline">Next</span>
                  <ArrowRight className="h-4 w-4 sm:ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleComplete}
                  className="h-10 sm:h-12 px-3 sm:px-4 bg-fey-gold hover:bg-fey-gold/90 text-accent-foreground"
                >
                  <Check className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Create Character</span>
                </Button>
              )}
            </div>
          </div>
        </footer>
      </div>
    </AppShell>
  )
}
