"use client"

import { useRouter } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"
import { CharacterBuilder } from "@/components/characters/character-builder"
import { useCharacterStore } from "@/lib/character-store"
import { useCampaignStore } from "@/lib/campaign-store"
import type { Character } from "@/lib/character/types"

export default function NewCharacterPage() {
  const router = useRouter()
  const addCharacter = useCharacterStore((state) => state.addCharacter)
  const activeCampaignId = useCampaignStore((state) => state.activeCampaignId)

  const handleComplete = (character: Character) => {
    // Add campaign association
    const characterWithCampaign = {
      ...character,
      campaignId: activeCampaignId || undefined,
    }
    addCharacter(characterWithCampaign)
    router.push(`/characters/${character.id}`)
  }

  const handleCancel = () => {
    router.push("/characters")
  }

  return (
    <AppShell title="Create Character" subtitle="Forge a new hero for your adventures">
      <CharacterBuilder 
        onComplete={handleComplete}
        onCancel={handleCancel}
      />
    </AppShell>
  )
}
