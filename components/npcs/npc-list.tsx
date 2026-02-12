"use client"

import { useState, useMemo, useEffect } from "react"
import { Search, Users, Filter, X, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useNPCStore } from "@/lib/npc-store"
import { useCampaignNPCs, useActiveCampaignId } from "@/lib/hooks/use-campaign-data"
import { NPCCard } from "./npc-card"
import { AddNPCDialog } from "./add-npc-dialog"

export function NPCList() {
  const { deleteNPC, initialize, isInitialized } = useNPCStore()
  const npcs = useCampaignNPCs()
  const activeCampaignId = useActiveCampaignId()

  const [searchQuery, setSearchQuery] = useState("")
  const [factionFilter, setFactionFilter] = useState<string>("all")
  const [locationFilter, setLocationFilter] = useState<string>("all")
  const [relationshipFilter, setRelationshipFilter] = useState<string>("all")
  const [showFilters, setShowFilters] = useState(false)
  const [expandedNPCId, setExpandedNPCId] = useState<string | null>(null)
  const [deleteConfirmNPC, setDeleteConfirmNPC] = useState<string | null>(null)

  useEffect(() => {
    if (!isInitialized) {
      initialize()
    }
  }, [initialize, isInitialized])

  // Get unique factions and locations for filters
  const uniqueFactions = useMemo(() => {
    const factions = new Set<string>()
    npcs.forEach((npc) => {
      if (npc.faction) factions.add(npc.faction)
    })
    return Array.from(factions).sort()
  }, [npcs])

  const uniqueLocations = useMemo(() => {
    const locations = new Set<string>()
    npcs.forEach((npc) => {
      if (npc.location) locations.add(npc.location)
    })
    return Array.from(locations).sort()
  }, [npcs])

  // Filter NPCs based on search and filters
  const filteredNPCs = useMemo(() => {
    return npcs.filter((npc) => {
      // Search filter
      const matchesSearch =
        searchQuery === "" ||
        npc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        npc.occupation.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (npc.faction && npc.faction.toLowerCase().includes(searchQuery.toLowerCase())) ||
        npc.location.toLowerCase().includes(searchQuery.toLowerCase())

      // Faction filter
      const matchesFaction = factionFilter === "all" || npc.faction === factionFilter

      // Location filter
      const matchesLocation = locationFilter === "all" || npc.location === locationFilter

      // Relationship filter
      const matchesRelationship = relationshipFilter === "all" || npc.relationship === relationshipFilter

      return matchesSearch && matchesFaction && matchesLocation && matchesRelationship
    })
  }, [npcs, searchQuery, factionFilter, locationFilter, relationshipFilter])

  const hasActiveFilters =
    searchQuery !== "" ||
    factionFilter !== "all" ||
    locationFilter !== "all" ||
    relationshipFilter !== "all"

  const clearFilters = () => {
    setSearchQuery("")
    setFactionFilter("all")
    setLocationFilter("all")
    setRelationshipFilter("all")
  }

  const handleToggleExpand = (npcId: string) => {
    setExpandedNPCId(expandedNPCId === npcId ? null : npcId)
  }

  const handleDeleteNPC = async (npcId: string) => {
    await deleteNPC(npcId)
    setDeleteConfirmNPC(null)
    if (expandedNPCId === npcId) {
      setExpandedNPCId(null)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      {/* Header with Search and Create Button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Input
            placeholder="Search NPCs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 bg-card/50 border-border/50 w-full"
          />
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Filter Toggle (Mobile) */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="sm:hidden"
          >
            <Filter className="h-4 w-4 mr-1" />
            Filters
            {hasActiveFilters && (
              <Badge className="ml-1 h-4 w-4 p-0 text-[10px] bg-fey-cyan text-white">!</Badge>
            )}
          </Button>

          {/* Desktop Filters */}
          <div className="hidden sm:flex items-center gap-2">
            {/* Relationship Filter */}
            <Select value={relationshipFilter} onValueChange={setRelationshipFilter}>
              <SelectTrigger className="w-[140px] bg-card/50">
                <SelectValue placeholder="Relationship" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="friendly">Friendly</SelectItem>
                <SelectItem value="neutral">Neutral</SelectItem>
                <SelectItem value="hostile">Hostile</SelectItem>
              </SelectContent>
            </Select>

            {/* Faction Filter */}
            {uniqueFactions.length > 0 && (
              <Select value={factionFilter} onValueChange={setFactionFilter}>
                <SelectTrigger className="w-[140px] bg-card/50">
                  <SelectValue placeholder="Faction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Factions</SelectItem>
                  {uniqueFactions.map((faction) => (
                    <SelectItem key={faction} value={faction}>
                      {faction}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Location Filter */}
            {uniqueLocations.length > 0 && (
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="w-[160px] bg-card/50">
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {uniqueLocations.map((location) => (
                    <SelectItem key={location} value={location}>
                      {location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {/* Add NPC Button */}
          <AddNPCDialog />
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

            {/* Relationship Filter */}
            <Select value={relationshipFilter} onValueChange={setRelationshipFilter}>
              <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder="Relationship" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="friendly">Friendly</SelectItem>
                <SelectItem value="neutral">Neutral</SelectItem>
                <SelectItem value="hostile">Hostile</SelectItem>
              </SelectContent>
            </Select>

            {/* Faction Filter */}
            {uniqueFactions.length > 0 && (
              <Select value={factionFilter} onValueChange={setFactionFilter}>
                <SelectTrigger className="w-full bg-background">
                  <SelectValue placeholder="Faction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Factions</SelectItem>
                  {uniqueFactions.map((faction) => (
                    <SelectItem key={faction} value={faction}>
                      {faction}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Location Filter */}
            {uniqueLocations.length > 0 && (
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="w-full bg-background">
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {uniqueLocations.map((location) => (
                    <SelectItem key={location} value={location}>
                      {location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results Count */}
      {npcs.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-foreground/70">
          <Users className="h-4 w-4 flex-shrink-0" />
          <span>
            {filteredNPCs.length} of {npcs.length} NPC{npcs.length !== 1 ? "s" : ""}
            {hasActiveFilters && " (filtered)"}
          </span>
        </div>
      )}

      {/* Loading Skeletons */}
      {!isInitialized && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="bg-card/50 backdrop-blur-sm">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
                <Skeleton className="h-3 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-14 rounded-full" />
                  <Skeleton className="h-5 w-18 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* NPC Grid or Empty State */}
      {!isInitialized ? null : filteredNPCs.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          {filteredNPCs.map((npc) => (
            <div key={npc.id} className="relative group">
              <NPCCard
                npc={npc}
                isExpanded={expandedNPCId === npc.id}
                onToggleExpand={() => handleToggleExpand(npc.id)}
              />
              {/* Delete button - visible on hover/focus */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 left-2 h-8 w-8 bg-background/80 hover:bg-destructive hover:text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                onClick={() => setDeleteConfirmNPC(npc.id)}
                title="Delete NPC"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : npcs.length === 0 ? (
        // No NPCs at all - Empty state
        <Card className="bg-card/50 backdrop-blur-sm border-dashed border-2 border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16 px-4 text-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-fey-cyan/10 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 sm:w-10 sm:h-10 text-fey-cyan" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2">No NPCs yet</h3>
            <p className="text-sm sm:text-base text-foreground/70 mb-6 max-w-sm">
              Populate your world with memorable characters! Add your first NPC to get started.
            </p>
            <AddNPCDialog
              trigger={
                <Button className="bg-fey-cyan hover:bg-fey-cyan/90 text-white">
                  Add Your First NPC
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        // Has NPCs but none match filters
        <Card className="bg-card/50 backdrop-blur-sm border-dashed border-2 border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16 px-4 text-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-fey-purple/10 flex items-center justify-center mb-4">
              <Search className="w-8 h-8 sm:w-10 sm:h-10 text-fey-purple" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2">No matches found</h3>
            <p className="text-sm sm:text-base text-foreground/70 mb-6 max-w-sm">
              No NPCs match your current search or filters. Try adjusting your criteria.
            </p>
            <Button variant="outline" onClick={clearFilters}>
              <X className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmNPC} onOpenChange={() => setDeleteConfirmNPC(null)}>
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete NPC?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this NPC from your campaign.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => deleteConfirmNPC && handleDeleteNPC(deleteConfirmNPC)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
