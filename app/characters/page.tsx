"use client"

import { AppShell } from "@/components/app-shell"
import { CharacterList } from "@/components/characters/character-list"

export default function CharactersPage() {
  return (
    <AppShell pageTitle="Characters">
      <div className="p-3 sm:p-4 lg:p-6 w-full max-w-full min-w-0">
        <CharacterList />
      </div>
    </AppShell>
  )
}
