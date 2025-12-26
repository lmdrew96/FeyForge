"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useCharacterStore } from "@/lib/character-store"
import { useCampaignCharacters } from "@/lib/hooks/use-campaign-data"
import { Plus, Trash2, Sword, Wand2, Target, Shield, Feather, Music } from "lucide-react"
import Link from "next/link"
import { ABILITY_ABBREVIATIONS, type Ability } from "@/lib/character/constants"

export function CharacterList() {
  const characters = useCampaignCharacters()
  const { deleteCharacter, getCalculatedStats } = useCharacterStore()

  if (characters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] sm:min-h-[60vh] px-2 sm:px-4">
        <div className="fairy-dust" />

        <div className="text-center max-w-2xl">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-serif mb-3 sm:mb-4 text-foreground">No Characters Yet</h2>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground mb-6 sm:mb-8">
            Build heroes for your campaigns. Track their stats, spells, and progression.
          </p>

          <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mb-6 sm:mb-10">
            {[
              { icon: Sword, name: "Fighter", color: "#47D1BB" },
              { icon: Wand2, name: "Wizard", color: "#931BE4" },
              { icon: Target, name: "Ranger", color: "#95B851" },
              { icon: Shield, name: "Paladin", color: "#521BC0" },
              { icon: Feather, name: "Rogue", color: "#47D1BB" },
              { icon: Music, name: "Bard", color: "#931BE4" },
            ].map((classType) => {
              const Icon = classType.icon
              return (
                <div
                  key={classType.name}
                  className="flex flex-col items-center p-2 sm:p-4 rounded-xl border border-border hover:border-primary/50 transition-all bg-card/30 backdrop-blur-sm hover:shadow-lg hover:shadow-primary/10"
                  style={{
                    borderColor: `${classType.color}33`,
                  }}
                >
                  <Icon className="h-6 w-6 sm:h-10 sm:w-10 mb-1 sm:mb-2" style={{ color: classType.color }} />
                  <div className="text-[10px] sm:text-sm text-muted-foreground">{classType.name}</div>
                </div>
              )
            })}
          </div>

          {/* Large CTA */}
          <Button
            asChild
            size="lg"
            className="text-sm sm:text-lg px-4 sm:px-8 py-3 sm:py-6 h-auto bg-primary hover:bg-primary/90 shadow-lg shadow-primary/30"
          >
            <Link href="/characters/new">
              <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5 sm:mr-2" />
              Create Your First Character
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-serif text-lg sm:text-2xl font-bold text-silver">Your Characters</h2>
        <Button asChild className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 text-xs sm:text-sm h-8 sm:h-10 px-2 sm:px-4">
          <Link href="/characters/new">
            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden xs:inline">New Character</span>
            <span className="xs:hidden">New</span>
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {characters.map((character) => {
          const stats = getCalculatedStats(character.id)

          return (
            <Link key={character.id} href={`/characters/${character.id}`}>
              <Card className="bg-card/50 backdrop-blur-sm border-border hover:border-primary/50 transition-all cursor-pointer group hover:shadow-lg hover:shadow-primary/10 active:scale-[0.99]">
                <CardContent className="p-3 sm:p-6">
                  <div className="flex items-start justify-between mb-2 sm:mb-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-serif text-base sm:text-xl font-bold text-foreground group-hover:text-primary transition-colors truncate">
                        {character.name}
                      </h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        Level {character.level} {character.race} {character.class}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0 h-8 w-8 sm:h-9 sm:w-9"
                      onClick={(e) => {
                        e.preventDefault()
                        if (confirm(`Delete ${character.name}?`)) {
                          deleteCharacter(character.id)
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex gap-2 mb-4">
                    <Badge className="badge-cyan">
                      HP: {character.hitPoints.current}/{character.hitPoints.max}
                    </Badge>
                    <Badge className="badge-purple">AC: {stats?.armorClass || 10}</Badge>
                  </div>

                  <div className="pt-4 border-t border-border/50">
                    <div className="grid grid-cols-6 gap-2 text-center text-xs">
                      {(
                        ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as Ability[]
                      ).map((ability) => (
                        <div key={ability}>
                          <p className="text-muted-foreground uppercase font-medium">
                            {ABILITY_ABBREVIATIONS[ability]}
                          </p>
                          <p className="font-bold text-foreground mt-1">
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
