"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Coins, Gem, Scroll, Sparkles, RefreshCw } from "lucide-react"

type TreasureType = "individual" | "hoard"
type CRRange = "0-4" | "5-10" | "11-16" | "17+"

interface LootResult {
  coins: { cp?: number; sp?: number; ep?: number; gp?: number; pp?: number }
  gems?: { value: number; description: string }[]
  artObjects?: { value: number; description: string }[]
  magicItems?: { rarity: string; name: string }[]
}

// Gem descriptions by value
const GEMS: Record<number, string[]> = {
  10: [
    "Azurite (opaque mottled deep blue)",
    "Banded agate (translucent striped)",
    "Blue quartz (transparent pale blue)",
    "Eye agate (translucent circles)",
    "Hematite (opaque gray-black)",
    "Lapis lazuli (opaque light/dark blue)",
    "Malachite (opaque striated green)",
    "Turquoise (opaque light blue-green)",
  ],
  50: [
    "Bloodstone (opaque dark gray/red)",
    "Carnelian (opaque orange-red)",
    "Chalcedony (opaque white)",
    "Moonstone (translucent white/blue)",
    "Onyx (opaque black/white bands)",
    "Quartz (transparent clear/smoky)",
  ],
  100: [
    "Amber (transparent watery gold)",
    "Amethyst (transparent purple)",
    "Coral (opaque crimson)",
    "Garnet (transparent red/brown)",
    "Jade (translucent light green)",
    "Pearl (opaque lustrous white)",
  ],
  500: [
    "Alexandrite (transparent dark green)",
    "Aquamarine (transparent pale blue)",
    "Black pearl (opaque pure black)",
    "Topaz (transparent golden yellow)",
  ],
  1000: [
    "Black opal (translucent dark colors)",
    "Blue sapphire (transparent blue-white)",
    "Emerald (transparent deep green)",
    "Fire opal (translucent fiery red)",
    "Ruby (transparent clear red)",
  ],
}

// Art objects by value
const ART_OBJECTS: Record<number, string[]> = {
  25: [
    "Silver ewer",
    "Carved bone statuette",
    "Small gold bracelet",
    "Gold locket with portrait",
  ],
  250: [
    "Gold ring with bloodstones",
    "Carved ivory statuette",
    "Silver necklace with gem pendant",
    "Bronze crown",
  ],
  750: [
    "Silver chalice with moonstones",
    "Carved harp of exotic wood",
    "Small gold idol",
    "Painted gold war mask",
  ],
  2500: [
    "Fine gold chain with fire opal",
    "Old masterpiece painting",
    "Platinum bracelet with sapphire",
    "Gold circlet with four aquamarines",
  ],
}

// Common magic items by rarity
const MAGIC_ITEMS: Record<string, string[]> = {
  common: ["Potion of Healing", "Spell Scroll (cantrip)", "Potion of Climbing", "Bag of Holding"],
  uncommon: [
    "Potion of Greater Healing",
    "Cloak of Protection",
    "Boots of Elvenkind",
    "Wand of Magic Missiles",
    "Immovable Rod",
  ],
  rare: [
    "Potion of Superior Healing",
    "Cloak of Displacement",
    "Ring of Protection",
    "Flame Tongue",
    "Amulet of Health",
  ],
  "very rare": [
    "Potion of Supreme Healing",
    "Dancing Sword",
    "Cloak of Invisibility",
    "Ring of Regeneration",
  ],
  legendary: [
    "Vorpal Sword",
    "Ring of Three Wishes",
    "Staff of the Magi",
    "Holy Avenger",
  ],
}

