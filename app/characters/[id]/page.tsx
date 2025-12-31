"use client"

import { AbilityScoresPanel } from "@/components/character-sheet/ability-scores-panel"
import { CharacterHeader } from "@/components/character-sheet/character-header"
import { CombatPanel } from "@/components/character-sheet/combat-panel"
import { FeaturesPanel } from "@/components/character-sheet/features-panel"
import { HealthTracker } from "@/components/character-sheet/health-tracker"
import { InventoryPanel } from "@/components/character-sheet/inventory-panel"
import { PersonalityPanel } from "@/components/character-sheet/personality-panel"
import { SkillsPanel } from "@/components/character-sheet/skills-panel"
import { SpellcastingPanel } from "@/components/character-sheet/spellcasting-panel"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { useCharacterStore } from "@/lib/feyforge-character-store"
import type { Character, CharacterUpdateInput } from "@/lib/character/types"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export default function CharacterSheetPage() {
  const params = useParams()
  const router = useRouter()
  const { characters, updateCharacter, deleteCharacter, getCalculatedStats } = useCharacterStore()
  const [character, setCharacter] = useState<Character | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [pendingChanges, setPendingChanges] = useState<CharacterUpdateInput>({})

  useEffect(() => {
    const id = params.id as string

    if (id === "new") {
      router.replace("/create-character")
      return
    }

    const found = characters.find((c) => c.id === id)
    if (found) {
      setCharacter(found)
    }
  }, [params.id, characters, router])

  const calculatedStats = character ? getCalculatedStats(character.id) : null

  const handleUpdate = (data: CharacterUpdateInput) => {
    if (isEditing) {
      setPendingChanges((prev) => ({ ...prev, ...data }))
      setCharacter((prev) => (prev ? { ...prev, ...data } as Character : null))
    }
  }

  const saveChanges = () => {
    if (character) {
      updateCharacter(character.id, pendingChanges)
    }
    setPendingChanges({})
    setIsEditing(false)
  }

  const cancelEditing = () => {
    if (character) {
      const original = characters.find((c) => c.id === character.id)
      if (original) setCharacter(original)
    }
    setPendingChanges({})
    setIsEditing(false)
  }

  const handleDelete = () => {
    if (character) {
      deleteCharacter(character.id)
    }
    router.push("/")
  }

  const exportCharacter = () => {
    if (character) {
      const blob = new Blob([JSON.stringify(character, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${character.name.replace(/\s+/g, "_")}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  if (!character) {
    return (
      <AppShell pageTitle="Character">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <h1 className="text-2xl font-display font-bold text-foreground mb-4">Character Not Found</h1>
            <p className="text-foreground/70 mb-6">The character you&apos;re looking for doesn&apos;t exist.</p>
            <Button asChild className="bg-fey-forest hover:bg-fey-forest/80">
              <a href="/">Return Home</a>
            </Button>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell pageTitle={character.name}>
      {/* Main Content */}
      <div className="p-3 sm:p-4 lg:p-6 w-full max-w-full overflow-x-hidden">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 w-full">
          {/* Header - now contains action buttons */}
          <CharacterHeader
            character={character}
            isEditing={isEditing}
            onUpdate={handleUpdate}
            onEdit={() => setIsEditing(true)}
            onSave={saveChanges}
            onCancel={cancelEditing}
            onDelete={handleDelete}
            onExport={exportCharacter}
          />

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 w-full">
            {/* Left Column - Core Stats */}
            <div className="lg:col-span-4 space-y-4 sm:space-y-6 min-w-0">
              <AbilityScoresPanel character={character} calculatedStats={calculatedStats} isEditing={isEditing} onUpdate={handleUpdate} />
              <HealthTracker character={character} isEditing={isEditing} onUpdate={handleUpdate} />
              <SkillsPanel character={character} calculatedStats={calculatedStats} isEditing={isEditing} onUpdate={handleUpdate} />
            </div>

            {/* Middle Column - Combat & Features */}
            <div className="lg:col-span-4 space-y-4 sm:space-y-6 min-w-0">
              <CombatPanel character={character} isEditing={isEditing} onUpdate={handleUpdate} />
              <FeaturesPanel character={character} isEditing={isEditing} onUpdate={handleUpdate} />
              {character.spellcasting && (
                <SpellcastingPanel character={character} isEditing={isEditing} onUpdate={handleUpdate} />
              )}
            </div>

            {/* Right Column - Inventory & Personality */}
            <div className="lg:col-span-4 space-y-4 sm:space-y-6 min-w-0">
              <InventoryPanel character={character} calculatedStats={calculatedStats} isEditing={isEditing} onUpdate={handleUpdate} />
              <PersonalityPanel character={character} isEditing={isEditing} onUpdate={handleUpdate} />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
