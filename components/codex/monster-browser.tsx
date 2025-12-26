"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Search, Skull, Shield, Heart, Swords, Eye, Loader2, RefreshCw } from "lucide-react"
import { open5eApi, type Open5eMonster } from "@/lib/open5e-api"
import useSWR from "swr"

const CR_OPTIONS = [
  "All",
  "0",
  "1/8",
  "1/4",
  "1/2",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
  "29",
  "30",
]
const TYPE_OPTIONS = [
  "All",
  "Aberration",
  "Beast",
  "Celestial",
  "Construct",
  "Dragon",
  "Elemental",
  "Fey",
  "Fiend",
  "Giant",
  "Humanoid",
  "Monstrosity",
  "Ooze",
  "Plant",
  "Undead",
]
const SIZE_OPTIONS = ["All", "Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"]

function getModifier(score: number): string {
  const mod = Math.floor((score - 10) / 2)
  return mod >= 0 ? `+${mod}` : `${mod}`
}

function formatSpeed(speed: Record<string, number>): string {
  return Object.entries(speed)
    .map(([type, value]) => (type === "walk" ? `${value} ft.` : `${type} ${value} ft.`))
    .join(", ")
}

function getCrXp(cr: number): number {
  const xpByCr: Record<number, number> = {
    0: 10,
    0.125: 25,
    0.25: 50,
    0.5: 100,
    1: 200,
    2: 450,
    3: 700,
    4: 1100,
    5: 1800,
    6: 2300,
    7: 2900,
    8: 3900,
    9: 5000,
    10: 5900,
    11: 7200,
    12: 8400,
    13: 10000,
    14: 11500,
    15: 13000,
    16: 15000,
    17: 18000,
    18: 20000,
    19: 22000,
    20: 25000,
    21: 33000,
    22: 41000,
    23: 50000,
    24: 62000,
    25: 75000,
    26: 90000,
    27: 105000,
    28: 120000,
    29: 135000,
    30: 155000,
  }
  return xpByCr[cr] || 0
}

