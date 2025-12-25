"use client"

import { useParams, useRouter } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"
import { CharacterSheet } from "@/components/characters/character-sheet"
import { useCharacterStore } from "@/lib/character-store"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { useEffect, useState } from "react"

export default function CharacterPage() {
  const { id } = useParams()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const characters = useCharacterStore((state) => state.characters)
  const character = characters.find((c) => c.id === id)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (id === "new") {
      router.replace("/characters/new")
    }
  }, [id, router])

  if (id === "new") {
    return (
      <AppShell title="Loading..." subtitle="Preparing character builder">
        <Card className="bg-card border-border">
          <CardContent className="p-12 text-center">
            <div className="animate-pulse">
              <div className="h-8 bg-muted rounded-2xl w-48 mx-auto mb-4" />
              <div className="h-4 bg-muted rounded-2xl w-32 mx-auto" />
            </div>
          </CardContent>
        </Card>
      </AppShell>
    )
  }

  // Wait for hydration before showing not found
  if (!mounted) {
    return (
      <AppShell title="Loading..." subtitle="Summoning character data">
        <Card className="bg-card border-border">
          <CardContent className="p-12 text-center">
            <div className="animate-pulse">
              <div className="h-8 bg-muted rounded w-48 mx-auto mb-4" />
              <div className="h-4 bg-muted rounded w-32 mx-auto" />
            </div>
          </CardContent>
        </Card>
      </AppShell>
    )
  }

  if (!character) {
    return (
      <AppShell title="Character Not Found" subtitle="This hero has vanished into the mists">
        <Card className="bg-card border-border">
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground mb-4">The character you&apos;re looking for doesn&apos;t exist.</p>
            <Button asChild variant="outline" className="border-border bg-transparent">
              <Link href="/characters">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Characters
              </Link>
            </Button>
          </CardContent>
        </Card>
      </AppShell>
    )
  }

  return (
    <AppShell title={character.name} subtitle={`Level ${character.level} Character Sheet`}>
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
          <Link href="/characters">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Characters
          </Link>
        </Button>
      </div>
      <CharacterSheet character={character} />
    </AppShell>
  )
}
