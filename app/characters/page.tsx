import { AppShell } from "@/components/layout/app-shell"
import { CharacterList } from "@/components/characters/character-list"

export default function CharactersPage() {
  return (
    <AppShell title="Characters" subtitle="Manage your heroes and their stories">
      <CharacterList />
    </AppShell>
  )
}