export function MonsterBrowser() {
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [crFilter, setCrFilter] = useState("All")
  const [typeFilter, setTypeFilter] = useState("All")
  const [sizeFilter, setSizeFilter] = useState("All")
  const [selectedMonster, setSelectedMonster] = useState<Open5eMonster | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const {
    data: monsters,
    error,
    isLoading,
    mutate,
  } = useSWR(
    ["monsters", debouncedSearch, crFilter, typeFilter, sizeFilter],
    async () => {
      const params: { search?: string; cr?: string; type?: string; size?: string } = {}
      if (debouncedSearch) params.search = debouncedSearch
      if (crFilter !== "All") params.cr = crFilter
      if (typeFilter !== "All") params.type = typeFilter
      if (sizeFilter !== "All") params.size = sizeFilter
      return open5eApi.getMonsters(params)
    },
    { revalidateOnFocus: false },
  )

  const filteredMonsters = (monsters || []).sort((a, b) => a.name.localeCompare(b.name))

  const crColor = (cr: number): string => {
    if (cr <= 1) return "bg-green-500/20 text-green-400 border-green-500/30"
    if (cr <= 4) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
    if (cr <= 10) return "bg-orange-500/20 text-orange-400 border-orange-500/30"
    if (cr <= 17) return "bg-red-500/20 text-red-400 border-red-500/30"
    return "bg-purple-500/20 text-purple-400 border-purple-500/30"
  }

  return (
    <div className="flex h-full gap-4">
      {/* Monster List */}
      <div className="flex w-1/2 flex-col gap-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search monsters..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={crFilter} onValueChange={setCrFilter}>
            <SelectTrigger className="w-24">
              <SelectValue placeholder="CR" />
            </SelectTrigger>
            <SelectContent>
              {CR_OPTIONS.map((cr) => (
                <SelectItem key={cr} value={cr}>
                  {cr === "All" ? "All CR" : `CR ${cr}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sizeFilter} onValueChange={setSizeFilter}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Size" />
            </SelectTrigger>
            <SelectContent>
              {SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={size}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={() => mutate()} disabled={isLoading} title="Refresh from API">
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Monster List */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading monsters from Open5e...</span>
            </div>
          ) : error ? (
            <div className="py-8 text-center text-destructive">
              <p>Failed to load monsters. Please try again.</p>
              <Button variant="outline" className="mt-2 bg-transparent" onClick={() => mutate()}>
                Retry
              </Button>
            </div>
          ) : (
            <div className="space-y-2 pr-4">
              {filteredMonsters.map((monster) => (
                <Card
                  key={monster.slug}
                  className={`cursor-pointer border-border/50 bg-card/50 transition-colors hover:bg-card ${
                    selectedMonster?.slug === monster.slug ? "border-primary bg-card" : ""
                  }`}
                  onClick={() => setSelectedMonster(monster)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Skull className="h-4 w-4 text-destructive" />
                        <span className="font-medium">{monster.name}</span>
                      </div>
                      <Badge className={crColor(monster.cr)}>CR {monster.challenge_rating}</Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                      <span>
                        {monster.size} {monster.type}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="h-3 w-3" /> {monster.hit_points}
                      </span>
                      <span className="flex items-center gap-1">
                        <Shield className="h-3 w-3" /> {monster.armor_class}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filteredMonsters.length === 0 && !isLoading && (
                <p className="py-8 text-center text-muted-foreground">No monsters found matching your criteria</p>
              )}
            </div>
          )}
        </ScrollArea>
        <p className="text-sm text-muted-foreground">{filteredMonsters.length} monsters found</p>
      </div>

      {/* Monster Detail */}
      <div className="w-1/2">
        {selectedMonster ? (
          <Card className="h-full border-border/50 bg-card/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">{selectedMonster.name}</CardTitle>
                <Badge className={crColor(selectedMonster.cr)}>
                  CR {selectedMonster.challenge_rating} ({getCrXp(selectedMonster.cr).toLocaleString()} XP)
                </Badge>
              </div>
              <p className="text-sm italic text-muted-foreground">
                {selectedMonster.size} {selectedMonster.type}
                {selectedMonster.subtype && ` (${selectedMonster.subtype})`}, {selectedMonster.alignment}
              </p>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100vh-400px)]">
                <div className="space-y-4 pr-4">
                  {/* Basic Stats */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/50 p-2">
                      <Shield className="h-4 w-4 text-blue-400" />
                      <div>
                        <p className="text-xs text-muted-foreground">AC</p>
                        <p className="text-sm font-medium">
                          {selectedMonster.armor_class}
                          {selectedMonster.armor_desc && ` (${selectedMonster.armor_desc})`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/50 p-2">
                      <Heart className="h-4 w-4 text-red-400" />
                      <div>
                        <p className="text-xs text-muted-foreground">HP</p>
                        <p className="text-sm font-medium">
                          {selectedMonster.hit_points} ({selectedMonster.hit_dice})
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/50 p-2">
                      <Swords className="h-4 w-4 text-yellow-400" />
                      <div>
                        <p className="text-xs text-muted-foreground">Speed</p>
                        <p className="text-sm font-medium">{formatSpeed(selectedMonster.speed)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Ability Scores */}
                  <div className="grid grid-cols-6 gap-2 text-center">
                    {(["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as const).map(
                      (ability) => (
                        <div key={ability} className="rounded-lg border border-border/50 bg-background/50 p-2">
                          <p className="text-xs uppercase text-muted-foreground">{ability.slice(0, 3)}</p>
                          <p className="text-lg font-bold">{selectedMonster[ability]}</p>
                          <p className="text-xs text-primary">{getModifier(selectedMonster[ability])}</p>
                        </div>
                      ),
                    )}
                  </div>

                  {/* Additional Info */}
                  <div className="space-y-2 text-sm">
                    {selectedMonster.damage_resistances && (
                      <p>
                        <span className="font-medium">Resistances:</span> {selectedMonster.damage_resistances}
                      </p>
                    )}
                    {selectedMonster.damage_immunities && (
                      <p>
                        <span className="font-medium">Immunities:</span> {selectedMonster.damage_immunities}
                      </p>
                    )}
                    {selectedMonster.condition_immunities && (
                      <p>
                        <span className="font-medium">Condition Immunities:</span>{" "}
                        {selectedMonster.condition_immunities}
                      </p>
                    )}
                    <p>
                      <span className="font-medium">Senses:</span> {selectedMonster.senses}
                    </p>
                    <p>
                      <span className="font-medium">Languages:</span> {selectedMonster.languages || "—"}
                    </p>
                  </div>

                  {/* Special Abilities */}
                  {selectedMonster.special_abilities && selectedMonster.special_abilities.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-primary">Traits</h4>
                      {selectedMonster.special_abilities.map((ability, i) => (
                        <div key={i} className="rounded-lg border border-border/50 bg-background/50 p-3 min-w-0">
                          <p className="font-medium">{ability.name}</p>
                          <p className="text-sm text-muted-foreground overflow-hidden min-w-0 overflow-wrap-anywhere">{ability.desc}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  {selectedMonster.actions && selectedMonster.actions.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-primary">Actions</h4>
                      {selectedMonster.actions.map((action, i) => (
                        <div key={i} className="rounded-lg border border-border/50 bg-background/50 p-3 min-w-0">
                          <p className="font-medium">{action.name}</p>
                          <p className="text-sm text-muted-foreground overflow-hidden min-w-0 overflow-wrap-anywhere">{action.desc}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reactions */}
                  {selectedMonster.reactions && selectedMonster.reactions.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-primary">Reactions</h4>
                      {selectedMonster.reactions.map((reaction, i) => (
                        <div key={i} className="rounded-lg border border-border/50 bg-background/50 p-3 min-w-0">
                          <p className="font-medium">{reaction.name}</p>
                          <p className="text-sm text-muted-foreground overflow-hidden min-w-0 overflow-wrap-anywhere">{reaction.desc}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Legendary Actions */}
                  {selectedMonster.legendary_actions && selectedMonster.legendary_actions.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-primary">Legendary Actions</h4>
                      <p className="text-xs text-muted-foreground">
                        The creature can take 3 legendary actions, choosing from the options below.
                      </p>
                      {selectedMonster.legendary_actions.map((action, i) => (
                        <div key={i} className="rounded-lg border border-primary/30 bg-primary/5 p-3 min-w-0">
                          <p className="font-medium">{action.name}</p>
                          <p className="text-sm text-muted-foreground overflow-hidden min-w-0 overflow-wrap-anywhere">{action.desc}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ) : (
          <Card className="flex h-full items-center justify-center border-border/50 bg-card/50">
            <div className="text-center">
              <Eye className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-2 text-muted-foreground">Select a monster to view its stat block</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
