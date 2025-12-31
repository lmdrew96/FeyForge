"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, Sparkles, Clock, Target, Wand2, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { open5eApi, type Open5eSpell } from "@/lib/open5e-api"
import useSWR from "swr"

const SPELL_SCHOOLS = [
  "Abjuration",
  "Conjuration",
  "Divination",
  "Enchantment",
  "Evocation",
  "Illusion",
  "Necromancy",
  "Transmutation",
]
const CLASSES = ["All", "Bard", "Cleric", "Druid", "Paladin", "Ranger", "Sorcerer", "Warlock", "Wizard"]

export function SpellBrowser() {
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [levelFilter, setLevelFilter] = useState<string>("all")
  const [schoolFilter, setSchoolFilter] = useState<string>("all")
  const [classFilter, setClassFilter] = useState<string>("All")
  const [selectedSpell, setSelectedSpell] = useState<Open5eSpell | null>(null)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const {
    data: spells,
    error,
    isLoading,
    mutate,
  } = useSWR(
    ["spells", debouncedSearch, levelFilter, schoolFilter, classFilter],
    async () => {
      const params: { search?: string; level?: number; school?: string; class?: string } = {}
      if (debouncedSearch) params.search = debouncedSearch
      if (levelFilter !== "all") params.level = Number.parseInt(levelFilter)
      if (schoolFilter !== "all") params.school = schoolFilter
      if (classFilter !== "All") params.class = classFilter
      return open5eApi.getSpells(params)
    },
    { revalidateOnFocus: false },
  )

  const filteredSpells = (spells || []).sort((a, b) => {
    if (a.level_int !== b.level_int) return a.level_int - b.level_int
    return a.name.localeCompare(b.name)
  })

  const schoolColors: Record<string, string> = {
    Abjuration: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    Conjuration: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    Divination: "bg-fey-cyan/20 text-fey-cyan border-fey-cyan/30",
    Enchantment: "bg-pink-500/20 text-pink-400 border-pink-500/30",
    Evocation: "bg-red-500/20 text-red-400 border-red-500/30",
    Illusion: "bg-fey-purple/20 text-fey-purple border-fey-purple/30",
    Necromancy: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    Transmutation: "bg-green-500/20 text-green-400 border-green-500/30",
  }

  const formatSchool = (school: string) => {
    return school.charAt(0).toUpperCase() + school.slice(1)
  }

  return (
    <div className="flex flex-col lg:flex-row h-full gap-4 min-w-0">
      {/* Spell List */}
      <div className="flex flex-1 min-w-0 lg:max-w-[50%] flex-col gap-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          <div className="relative flex-1 min-w-0 w-full sm:w-auto">
            <Search className="absolute left-2.5 sm:left-3 top-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search spells..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 sm:pl-9 h-9 sm:h-10 text-sm bg-input border-border"
            />
          </div>
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-20 sm:w-28 h-9 sm:h-10 text-xs sm:text-sm bg-input border-border">
              <SelectValue placeholder="Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="0">Cantrip</SelectItem>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => (
                <SelectItem key={level} value={level.toString()}>
                  Level {level}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={schoolFilter} onValueChange={setSchoolFilter}>
            <SelectTrigger className="w-24 sm:w-32 h-9 sm:h-10 text-xs sm:text-sm bg-input border-border">
              <SelectValue placeholder="School" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Schools</SelectItem>
              {SPELL_SCHOOLS.map((school) => (
                <SelectItem key={school} value={school}>
                  {school}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-20 sm:w-28 h-9 sm:h-10 text-xs sm:text-sm bg-input border-border">
              <SelectValue placeholder="Class" />
            </SelectTrigger>
            <SelectContent>
              {CLASSES.map((cls) => (
                <SelectItem key={cls} value={cls}>
                  {cls}
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

        {/* Spell List */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-fey-cyan" />
              <span className="ml-2 text-muted-foreground">Loading spells from Open5e...</span>
            </div>
          ) : error ? (
            <div className="py-8 text-center text-destructive">
              <p>Failed to load spells. Please try again.</p>
              <Button variant="outline" className="mt-2 bg-transparent" onClick={() => mutate()}>
                Retry
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5 sm:space-y-2 pr-2 sm:pr-4">
              {filteredSpells.map((spell) => (
                <Card
                  key={spell.slug}
                  className={`cursor-pointer border-border/50 bg-card/50 backdrop-blur-sm transition-colors hover:bg-card active:scale-[0.99] ${
                    selectedSpell?.slug === spell.slug ? "border-fey-cyan bg-card" : ""
                  }`}
                  onClick={() => setSelectedSpell(spell)}
                >
                  <CardContent className="p-2.5 sm:p-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-fey-cyan shrink-0" />
                        <span className="font-medium text-sm sm:text-base">{spell.name}</span>
                        {spell.concentration === "yes" && (
                          <Badge
                            variant="outline"
                            className="text-[10px] sm:text-xs text-fey-purple border-fey-purple/30 px-1.5"
                          >
                            C
                          </Badge>
                        )}
                        {spell.ritual === "yes" && (
                          <Badge
                            variant="outline"
                            className="text-[10px] sm:text-xs text-fey-cyan border-fey-cyan/30 px-1.5"
                          >
                            R
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <Badge variant="outline" className="text-[10px] sm:text-xs">
                          {spell.level_int === 0 ? "Cantrip" : `Lvl ${spell.level_int}`}
                        </Badge>
                        <Badge className={`text-[10px] sm:text-xs ${schoolColors[formatSchool(spell.school)] || ""}`}>
                          {formatSchool(spell.school)}
                        </Badge>
                      </div>
                    </div>
                    <p className="mt-1 text-[10px] sm:text-xs text-muted-foreground line-clamp-1">{spell.dnd_class}</p>
                  </CardContent>
                </Card>
              ))}
              {filteredSpells.length === 0 && !isLoading && (
                <p className="py-6 sm:py-8 text-center text-sm sm:text-base text-muted-foreground">
                  No spells found matching your criteria
                </p>
              )}
            </div>
          )}
        </ScrollArea>
        <p className="text-sm text-muted-foreground">{filteredSpells.length} spells found</p>
      </div>

      {/* Spell Detail */}
      <div className="flex-1 min-w-0 lg:max-w-[50%]">
        {selectedSpell ? (
          <Card className="h-full border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Wand2 className="h-5 w-5 text-fey-cyan" />
                  {selectedSpell.name}
                </CardTitle>
                <div className="flex gap-2">
                  <Badge variant="outline">
                    {selectedSpell.level_int === 0 ? "Cantrip" : `Level ${selectedSpell.level_int}`}
                  </Badge>
                  <Badge className={schoolColors[formatSchool(selectedSpell.school)] || ""}>
                    {formatSchool(selectedSpell.school)}
                  </Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{selectedSpell.dnd_class}</p>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[250px] sm:h-[300px] lg:h-[calc(100vh-400px)]">
                <div className="space-y-3 sm:space-y-4 pr-2 sm:pr-4">
                  <div className="grid grid-cols-2 gap-2 sm:gap-4">
                    <div className="flex items-center gap-1.5 sm:gap-2 rounded-lg border border-border/50 bg-background/50 p-2 sm:p-3">
                      <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Casting Time</p>
                        <p className="text-xs sm:text-sm font-medium truncate">{selectedSpell.casting_time}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 rounded-lg border border-border/50 bg-background/50 p-2 sm:p-3">
                      <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Range</p>
                        <p className="text-xs sm:text-sm font-medium truncate">{selectedSpell.range}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                    <p className="text-xs text-muted-foreground">Components</p>
                    <p className="text-sm font-medium">
                      {selectedSpell.components}
                      {selectedSpell.material && ` (${selectedSpell.material})`}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                    <p className="text-xs text-muted-foreground">Duration</p>
                    <p className="text-sm font-medium">
                      {selectedSpell.concentration === "yes" && "Concentration, "}
                      {selectedSpell.duration}
                    </p>
                  </div>

                  <div className="rounded-lg border border-fey-cyan/30 bg-fey-cyan/5 p-4">
                    <p className="text-xs text-muted-foreground mb-2">Description</p>
                    <div className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-hidden">
                      {selectedSpell.desc}
                    </div>
                  </div>

                  {selectedSpell.higher_level && (
                    <div className="rounded-lg border border-fey-gold/30 bg-fey-gold/5 p-4">
                      <p className="text-xs font-medium text-fey-gold mb-2">At Higher Levels</p>
                      <p className="text-sm leading-relaxed">{selectedSpell.higher_level}</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ) : (
          <Card className="flex h-full items-center justify-center border-border/50 bg-card/80 backdrop-blur-sm">
            <div className="text-center">
              <Sparkles className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-2 text-muted-foreground">Select a spell to view details</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
