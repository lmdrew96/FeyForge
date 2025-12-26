"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import { useCombatStore, conditions } from "@/lib/combat-store"
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Plus,
  Trash2,
  Dices,
  Shield,
  Heart,
  MoreVertical,
  RotateCcw,
  Swords,
  User,
  Skull,
} from "lucide-react"
import { cn } from "@/lib/utils"

export function InitiativeTracker() {
  const {
    combatants,
    currentTurn,
    round,
    isActive,
    addCombatant,
    removeCombatant,
    updateCombatant,
    nextTurn,
    previousTurn,
    startCombat,
    endCombat,
    resetCombat,
    rollInitiative,
    rollAllInitiatives,
    sortByInitiative,
  } = useCombatStore()

  const [newCombatant, setNewCombatant] = useState({
    name: "",
    initiativeModifier: 0,
    maxHP: 10,
    armorClass: 10,
    isPlayer: true,
  })

  const [dialogOpen, setDialogOpen] = useState(false)

  const handleAddCombatant = () => {
    if (!newCombatant.name) return

    addCombatant({
      name: newCombatant.name,
      initiative: 0,
      initiativeModifier: newCombatant.initiativeModifier,
      currentHP: newCombatant.maxHP,
      maxHP: newCombatant.maxHP,
      armorClass: newCombatant.armorClass,
      conditions: [],
      isPlayer: newCombatant.isPlayer,
      isActive: true,
    })

    setNewCombatant({
      name: "",
      initiativeModifier: 0,
      maxHP: 10,
      armorClass: 10,
      isPlayer: true,
    })
    setDialogOpen(false)
  }

  const handleHPChange = (id: string, delta: number) => {
    const combatant = combatants.find((c) => c.id === id)
    if (!combatant) return

    const newHP = Math.max(0, Math.min(combatant.maxHP, combatant.currentHP + delta))
    updateCombatant(id, { currentHP: newHP })
  }

  const toggleCondition = (id: string, condition: string) => {
    const combatant = combatants.find((c) => c.id === id)
    if (!combatant) return

    const hasCondition = combatant.conditions.includes(condition)
    updateCombatant(id, {
      conditions: hasCondition
        ? combatant.conditions.filter((c) => c !== condition)
        : [...combatant.conditions, condition],
    })
  }

  const currentCombatant = combatants[currentTurn]

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Combat Controls */}
      <Card className="bg-card border-border">
        <CardContent className="p-2.5 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-1.5 sm:gap-2">
                {!isActive ? (
                  <Button
                    onClick={() => {
                      if (combatants.length > 0) {
                        rollAllInitiatives()
                        startCombat()
                      }
                    }}
                    disabled={combatants.length === 0}
                    className="bg-primary hover:bg-primary/90 text-xs sm:text-sm h-8 sm:h-10 px-2 sm:px-4"
                  >
                    <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="hidden xs:inline">Start Combat</span>
                    <span className="xs:hidden">Start</span>
                  </Button>
                ) : (
                  <Button onClick={endCombat} variant="outline" className="border-border bg-transparent text-xs sm:text-sm h-8 sm:h-10 px-2 sm:px-4">
                    <Pause className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    Pause
                  </Button>
                )}
              </div>

              {isActive && (
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" onClick={previousTurn} className="border-border bg-transparent h-8 w-8 sm:h-10 sm:w-10 min-w-[44px] min-h-[44px]">
                    <SkipBack className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={nextTurn} className="border-border bg-transparent h-8 w-8 sm:h-10 sm:w-10 min-w-[44px] min-h-[44px]">
                    <SkipForward className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              {isActive && (
                <Badge variant="outline" className="border-primary text-primary text-sm sm:text-lg px-2 sm:px-4 py-0.5 sm:py-1">
                  Round {round}
                </Badge>
              )}

              <div className="flex items-center gap-1 sm:gap-2">
                <Button
                  variant="outline"
                  onClick={rollAllInitiatives}
                  disabled={combatants.length === 0}
                  className="border-border bg-transparent text-xs sm:text-sm h-8 sm:h-10 px-2 sm:px-3"
                >
                  <Dices className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Roll All</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={sortByInitiative}
                  disabled={combatants.length === 0}
                  className="border-border bg-transparent text-xs sm:text-sm h-8 sm:h-10 px-2 sm:px-3"
                >
                  Sort
                </Button>
                <Button
                  variant="outline"
                  onClick={resetCombat}
                  className="border-border bg-transparent text-destructive hover:text-destructive h-8 w-8 sm:h-10 sm:w-10 p-0 min-w-[44px] min-h-[44px]"
                >
                  <RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
              </div>

              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary hover:bg-primary/90 text-xs sm:text-sm h-8 sm:h-10 px-2 sm:px-4">
                    <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Add Combatant</span>
                    <span className="sm:hidden">Add</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border">
                  <DialogHeader>
                    <DialogTitle className="font-serif text-foreground">Add Combatant</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label className="text-foreground">Name</Label>
                      <Input
                        value={newCombatant.name}
                        onChange={(e) => setNewCombatant((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter name..."
                        className="bg-input border-border"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-foreground">Initiative Mod</Label>
                        <Input
                          type="number"
                          value={newCombatant.initiativeModifier}
                          onChange={(e) =>
                            setNewCombatant((prev) => ({
                              ...prev,
                              initiativeModifier: Number.parseInt(e.target.value) || 0,
                            }))
                          }
                          className="bg-input border-border"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-foreground">Max HP</Label>
                        <Input
                          type="number"
                          value={newCombatant.maxHP}
                          onChange={(e) =>
                            setNewCombatant((prev) => ({ ...prev, maxHP: Number.parseInt(e.target.value) || 1 }))
                          }
                          className="bg-input border-border"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-foreground">AC</Label>
                        <Input
                          type="number"
                          value={newCombatant.armorClass}
                          onChange={(e) =>
                            setNewCombatant((prev) => ({ ...prev, armorClass: Number.parseInt(e.target.value) || 10 }))
                          }
                          className="bg-input border-border"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="isPlayer"
                        checked={newCombatant.isPlayer}
                        onCheckedChange={(checked) => setNewCombatant((prev) => ({ ...prev, isPlayer: checked }))}
                      />
                      <Label htmlFor="isPlayer" className="text-foreground">
                        Player Character
                      </Label>
                    </div>
                    <Button className="w-full bg-primary hover:bg-primary/90" onClick={handleAddCombatant}>
                      Add to Combat
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Turn Display */}
      {isActive && currentCombatant && (
        <Card className="bg-card border-primary border-glow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "h-12 w-12 rounded-full flex items-center justify-center",
                    currentCombatant.isPlayer ? "bg-primary/20" : "bg-destructive/20",
                  )}
                >
                  {currentCombatant.isPlayer ? (
                    <User className="h-6 w-6 text-primary" />
                  ) : (
                    <Skull className="h-6 w-6 text-destructive" />
                  )}
                </div>
                <div>
                  <h2 className="font-serif text-2xl font-bold text-foreground">{currentCombatant.name}'s Turn</h2>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Heart className="h-4 w-4" />
                      {currentCombatant.currentHP}/{currentCombatant.maxHP}
                    </span>
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Shield className="h-4 w-4" />
                      AC {currentCombatant.armorClass}
                    </span>
                  </div>
                </div>
              </div>
              <Button onClick={nextTurn} className="bg-primary hover:bg-primary/90">
                End Turn
                <SkipForward className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Combatant List */}
      {combatants.length === 0 ? (
        <Card className="bg-card border-border border-dashed">
          <CardContent className="p-12 text-center">
            <Swords className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-4" />
            <h3 className="font-serif text-xl font-bold text-foreground mb-2">No Combatants</h3>
            <p className="text-muted-foreground mb-4">Add players and monsters to begin tracking initiative</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {combatants.map((combatant, index) => {
            const isCurrentTurn = isActive && index === currentTurn
            const isDead = combatant.currentHP <= 0
            const hpPercentage = (combatant.currentHP / combatant.maxHP) * 100

            return (
              <Card
                key={combatant.id}
                className={cn(
                  "bg-card border transition-all",
                  isCurrentTurn ? "border-primary border-glow" : "border-border",
                  isDead && "opacity-50",
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Initiative */}
                    <div className="text-center w-14 shrink-0">
                      <button
                        onClick={() => rollInitiative(combatant.id)}
                        className="text-3xl font-bold text-gold-gradient hover:opacity-80 transition-opacity"
                      >
                        {combatant.initiative || "—"}
                      </button>
                      <p className="text-xs text-muted-foreground">Init</p>
                    </div>

                    {/* Avatar/Icon */}
                    <div
                      className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                        combatant.isPlayer ? "bg-primary/20" : "bg-destructive/20",
                      )}
                    >
                      {combatant.isPlayer ? (
                        <User className="h-5 w-5 text-primary" />
                      ) : (
                        <Skull className="h-5 w-5 text-destructive" />
                      )}
                    </div>

                    {/* Name & Stats */}
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3
                          className={cn(
                            "font-medium truncate flex-1 min-w-0",
                            isDead ? "text-muted-foreground line-through" : "text-foreground",
                          )}
                        >
                          {combatant.name}
                        </h3>
                        {isDead && (
                          <Badge variant="destructive" className="text-xs">
                            Dead
                          </Badge>
                        )}
                      </div>

                      {/* HP Bar */}
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex-1">
                          <Progress
                            value={hpPercentage}
                            className={cn(
                              "h-2 bg-muted",
                              hpPercentage <= 25 && "[&>div]:bg-destructive",
                              hpPercentage > 25 && hpPercentage <= 50 && "[&>div]:bg-yellow-500",
                            )}
                          />
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleHPChange(combatant.id, -1)}
                          >
                            <span className="text-destructive">-</span>
                          </Button>
                          <span className="text-sm font-medium text-foreground w-16 text-center">
                            {combatant.currentHP}/{combatant.maxHP}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleHPChange(combatant.id, 1)}
                          >
                            <span className="text-green-500">+</span>
                          </Button>
                        </div>
                      </div>

                      {/* Conditions */}
                      {combatant.conditions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {combatant.conditions.map((condition) => (
                            <Badge
                              key={condition}
                              variant="outline"
                              className="text-xs cursor-pointer border-destructive/50 text-destructive"
                              onClick={() => toggleCondition(combatant.id, condition)}
                            >
                              {condition} ×
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* AC */}
                    <div className="text-center">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Shield className="h-4 w-4" />
                        <span className="font-medium text-foreground">{combatant.armorClass}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover border-border w-48">
                        <DropdownMenuItem onClick={() => rollInitiative(combatant.id)} className="focus:bg-accent">
                          <Dices className="h-4 w-4 mr-2" />
                          Roll Initiative
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleHPChange(combatant.id, -5)} className="focus:bg-accent">
                          <Heart className="h-4 w-4 mr-2" />
                          Damage (5)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleHPChange(combatant.id, 5)} className="focus:bg-accent">
                          <Heart className="h-4 w-4 mr-2" />
                          Heal (5)
                        </DropdownMenuItem>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="flex items-center px-2 py-1.5 text-sm w-full hover:bg-accent rounded-sm">
                            Add Condition
                          </DropdownMenuTrigger>
                          <DropdownMenuContent side="right" className="bg-popover border-border">
                            <ScrollArea className="h-[200px]">
                              {conditions.map((condition) => (
                                <DropdownMenuItem
                                  key={condition}
                                  onClick={() => toggleCondition(combatant.id, condition)}
                                  className="focus:bg-accent"
                                >
                                  {combatant.conditions.includes(condition) && "✓ "}
                                  {condition}
                                </DropdownMenuItem>
                              ))}
                            </ScrollArea>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <DropdownMenuItem
                          onClick={() => removeCombatant(combatant.id)}
                          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
