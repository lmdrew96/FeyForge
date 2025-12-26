"use client"

import { useState, useCallback, useEffect } from "react"
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
import { Dices, Plus, Minus, Trash2, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSettingsStore } from "@/lib/settings-store"
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion"
import { useDiceSounds } from "@/lib/hooks/use-dice-sounds"
import { CritParticles } from "./crit-particles"

export function DiceRoller() {
  const [customDice, setCustomDice] = useState("")
  const [config, setConfig] = useState<DiceConfig>({ count: 1, sides: 20, modifier: 0 })
  const [advantage, setAdvantage] = useState(false)
  const [disadvantage, setDisadvantage] = useState(false)
  const [history, setHistory] = useState<DiceRoll[]>([])
  const [lastRoll, setLastRoll] = useState<DiceRoll | null>(null)
  const [isRolling, setIsRolling] = useState(false)
  const [showParticles, setShowParticles] = useState(false)
  const [lastConfig, setLastConfig] = useState<DiceConfig | null>(null)

  const animationEnabled = useSettingsStore((s) => s.diceAnimation)
  const prefersReducedMotion = useReducedMotion()
  const { playRollSound, playCritSound } = useDiceSounds()
  const shouldAnimate = animationEnabled && !prefersReducedMotion

  const performRoll = useCallback(
    (overrideConfig?: DiceConfig, label?: string) => {
      const rollConfig = overrideConfig || config
      setLastConfig(rollConfig)
      setIsRolling(true)
      setShowParticles(false)
      playRollSound()

      const animationDuration = shouldAnimate ? 1200 : 300

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

        if (criticalHit || criticalMiss) {
          playCritSound(criticalHit)
          setShowParticles(true)
          setTimeout(() => setShowParticles(false), 1000)
        }

        setLastRoll(roll)
        setHistory((prev) => [roll, ...prev].slice(0, 50))
        setIsRolling(false)
      }, animationDuration)
    },
    [config, advantage, disadvantage, playRollSound, playCritSound, shouldAnimate],
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return
      if (e.code === "Space" && lastConfig && !isRolling) {
        e.preventDefault()
        performRoll(lastConfig, lastRoll?.label)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [lastConfig, lastRoll?.label, isRolling, performRoll])

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
    if (parsed) performRoll(parsed, label)
  }

  const clearHistory = () => {
    setHistory([])
    setLastRoll(null)
  }

  return (
    <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-3">
      {/* Main Roller */}
      <div className="lg:col-span-2 space-y-4 sm:space-y-6">
        <Card className="glass-card border-glow">
          <CardContent className="p-4 sm:p-6 md:p-8 lg:p-12">
            <div className="text-center relative min-h-[200px] sm:min-h-[240px] md:min-h-[280px] flex flex-col items-center justify-center">
              <CritParticles
                type={lastRoll?.criticalHit ? "hit" : "miss"}
                active={showParticles && (lastRoll?.criticalHit || lastRoll?.criticalMiss || false)}
              />

              {isRolling ? (
                <div className="py-4 sm:py-8">
                  <Dices
                    className={cn(
                      "h-20 w-20 sm:h-24 sm:w-24 md:h-32 md:w-32 mx-auto text-primary",
                      shouldAnimate && "animate-dice-tumble",
                    )}
                  />
                  <p className="text-base sm:text-lg md:text-xl mt-4 sm:mt-6 text-muted-foreground animate-pulse">
                    Rolling...
                  </p>
                </div>
              ) : lastRoll ? (
                <>
                  <div
                    className={cn(
                      "dice-result mb-3 sm:mb-6",
                      shouldAnimate && "animate-result-pop",
                      lastRoll.criticalHit && "crit-hit",
                      lastRoll.criticalMiss && "crit-miss",
                      !lastRoll.criticalHit && !lastRoll.criticalMiss && "text-gold-gradient",
                    )}
                  >
                    {lastRoll.total}
                  </div>
                  {lastRoll.criticalHit && (
                    <Badge className="badge-emerald text-sm sm:text-lg md:text-xl px-3 sm:px-4 md:px-6 py-1 sm:py-2 mb-2 sm:mb-4 animate-gentle-pulse">
                      NATURAL 20!
                    </Badge>
                  )}
                  {lastRoll.criticalMiss && (
                    <Badge className="bg-destructive/20 text-destructive border-destructive/50 text-sm sm:text-lg md:text-xl px-3 sm:px-4 md:px-6 py-1 sm:py-2 mb-2 sm:mb-4 animate-gentle-pulse">
                      NATURAL 1!
                    </Badge>
                  )}
                  <div className="text-sm sm:text-base md:text-lg text-muted-foreground">
                    <span className="font-semibold text-foreground">{lastRoll.dice}</span>
                    {lastRoll.label && <span className="ml-2 text-primary">({lastRoll.label})</span>}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground mt-2 sm:mt-3">
                    Rolls: [{lastRoll.rolls.join(", ")}]
                    {lastRoll.modifier !== 0 && (
                      <span className="ml-1 text-primary">
                        {lastRoll.modifier > 0 ? "+" : ""}
                        {lastRoll.modifier}
                      </span>
                    )}
                  </div>
                  {(lastRoll.advantage || lastRoll.disadvantage) && (
                    <Badge variant="outline" className="mt-3 border-border">
                      {lastRoll.advantage ? "Advantage" : "Disadvantage"}
                    </Badge>
                  )}
                </>
              ) : (
                <div className="text-center py-4 sm:py-8">
                  <Dices className="h-20 w-20 sm:h-24 sm:w-24 md:h-32 md:w-32 mx-auto text-muted-foreground/30 animate-float-gentle" />
                  <p className="text-base sm:text-lg md:text-xl mt-4 sm:mt-6 text-muted-foreground">
                    Click a die to roll!
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-silver">Quick Roll</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 xs:grid-cols-5 sm:grid-cols-7 gap-1.5 sm:gap-2 md:gap-3">
              {standardDice.map((sides) => (
                <Button
                  key={sides}
                  variant={config.sides === sides ? "default" : "outline"}
                  className={cn("dice-button", config.sides === sides && "active")}
                  onClick={() => handleQuickRoll(sides)}
                >
                  d{sides}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Custom Roller */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-silver">Custom Roll</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-muted-foreground text-xs sm:text-sm">Count</Label>
                <div className="flex items-center gap-1 sm:gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 sm:h-9 sm:w-9 min-w-[44px] min-h-[44px] flex items-center justify-center bg-transparent"
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
                    className="text-center text-lg font-bold"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 sm:h-9 sm:w-9 min-w-[44px] min-h-[44px] flex items-center justify-center bg-transparent"
                    onClick={() => setConfig((prev) => ({ ...prev, count: Math.min(100, prev.count + 1) }))}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-muted-foreground text-xs sm:text-sm">Sides</Label>
                <Input
                  type="number"
                  min={2}
                  max={100}
                  value={config.sides}
                  onChange={(e) => setConfig((prev) => ({ ...prev, sides: Number.parseInt(e.target.value) || 6 }))}
                  className="text-center text-base sm:text-lg font-bold h-9 sm:h-10"
                />
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-muted-foreground text-xs sm:text-sm">Modifier</Label>
                <div className="flex items-center gap-1 sm:gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 sm:h-9 sm:w-9 min-w-[44px] min-h-[44px] flex items-center justify-center bg-transparent"
                    onClick={() => setConfig((prev) => ({ ...prev, modifier: prev.modifier - 1 }))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    value={config.modifier}
                    onChange={(e) => setConfig((prev) => ({ ...prev, modifier: Number.parseInt(e.target.value) || 0 }))}
                    className="text-center text-base sm:text-lg font-bold h-9 sm:h-10"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 sm:h-9 sm:w-9 min-w-[44px] min-h-[44px] flex items-center justify-center bg-transparent"
                    onClick={() => setConfig((prev) => ({ ...prev, modifier: prev.modifier + 1 }))}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 sm:gap-8">
              <div className="flex items-center gap-2 sm:gap-3">
                <Switch
                  id="advantage"
                  checked={advantage}
                  onCheckedChange={(checked) => {
                    setAdvantage(checked)
                    if (checked) setDisadvantage(false)
                  }}
                />
                <Label htmlFor="advantage" className="text-foreground font-medium text-sm sm:text-base">
                  Advantage
                </Label>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <Switch
                  id="disadvantage"
                  checked={disadvantage}
                  onCheckedChange={(checked) => {
                    setDisadvantage(checked)
                    if (checked) setAdvantage(false)
                  }}
                />
                <Label htmlFor="disadvantage" className="text-foreground font-medium text-sm sm:text-base">
                  Disadvantage
                </Label>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
              <Button
                className="flex-1 h-12 sm:h-14 md:h-16 text-base sm:text-lg md:text-xl btn-primary"
                onClick={() => performRoll()}
                disabled={isRolling}
              >
                <Dices className={cn("h-5 w-5 sm:h-6 sm:w-6 mr-2 sm:mr-3", isRolling && "animate-spin")} />
                Roll {formatDiceNotation(config)}
              </Button>
              {lastConfig && (
                <Button
                  variant="outline"
                  className="h-12 sm:h-14 md:h-16 px-4 sm:px-6 hover:border-primary/50 bg-transparent text-sm sm:text-base"
                  onClick={() => performRoll(lastConfig, lastRoll?.label)}
                  disabled={isRolling}
                  title="Press Space to roll again"
                >
                  <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5 sm:mr-2" />
                  Again
                  <kbd className="ml-2 sm:ml-3 text-[10px] sm:text-xs bg-muted px-1.5 sm:px-2 py-0.5 sm:py-1 rounded hidden sm:inline">
                    Space
                  </kbd>
                </Button>
              )}
            </div>

            <div className="flex gap-2 sm:gap-3">
              <Input
                placeholder="e.g., 2d6+3"
                value={customDice}
                onChange={(e) => setCustomDice(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCustomRoll()}
                className="text-sm sm:text-lg"
              />
              <Button
                variant="outline"
                onClick={handleCustomRoll}
                className="px-3 sm:px-6 bg-transparent text-sm sm:text-base"
              >
                Roll
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-4 sm:space-y-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-silver text-base sm:text-lg">Common Rolls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 sm:space-y-2">
            {commonRolls.map((roll) => (
              <Button
                key={roll.name}
                variant="outline"
                className="w-full justify-between hover:border-primary/50 h-10 sm:h-12 bg-transparent text-sm sm:text-base min-h-[44px]"
                onClick={() => handleCommonRoll(roll.dice, roll.name)}
              >
                <span className="font-medium">{roll.name}</span>
                <span className="text-xs sm:text-sm text-primary">{roll.dice}</span>
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-silver text-base sm:text-lg">History</CardTitle>
            {history.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearHistory}
                className="text-muted-foreground hover:text-destructive h-8 w-8 sm:h-9 sm:w-9 p-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-xs sm:text-sm text-muted-foreground text-center py-6 sm:py-8">No rolls yet</p>
            ) : (
              <ScrollArea className="h-[250px] sm:h-[300px] lg:h-[350px]">
                <div className="space-y-1.5 sm:space-y-2">
                  {history.map((roll) => (
                    <div
                      key={roll.id}
                      className={cn(
                        "p-2.5 sm:p-4 rounded-lg border transition-colors",
                        roll.criticalHit
                          ? "border-primary/50 bg-primary/10"
                          : roll.criticalMiss
                            ? "border-destructive/50 bg-destructive/10"
                            : "border-border bg-card/50",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{roll.dice}</span>
                        <span
                          className={cn(
                            "text-2xl font-bold font-serif",
                            roll.criticalHit && "text-primary",
                            roll.criticalMiss && "text-destructive",
                          )}
                        >
                          {roll.total}
                        </span>
                      </div>
                      {roll.label && <p className="text-xs text-primary mt-1">{roll.label}</p>}
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
