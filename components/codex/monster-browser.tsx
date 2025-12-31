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
  "All", "0", "1/8", "1/4", "1/2", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
  "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24",
  "25", "26", "27", "28", "29", "30",
]
const TYPE_OPTIONS = [
  "All", "Aberration", "Beast", "Celestial", "Construct", "Dragon", "Elemental",
  "Fey", "Fiend", "Giant", "Humanoid", "Monstrosity", "Ooze", "Plant", "Undead",
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
    0: 10, 0.125: 25, 0.25: 50, 0.5: 100, 1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800,
    6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900, 11: 7200, 12: 8400, 13: 10000,
    14: 11500, 15: 13000, 16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000,
    21: 33000, 22: 41000, 23: 50000, 24: 62000, 25: 75000, 26: 90000, 27: 105000,
    28: 120000, 29: 135000, 30: 155000,
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
    return "bg-fey-purple/20 text-fey-purple border-fey-purple/30"
  }

  return (
    <div className="flex flex-col lg:flex-row h-full gap-3 sm:gap-4 min-w-0">
      {/* Monster List */}
      <div className="flex flex-1 min-w-0 lg:max-w-[50%] flex-col gap-3 sm:gap-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 sm:left-3 top-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search monsters..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 sm:pl-9 text-sm h-9 sm:h-10 bg-input border-border"
            />
          </div>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            <Select value={crFilter} onValueChange={setCrFilter}>
              <SelectTrigger className="w-[70px] sm:w-24 text-xs sm:text-sm h-9 sm:h-10 bg-input border-border">
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
              <SelectTrigger className="w-[90px] sm:w-32 text-xs sm:text-sm h-9 sm:h-10 bg-input border-border">
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
              <SelectTrigger className="w-[80px] sm:w-28 text-xs sm:text-sm h-9 sm:h-10 bg-input border-border">
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => mutate()}
              disabled={isLoading}
              title="Refresh from API"
              className="h-9 w-9 sm:h-10 sm:w-10"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Monster List */}
        <ScrollArea className="flex-1 min-h-[200px] lg:min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 sm:py-12">
              <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-fey-cyan" />
              <span className="ml-2 text-muted-foreground text-sm">Loading monsters...</span>
            </div>
          ) : error ? (
            <div className="py-6 sm:py-8 text-center text-destructive">
              <p className="text-sm">Failed to load monsters. Please try again.</p>
              <Button variant="outline" className="mt-2 bg-transparent text-sm" onClick={() => mutate()}>
                Retry
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5 sm:space-y-2 pr-2 sm:pr-4">
              {filteredMonsters.map((monster) => (
                <Card
                  key={monster.slug}
                  className={`cursor-pointer border-border/50 bg-card/50 backdrop-blur-sm transition-colors hover:bg-card active:scale-[0.99] ${
                    selectedMonster?.slug === monster.slug ? "border-fey-cyan bg-card" : ""
                  }`}
                  onClick={() => setSelectedMonster(monster)}
                >
                  <CardContent className="p-2 sm:p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                        <Skull className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-destructive shrink-0" />
                        <span className="font-medium text-sm sm:text-base truncate">{monster.name}</span>
                      </div>
                      <Badge className={`${crColor(monster.cr)} text-[10px] sm:text-xs shrink-0`}>
                        CR {monster.challenge_rating}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground">
                      <span className="truncate">
                        {monster.size} {monster.type}
                      </span>
                      <span className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                        <Heart className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> {monster.hit_points}
                      </span>
                      <span className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                        <Shield className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> {monster.armor_class}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filteredMonsters.length === 0 && !isLoading && (
                <p className="py-6 sm:py-8 text-center text-muted-foreground text-sm">
                  No monsters found matching your criteria
                </p>
              )}
            </div>
          )}
        </ScrollArea>
        <p className="text-xs sm:text-sm text-muted-foreground">{filteredMonsters.length} monsters found</p>
      </div>

      {/* Monster Detail */}
      <div className="flex-1 min-w-0 lg:max-w-[50%]">
        {selectedMonster ? (
          <Card className="h-full border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-2 px-3 sm:px-6">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base sm:text-xl truncate">{selectedMonster.name}</CardTitle>
                <Badge className={`${crColor(selectedMonster.cr)} text-[10px] sm:text-xs shrink-0`}>
                  CR {selectedMonster.challenge_rating} ({getCrXp(selectedMonster.cr).toLocaleString()} XP)
                </Badge>
              </div>
              <p className="text-sm italic text-muted-foreground">
                {selectedMonster.size} {selectedMonster.type}
                {selectedMonster.subtype && ` (${selectedMonster.subtype})`}, {selectedMonster.alignment}
              </p>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              <ScrollArea className="h-[250px] sm:h-[300px] lg:h-[calc(100vh-400px)]">
                <div className="space-y-3 sm:space-y-4 pr-2 sm:pr-4">
                  {/* Basic Stats */}
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                    <div className="flex items-center gap-1.5 sm:gap-2 rounded-lg border border-border/50 bg-background/50 p-1.5 sm:p-2">
                      <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] sm:text-xs text-muted-foreground">AC</p>
                        <p className="text-xs sm:text-sm font-medium truncate">
                          {selectedMonster.armor_class}
                          {selectedMonster.armor_desc && <span className="hidden sm:inline"> ({selectedMonster.armor_desc})</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 rounded-lg border border-border/50 bg-background/50 p-1.5 sm:p-2">
                      <Heart className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] sm:text-xs text-muted-foreground">HP</p>
                        <p className="text-xs sm:text-sm font-medium truncate">
                          {selectedMonster.hit_points} <span className="hidden sm:inline">({selectedMonster.hit_dice})</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 rounded-lg border border-border/50 bg-background/50 p-1.5 sm:p-2">
                      <Swords className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-fey-gold shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Speed</p>
                        <p className="text-xs sm:text-sm font-medium truncate">{formatSpeed(selectedMonster.speed)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Ability Scores */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 sm:gap-2 text-center">
                    {(["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as const).map(
                      (ability) => (
                        <div key={ability} className="rounded-lg border border-border/50 bg-background/50 p-1.5 sm:p-2">
                          <p className="text-[10px] sm:text-xs uppercase text-muted-foreground">{ability.slice(0, 3)}</p>
                          <p className="text-sm sm:text-lg font-bold">{selectedMonster[ability]}</p>
                          <p className="text-[10px] sm:text-xs text-fey-cyan">{getModifier(selectedMonster[ability])}</p>
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
                        <span className="font-medium">Condition Immunities:</span> {selectedMonster.condition_immunities}
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
                      <h4 className="font-semibold text-fey-cyan">Traits</h4>
                      {selectedMonster.special_abilities.map((ability, i) => (
                        <div key={i} className="rounded-lg border border-border/50 bg-background/50 p-3">
                          <p className="font-medium">{ability.name}</p>
                          <p className="text-sm text-muted-foreground">{ability.desc}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  {selectedMonster.actions && selectedMonster.actions.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-fey-cyan">Actions</h4>
                      {selectedMonster.actions.map((action, i) => (
                        <div key={i} className="rounded-lg border border-border/50 bg-background/50 p-3">
                          <p className="font-medium">{action.name}</p>
                          <p className="text-sm text-muted-foreground">{action.desc}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reactions */}
                  {selectedMonster.reactions && selectedMonster.reactions.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-fey-cyan">Reactions</h4>
                      {selectedMonster.reactions.map((reaction, i) => (
                        <div key={i} className="rounded-lg border border-border/50 bg-background/50 p-3">
                          <p className="font-medium">{reaction.name}</p>
                          <p className="text-sm text-muted-foreground">{reaction.desc}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Legendary Actions */}
                  {selectedMonster.legendary_actions && selectedMonster.legendary_actions.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-fey-gold">Legendary Actions</h4>
                      <p className="text-xs text-muted-foreground">
                        The creature can take 3 legendary actions, choosing from the options below.
                      </p>
                      {selectedMonster.legendary_actions.map((action, i) => (
                        <div key={i} className="rounded-lg border border-fey-gold/30 bg-fey-gold/5 p-3">
                          <p className="font-medium">{action.name}</p>
                          <p className="text-sm text-muted-foreground">{action.desc}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ) : (
          <Card className="flex h-full items-center justify-center border-border/50 bg-card/80 backdrop-blur-sm">
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