function rollDice(count: number, sides: number): number {
  let total = 0
  for (let i = 0; i < count; i++) {
    total += Math.floor(Math.random() * sides) + 1
  }
  return total
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function LootGenerator() {
  const [treasureType, setTreasureType] = useState<TreasureType>("individual")
  const [crRange, setCRRange] = useState<CRRange>("0-4")
  const [result, setResult] = useState<LootResult | null>(null)

  const generateLoot = () => {
    const loot: LootResult = { coins: {} }

    if (treasureType === "individual") {
      // Individual treasure
      switch (crRange) {
        case "0-4":
          const roll04 = rollDice(1, 100)
          if (roll04 <= 30) {
            loot.coins.cp = rollDice(5, 6)
          } else if (roll04 <= 60) {
            loot.coins.sp = rollDice(4, 6)
          } else if (roll04 <= 70) {
            loot.coins.ep = rollDice(3, 6)
          } else if (roll04 <= 95) {
            loot.coins.gp = rollDice(3, 6)
          } else {
            loot.coins.pp = rollDice(1, 6)
          }
          break
        case "5-10":
          const roll510 = rollDice(1, 100)
          if (roll510 <= 30) {
            loot.coins.cp = rollDice(4, 6) * 100
            loot.coins.ep = rollDice(1, 6) * 10
          } else if (roll510 <= 60) {
            loot.coins.sp = rollDice(6, 6) * 10
            loot.coins.gp = rollDice(2, 6) * 10
          } else if (roll510 <= 70) {
            loot.coins.ep = rollDice(3, 6) * 10
            loot.coins.gp = rollDice(2, 6) * 10
          } else if (roll510 <= 95) {
            loot.coins.gp = rollDice(4, 6) * 10
          } else {
            loot.coins.gp = rollDice(2, 6) * 10
            loot.coins.pp = rollDice(3, 6)
          }
          break
        case "11-16":
          const roll1116 = rollDice(1, 100)
          if (roll1116 <= 20) {
            loot.coins.sp = rollDice(4, 6) * 100
            loot.coins.gp = rollDice(1, 6) * 100
          } else if (roll1116 <= 35) {
            loot.coins.ep = rollDice(1, 6) * 100
            loot.coins.gp = rollDice(1, 6) * 100
          } else if (roll1116 <= 75) {
            loot.coins.gp = rollDice(2, 6) * 100
            loot.coins.pp = rollDice(1, 6) * 10
          } else {
            loot.coins.gp = rollDice(2, 6) * 100
            loot.coins.pp = rollDice(2, 6) * 10
          }
          break
        case "17+":
          const roll17 = rollDice(1, 100)
          if (roll17 <= 15) {
            loot.coins.ep = rollDice(2, 6) * 1000
            loot.coins.gp = rollDice(8, 6) * 100
          } else if (roll17 <= 55) {
            loot.coins.gp = rollDice(1, 6) * 1000
            loot.coins.pp = rollDice(1, 6) * 100
          } else {
            loot.coins.gp = rollDice(1, 6) * 1000
            loot.coins.pp = rollDice(2, 6) * 100
          }
          break
      }
    } else {
      // Treasure hoard
      switch (crRange) {
        case "0-4":
          loot.coins.cp = rollDice(6, 6) * 100
          loot.coins.sp = rollDice(3, 6) * 100
          loot.coins.gp = rollDice(2, 6) * 10
          break
        case "5-10":
          loot.coins.cp = rollDice(2, 6) * 100
          loot.coins.sp = rollDice(2, 6) * 1000
          loot.coins.gp = rollDice(6, 6) * 100
          loot.coins.pp = rollDice(3, 6) * 10
          break
        case "11-16":
          loot.coins.gp = rollDice(4, 6) * 1000
          loot.coins.pp = rollDice(5, 6) * 100
          break
        case "17+":
          loot.coins.gp = rollDice(12, 6) * 1000
          loot.coins.pp = rollDice(8, 6) * 1000
          break
      }

      // Add gems/art/magic items for hoards
      const hoardRoll = rollDice(1, 100)
      if (hoardRoll > 50) {
        // Add gems
        const gemValues = Object.keys(GEMS).map(Number)
        const gemValue = randomChoice(gemValues.slice(0, crRange === "0-4" ? 2 : crRange === "5-10" ? 3 : 5))
        const gemCount = rollDice(2, 4)
        loot.gems = []
        for (let i = 0; i < gemCount; i++) {
          loot.gems.push({
            value: gemValue,
            description: randomChoice(GEMS[gemValue]),
          })
        }
      }

      if (hoardRoll > 70) {
        // Add art objects
        const artValues = Object.keys(ART_OBJECTS).map(Number)
        const artValue = randomChoice(artValues.slice(0, crRange === "0-4" ? 1 : crRange === "5-10" ? 2 : 4))
        const artCount = rollDice(1, 4)
        loot.artObjects = []
        for (let i = 0; i < artCount; i++) {
          loot.artObjects.push({
            value: artValue,
            description: randomChoice(ART_OBJECTS[artValue]),
          })
        }
      }

      if (hoardRoll > 80) {
        // Add magic items
        const rarities =
          crRange === "0-4"
            ? ["common", "uncommon"]
            : crRange === "5-10"
              ? ["uncommon", "rare"]
              : crRange === "11-16"
                ? ["rare", "very rare"]
                : ["very rare", "legendary"]
        const rarity = randomChoice(rarities)
        const itemCount = rollDice(1, 3)
        loot.magicItems = []
        for (let i = 0; i < itemCount; i++) {
          loot.magicItems.push({
            rarity,
            name: randomChoice(MAGIC_ITEMS[rarity]),
          })
        }
      }
    }

    setResult(loot)
  }

  const formatCoins = (coins: LootResult["coins"]) => {
    const parts = []
    if (coins.pp) parts.push(`${coins.pp} pp`)
    if (coins.gp) parts.push(`${coins.gp} gp`)
    if (coins.ep) parts.push(`${coins.ep} ep`)
    if (coins.sp) parts.push(`${coins.sp} sp`)
    if (coins.cp) parts.push(`${coins.cp} cp`)
    return parts.join(", ") || "No coins"
  }

  const rarityColors: Record<string, string> = {
    common: "bg-muted text-muted-foreground",
    uncommon: "bg-green-500/20 text-green-400 border-green-500/30",
    rare: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    "very rare": "bg-purple-500/20 text-purple-400 border-purple-500/30",
    legendary: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  }

  return (
    <div className="space-y-6">
      <Card className="bg-card/80 backdrop-blur-sm border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Coins className="h-5 w-5 text-fey-gold" />
            Loot Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Treasure Type</label>
              <Select value={treasureType} onValueChange={(v) => setTreasureType(v as TreasureType)}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual Treasure</SelectItem>
                  <SelectItem value="hoard">Treasure Hoard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Challenge Rating</label>
              <Select value={crRange} onValueChange={(v) => setCRRange(v as CRRange)}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0-4">CR 0-4</SelectItem>
                  <SelectItem value="5-10">CR 5-10</SelectItem>
                  <SelectItem value="11-16">CR 11-16</SelectItem>
                  <SelectItem value="17+">CR 17+</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button 
            onClick={generateLoot} 
            className="w-full gap-2 bg-fey-cyan hover:bg-fey-cyan/90 text-white"
          >
            <RefreshCw className="h-4 w-4" />
            Generate Loot
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card className="bg-card/80 backdrop-blur-sm border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-fey-gold" />
              Generated Treasure
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Coins */}
            <div className="flex items-start gap-3 rounded-lg border border-border bg-background/30 p-3">
              <Coins className="mt-0.5 h-5 w-5 text-fey-gold" />
              <div>
                <p className="font-medium">Coins</p>
                <p className="text-sm text-muted-foreground">{formatCoins(result.coins)}</p>
              </div>
            </div>

            {/* Gems */}
            {result.gems && result.gems.length > 0 && (
              <div className="flex items-start gap-3 rounded-lg border border-border bg-background/30 p-3">
                <Gem className="mt-0.5 h-5 w-5 text-fey-cyan" />
                <div className="flex-1">
                  <p className="font-medium">Gems</p>
                  <div className="mt-1 space-y-1">
                    {result.gems.map((gem, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{gem.description}</span>
                        <Badge variant="outline" className="border-fey-gold/30">{gem.value} gp</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Art Objects */}
            {result.artObjects && result.artObjects.length > 0 && (
              <div className="flex items-start gap-3 rounded-lg border border-border bg-background/30 p-3">
                <Scroll className="mt-0.5 h-5 w-5 text-amber-500" />
                <div className="flex-1">
                  <p className="font-medium">Art Objects</p>
                  <div className="mt-1 space-y-1">
                    {result.artObjects.map((art, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{art.description}</span>
                        <Badge variant="outline" className="border-fey-gold/30">{art.value} gp</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Magic Items */}
            {result.magicItems && result.magicItems.length > 0 && (
              <div className="flex items-start gap-3 rounded-lg border border-border bg-background/30 p-3">
                <Sparkles className="mt-0.5 h-5 w-5 text-purple-500" />
                <div className="flex-1">
                  <p className="font-medium">Magic Items</p>
                  <div className="mt-1 space-y-1">
                    {result.magicItems.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span>{item.name}</span>
                        <Badge className={rarityColors[item.rarity]}>{item.rarity}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
