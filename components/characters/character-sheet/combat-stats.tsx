"use client"

/**
 * Combat Stats Component
 * Shows AC, Initiative, Speed, and other combat-related stats
 */

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Shield, Zap, Footprints, Eye, Dumbbell } from "lucide-react"
import { formatModifier } from "@/lib/character/constants"

interface CombatStatsProps {
  armorClass: number
  initiative: number
  speed: number
  passivePerception: number
  proficiencyBonus: number
}

export function CombatStats({ 
  armorClass, 
  initiative, 
  speed, 
  passivePerception,
  proficiencyBonus,
}: CombatStatsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {/* Armor Class */}
      <Card className="bg-card border-border">
        <CardContent className="p-4 text-center">
          <Shield className="h-5 w-5 mx-auto text-blue-400" />
          <p className="text-2xl font-bold text-foreground mt-2">{armorClass}</p>
          <p className="text-xs text-muted-foreground">Armor Class</p>
        </CardContent>
      </Card>

      {/* Initiative */}
      <Card className="bg-card border-border">
        <CardContent className="p-4 text-center">
          <Zap className="h-5 w-5 mx-auto text-yellow-400" />
          <p className="text-2xl font-bold text-foreground mt-2">{formatModifier(initiative)}</p>
          <p className="text-xs text-muted-foreground">Initiative</p>
        </CardContent>
      </Card>

      {/* Speed */}
      <Card className="bg-card border-border">
        <CardContent className="p-4 text-center">
          <Footprints className="h-5 w-5 mx-auto text-green-400" />
          <p className="text-2xl font-bold text-foreground mt-2">{speed}</p>
          <p className="text-xs text-muted-foreground">Speed</p>
        </CardContent>
      </Card>

      {/* Passive Perception */}
      <Card className="bg-card border-border">
        <CardContent className="p-4 text-center">
          <Eye className="h-5 w-5 mx-auto text-purple-400" />
          <p className="text-2xl font-bold text-foreground mt-2">{passivePerception}</p>
          <p className="text-xs text-muted-foreground">Passive Perception</p>
        </CardContent>
      </Card>

      {/* Proficiency Bonus */}
      <Card className="bg-card border-border">
        <CardContent className="p-4 text-center">
          <Dumbbell className="h-5 w-5 mx-auto text-orange-400" />
          <p className="text-2xl font-bold text-foreground mt-2">+{proficiencyBonus}</p>
          <p className="text-xs text-muted-foreground">Proficiency</p>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Compact combat stats for smaller displays
 */
interface CompactCombatStatsProps {
  armorClass: number
  initiative: number
  speed: number
}

export function CompactCombatStats({ armorClass, initiative, speed }: CompactCombatStatsProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-1">
        <Shield className="h-4 w-4 text-blue-400" />
        <span className="font-bold text-foreground">{armorClass}</span>
      </div>
      <div className="flex items-center gap-1">
        <Zap className="h-4 w-4 text-yellow-400" />
        <span className="font-bold text-foreground">{formatModifier(initiative)}</span>
      </div>
      <div className="flex items-center gap-1">
        <Footprints className="h-4 w-4 text-green-400" />
        <span className="font-bold text-foreground">{speed} ft</span>
      </div>
    </div>
  )
}
