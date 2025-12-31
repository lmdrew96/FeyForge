"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Sword, Users, Skull, Zap, Minus, Plus } from "lucide-react"

// XP thresholds by level (Easy, Medium, Hard, Deadly)
const XP_THRESHOLDS: Record<number, [number, number, number, number]> = {
  1: [25, 50, 75, 100],
  2: [50, 100, 150, 200],
  3: [75, 150, 225, 400],
  4: [125, 250, 375, 500],
  5: [250, 500, 750, 1100],
  6: [300, 600, 900, 1400],
  7: [350, 750, 1100, 1700],
  8: [450, 900, 1400, 2100],
  9: [550, 1100, 1600, 2400],
  10: [600, 1200, 1900, 2800],
  11: [800, 1600, 2400, 3600],
  12: [1000, 2000, 3000, 4500],
  13: [1100, 2200, 3400, 5100],
  14: [1250, 2500, 3800, 5700],
  15: [1400, 2800, 4300, 6400],
  16: [1600, 3200, 4800, 7200],
  17: [2000, 3900, 5900, 8800],
  18: [2100, 4200, 6300, 9500],
  19: [2400, 4900, 7300, 10900],
  20: [2800, 5700, 8500, 12700],
}

// Monster CR to XP mapping
const CR_TO_XP: Record<string, number> = {
  "0": 10,
  "1/8": 25,
  "1/4": 50,
  "1/2": 100,
  "1": 200,
  "2": 450,
  "3": 700,
  "4": 1100,
  "5": 1800,
  "6": 2300,
  "7": 2900,
  "8": 3900,
  "9": 5000,
  "10": 5900,
  "11": 7200,
  "12": 8400,
  "13": 10000,
  "14": 11500,
  "15": 13000,
  "16": 15000,
  "17": 18000,
  "18": 20000,
  "19": 22000,
  "20": 25000,
  "21": 33000,
  "22": 41000,
  "23": 50000,
  "24": 62000,
  "25": 75000,
  "26": 90000,
  "27": 105000,
  "28": 120000,
  "29": 135000,
  "30": 155000,
}

const MULTIPLIERS = [1, 1.5, 2, 2.5, 3, 4]

interface Monster {
  id: string
  name: string
  cr: string
  count: number
}

