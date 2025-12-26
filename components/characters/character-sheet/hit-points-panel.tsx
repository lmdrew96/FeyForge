"use client"

/**
 * Hit Points Panel Component
 * Manages current, max, and temporary HP with visual feedback
 */

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Heart, Plus, Minus, Shield, Skull, RotateCcw } from "lucide-react"
import type { HitPoints, DeathSaves } from "@/lib/character/types"

interface HitPointsPanelProps {
  hitPoints: HitPoints
  onHPChange?: (current: number, temp?: number) => void
  onHeal?: (amount: number) => void
  onDamage?: (amount: number) => void
}

export function HitPointsPanel({ 
  hitPoints, 
  onHPChange,
  onHeal,
  onDamage,
}: HitPointsPanelProps) {
  const [inputValue, setInputValue] = useState("")
  const [mode, setMode] = useState<"heal" | "damage">("damage")

  const hpPercentage = (hitPoints.current / hitPoints.max) * 100
  const effectiveHP = hitPoints.current + hitPoints.temp

  const handleApply = () => {
    const amount = parseInt(inputValue) || 0
    if (amount <= 0) return

    if (mode === "heal" && onHeal) {
      onHeal(amount)
    } else if (mode === "damage" && onDamage) {
      onDamage(amount)
    }
    setInputValue("")
  }

  const getHPColor = () => {
    if (hpPercentage <= 25) return "bg-red-500"
    if (hpPercentage <= 50) return "bg-yellow-500"
    return "bg-green-500"
  }

  const getHPTextColor = () => {
    if (hitPoints.current === 0) return "text-red-500"
    if (hpPercentage <= 25) return "text-red-400"
    if (hpPercentage <= 50) return "text-yellow-400"
    return "text-green-400"
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 sm:pb-3">
        <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1.5 sm:gap-2">
          <Heart className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-400" />
          Hit Points
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3 sm:space-y-4">
        {/* HP Display */}
        <div className="text-center">
          <div className="flex items-baseline justify-center gap-0.5 sm:gap-1">
            <span className={`text-2xl sm:text-4xl font-bold ${getHPTextColor()}`}>
              {hitPoints.current}
            </span>
            <span className="text-lg sm:text-2xl text-muted-foreground">/</span>
            <span className="text-lg sm:text-2xl text-muted-foreground">{hitPoints.max}</span>
          </div>
          {hitPoints.temp > 0 && (
            <Badge variant="secondary" className="mt-1 text-[10px] sm:text-xs">
              <Shield className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
              +{hitPoints.temp} Temp HP
            </Badge>
          )}
        </div>

        {/* HP Bar */}
        <div className="space-y-0.5 sm:space-y-1">
          <Progress 
            value={hpPercentage} 
            className="h-2 sm:h-3"
          />
          {hitPoints.temp > 0 && (
            <div className="h-0.5 sm:h-1 bg-blue-500/50 rounded-full" 
              style={{ width: `${(hitPoints.temp / hitPoints.max) * 100}%` }} 
            />
          )}
        </div>

        {/* HP Controls */}
        {(onHeal || onDamage) && (
          <div className="space-y-2 sm:space-y-3">
            {/* Mode Toggle */}
            <div className="flex rounded-lg border border-border bg-muted/50 p-0.5">
              <button
                onClick={() => setMode("damage")}
                className={`flex-1 flex items-center justify-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-md transition-all min-h-[36px] sm:min-h-[40px] ${
                  mode === "damage"
                    ? "bg-red-500 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Minus className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                Damage
              </button>
              <button
                onClick={() => setMode("heal")}
                className={`flex-1 flex items-center justify-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-md transition-all min-h-[36px] sm:min-h-[40px] ${
                  mode === "heal"
                    ? "bg-green-500 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Plus className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                Heal
              </button>
            </div>

            {/* Input */}
            <div className="flex gap-1.5 sm:gap-2">
              <Input
                type="number"
                min={1}
                placeholder="Amount..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleApply()}
                className="bg-input border-border h-9 sm:h-10 text-sm"
              />
              <Button
                onClick={handleApply}
                disabled={!inputValue || parseInt(inputValue) <= 0}
                className={`h-9 sm:h-10 text-xs sm:text-sm px-3 sm:px-4 ${mode === "heal" ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"}`}
              >
                Apply
              </Button>
            </div>

            {/* Quick Buttons */}
            <div className="flex gap-1 flex-wrap">
              {[1, 5, 10].map((amount) => (
                <Button
                  key={amount}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (mode === "heal" && onHeal) onHeal(amount)
                    else if (mode === "damage" && onDamage) onDamage(amount)
                  }}
                  className={`text-xs h-8 sm:h-9 min-w-[44px] ${
                    mode === "heal" 
                      ? "border-green-500/50 text-green-500 hover:bg-green-500/10" 
                      : "border-red-500/50 text-red-500 hover:bg-red-500/10"
                  }`}
                >
                  {mode === "heal" ? "+" : "-"}{amount}
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Death Saves Panel Component
 */
interface DeathSavesPanelProps {
  deathSaves: DeathSaves
  onAddSuccess?: () => void
  onAddFailure?: () => void
  onReset?: () => void
}

export function DeathSavesPanel({ 
  deathSaves, 
  onAddSuccess,
  onAddFailure,
  onReset,
}: DeathSavesPanelProps) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Skull className="h-4 w-4 text-gray-400" />
          Death Saves
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Successes */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Successes</span>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full border-2 ${
                    i < deathSaves.successes
                      ? "bg-green-500 border-green-500"
                      : "border-muted-foreground"
                  }`}
                />
              ))}
            </div>
            {onAddSuccess && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onAddSuccess}
                disabled={deathSaves.successes >= 3}
                className="h-6 w-6"
              >
                <Plus className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Failures */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Failures</span>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full border-2 ${
                    i < deathSaves.failures
                      ? "bg-red-500 border-red-500"
                      : "border-muted-foreground"
                  }`}
                />
              ))}
            </div>
            {onAddFailure && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onAddFailure}
                disabled={deathSaves.failures >= 3}
                className="h-6 w-6"
              >
                <Plus className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Reset */}
        {onReset && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onReset}
            className="w-full text-muted-foreground"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
