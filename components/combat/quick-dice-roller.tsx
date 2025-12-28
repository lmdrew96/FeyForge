"use client"

import { useState } from "react"
import { Dice6, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface RollResult {
  id: string
  expression: string
  rolls: number[]
  modifier: number
  total: number
  timestamp: Date
}

export function QuickDiceRoller() {
  const [customExpression, setCustomExpression] = useState("")
  const [rollHistory, setRollHistory] = useState<RollResult[]>([])
  const [isRolling, setIsRolling] = useState(false)

  const rollDice = (sides: number, count = 1, modifier = 0, label?: string) => {
    setIsRolling(true)

    setTimeout(() => {
      const rolls: number[] = []
      for (let i = 0; i < count; i++) {
        rolls.push(Math.floor(Math.random() * sides) + 1)
      }
      const total = rolls.reduce((sum, r) => sum + r, 0) + modifier

      const result: RollResult = {
        id: crypto.randomUUID(),
        expression: label || `${count}d${sides}${modifier >= 0 ? "+" : ""}${modifier !== 0 ? modifier : ""}`,
        rolls,
        modifier,
        total,
        timestamp: new Date(),
      }

      setRollHistory((prev) => [result, ...prev].slice(0, 10))
      setIsRolling(false)
    }, 300)
  }

  const parseAndRoll = (expression: string) => {
    // Parse expressions like "2d6+3" or "1d20-2" or "4d8"
    const match = expression.match(/^(\d*)d(\d+)([+-]\d+)?$/i)
    if (!match) return

    const count = Number.parseInt(match[1]) || 1
    const sides = Number.parseInt(match[2])
    const modifier = match[3] ? Number.parseInt(match[3]) : 0

    if (sides > 0 && count > 0 && count <= 100) {
      rollDice(sides, count, modifier, expression)
    }
  }

  const handleCustomRoll = () => {
    if (customExpression) {
      parseAndRoll(customExpression)
      setCustomExpression("")
    }
  }

  const clearHistory = () => setRollHistory([])

  const quickDice = [
    { label: "d20", sides: 20 },
    { label: "d12", sides: 12 },
    { label: "d10", sides: 10 },
    { label: "d8", sides: 8 },
    { label: "d6", sides: 6 },
    { label: "d4", sides: 4 },
  ]

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Dice6 className="h-5 w-5 text-fey-purple" />
          Quick Dice
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Roll Buttons */}
        <div className="grid grid-cols-3 gap-2">
          {quickDice.map(({ label, sides }) => (
            <Button
              key={label}
              variant="outline"
              size="sm"
              onClick={() => rollDice(sides)}
              disabled={isRolling}
              className={cn("font-medium transition-transform", isRolling && "animate-pulse")}
            >
              {label}
            </Button>
          ))}
        </div>

        {/* Custom Expression */}
        <div className="flex gap-2">
          <Input
            placeholder="2d6+3"
            value={customExpression}
            onChange={(e) => setCustomExpression(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCustomRoll()}
            className="h-9"
          />
          <Button size="sm" onClick={handleCustomRoll} disabled={!customExpression || isRolling}>
            Roll
          </Button>
        </div>

        {/* Roll History */}
        {rollHistory.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Recent Rolls</span>
              <Button variant="ghost" size="sm" onClick={clearHistory} className="h-6 px-2">
                <RotateCcw className="h-3 w-3" />
              </Button>
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {rollHistory.map((result, index) => (
                <div
                  key={result.id}
                  className={cn(
                    "flex items-center justify-between py-1 px-2 rounded text-sm",
                    index === 0 && "bg-fey-cyan/10",
                  )}
                >
                  <span className="text-muted-foreground">{result.expression}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      [{result.rolls.join(", ")}]
                      {result.modifier !== 0 && (
                        <span>
                          {result.modifier >= 0 ? "+" : ""}
                          {result.modifier}
                        </span>
                      )}
                    </span>
                    <Badge
                      variant={index === 0 ? "default" : "secondary"}
                      className={cn("min-w-[2.5rem] justify-center", index === 0 && "bg-fey-cyan")}
                    >
                      {result.total}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
