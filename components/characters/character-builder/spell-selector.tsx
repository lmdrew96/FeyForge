"use client"

/**
 * Spell Selector Component
 * Comprehensive spell browser with filters for character creation and leveling
 */

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Search, Sparkles, BookOpen, Check, Loader2, Wand2 } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { cn } from "@/lib/utils"
import { open5eApi, type Open5eSpell } from "@/lib/open5e-api"
import { SPELL_SCHOOLS } from "@/lib/character/constants"

// ============================================
// TYPES
// ============================================

interface SpellSelectorProps {
  characterClass: string
  characterLevel: number
  maxCantrips?: number
  maxSpellsKnown?: number
  maxSpellsPrepared?: number
  selectedCantrips: string[]
  selectedSpells: string[]
  preparedSpells?: string[]
  onSelectCantrip: (spellSlug: string) => void
  onDeselectCantrip: (spellSlug: string) => void
  onSelectSpell: (spellSlug: string) => void
  onDeselectSpell: (spellSlug: string) => void
  onTogglePrepared?: (spellSlug: string) => void
  isPreparedCaster?: boolean
}

// ============================================
// SPELL SELECTOR COMPONENT
// ============================================

export function SpellSelector({
  characterClass,
  characterLevel,
  maxCantrips = 3,
  maxSpellsKnown,
  maxSpellsPrepared,
  selectedCantrips,
  selectedSpells,
  preparedSpells = [],
  onSelectCantrip,
  onDeselectCantrip,
  onSelectSpell,
  onDeselectSpell,
  onTogglePrepared,
  isPreparedCaster = false,
}: SpellSelectorProps) {
  const [allSpells, setAllSpells] = useState<Open5eSpell[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [levelFilter, setLevelFilter] = useState<string>("all")
  const [schoolFilter, setSchoolFilter] = useState<string>("all")
  const [concentrationFilter, setConcentrationFilter] = useState<string>("all")
  const [ritualFilter, setRitualFilter] = useState<string>("all")
  const [showSelectedOnly, setShowSelectedOnly] = useState(false)
  const [selectedSpellDetails, setSelectedSpellDetails] = useState<Open5eSpell | null>(null)

  // Calculate max spell level based on character level
  const maxSpellLevel = useMemo(() => {
    if (characterLevel >= 17) return 9
    if (characterLevel >= 15) return 8
    if (characterLevel >= 13) return 7
    if (characterLevel >= 11) return 6
    if (characterLevel >= 9) return 5
    if (characterLevel >= 7) return 4
    if (characterLevel >= 5) return 3
    if (characterLevel >= 3) return 2
    return 1
  }, [characterLevel])

  // Load spells from Open5e
  useEffect(() => {
    async function loadSpells() {
      setLoading(true)
      try {
        const spells = await open5eApi.getSpells({})
        setAllSpells(spells)
      } catch (error) {
        console.error("Failed to load spells:", error)
      } finally {
        setLoading(false)
      }
    }
    loadSpells()
  }, [])

  // Filter spells for this class
  const classSpells = useMemo(() => {
    const className = characterClass.toLowerCase()
    return allSpells.filter((spell) => {
      const spellClasses = spell.dnd_class.toLowerCase()
      return spellClasses.includes(className)
    })
  }, [allSpells, characterClass])

  // Apply filters
  const filteredSpells = useMemo(() => {
    return classSpells.filter((spell) => {
      // Search filter
      if (searchQuery && !spell.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }

      // Level filter
      if (levelFilter !== "all" && spell.level_int !== Number.parseInt(levelFilter)) {
        return false
      }

      // School filter
      if (schoolFilter !== "all" && spell.school.toLowerCase() !== schoolFilter.toLowerCase()) {
        return false
      }

      // Concentration filter
      if (concentrationFilter === "yes" && spell.concentration !== "yes") {
        return false
      }
      if (concentrationFilter === "no" && spell.concentration === "yes") {
        return false
      }

      // Ritual filter
      if (ritualFilter === "yes" && spell.ritual !== "yes") {
        return false
      }
      if (ritualFilter === "no" && spell.ritual === "yes") {
        return false
      }

      // Selected only filter
      if (showSelectedOnly) {
        const isSelected =
          spell.level_int === 0 ? selectedCantrips.includes(spell.slug) : selectedSpells.includes(spell.slug)
        if (!isSelected) return false
      }

      // Level cap based on character level
      if (spell.level_int > 0 && spell.level_int > maxSpellLevel) {
        return false
      }

      return true
    })
  }, [
    classSpells,
    searchQuery,
    levelFilter,
    schoolFilter,
    concentrationFilter,
    ritualFilter,
    showSelectedOnly,
    selectedCantrips,
    selectedSpells,
    maxSpellLevel,
  ])

  // Separate cantrips and leveled spells
  const cantrips = filteredSpells.filter((s) => s.level_int === 0)
  const leveledSpells = filteredSpells.filter((s) => s.level_int > 0)

  // Group leveled spells by level
  const spellsByLevel = useMemo(() => {
    const grouped: Record<number, Open5eSpell[]> = {}
    for (let i = 1; i <= 9; i++) {
      grouped[i] = leveledSpells.filter((s) => s.level_int === i)
    }
    return grouped
  }, [leveledSpells])

  const handleSpellClick = (spell: Open5eSpell) => {
    if (spell.level_int === 0) {
      if (selectedCantrips.includes(spell.slug)) {
        onDeselectCantrip(spell.slug)
      } else if (selectedCantrips.length < maxCantrips) {
        onSelectCantrip(spell.slug)
      }
    } else {
      if (selectedSpells.includes(spell.slug)) {
        onDeselectSpell(spell.slug)
      } else if (!maxSpellsKnown || selectedSpells.length < maxSpellsKnown) {
        onSelectSpell(spell.slug)
      }
    }
  }

  return (
    <Card className="bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-purple-400" />
            Spell Selection
          </CardTitle>
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="outline">
              Cantrips: {selectedCantrips.length}/{maxCantrips}
            </Badge>
            {maxSpellsKnown && (
              <Badge variant="outline">
                Spells: {selectedSpells.length}/{maxSpellsKnown}
              </Badge>
            )}
            {isPreparedCaster && maxSpellsPrepared && (
              <Badge variant="secondary">
                Prepared: {preparedSpells.length}/{maxSpellsPrepared}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search spells..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filter Row */}
          <div className="flex flex-wrap gap-2">
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="0">Cantrips</SelectItem>
                {Array.from({ length: maxSpellLevel }, (_, i) => i + 1).map((level) => (
                  <SelectItem key={level} value={level.toString()}>
                    Level {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={schoolFilter} onValueChange={setSchoolFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="School" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Schools</SelectItem>
                {SPELL_SCHOOLS.map((school) => (
                  <SelectItem key={school} value={school}>
                    {school.charAt(0).toUpperCase() + school.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={concentrationFilter} onValueChange={setConcentrationFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Concentration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any</SelectItem>
                <SelectItem value="yes">Concentration</SelectItem>
                <SelectItem value="no">Non-Concentration</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 ml-auto">
              <Checkbox
                id="selectedOnly"
                checked={showSelectedOnly}
                onCheckedChange={(checked) => setShowSelectedOnly(checked === true)}
              />
              <label htmlFor="selectedOnly" className="text-sm text-muted-foreground cursor-pointer">
                Selected only
              </label>
            </div>
          </div>
        </div>

        {/* Spell List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="cantrips" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="cantrips">Cantrips ({cantrips.length})</TabsTrigger>
              <TabsTrigger value="spells">Spells ({leveledSpells.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="cantrips" className="mt-4">
              <ScrollArea className="h-[400px] pr-4">
                <div className="grid gap-2">
                  {cantrips.map((spell) => (
                    <SpellCard
                      key={spell.slug}
                      spell={spell}
                      isSelected={selectedCantrips.includes(spell.slug)}
                      isDisabled={!selectedCantrips.includes(spell.slug) && selectedCantrips.length >= maxCantrips}
                      onClick={() => handleSpellClick(spell)}
                      onViewDetails={() => setSelectedSpellDetails(spell)}
                    />
                  ))}
                  {cantrips.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No cantrips found matching your filters</p>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="spells" className="mt-4">
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {Object.entries(spellsByLevel).map(([level, spells]) => {
                    if (spells.length === 0) return null
                    return (
                      <div key={level}>
                        <h4 className="text-sm font-medium mb-2 sticky top-0 bg-background/95 backdrop-blur py-1">
                          Level {level} Spells ({spells.length})
                        </h4>
                        <div className="grid gap-2">
                          {spells.map((spell) => (
                            <SpellCard
                              key={spell.slug}
                              spell={spell}
                              isSelected={selectedSpells.includes(spell.slug)}
                              isPrepared={isPreparedCaster && preparedSpells.includes(spell.slug)}
                              isDisabled={
                                !selectedSpells.includes(spell.slug) &&
                                maxSpellsKnown !== undefined &&
                                selectedSpells.length >= maxSpellsKnown
                              }
                              onClick={() => handleSpellClick(spell)}
                              onViewDetails={() => setSelectedSpellDetails(spell)}
                              onTogglePrepared={
                                isPreparedCaster && selectedSpells.includes(spell.slug)
                                  ? () => onTogglePrepared?.(spell.slug)
                                  : undefined
                              }
                            />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                  {leveledSpells.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No spells found matching your filters</p>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}

        {/* Spell Details Dialog */}
        <Dialog open={!!selectedSpellDetails} onOpenChange={() => setSelectedSpellDetails(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            {selectedSpellDetails && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-400" />
                    {selectedSpellDetails.name}
                    {selectedSpellDetails.level_int === 0 ? (
                      <Badge variant="secondary">Cantrip</Badge>
                    ) : (
                      <Badge variant="secondary">Level {selectedSpellDetails.level_int}</Badge>
                    )}
                  </DialogTitle>
                </DialogHeader>
                <SpellDetails spell={selectedSpellDetails} />
              </>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

// ============================================
// SPELL CARD
// ============================================

interface SpellCardProps {
  spell: Open5eSpell
  isSelected: boolean
  isPrepared?: boolean
  isDisabled?: boolean
  onClick: () => void
  onViewDetails: () => void
  onTogglePrepared?: () => void
}

function SpellCard({
  spell,
  isSelected,
  isPrepared,
  isDisabled,
  onClick,
  onViewDetails,
  onTogglePrepared,
}: SpellCardProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer",
        isSelected ? "border-purple-500 bg-purple-500/10" : "border-border hover:border-purple-500/50",
        isDisabled && !isSelected && "opacity-50 cursor-not-allowed",
      )}
      onClick={() => !isDisabled && onClick()}
    >
      {/* Selection Indicator */}
      <div
        className={cn(
          "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
          isSelected ? "border-purple-500 bg-purple-500" : "border-muted-foreground/50",
        )}
      >
        {isSelected && <Check className="h-3 w-3 text-white" />}
      </div>

      {/* Spell Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{spell.name}</span>
          {spell.concentration === "yes" && (
            <Badge variant="outline" className="text-[10px] px-1">
              C
            </Badge>
          )}
          {spell.ritual === "yes" && (
            <Badge variant="outline" className="text-[10px] px-1">
              R
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          <span className="capitalize">{spell.school}</span>
          <span>•</span>
          <span>{spell.casting_time}</span>
          <span>•</span>
          <span>{spell.range}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {onTogglePrepared && (
          <Button
            variant={isPrepared ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={(e) => {
              e.stopPropagation()
              onTogglePrepared()
            }}
          >
            {isPrepared ? "Prepared" : "Prepare"}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={(e) => {
            e.stopPropagation()
            onViewDetails()
          }}
        >
          <BookOpen className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// ============================================
// SPELL DETAILS
// ============================================

interface SpellDetailsProps {
  spell: Open5eSpell
}

function SpellDetails({ spell }: SpellDetailsProps) {
  return (
    <div className="space-y-4">
      {/* Quick Info */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-muted-foreground">School:</span> <span className="capitalize">{spell.school}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Casting Time:</span> {spell.casting_time}
        </div>
        <div>
          <span className="text-muted-foreground">Range:</span> {spell.range}
        </div>
        <div>
          <span className="text-muted-foreground">Duration:</span> {spell.duration}
        </div>
        <div>
          <span className="text-muted-foreground">Components:</span> {spell.components}
        </div>
        {spell.material && (
          <div className="col-span-2">
            <span className="text-muted-foreground">Materials:</span> {spell.material}
          </div>
        )}
      </div>

      {/* Badges */}
      <div className="flex gap-2">
        {spell.concentration === "yes" && <Badge>Concentration</Badge>}
        {spell.ritual === "yes" && <Badge variant="secondary">Ritual</Badge>}
      </div>

      {/* Description */}
      <div className="prose prose-sm max-w-none break-words overflow-hidden">
        <ReactMarkdown>{spell.desc}</ReactMarkdown>
      </div>

      {/* Higher Levels */}
      {spell.higher_level && (
        <div className="border-t pt-4">
          <h4 className="font-medium mb-2">At Higher Levels</h4>
          <p className="text-sm text-muted-foreground break-words">{spell.higher_level}</p>
        </div>
      )}

      {/* Classes */}
      <div className="border-t pt-4">
        <span className="text-sm text-muted-foreground">Classes: </span>
        <span className="text-sm">{spell.dnd_class}</span>
      </div>
    </div>
  )
}
