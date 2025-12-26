"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useCharacterStore } from "@/lib/character-store"
import { useCampaignCharacters } from "@/lib/hooks/use-campaign-data"
import { Plus, User, Trash2 } from "lucide-react"
import Link from "next/link"
import { ABILITY_ABBREVIATIONS, type Ability } from "@/lib/character/constants"

export function CharacterList() {
  const characters = useCampaignCharacters()
  const { deleteCharacter, getCalculatedStats } = useCharacterStore()

  if (characters.length === 0) {
    return (
      <Card className="bg-card border-border border-dashed">
        <CardContent className="p-12 text-center">
          <div className="h-16 w-16 rounded-full bg-accent/50 flex items-center justify-center mx-auto mb-4">
            <User className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-serif text-xl font-bold text-foreground mb-2">No Characters Yet</h3>
          <p className="text-muted-foreground mb-6">Create your first hero to begin your adventure</p>
          <Button asChild className="bg-primary hover:bg-primary/90">
            <Link href="/characters/new">
              <Plus className="h-4 w-4 mr-2" />
              Create Character
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl font-bold text-foreground">Your Characters</h2>
        <Button asChild className="bg-primary hover:bg-primary/90">
          <Link href="/characters/new">
            <Plus className="h-4 w-4 mr-2" />
            New Character
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {characters.map((character) => {
          const stats = getCalculatedStats(character.id)

          return (
            <Link key={character.id} href={`/characters/${character.id}`}>
              <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer group">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-serif font-bold text-foreground group-hover:text-primary transition-colors">
                        {character.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Level {character.level} {character.race} {character.class}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.preventDefault()
                        deleteCharacter(character.id)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <Badge variant="outline" className="border-border text-muted-foreground">
                      HP: {character.hitPoints.current}/{character.hitPoints.max}
                    </Badge>
                    <Badge variant="outline" className="border-border text-muted-foreground">
                      AC: {stats?.armorClass || 10}
                    </Badge>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border">
                    <div className="grid grid-cols-6 gap-1 text-center text-xs">
                      {(["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as Ability[]).map((ability) => (
                        <div key={ability}>
                          <p className="text-muted-foreground uppercase">{ABILITY_ABBREVIATIONS[ability]}</p>
                          <p className="font-medium text-foreground">
                            {stats?.abilities[ability] || character.baseAbilities[ability]}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
