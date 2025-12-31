"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useCharacterStore } from "@/lib/feyforge-character-store"
import { useCampaignCharacters } from "@/lib/hooks/use-campaign-data"
import { useSessionStore, type PlannedEncounter } from "@/lib/session-store"
import { Award, Users, Plus, Minus, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

// XP thresholds for leveling
const XP_THRESHOLDS = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
  85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000
]

interface XPCalculatorProps {
  sessionId?: string
  plannedEncounters?: PlannedEncounter[]
  onXPAwarded?: (totalXP: number) => void
}

export function XPCalculator({ sessionId, plannedEncounters = [], onXPAwarded }: XPCalculatorProps) {
  const { updateCharacter } = useCharacterStore()
  const { updateSession } = useSessionStore()
  const characters = useCampaignCharacters()

  const [selectedCharacters, setSelectedCharacters] = useState<string[]>(
    characters.map((c) => c.id)
  )
  const [bonusXP, setBonusXP] = useState(0)
  const [isAwarding, setIsAwarding] = useState(false)

  // Calculate XP from completed encounters
  const encounterXP = useMemo(() => {
    return plannedEncounters
      .filter((enc) => enc.status === "completed")
      .reduce((sum, enc) => sum + (enc.xpReward || 0), 0)
  }, [plannedEncounters])

  const totalXP = encounterXP + bonusXP
  const xpPerCharacter = selectedCharacters.length > 0
    ? Math.floor(totalXP / selectedCharacters.length)
    : 0

  // Toggle character selection
  const toggleCharacter = (id: string) => {
    setSelectedCharacters((prev) =>
      prev.includes(id) ? prev.filter((cid) => cid !== id) : [...prev, id]
    )
  }

  // Select all / none
  const selectAll = () => setSelectedCharacters(characters.map((c) => c.id))
  const selectNone = () => setSelectedCharacters([])

  // Get level from XP
  const getLevelFromXP = (xp: number): number => {
    for (let i = XP_THRESHOLDS.length - 1; i >= 0; i--) {
      if (xp >= XP_THRESHOLDS[i]) return i + 1
    }
    return 1
  }

  // Get XP needed for next level
  const getXPToNextLevel = (currentXP: number): number => {
    const currentLevel = getLevelFromXP(currentXP)
    if (currentLevel >= 20) return 0
    return XP_THRESHOLDS[currentLevel] - currentXP
  }

  // Award XP to selected characters
  const awardXP = async () => {
    if (selectedCharacters.length === 0 || xpPerCharacter === 0) return

    setIsAwarding(true)

    try {
      // Update each selected character
      for (const charId of selectedCharacters) {
        const char = characters.find((c) => c.id === charId)
        if (char) {
          const newXP = char.experiencePoints + xpPerCharacter
          const newLevel = getLevelFromXP(newXP)

          updateCharacter(charId, {
            experiencePoints: newXP,
            level: newLevel,
          })
        }
      }

      // Update session with awarded XP (only if sessionId is provided)
      if (sessionId) {
        updateSession(sessionId, { xpAwarded: totalXP })
      }

      // Callback
      onXPAwarded?.(totalXP)

      // Reset bonus XP
      setBonusXP(0)
    } finally {
      setIsAwarding(false)
    }
  }

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Award className="h-5 w-5 text-fey-gold" />
          XP Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* XP Sources */}
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">XP Sources</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="p-3 rounded-lg border border-border bg-background/30">
              <div className="flex items-center justify-between">
                <span className="text-sm">Encounters</span>
                <span className="font-mono font-bold">{encounterXP.toLocaleString()}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {plannedEncounters.filter((e) => e.status === "completed").length}/{plannedEncounters.length} done
              </p>
            </div>
            <div className="p-3 rounded-lg border border-border bg-background/30">
              <div className="flex items-center justify-between">
                <span className="text-sm">Bonus XP</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setBonusXP(Math.max(0, bonusXP - 100))}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <Input
                    type="number"
                    value={bonusXP}
                    onChange={(e) => setBonusXP(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-20 h-7 text-center font-mono text-sm bg-background/50"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setBonusXP(bonusXP + 100)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Roleplay, quests
              </p>
            </div>
          </div>
        </div>

        {/* Total & Per Character */}
        <div className="flex items-center justify-between p-3 rounded-lg border border-fey-gold/50 bg-fey-gold/10">
          <div>
            <p className="text-sm text-muted-foreground">Total XP</p>
            <p className="text-2xl font-bold font-mono">{totalXP.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Per char ({selectedCharacters.length})</p>
            <p className="text-2xl font-bold font-mono text-fey-gold">{xpPerCharacter.toLocaleString()}</p>
          </div>
        </div>

        {/* Character Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Select Characters
            </Label>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={selectAll} className="h-8 text-xs">
                All
              </Button>
              <Button variant="ghost" size="sm" onClick={selectNone} className="h-8 text-xs">
                None
              </Button>
            </div>
          </div>

          {characters.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No characters in this campaign
            </p>
          ) : (
            <ScrollArea className="h-[180px]">
              <div className="space-y-2 pr-4">
                {characters.map((char) => {
                  const isSelected = selectedCharacters.includes(char.id)
                  const newXP = char.experiencePoints + xpPerCharacter
                  const currentLevel = getLevelFromXP(char.experiencePoints)
                  const newLevel = getLevelFromXP(newXP)
                  const willLevelUp = newLevel > currentLevel

                  return (
                    <div
                      key={char.id}
                      onClick={() => toggleCharacter(char.id)}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
                        isSelected
                          ? "border-fey-cyan bg-fey-cyan/10"
                          : "border-border hover:border-fey-cyan/50"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleCharacter(char.id)}
                        />
                        <div>
                          <span className="font-medium">{char.name}</span>
                          <p className="text-xs text-muted-foreground">
                            Level {char.level} {char.race} {char.class}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono">
                            {char.experiencePoints.toLocaleString()} XP
                          </span>
                          {isSelected && xpPerCharacter > 0 && (
                            <>
                              <span className="text-xs text-muted-foreground">+{xpPerCharacter}</span>
                              {willLevelUp && (
                                <Badge className="bg-fey-gold/20 text-fey-gold border-fey-gold/50">
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  Level Up!
                                </Badge>
                              )}
                            </>
                          )}
                        </div>
                        {isSelected && !willLevelUp && (
                          <p className="text-xs text-muted-foreground">
                            {getXPToNextLevel(newXP).toLocaleString()} XP to level {currentLevel + 1}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Award Button */}
        <Button
          onClick={awardXP}
          disabled={selectedCharacters.length === 0 || xpPerCharacter === 0 || isAwarding}
          className="w-full bg-fey-gold hover:bg-fey-gold/90 text-white"
        >
          <Award className="h-4 w-4 mr-2" />
          {isAwarding ? "Awarding..." : `Award ${xpPerCharacter.toLocaleString()} XP Each`}
        </Button>
      </CardContent>
    </Card>
  )
}