export function EncounterBuilder() {
  const [partySize, setPartySize] = useState(4)
  const [partyLevel, setPartyLevel] = useState(5)
  const [monsters, setMonsters] = useState<Monster[]>([])
  const [newMonsterName, setNewMonsterName] = useState("")
  const [newMonsterCR, setNewMonsterCR] = useState("1")

  const addMonster = () => {
    if (!newMonsterName.trim()) return

    setMonsters([
      ...monsters,
      {
        id: crypto.randomUUID(),
        name: newMonsterName,
        cr: newMonsterCR,
        count: 1,
      },
    ])
    setNewMonsterName("")
  }

  const updateMonsterCount = (id: string, count: number) => {
    setMonsters(monsters.map((m) => (m.id === id ? { ...m, count: Math.max(0, count) } : m)))
  }

  const removeMonster = (id: string) => {
    setMonsters(monsters.filter((m) => m.id !== id))
  }

  // Calculate encounter difficulty
  const calculateDifficulty = () => {
    const totalMonsters = monsters.reduce((sum, m) => sum + m.count, 0)
    if (totalMonsters === 0) return null

    // Calculate base XP
    const baseXP = monsters.reduce((sum, m) => {
      return sum + CR_TO_XP[m.cr] * m.count
    }, 0)

    // Get multiplier based on number of monsters
    let multiplierIndex = 0
    if (totalMonsters === 2) multiplierIndex = 1
    else if (totalMonsters >= 3 && totalMonsters <= 6) multiplierIndex = 2
    else if (totalMonsters >= 7 && totalMonsters <= 10) multiplierIndex = 3
    else if (totalMonsters >= 11 && totalMonsters <= 14) multiplierIndex = 4
    else if (totalMonsters >= 15) multiplierIndex = 5

    const adjustedXP = Math.floor(baseXP * MULTIPLIERS[multiplierIndex])

    // Get party thresholds
    const thresholds = XP_THRESHOLDS[partyLevel]
    const partyEasy = thresholds[0] * partySize
    const partyMedium = thresholds[1] * partySize
    const partyHard = thresholds[2] * partySize
    const partyDeadly = thresholds[3] * partySize

    let difficulty: "trivial" | "easy" | "medium" | "hard" | "deadly"
    if (adjustedXP < partyEasy) difficulty = "trivial"
    else if (adjustedXP < partyMedium) difficulty = "easy"
    else if (adjustedXP < partyHard) difficulty = "medium"
    else if (adjustedXP < partyDeadly) difficulty = "hard"
    else difficulty = "deadly"

    return {
      baseXP,
      adjustedXP,
      difficulty,
      thresholds: {
        easy: partyEasy,
        medium: partyMedium,
        hard: partyHard,
        deadly: partyDeadly,
      },
    }
  }

  const result = calculateDifficulty()

  const difficultyColors = {
    trivial: "bg-muted text-muted-foreground",
    easy: "bg-green-500/20 text-green-400 border-green-500/30",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    hard: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    deadly: "bg-red-500/20 text-red-400 border-red-500/30",
  }

  return (
    <div className="space-y-6">
      {/* Party Configuration */}
      <Card className="bg-card/80 backdrop-blur-sm border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-fey-cyan" />
            Party Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Party Size</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPartySize(Math.max(1, partySize - 1))}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-12 text-center font-mono text-lg">{partySize}</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPartySize(Math.min(8, partySize + 1))}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Average Level</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPartyLevel(Math.max(1, partyLevel - 1))}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-12 text-center font-mono text-lg">{partyLevel}</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPartyLevel(Math.min(20, partyLevel + 1))}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monster Builder */}
      <Card className="bg-card/80 backdrop-blur-sm border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Skull className="h-5 w-5 text-destructive" />
            Monsters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add Monster Form */}
          <div className="flex gap-2">
            <Input
              placeholder="Monster name"
              value={newMonsterName}
              onChange={(e) => setNewMonsterName(e.target.value)}
              className="flex-1 bg-background/50"
              onKeyDown={(e) => e.key === "Enter" && addMonster()}
            />
            <Select value={newMonsterCR} onValueChange={setNewMonsterCR}>
              <SelectTrigger className="w-24 bg-background/50">
                <SelectValue placeholder="CR" />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(CR_TO_XP).map((cr) => (
                  <SelectItem key={cr} value={cr}>
                    CR {cr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              onClick={addMonster}
              className="bg-fey-cyan hover:bg-fey-cyan/90 text-white"
            >
              Add
            </Button>
          </div>

          {/* Monster List */}
          {monsters.length > 0 ? (
            <div className="space-y-2">
              {monsters.map((monster) => (
                <div
                  key={monster.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-background/30 p-3"
                >
                  <div className="flex items-center gap-3">
                    <Sword className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{monster.name}</span>
                    <Badge variant="outline" className="border-fey-cyan/30">
                      CR {monster.cr}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      ({CR_TO_XP[monster.cr]} XP each)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => updateMonsterCount(monster.id, monster.count - 1)}
                    >
                      -
                    </Button>
                    <span className="w-8 text-center">{monster.count}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => updateMonsterCount(monster.id, monster.count + 1)}
                    >
                      +
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => removeMonster(monster.id)}
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-4">
              Add monsters to calculate encounter difficulty
            </p>
          )}
        </CardContent>
      </Card>

      {/* Difficulty Result */}
      {result && (
        <Card className="bg-card/80 backdrop-blur-sm border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Zap className="h-5 w-5 text-fey-gold" />
              Encounter Difficulty
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center gap-4">
              <Badge className={`px-4 py-2 text-lg capitalize ${difficultyColors[result.difficulty]}`}>
                {result.difficulty}
              </Badge>
              <div className="text-center">
                <p className="text-2xl font-bold">{result.adjustedXP.toLocaleString()} XP</p>
                <p className="text-sm text-muted-foreground">
                  ({result.baseXP.toLocaleString()} base XP)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center text-sm">
              <div className="rounded-lg bg-green-500/10 p-2">
                <p className="font-medium text-green-400">Easy</p>
                <p className="text-muted-foreground">{result.thresholds.easy.toLocaleString()}</p>
              </div>
              <div className="rounded-lg bg-yellow-500/10 p-2">
                <p className="font-medium text-yellow-400">Medium</p>
                <p className="text-muted-foreground">{result.thresholds.medium.toLocaleString()}</p>
              </div>
              <div className="rounded-lg bg-orange-500/10 p-2">
                <p className="font-medium text-orange-400">Hard</p>
                <p className="text-muted-foreground">{result.thresholds.hard.toLocaleString()}</p>
              </div>
              <div className="rounded-lg bg-red-500/10 p-2">
                <p className="font-medium text-red-400">Deadly</p>
                <p className="text-muted-foreground">{result.thresholds.deadly.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
