"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useCharacterStore as useCharacterBuilderStore } from "@/lib/character-store"
import { useCharacterStore } from "@/lib/feyforge-character-store"
import { useActiveCampaignId } from "@/lib/hooks/use-campaign-data"
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
import type { Character, ItemProperty } from "@/lib/character/types"
import type { Skill, Ability, Alignment } from "@/lib/character/constants"

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
  const { currentStep, setStep, character, resetCharacter } =
    useCharacterBuilderStore()
  const addCharacter = useCharacterStore((s) => s.addCharacter)
  const activeCampaignId = useActiveCampaignId()

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return character.name && character.race && character.characterClass
      case 2:
        return true
      case 3:
        return true
      case 4:
        return (
          character.equipmentChoice === "gold" ||
          character.selectedEquipment.length > 0
        )
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

  const handleComplete = async () => {
    // Generate a unique ID for the new character
    const newId = `char-${Date.now()}`

    // Calculate initial HP based on class hit die (assume d8 for now + CON mod)
    const conMod = Math.floor((character.abilities.constitution - 10) / 2)
    const initialHP = 8 + conMod // Level 1 max HP

    // Transform character builder data to FeyForge Character format
    const newCharacter = {
      id: newId,
      campaignId: activeCampaignId || undefined,
      name: character.name,
      race: character.race,
      subrace: character.subrace || undefined,
      class: character.characterClass, // FeyForge uses 'class' not 'characterClass'
      level: 1,
      experiencePoints: 0,
      background: character.background || undefined,
      alignment: (character.alignment as Alignment) || undefined,

      // Base ability scores using full property names
      baseAbilities: {
        strength: character.abilities.strength,
        dexterity: character.abilities.dexterity,
        constitution: character.abilities.constitution,
        intelligence: character.abilities.intelligence,
        wisdom: character.abilities.wisdom,
        charisma: character.abilities.charisma,
      },

      // Combat stats
      hitPoints: {
        current: initialHP,
        max: initialHP,
        temp: 0,
      },
      hitDice: [
        {
          diceSize: 8,
          total: 1,
          used: 0,
        },
      ],
      deathSaves: {
        successes: 0,
        failures: 0,
      },
      speed: 30,
      inspiration: false,

      // Proficiencies - Note: skillProficiencies stores display names for UI compatibility
      // The Skill type expects camelCase keys but we store display names
      savingThrowProficiencies: [] as Ability[],
      skillProficiencies: character.skillProficiencies as unknown as Skill[],
      skillExpertise: [] as Skill[],
      armorProficiencies: [] as string[],
      weaponProficiencies: [] as string[],
      toolProficiencies: [...character.toolProficiencies],
      languages: [...character.languages],

      // Currency
      currency: {
        cp: 0,
        sp: 0,
        ep: 0,
        gp: character.equipmentChoice === "gold" ? character.startingGold : 0,
        pp: 0,
      },

      // Properties (equipment stored as ItemProperty in properties array)
      properties: character.selectedEquipment.map(
        (name, index): ItemProperty => ({
          id: `item-${newId}-${index}`,
          type: "item",
          name,
          description: "",
          active: true,
          category: "gear",
          equipped: false,
          quantity: 1,
          weight: 0,
          modifiers: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      ),

      // Personality
      personalityTraits: character.personalityTraits || "",
      ideals: character.ideals || "",
      bonds: character.bonds || "",
      flaws: character.flaws || "",
      backstory: character.backstory || "",

      // Physical characteristics
      age: character.age || undefined,
      height: character.height || undefined,
      weight: character.weight || undefined,
      eyes: character.eyes || undefined,
      skin: character.skin || undefined,
      hair: character.hair || undefined,
      imageUrl: character.imageUrl || undefined,

      // Metadata
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies Omit<Character, "imageUrl"> & { imageUrl?: string }

    try {
      // Add character to the store (async)
      await addCharacter(newCharacter as Character)

      // Reset the builder
      resetCharacter()

      // Navigate to the new character's sheet
      router.push(`/characters/${newId}`)
    } catch (error) {
      console.error("Failed to create character:", error)
      const message = error instanceof Error ? error.message : "Failed to create character"
      if (message.includes("Not authenticated")) {
        toast.error("Please log in to create a character")
      } else {
        toast.error(message)
      }
    }
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
            <ProgressIndicator
              currentStep={currentStep}
              totalSteps={TOTAL_STEPS}
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 px-4 py-6 md:py-8 max-w-7xl mx-auto w-full">
          <Card className="bg-card/80 backdrop-blur-sm border-2 border-border shadow-xl w-full">
            <CardContent className="p-3 sm:p-4 md:p-8 w-full max-w-full overflow-x-hidden">
              {/* Step Title */}
              <h2 className="text-lg font-semibold text-fey-gold mb-6">
                {stepTitles[currentStep - 1]}
              </h2>

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
                    : "border-fey-purple text-fey-purple hover:bg-fey-purple/10"
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
                          : "bg-secondary"
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
                      : "bg-secondary text-muted-foreground"
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
