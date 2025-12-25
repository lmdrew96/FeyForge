import { AppShell } from "@/components/layout/app-shell"
import { CharacterBuilder } from "@/components/characters/character-builder"

export default function NewCharacterPage() {
  return (
    <AppShell title="Create Character" subtitle="Forge a new hero for your adventures">
      <CharacterBuilder />
    </AppShell>
  )
}
