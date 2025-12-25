"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  parseDiceNotation,
  rollDice,
  rollWithAdvantage,
  rollWithDisadvantage,
  formatDiceNotation,
  standardDice,
  commonRolls,
  type DiceRoll,
  type DiceConfig,
} from "@/lib/dice"
import { Dices, Plus, Minus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

export function DiceRoller() {
  const [customDice, setCustomDice] = useState("")
  const [config, setConfig] = useState<DiceConfig>({ count: 1, sides: 20, modifier: 0 })
  const [advantage, setAdvantage] = useState(false)
  const [disadvantage, setDisadvantage] = useState(false)
  const [history, setHistory] = useState<DiceRoll[]>([])
  const [lastRoll, setLastRoll] = useState<DiceRoll | null>(null)
  const [isRolling, setIsRolling] = useState(false)

  const performRoll = useCallback(
    (overrideConfig?: DiceConfig, label?: string) => {
      const rollConfig = overrideConfig || config
      setIsRolling(true)

      setTimeout(() => {
        let rolls: number[]
        let total: number
        let criticalHit = false
        let criticalMiss = false

        if (rollConfig.sides === 20 && rollConfig.count === 1) {
          if (advantage && !disadvantage) {
            const result = rollWithAdvantage(20)
            rolls = result.rolls
            total = result.result + rollConfig.modifier
            criticalHit = result.result === 20
            criticalMiss = result.result === 1
          } else if (disadvantage && !advantage) {
            const result = rollWithDisadvantage(20)
            rolls = result.rolls
            total = result.result + rollConfig.modifier
            criticalHit = result.result === 20
            criticalMiss = result.result === 1
          } else {
            rolls = rollDice(rollConfig)
            total = rolls.reduce((a, b) => a + b, 0) + rollConfig.modifier
            criticalHit = rolls[0] === 20
            criticalMiss = rolls[0] === 1
          }
        } else {
          rolls = rollDice(rollConfig)
          total = rolls.reduce((a, b) => a + b, 0) + rollConfig.modifier
        }

        const roll: DiceRoll = {
          id: crypto.randomUUID(),
          dice: formatDiceNotation(rollConfig),
          rolls,
          modifier: rollConfig.modifier,
          total,
          advantage: advantage && rollConfig.sides === 20 && rollConfig.count === 1,
          disadvantage: disadvantage && rollConfig.sides === 20 && rollConfig.count === 1,
          criticalHit,
          criticalMiss,
          timestamp: new Date(),
          label,
        }

        setLastRoll(roll)
        setHistory((prev) => [roll, ...prev].slice(0, 50))
        setIsRolling(false)
      }, 300)
    },
    [config, advantage, disadvantage],
  )

  const handleQuickRoll = (sides: number) => {
    setConfig((prev) => ({ ...prev, sides }))
    performRoll({ ...config, sides })
  }

  const handleCustomRoll = () => {
    const parsed = parseDiceNotation(customDice)
    if (parsed) {
      setConfig(parsed)
      performRoll(parsed)
    }
  }

  const handleCommonRoll = (dice: string, label: string) => {
    const parsed = parseDiceNotation(dice)
    if (parsed) {
      performRoll(parsed, label)
    }
  }

  const clearHistory = () => {
    setHistory([])
    setLastRoll(null)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Main Roller */}
      <div className="lg:col-span-2 space-y-6">
        {/* Result Display */}
        <Card className="bg-card border-border border-glow">
          <CardContent className="p-8">
            <div className="text-center">
              {lastRoll ? (
                <>
                  <div
                    className={cn(
                      "text-7xl font-bold font-serif mb-4 transition-all",
                      isRolling && "animate-pulse",
                      lastRoll.criticalHit && "text-primary animate-glow-pulse",
                      lastRoll.criticalMiss && "text-destructive",
                      !lastRoll.criticalHit && !lastRoll.criticalMiss && "text-gold-gradient",
                    )}
                  >
                    {lastRoll.total}
                  </div>
                  {lastRoll.criticalHit && (
                    <Badge className="bg-primary/20 text-primary border-primary/50 text-lg px-4 py-1 mb-2">
                      CRITICAL HIT!
                    </Badge>
                  )}
                  {lastRoll.criticalMiss && (
                    <Badge className="bg-destructive/20 text-destructive border-destructive/50 text-lg px-4 py-1 mb-2">
                      CRITICAL MISS!
                    </Badge>
                  )}
                  <div className="text-muted-foreground">
                    <span className="font-medium">{lastRoll.dice}</span>
                    {lastRoll.label && <span className="ml-2">({lastRoll.label})</span>}
                  </div>
                  <div className="text-sm text-muted-foreground mt-2">
                    Rolls: [{lastRoll.rolls.join(", ")}]
                    {lastRoll.modifier !== 0 && (
                      <span className="ml-1">
                        {lastRoll.modifier > 0 ? "+" : ""}
                        {lastRoll.modifier}
                      </span>
                    )}
                  </div>
                  {(lastRoll.advantage || lastRoll.disadvantage) && (
                    <Badge variant="outline" className="mt-2 border-border text-muted-foreground">
                      {lastRoll.advantage ? "Advantage" : "Disadvantage"}
                    </Badge>
                  )}
                </>
              ) : (
                <div className="text-6xl text-muted-foreground font-serif">
                  <Dices className="h-24 w-24 mx-auto opacity-30" />
                  <p className="text-lg mt-4">Roll the dice!</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Dice Buttons */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-serif text-foreground">Quick Roll</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {standardDice.map((sides) => (
                <Button
                  key={sides}
                  variant={config.sides === sides ? "default" : "outline"}
                  className={cn(
                    "h-16 text-lg font-bold",
                    config.sides === sides
                      ? "bg-primary text-primary-foreground"
                      : "border-border hover:border-primary/50 bg-transparent",
                  )}
                  onClick={() => handleQuickRoll(sides)}
                >
                  d{sides}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Custom Roller */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-serif text-foreground">Custom Roll</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {/* Dice Count */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">Count</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="border-border bg-transparent"
                    onClick={() => setConfig((prev) => ({ ...prev, count: Math.max(1, prev.count - 1) }))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={config.count}
                    onChange={(e) => setConfig((prev) => ({ ...prev, count: Number.parseInt(e.target.value) || 1 }))}
                    className="text-center bg-input border-border"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="border-border bg-transparent"
                    onClick={() => setConfig((prev) => ({ ...prev, count: Math.min(100, prev.count + 1) }))}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Dice Sides */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">Sides</Label>
                <Input
                  type="number"
                  min={2}
                  max={100}
                  value={config.sides}
                  onChange={(e) => setConfig((prev) => ({ ...prev, sides: Number.parseInt(e.target.value) || 6 }))}
                  className="text-center bg-input border-border"
                />
              </div>

              {/* Modifier */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">Modifier</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="border-border bg-transparent"
                    onClick={() => setConfig((prev) => ({ ...prev, modifier: prev.modifier - 1 }))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    value={config.modifier}
                    onChange={(e) => setConfig((prev) => ({ ...prev, modifier: Number.parseInt(e.target.value) || 0 }))}
                    className="text-center bg-input border-border"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="border-border bg-transparent"
                    onClick={() => setConfig((prev) => ({ ...prev, modifier: prev.modifier + 1 }))}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Advantage/Disadvantage */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="advantage"
                  checked={advantage}
                  onCheckedChange={(checked) => {
                    setAdvantage(checked)
                    if (checked) setDisadvantage(false)
                  }}
                />
                <Label htmlFor="advantage" className="text-foreground">
                  Advantage
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="disadvantage"
                  checked={disadvantage}
                  onCheckedChange={(checked) => {
                    setDisadvantage(checked)
                    if (checked) setAdvantage(false)
                  }}
                />
                <Label htmlFor="disadvantage" className="text-foreground">
                  Disadvantage
                </Label>
              </div>
            </div>

            {/* Roll Button */}
            <Button
              className="w-full h-14 text-lg bg-primary hover:bg-primary/90 border-glow"
              onClick={() => performRoll()}
              disabled={isRolling}
            >
              <Dices className={cn("h-5 w-5 mr-2", isRolling && "animate-spin")} />
              Roll {formatDiceNotation(config)}
            </Button>

            {/* Custom Notation */}
            <div className="flex gap-2">
              <Input
                placeholder="Enter dice notation (e.g., 2d6+3)"
                value={customDice}
                onChange={(e) => setCustomDice(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCustomRoll()}
                className="bg-input border-border"
              />
              <Button variant="outline" onClick={handleCustomRoll} className="border-border bg-transparent">
                Roll
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        {/* Common Rolls */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-serif text-foreground">Common Rolls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {commonRolls.map((roll) => (
              <Button
                key={roll.name}
                variant="outline"
                className="w-full justify-start border-border hover:border-primary/50 bg-transparent"
                onClick={() => handleCommonRoll(roll.dice, roll.name)}
              >
                <span className="flex-1 text-left">
                  <span className="text-foreground">{roll.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">({roll.dice})</span>
                </span>
              </Button>
            ))}
          </CardContent>
        </Card>

        {/* Roll History */}
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-serif text-foreground">History</CardTitle>
            {history.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearHistory}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No rolls yet</p>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {history.map((roll) => (
                    <div
                      key={roll.id}
                      className={cn(
                        "p-3 rounded-lg border",
                        roll.criticalHit
                          ? "border-primary/50 bg-primary/10"
                          : roll.criticalMiss
                            ? "border-destructive/50 bg-destructive/10"
                            : "border-border bg-accent/30",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">{roll.dice}</span>
                        <span
                          className={cn(
                            "text-xl font-bold",
                            roll.criticalHit
                              ? "text-primary"
                              : roll.criticalMiss
                                ? "text-destructive"
                                : "text-foreground",
                          )}
                        >
                          {roll.total}
                        </span>
                      </div>
                      {roll.label && <p className="text-xs text-muted-foreground">{roll.label}</p>}
                      <p className="text-xs text-muted-foreground mt-1">[{roll.rolls.join(", ")}]</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
