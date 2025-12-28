"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Search, Plus, Users, Filter, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useCharactersStore } from "@/lib/characters-store"
import { useCampaignsStore } from "@/lib/campaigns-store"
import { CharacterCard } from "./character-card"
import { classes } from "@/lib/character-data"

export function CharacterList() {
  const { characters } = useCharactersStore()
  const { activeCampaignId } = useCampaignsStore()

  const [searchQuery, setSearchQuery] = useState("")
  const [classFilter, setClassFilter] = useState<string>("all")
  const [showFilters, setShowFilters] = useState(false)

  // Filter characters based on search and filters
  const filteredCharacters = useMemo(() => {
    return characters.filter((character) => {
      // Search filter
      const matchesSearch =
        searchQuery === "" ||
        character.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        character.race.toLowerCase().includes(searchQuery.toLowerCase()) ||
        character.characterClass.toLowerCase().includes(searchQuery.toLowerCase())

      // Class filter
      const matchesClass = classFilter === "all" || character.characterClass === classFilter

      return matchesSearch && matchesClass
    })
  }, [characters, searchQuery, classFilter])

  const hasActiveFilters = searchQuery !== "" || classFilter !== "all"

  const clearFilters = () => {
    setSearchQuery("")
    setClassFilter("all")
  }

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      {/* Header with Search and Create Button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Input
            placeholder="Search characters..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 bg-card/50 border-border/50 w-full"
          />
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Filter Toggle (Mobile) */}
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="sm:hidden">
            <Filter className="h-4 w-4 mr-1" />
            Filters
            {hasActiveFilters && <Badge className="ml-1 h-4 w-4 p-0 text-[10px] bg-fey-cyan text-white">!</Badge>}
          </Button>

          {/* Class Filter (Desktop) */}
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-[140px] hidden sm:flex bg-card/50">
              <SelectValue placeholder="All Classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map((cls) => (
                <SelectItem key={cls.value} value={cls.value}>
                  {cls.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="hidden sm:flex text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}

          {/* Create Button */}
          <Button asChild className="bg-fey-cyan hover:bg-fey-cyan/90 text-white flex-shrink-0">
            <Link href="/create-character">
              <Plus className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden xs:inline">New Character</span>
              <span className="xs:hidden">New</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Mobile Filters Panel */}
      {showFilters && (
        <Card className="sm:hidden bg-card/50 backdrop-blur-sm">
          <CardContent className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Filters</span>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
                  Clear All
                </Button>
              )}
            </div>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map((cls) => (
                  <SelectItem key={cls.value} value={cls.value}>
                    {cls.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Results Count */}
      {characters.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-foreground/70">
          <Users className="h-4 w-4 flex-shrink-0" />
          <span>
            {filteredCharacters.length} of {characters.length} character{characters.length !== 1 ? "s" : ""}
            {hasActiveFilters && " (filtered)"}
          </span>
        </div>
      )}

      {/* Character Grid or Empty State */}
      {filteredCharacters.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          {filteredCharacters.map((character) => (
            <CharacterCard key={character.id} character={character} />
          ))}
        </div>
      ) : characters.length === 0 ? (
        // No characters at all - Empty state
        <Card className="bg-card/50 backdrop-blur-sm border-dashed border-2 border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16 px-4 text-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-fey-cyan/10 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 sm:w-10 sm:h-10 text-fey-cyan" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2">No characters yet</h3>
            <p className="text-sm sm:text-base text-foreground/70 mb-6 max-w-sm">
              Forge your first hero! Create a character to begin your adventure.
            </p>
            <Button asChild className="bg-fey-cyan hover:bg-fey-cyan/90 text-white">
              <Link href="/create-character">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Character
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        // Has characters but none match filters
        <Card className="bg-card/50 backdrop-blur-sm border-dashed border-2 border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16 px-4 text-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-fey-purple/10 flex items-center justify-center mb-4">
              <Search className="w-8 h-8 sm:w-10 sm:h-10 text-fey-purple" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2">No matches found</h3>
            <p className="text-sm sm:text-base text-foreground/70 mb-6 max-w-sm">
              No characters match your current search or filters. Try adjusting your criteria.
            </p>
            <Button variant="outline" onClick={clearFilters}>
              <X className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
