"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, BookOpen, Skull, Wand2, AlertCircle, ScrollText, Bookmark, X, Loader2, ChevronDown, ChevronUp, Filter, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  useCodexStore,
  type CodexCategory,
  type Open5eSpell,
  type Open5eMonster,
  type Open5eMagicItem,
  type Open5eCondition,
  type Open5eApiResponse,
} from "@/lib/codex-store"
import { SpellEntry } from "./spell-entry"
import { MonsterEntry } from "./monster-entry"
import { ItemEntry } from "./item-entry"
import { ConditionEntry } from "./condition-entry"

const OPEN5E_BASE_URL = "https://api.open5e.com/v1"
const PAGE_SIZE = 50

interface TabConfig {
  id: CodexCategory
  label: string
  icon: React.ReactNode
  endpoint: string
}

const tabs: TabConfig[] = [
  { id: "spells", label: "Spells", icon: <Wand2 className="h-4 w-4" />, endpoint: "/spells" },
  { id: "monsters", label: "Monsters", icon: <Skull className="h-4 w-4" />, endpoint: "/monsters" },
  { id: "magicitems", label: "Magic Items", icon: <BookOpen className="h-4 w-4" />, endpoint: "/magicitems" },
  { id: "conditions", label: "Conditions", icon: <AlertCircle className="h-4 w-4" />, endpoint: "/conditions" },
]

// Spell schools for filtering
const SPELL_SCHOOLS = ["Abjuration", "Conjuration", "Divination", "Enchantment", "Evocation", "Illusion", "Necromancy", "Transmutation"]
const SPELL_LEVELS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]

// Monster sizes and types
const MONSTER_SIZES = ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"]
const MONSTER_CR_RANGES = [
  { label: "CR 0-1", min: 0, max: 1 },
  { label: "CR 2-4", min: 2, max: 4 },
  { label: "CR 5-10", min: 5, max: 10 },
  { label: "CR 11-16", min: 11, max: 16 },
  { label: "CR 17+", min: 17, max: 30 },
]

// Magic item rarities
const ITEM_RARITIES = ["Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact"]

// Sort options per category
const SORT_OPTIONS: Record<CodexCategory, { value: string; label: string }[]> = {
  spells: [
    { value: "name", label: "Name (A-Z)" },
    { value: "-name", label: "Name (Z-A)" },
    { value: "level_int", label: "Level (Low-High)" },
    { value: "-level_int", label: "Level (High-Low)" },
    { value: "school", label: "School (A-Z)" },
  ],
  monsters: [
    { value: "name", label: "Name (A-Z)" },
    { value: "-name", label: "Name (Z-A)" },
    { value: "cr", label: "CR (Low-High)" },
    { value: "-cr", label: "CR (High-Low)" },
    { value: "type", label: "Type (A-Z)" },
  ],
  magicitems: [
    { value: "name", label: "Name (A-Z)" },
    { value: "-name", label: "Name (Z-A)" },
    { value: "rarity", label: "Rarity" },
    { value: "type", label: "Type (A-Z)" },
  ],
  conditions: [
    { value: "name", label: "Name (A-Z)" },
    { value: "-name", label: "Name (Z-A)" },
  ],
  equipment: [
    { value: "name", label: "Name (A-Z)" },
    { value: "-name", label: "Name (Z-A)" },
  ],
  rules: [
    { value: "name", label: "Name (A-Z)" },
    { value: "-name", label: "Name (Z-A)" },
  ],
}

