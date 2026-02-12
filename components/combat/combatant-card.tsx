"use client"

import { useState } from "react"
import { Shield, Plus, Minus, Trash2, ChevronDown, ChevronUp, Skull, User, Bug, Crown, Sparkles, X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCombatStore, type Combatant, type Condition } from "@/lib/combat-store"
import { cn } from "@/lib/utils"

const CONDITIONS: { value: Condition; label: string; color: string }[] = [
  { value: "blinded", label: "Blinded", color: "bg-gray-500" },
  { value: "charmed", label: "Charmed", color: "bg-pink-500" },
  { value: "deafened", label: "Deafened", color: "bg-gray-400" },
  { value: "frightened", label: "Frightened", color: "bg-yellow-600" },
  { value: "grappled", label: "Grappled", color: "bg-orange-500" },
  { value: "incapacitated", label: "Incapacitated", color: "bg-red-400" },
  { value: "invisible", label: "Invisible", color: "bg-blue-300" },
  { value: "paralyzed", label: "Paralyzed", color: "bg-yellow-400" },
  { value: "petrified", label: "Petrified", color: "bg-stone-500" },
  { value: "poisoned", label: "Poisoned", color: "bg-green-600" },
  { value: "prone", label: "Prone", color: "bg-amber-600" },
  { value: "restrained", label: "Restrained", color: "bg-orange-600" },
  { value: "stunned", label: "Stunned", color: "bg-purple-500" },
  { value: "unconscious", label: "Unconscious", color: "bg-gray-700" },
  { value: "exhaustion", label: "Exhaustion", color: "bg-amber-800" },
  { value: "concentrating", label: "Concentrating", color: "bg-fey-cyan" },
]

interface CombatantCardProps {
  combatant: Combatant
  index: number
}

