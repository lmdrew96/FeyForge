"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import type { Character, CharacterUpdateInput } from "@/lib/character/types"
import { Heart, Minus, Plus, Shield, Skull } from "lucide-react"
import { useState } from "react"

interface HealthTrackerProps {
  character: Character
  isEditing: boolean
  onUpdate: (data: CharacterUpdateInput) => void
}

export function HealthTracker({ character, isEditing, onUpdate }: HealthTrackerProps) {
  const [hpChange, setHpChange] = useState("")

  const healthPercentage = (character.hitPoints.current / character.hitPoints.max) * 100

  const handleHpChange = (delta: number) => {
    const newCurrent = Math.max(0, Math.min(character.hitPoints.max, character.hitPoints.current + delta))
    onUpdate({
      hitPoints: { ...character.hitPoints, current: newCurrent },
    })
  }

  const applyHpChange = (type: "damage" | "heal") => {
    const value = Number.parseInt(hpChange) || 0
    handleHpChange(type === "heal" ? value : -value)
    setHpChange("")
  }

  const toggleDeathSave = (type: "successes" | "failures", index: number) => {
    const current = character.deathSaves[type]
    const newValue = current > index ? index : index + 1
    onUpdate({
      deathSaves: { ...character.deathSaves, [type]: newValue },
    })
  }

  // Calculate total hit dice remaining across all classes
  const hitDiceStats = character.hitDice.reduce(
    (acc, hd) => ({
      current: acc.current + (hd.total - hd.used),
      total: acc.total + hd.total,
    }),
    { current: 0, total: 0 }
  )

  // Get the primary hit die type (first entry or d8 default)
  const primaryHitDie = character.hitDice[0]
  const hitDieType = primaryHitDie ? `d${primaryHitDie.diceSize}` : "d8"

  const useHitDie = () => {
    if (hitDiceStats.current > 0 && character.hitDice.length > 0) {
      // Find first hit die pool with remaining dice
      const updatedHitDice = [...character.hitDice]
      for (let i = 0; i < updatedHitDice.length; i++) {
        if (updatedHitDice[i].used < updatedHitDice[i].total) {
          updatedHitDice[i] = { ...updatedHitDice[i], used: updatedHitDice[i].used + 1 }
          break
        }
      }
      onUpdate({ hitDice: updatedHitDice })
    }
  }

  return (
    <Card className="p-4 bg-card/80 backdrop-blur-sm border-fey-sage/30">
      <h2 className="text-lg font-display font-semibold mb-4 text-fey-gold flex items-center gap-2">
        <Heart className="h-5 w-5" />
        Health
      </h2>

      {/* HP Bar */}
      <div className="mb-4">
        <div className="flex justify-between items-baseline mb-2">
          <span className="text-sm text-muted-foreground">Hit Points</span>
          <div className="flex items-baseline gap-1">
            {isEditing ? (
              <>
                <Input
                  type="number"
                  value={character.hitPoints.current}
                  onChange={(e) =>
                    onUpdate({
                      hitPoints: { ...character.hitPoints, current: Number.parseInt(e.target.value) || 0 },
                    })
                  }
                  className="w-14 h-7 text-center text-sm"
                />
                <span className="text-muted-foreground">/</span>
                <Input
                  type="number"
                  value={character.hitPoints.max}
                  onChange={(e) =>
                    onUpdate({
                      hitPoints: { ...character.hitPoints, max: Number.parseInt(e.target.value) || 1 },
                    })
                  }
                  className="w-14 h-7 text-center text-sm"
                />
              </>
            ) : (
              <span className="text-xl font-bold">
                <span className={healthPercentage <= 25 ? "text-destructive" : "text-foreground"}>
                  {character.hitPoints.current}
                </span>
                <span className="text-muted-foreground">/{character.hitPoints.max}</span>
              </span>
            )}
          </div>
        </div>
        <Progress
          value={healthPercentage}
          className="h-3"
          style={
            {
              "--progress-background":
                healthPercentage > 50 ? "var(--fey-forest)" : healthPercentage > 25 ? "#eab308" : "#dc2626",
            } as React.CSSProperties
          }
        />
        {character.hitPoints.temp > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <Shield className="h-4 w-4 text-fey-cyan" />
            <span className="text-sm text-fey-cyan">+{character.hitPoints.temp} Temp HP</span>
          </div>
        )}
      </div>

      {/* Quick HP Adjust */}
      {!isEditing && (
        <div className="flex gap-2 mb-4">
          <Input
            type="number"
            placeholder="Amount"
            value={hpChange}
            onChange={(e) => setHpChange(e.target.value)}
            className="flex-1 h-9 bg-background border-fey-sage/30"
          />
          <Button size="sm" variant="destructive" onClick={() => applyHpChange("damage")} className="gap-1">
            <Minus className="h-3 w-3" />
            Dmg
          </Button>
          <Button
            size="sm"
            variant="default"
            onClick={() => applyHpChange("heal")}
            className="gap-1 bg-fey-forest hover:bg-fey-forest/80"
          >
            <Plus className="h-3 w-3" />
            Heal
          </Button>
        </div>
      )}

      {/* Hit Dice */}
      <div className="flex items-center justify-between py-3 border-t border-fey-sage/20">
        <div>
          <span className="text-sm text-muted-foreground">Hit Dice</span>
          <p className="font-semibold">
            {hitDiceStats.current}/{hitDiceStats.total} {hitDieType}
          </p>
        </div>
        {!isEditing && (
          <Button
            size="sm"
            variant="outline"
            onClick={useHitDie}
            disabled={hitDiceStats.current <= 0}
            className="border-fey-sage/30"
          >
            Use Hit Die
          </Button>
        )}
      </div>

      {/* Death Saves */}
      <div className="pt-3 border-t border-fey-sage/20">
        <div className="flex items-center gap-2 mb-2">
          <Skull className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Death Saves</span>
        </div>
        <div className="flex justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-fey-forest">Successes</span>
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <button
                  key={i}
                  onClick={() => toggleDeathSave("successes", i)}
                  className={`w-5 h-5 rounded-full border-2 transition-colors ${
                    character.deathSaves.successes > i
                      ? "bg-fey-forest border-fey-forest"
                      : "border-fey-sage/50 hover:border-fey-forest"
                  }`}
                  aria-label={`Death save success ${i + 1}`}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-destructive">Failures</span>
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <button
                  key={i}
                  onClick={() => toggleDeathSave("failures", i)}
                  className={`w-5 h-5 rounded-full border-2 transition-colors ${
                    character.deathSaves.failures > i
                      ? "bg-destructive border-destructive"
                      : "border-fey-sage/50 hover:border-destructive"
                  }`}
                  aria-label={`Death save failure ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