export function CodexBrowser() {
  const { activeCategory, setActiveCategory, searchQuery, setSearchQuery, clearSearch, bookmarks } = useCodexStore()
  
  const [results, setResults] = useState<(Open5eSpell | Open5eMonster | Open5eMagicItem | Open5eCondition)[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [expandedEntrySlug, setExpandedEntrySlug] = useState<string | null>(null)
  const [showBookmarks, setShowBookmarks] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery)
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [nextPageUrl, setNextPageUrl] = useState<string | null>(null)
  const [prevPageUrl, setPrevPageUrl] = useState<string | null>(null)
  
  // Sorting
  const [sortBy, setSortBy] = useState<string>("name")
  
  // Filters per category
  const [spellLevelFilter, setSpellLevelFilter] = useState<string>("all")
  const [spellSchoolFilter, setSpellSchoolFilter] = useState<string>("all")
  const [monsterSizeFilter, setMonsterSizeFilter] = useState<string>("all")
  const [monsterCRFilter, setMonsterCRFilter] = useState<string>("all")
  const [itemRarityFilter, setItemRarityFilter] = useState<string>("all")

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setCurrentPage(1) // Reset to page 1 on search change
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Reset filters when category changes
  useEffect(() => {
    setSpellLevelFilter("all")
    setSpellSchoolFilter("all")
    setMonsterSizeFilter("all")
    setMonsterCRFilter("all")
    setItemRarityFilter("all")
    setSortBy("name")
    setCurrentPage(1)
  }, [activeCategory])

  // Fetch data from Open5e API
  const fetchData = useCallback(async (page: number = 1) => {
    if (page === 1) {
      setLoading(true)
    } else {
      setLoadingMore(true)
    }
    setError(null)
    
    const tab = tabs.find((t) => t.id === activeCategory)
    if (!tab) return

    try {
      const params = new URLSearchParams()
      
      // Search
      if (debouncedSearch) {
        params.append("search", debouncedSearch)
      }
      
      // Pagination
      params.append("limit", PAGE_SIZE.toString())
      const offset = (page - 1) * PAGE_SIZE
      if (offset > 0) {
        params.append("offset", offset.toString())
      }
      
      // Sorting
      if (sortBy) {
        params.append("ordering", sortBy)
      }
      
      // Category-specific filters
      if (activeCategory === "spells") {
        if (spellLevelFilter !== "all") {
          params.append("level_int", spellLevelFilter)
        }
        if (spellSchoolFilter !== "all") {
          params.append("school", spellSchoolFilter)
        }
      }
      
      if (activeCategory === "monsters") {
        if (monsterSizeFilter !== "all") {
          params.append("size", monsterSizeFilter)
        }
        if (monsterCRFilter !== "all") {
          const crRange = MONSTER_CR_RANGES.find(r => r.label === monsterCRFilter)
          if (crRange) {
            params.append("cr__gte", crRange.min.toString())
            params.append("cr__lte", crRange.max.toString())
          }
        }
      }
      
      if (activeCategory === "magicitems") {
        if (itemRarityFilter !== "all") {
          params.append("rarity", itemRarityFilter.toLowerCase())
        }
      }

      const url = `${OPEN5E_BASE_URL}${tab.endpoint}/?${params.toString()}`
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch ${tab.label}`)
      }

      const data: Open5eApiResponse<typeof results[0]> = await response.json()
      setResults(data.results)
      setTotalCount(data.count)
      setNextPageUrl(data.next)
      setPrevPageUrl(data.previous)
      setCurrentPage(page)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      setResults([])
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [activeCategory, debouncedSearch, sortBy, spellLevelFilter, spellSchoolFilter, monsterSizeFilter, monsterCRFilter, itemRarityFilter])

  useEffect(() => {
    fetchData(1)
  }, [fetchData])

  const handleCategoryChange = (value: string) => {
    setActiveCategory(value as CodexCategory)
    setExpandedEntrySlug(null)
    setShowBookmarks(false)
  }

  const handleToggleExpand = (slug: string) => {
    setExpandedEntrySlug(expandedEntrySlug === slug ? null : slug)
  }

  const handleNextPage = () => {
    if (nextPageUrl) {
      fetchData(currentPage + 1)
    }
  }

  const handlePrevPage = () => {
    if (prevPageUrl && currentPage > 1) {
      fetchData(currentPage - 1)
    }
  }

  const clearAllFilters = () => {
    setSpellLevelFilter("all")
    setSpellSchoolFilter("all")
    setMonsterSizeFilter("all")
    setMonsterCRFilter("all")
    setItemRarityFilter("all")
    setSortBy("name")
    clearSearch()
  }

  const hasActiveFilters = () => {
    if (searchQuery) return true
    if (activeCategory === "spells" && (spellLevelFilter !== "all" || spellSchoolFilter !== "all")) return true
    if (activeCategory === "monsters" && (monsterSizeFilter !== "all" || monsterCRFilter !== "all")) return true
    if (activeCategory === "magicitems" && itemRarityFilter !== "all") return true
    return false
  }

  const categoryBookmarks = bookmarks.filter((b) => b.category === activeCategory)
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const renderEntry = (entry: typeof results[0], isExpanded: boolean) => {
    switch (activeCategory) {
      case "spells":
        return <SpellEntry spell={entry as Open5eSpell} isExpanded={isExpanded} />
      case "monsters":
        return <MonsterEntry monster={entry as Open5eMonster} isExpanded={isExpanded} />
      case "magicitems":
        return <ItemEntry item={entry as Open5eMagicItem} isExpanded={isExpanded} />
      case "conditions":
        return <ConditionEntry condition={entry as Open5eCondition} isExpanded={isExpanded} />
      default:
        return null
    }
  }

  const getEntrySubtitle = (entry: typeof results[0]): string => {
    switch (activeCategory) {
      case "spells": {
        const spell = entry as Open5eSpell
        return `${spell.level_int === 0 ? "Cantrip" : `Level ${spell.level_int}`} ${spell.school}`
      }
      case "monsters": {
        const monster = entry as Open5eMonster
        return `${monster.size} ${monster.type}, CR ${monster.challenge_rating}`
      }
      case "magicitems": {
        const item = entry as Open5eMagicItem
        return `${item.type} (${item.rarity})`
      }
      case "conditions":
        return "Condition"
      default:
        return ""
    }
  }

  const renderFilters = () => {
    return (
      <div className="flex flex-wrap gap-2 items-center">
        {/* Sort dropdown - available for all categories */}
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[160px] bg-card/50 h-9">
            <ArrowUpDown className="h-3 w-3 mr-1" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS[activeCategory]?.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Spell filters */}
        {activeCategory === "spells" && (
          <>
            <Select value={spellLevelFilter} onValueChange={setSpellLevelFilter}>
              <SelectTrigger className="w-[120px] bg-card/50 h-9">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="0">Cantrip</SelectItem>
                {SPELL_LEVELS.slice(1).map((level) => (
                  <SelectItem key={level} value={level}>
                    Level {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={spellSchoolFilter} onValueChange={setSpellSchoolFilter}>
              <SelectTrigger className="w-[140px] bg-card/50 h-9">
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
          </>
        )}

        {/* Monster filters */}
        {activeCategory === "monsters" && (
          <>
            <Select value={monsterSizeFilter} onValueChange={setMonsterSizeFilter}>
              <SelectTrigger className="w-[120px] bg-card/50 h-9">
                <SelectValue placeholder="Size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sizes</SelectItem>
                {MONSTER_SIZES.map((size) => (
                  <SelectItem key={size} value={size}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={monsterCRFilter} onValueChange={setMonsterCRFilter}>
              <SelectTrigger className="w-[120px] bg-card/50 h-9">
                <SelectValue placeholder="CR" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All CR</SelectItem>
                {MONSTER_CR_RANGES.map((range) => (
                  <SelectItem key={range.label} value={range.label}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}

        {/* Magic item filters */}
        {activeCategory === "magicitems" && (
          <Select value={itemRarityFilter} onValueChange={setItemRarityFilter}>
            <SelectTrigger className="w-[140px] bg-card/50 h-9">
              <SelectValue placeholder="Rarity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Rarities</SelectItem>
              {ITEM_RARITIES.map((rarity) => (
                <SelectItem key={rarity} value={rarity}>
                  {rarity}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Clear filters button */}
        {hasActiveFilters() && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="h-9 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      {/* Header Section */}
      <div className="flex flex-col gap-3 min-w-0">
        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 min-w-0">
          <div className="relative flex-1 max-w-md min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Input
              placeholder="Search the codex..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9 bg-card/50 border-border/50 w-full"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                onClick={clearSearch}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="flex gap-2 flex-shrink-0">
            {/* Filters Toggle (Mobile) */}
            <Button
              variant={showFilters ? "default" : "outline"}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="sm:hidden"
            >
              <Filter className="h-4 w-4 mr-1" />
              Filters
              {hasActiveFilters() && (
                <Badge className="ml-1 h-4 w-4 p-0 text-[10px] bg-fey-cyan text-white">!</Badge>
              )}
            </Button>

            {/* Bookmarks Toggle */}
            <Button
              variant={showBookmarks ? "default" : "outline"}
              size="sm"
              onClick={() => setShowBookmarks(!showBookmarks)}
            >
              <Bookmark className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Bookmarks</span>
              {bookmarks.length > 0 && (
                <Badge className="ml-1 h-5 px-1.5 text-[10px] bg-fey-cyan/20 text-fey-cyan">
                  {bookmarks.length}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {/* Desktop Filters */}
        <div className="hidden sm:block">
          {renderFilters()}
        </div>

        {/* Mobile Filters (collapsible) */}
        {showFilters && (
          <div className="sm:hidden">
            {renderFilters()}
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeCategory} onValueChange={handleCategoryChange} className="w-full min-w-0">
        <TabsList className="w-full flex flex-wrap h-auto gap-1 p-1 bg-card/50">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="flex-1 min-w-[80px] gap-1.5 data-[state=active]:bg-fey-cyan/10 data-[state=active]:text-fey-cyan"
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Content Area */}
        {tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="mt-4">
            {/* Loading State */}
            {loading && (
              <Card className="p-8">
                <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin text-fey-cyan" />
                  <p>Consulting the archives...</p>
                </div>
              </Card>
            )}

            {/* Error State */}
            {error && !loading && (
              <Card className="p-8 border-destructive/50">
                <div className="flex flex-col items-center justify-center gap-3 text-center">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                  <p className="text-destructive font-medium">{error}</p>
                  <Button variant="outline" size="sm" onClick={() => fetchData(1)}>
                    Try Again
                  </Button>
                </div>
              </Card>
            )}

            {/* Bookmarks Section */}
            {showBookmarks && !loading && categoryBookmarks.length > 0 && (
              <Card className="mb-4 border-fey-gold/30">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-fey-gold mb-3 flex items-center gap-2">
                    <Bookmark className="h-4 w-4" />
                    Bookmarked {tab.label}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {categoryBookmarks.map((bookmark) => (
                      <Badge
                        key={bookmark.id}
                        variant="secondary"
                        className="cursor-pointer hover:bg-fey-cyan/10 hover:text-fey-cyan transition-colors"
                        onClick={() => {
                          setSearchQuery(bookmark.name)
                          setShowBookmarks(false)
                        }}
                      >
                        {bookmark.name}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Empty Bookmarks */}
            {showBookmarks && !loading && categoryBookmarks.length === 0 && (
              <Card className="mb-4 p-6">
                <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground text-center">
                  <Bookmark className="h-6 w-6" />
                  <p>No bookmarked {tab.label.toLowerCase()} yet</p>
                  <p className="text-xs">Click the bookmark icon on any entry to save it for quick access</p>
                </div>
              </Card>
            )}

            {/* Results */}
            {!loading && !error && (
              <>
                {/* Results Count & Pagination Info */}
                {results.length > 0 && (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                    <p className="text-sm text-muted-foreground">
                      Showing {((currentPage - 1) * PAGE_SIZE) + 1}-{Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount} {tab.label.toLowerCase()}
                      {debouncedSearch && ` matching "${debouncedSearch}"`}
                    </p>
                    {totalPages > 1 && (
                      <p className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                      </p>
                    )}
                  </div>
                )}

                {/* Results List */}
                <div className="space-y-3">
                  {results.map((entry) => {
                    const isExpanded = expandedEntrySlug === entry.slug
                    return (
                      <Collapsible
                        key={entry.slug}
                        open={isExpanded}
                        onOpenChange={() => handleToggleExpand(entry.slug)}
                      >
                        <Card className={`transition-all duration-200 ${isExpanded ? "ring-1 ring-fey-cyan/50" : "hover:border-fey-cyan/30"}`}>
                          <CollapsibleTrigger className="w-full text-left">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-foreground truncate">{entry.name}</h3>
                                  <p className="text-sm text-muted-foreground">{getEntrySubtitle(entry)}</p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {isExpanded ? (
                                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                                  ) : (
                                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="border-t border-border/50">
                              {renderEntry(entry, isExpanded)}
                            </div>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    )
                  })}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && results.length > 0 && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePrevPage}
                      disabled={!prevPageUrl || loadingMore}
                      className="gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="hidden sm:inline">Previous</span>
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      {/* Page number buttons - show limited range */}
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number
                        if (totalPages <= 5) {
                          pageNum = i + 1
                        } else if (currentPage <= 3) {
                          pageNum = i + 1
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i
                        } else {
                          pageNum = currentPage - 2 + i
                        }
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => fetchData(pageNum)}
                            disabled={loadingMore}
                            className="w-9 h-9 p-0"
                          >
                            {pageNum}
                          </Button>
                        )
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNextPage}
                      disabled={!nextPageUrl || loadingMore}
                      className="gap-1"
                    >
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* Loading more indicator */}
                {loadingMore && (
                  <div className="flex justify-center mt-4">
                    <Loader2 className="h-6 w-6 animate-spin text-fey-cyan" />
                  </div>
                )}

                {/* Empty State */}
                {results.length === 0 && (
                  <Card className="p-8">
                    <div className="flex flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                      <ScrollText className="h-8 w-8" />
                      <p className="font-medium">No {tab.label.toLowerCase()} found</p>
                      {(debouncedSearch || hasActiveFilters()) && (
                        <>
                          <p className="text-sm">Try adjusting your search or filters</p>
                          <Button variant="outline" size="sm" onClick={clearAllFilters}>
                            Clear All Filters
                          </Button>
                        </>
                      )}
                    </div>
                  </Card>
                )}
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