export function CombatantCard({ combatant, index }: CombatantCardProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [hpAdjust, setHpAdjust] = useState("")
  const [tempHpInput, setTempHpInput] = useState("")

  const {
    updateCombatant,
    removeCombatant,
    adjustHP,
    setTempHP,
    addCondition,
    removeCondition,
    addDeathSave,
    resetDeathSaves,
    setActiveCombatant,
  } = useCombatStore()

  const hpPercent = (combatant.hitPoints.current / combatant.hitPoints.max) * 100
  const isDead = combatant.hitPoints.current <= 0
  const isUnconscious = combatant.conditions.includes("unconscious")

  const getTypeIcon = () => {
    switch (combatant.type) {
      case "pc":
        return <User className="h-4 w-4" />
      case "npc":
        return <Crown className="h-4 w-4" />
      case "monster":
        return <Bug className="h-4 w-4" />
    }
  }

  const handleHPAdjust = (amount: number) => {
    adjustHP(combatant.id, amount)
  }

  const handleCustomHPAdjust = (isDamage: boolean) => {
    const value = Number.parseInt(hpAdjust)
    if (!isNaN(value) && value > 0) {
      adjustHP(combatant.id, isDamage ? -value : value)
      setHpAdjust("")
    }
  }

  const handleSetTempHP = () => {
    const value = Number.parseInt(tempHpInput)
    if (!isNaN(value)) {
      setTempHP(combatant.id, value)
      setTempHpInput("")
    }
  }

  return (
    <Card
      className={cn(
        "transition-all duration-200 overflow-hidden",
        combatant.isActive && "ring-2 ring-fey-cyan shadow-lg shadow-fey-cyan/20",
        isDead && "opacity-60",
      )}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        {/* Main Card Header - Always Visible */}
        <div
          className={cn("p-3 sm:p-4 cursor-pointer", combatant.isActive && "bg-fey-cyan/10")}
          onClick={() => setActiveCombatant(index)}
        >
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Initiative Badge */}
            <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-lg sm:text-xl font-bold text-primary">{combatant.initiative}</span>
            </div>

            {/* Name & Type */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground flex-shrink-0">{getTypeIcon()}</span>
                <h3 className="font-semibold text-foreground truncate text-sm sm:text-base">{combatant.name}</h3>
                {combatant.isActive && (
                  <Badge variant="outline" className="border-fey-cyan text-fey-cyan flex-shrink-0 text-xs">
                    Active
                  </Badge>
                )}
              </div>

              {/* HP Bar */}
              <div className="mt-1 sm:mt-2 flex items-center gap-2">
                <div
                  className="flex-1 h-2 sm:h-3 bg-muted rounded-full overflow-hidden"
                  role="progressbar"
                  aria-label={`${combatant.name} HP: ${combatant.hitPoints.current} of ${combatant.hitPoints.max}${hpPercent <= 25 ? " - critical" : hpPercent <= 50 ? " - injured" : ""}`}
                  aria-valuenow={combatant.hitPoints.current}
                  aria-valuemin={0}
                  aria-valuemax={combatant.hitPoints.max}
                >
                  <div
                    className={cn(
                      "h-full transition-all duration-300",
                      hpPercent > 50 && "bg-green-500",
                      hpPercent <= 50 && hpPercent > 25 && "bg-yellow-500",
                      hpPercent <= 25 && "bg-red-500",
                    )}
                    style={{ width: `${Math.max(0, hpPercent)}%` }}
                  />
                </div>
                <span className="text-xs sm:text-sm font-medium text-foreground/80 flex-shrink-0 min-w-0">
                  <span className="hidden sm:inline">
                    {combatant.hitPoints.current}/{combatant.hitPoints.max}
                  </span>
                  <span className="sm:hidden">{combatant.hitPoints.current}</span>
                  {combatant.hitPoints.temp > 0 && (
                    <span className="text-fey-cyan ml-1">+{combatant.hitPoints.temp}</span>
                  )}
                </span>
              </div>
            </div>

            {/* AC & Quick Actions */}
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded-md">
                <Shield className="h-3 w-3 sm:h-4 sm:w-4 text-fey-silver" />
                <span className="text-xs sm:text-sm font-medium">{combatant.armorClass}</span>
              </div>

              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>

          {/* Conditions Row */}
          {combatant.conditions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {combatant.conditions.map((condition) => {
                const condInfo = CONDITIONS.find((c) => c.value === condition)
                return (
                  <Badge key={condition} variant="secondary" className={cn("text-xs text-white", condInfo?.color)}>
                    {condInfo?.label}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeCondition(combatant.id, condition)
                      }}
                      className="ml-1 hover:text-white/80"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )
              })}
            </div>
          )}
        </div>

        {/* Expanded Content */}
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-3 sm:px-4 space-y-4 border-t border-border">
            {/* HP Adjustment */}
            <div className="space-y-2 pt-3">
              <label className="text-sm font-medium text-foreground/80">HP Adjustment</label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleHPAdjust(-1)}
                  className="text-red-500 border-red-500/50 hover:bg-red-500/10"
                >
                  <Minus className="h-3 w-3 mr-1" />1
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleHPAdjust(-5)}
                  className="text-red-500 border-red-500/50 hover:bg-red-500/10"
                >
                  <Minus className="h-3 w-3 mr-1" />5
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleHPAdjust(1)}
                  className="text-green-500 border-green-500/50 hover:bg-green-500/10"
                >
                  <Plus className="h-3 w-3 mr-1" />1
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleHPAdjust(5)}
                  className="text-green-500 border-green-500/50 hover:bg-green-500/10"
                >
                  <Plus className="h-3 w-3 mr-1" />5
                </Button>
              </div>

              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Amount"
                  value={hpAdjust}
                  onChange={(e) => setHpAdjust(e.target.value)}
                  className="flex-1 h-9"
                  min="1"
                />
                <Button variant="outline" size="sm" onClick={() => handleCustomHPAdjust(true)} className="text-red-500">
                  Damage
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCustomHPAdjust(false)}
                  className="text-green-500"
                >
                  Heal
                </Button>
              </div>
            </div>

            {/* Temp HP */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/80">Temporary HP</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Temp HP"
                  value={tempHpInput}
                  onChange={(e) => setTempHpInput(e.target.value)}
                  className="flex-1 h-9"
                  min="0"
                />
                <Button variant="outline" size="sm" onClick={handleSetTempHP}>
                  <Sparkles className="h-3 w-3 mr-1" />
                  Set
                </Button>
              </div>
            </div>

            {/* Conditions */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/80">Add Condition</label>
              <Select onValueChange={(value) => addCondition(combatant.id, value as Condition)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select condition..." />
                </SelectTrigger>
                <SelectContent>
                  {CONDITIONS.filter((c) => !combatant.conditions.includes(c.value)).map((condition) => (
                    <SelectItem key={condition.value} value={condition.value}>
                      {condition.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Death Saves (PC only) */}
            {combatant.type === "pc" && combatant.deathSaves && isDead && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                  <Skull className="h-4 w-4" />
                  Death Saves
                </label>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-green-500">Successes:</span>
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <button
                          key={`success-${i}`}
                          onClick={() => {
                            if (combatant.deathSaves!.successes > i) {
                              resetDeathSaves(combatant.id)
                            } else {
                              addDeathSave(combatant.id, true)
                            }
                          }}
                          className={cn(
                            "w-5 h-5 rounded-full border-2 transition-colors",
                            combatant.deathSaves!.successes > i
                              ? "bg-green-500 border-green-500"
                              : "border-green-500/50",
                          )}
                          aria-label={`Death save success ${i + 1}`}
                          aria-pressed={combatant.deathSaves!.successes > i}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-red-500">Failures:</span>
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <button
                          key={`failure-${i}`}
                          onClick={() => {
                            if (combatant.deathSaves!.failures > i) {
                              resetDeathSaves(combatant.id)
                            } else {
                              addDeathSave(combatant.id, false)
                            }
                          }}
                          className={cn(
                            "w-5 h-5 rounded-full border-2 transition-colors",
                            combatant.deathSaves!.failures > i ? "bg-red-500 border-red-500" : "border-red-500/50",
                          )}
                          aria-label={`Death save failure ${i + 1}`}
                          aria-pressed={combatant.deathSaves!.failures > i}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Edit Stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-foreground/70">Initiative</label>
                <Input
                  type="number"
                  value={combatant.initiative}
                  onChange={(e) => updateCombatant(combatant.id, { initiative: Number.parseInt(e.target.value) || 0 })}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-foreground/70">AC</label>
                <Input
                  type="number"
                  value={combatant.armorClass}
                  onChange={(e) => updateCombatant(combatant.id, { armorClass: Number.parseInt(e.target.value) || 10 })}
                  className="h-9"
                />
              </div>
            </div>

            {/* Remove Button */}
            <Button variant="destructive" size="sm" onClick={() => removeCombatant(combatant.id)} className="w-full">
              <Trash2 className="h-4 w-4 mr-2" />
              Remove from Combat
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
