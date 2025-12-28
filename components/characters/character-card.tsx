"use client"

import type React from "react"

import Link from "next/link"
import { Eye, Heart, User } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Character } from "@/lib/characters-store"
import { classes } from "@/lib/character-data"
import { Axe, Music, Sparkles, Leaf, Shield, Hand, Cross, Target, Sword, Flame, BookOpen } from "lucide-react"

// Map icon names to components
const classIcons: Record<string, React.ElementType> = {
  Axe,
  Music,
  Sparkles,
  Leaf,
  Shield,
  Hand,
  Cross,
  Target,
  Sword,
  Flame,
  Eye,
  BookOpen,
}

interface CharacterCardProps {
  character: Character
}

export function CharacterCard({ character }: CharacterCardProps) {
  const hpPercent = character.hitPoints.max > 0 ? (character.hitPoints.current / character.hitPoints.max) * 100 : 0

  // Get HP bar color based on percentage
  const getHpColor = () => {
    if (hpPercent > 50) return "bg-green-500"
    if (hpPercent > 25) return "bg-yellow-500"
    return "bg-red-500"
  }

  // Get class info for icon
  const classInfo = classes.find((c) => c.value === character.characterClass)
  const IconComponent = classInfo?.icon ? classIcons[classInfo.icon] : User

  // Format class display
  const classDisplay = classInfo?.label || character.characterClass
  const levelDisplay = `${classDisplay} ${character.level}`

  // Format race display
  const raceDisplay = character.subrace || character.race

  return (
    <Card className="group relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-fey-cyan/10 hover:border-fey-cyan/30 bg-card/80 backdrop-blur-sm">
      <CardContent className="p-0">
        {/* Portrait Section */}
        <div className="relative aspect-[4/3] bg-gradient-to-br from-fey-forest/20 to-fey-purple/20 overflow-hidden">
          {character.imageUrl ? (
            <img
              src={character.imageUrl || "/placeholder.svg"}
              alt={character.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-muted/50 flex items-center justify-center">
                <IconComponent className="w-8 h-8 sm:w-10 sm:h-10 text-fey-cyan" />
              </div>
            </div>
          )}

          {/* Level Badge */}
          <Badge className="absolute top-2 right-2 bg-fey-purple/90 text-white border-0 text-xs">
            Lv {character.level}
          </Badge>
        </div>

        {/* Info Section */}
        <div className="p-3 sm:p-4 space-y-2 sm:space-y-3 min-w-0">
          {/* Name */}
          <h3 className="font-semibold text-foreground text-base sm:text-lg truncate min-w-0">{character.name}</h3>

          {/* Class & Race */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
            <Badge variant="outline" className="text-xs shrink-0 bg-fey-cyan/10 border-fey-cyan/30 text-fey-cyan">
              <IconComponent className="w-3 h-3 mr-1 flex-shrink-0" />
              <span className="truncate">{levelDisplay}</span>
            </Badge>
            <Badge
              variant="outline"
              className="text-xs shrink-0 bg-fey-purple/10 border-fey-purple/30 text-fey-purple truncate max-w-[120px]"
            >
              {raceDisplay}
            </Badge>
          </div>

          {/* HP Bar */}
          <div className="space-y-1 min-w-0">
            <div className="flex items-center justify-between text-xs min-w-0">
              <span className="flex items-center gap-1 text-foreground/70 flex-shrink-0">
                <Heart className="w-3 h-3 text-red-500 flex-shrink-0" />
                <span className="hidden xs:inline">HP</span>
              </span>
              <span className="font-medium text-foreground truncate">
                {character.hitPoints.current}/{character.hitPoints.max}
                {character.hitPoints.temp > 0 && (
                  <span className="text-fey-cyan ml-1">(+{character.hitPoints.temp})</span>
                )}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full ${getHpColor()} transition-all duration-300`}
                style={{ width: `${Math.min(hpPercent, 100)}%` }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1 min-w-0">
            <Button asChild variant="outline" size="sm" className="flex-1 text-xs sm:text-sm min-w-0 bg-transparent">
              <Link href={`/characters/${character.id}`}>
                <Eye className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />
                <span className="truncate">View Sheet</span>
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
