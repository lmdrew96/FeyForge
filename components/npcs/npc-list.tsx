"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useNPCStore, type NPC } from "@/lib/npc-store"
import { Search, User, MapPin, Trash2, Heart, Skull, HelpCircle, Plus } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export function NPCList() {
  const { npcs, deleteNPC } = useNPCStore()
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterRelationship, setFilterRelationship] = useState<string>("all")

  const filteredNPCs = npcs.filter((npc) => {
    const matchesSearch =
      search === "" ||
      npc.name.toLowerCase().includes(search.toLowerCase()) ||
      npc.occupation.toLowerCase().includes(search.toLowerCase()) ||
      npc.location.toLowerCase().includes(search.toLowerCase())

    const matchesStatus = filterStatus === "all" || npc.status === filterStatus
    const matchesRelationship = filterRelationship === "all" || npc.relationship === filterRelationship

    return matchesSearch && matchesStatus && matchesRelationship
  })

  const getStatusIcon = (status: NPC["status"]) => {
    switch (status) {
      case "alive":
        return <Heart className="h-3 w-3 text-green-500" />
      case "dead":
        return <Skull className="h-3 w-3 text-destructive" />
      default:
        return <HelpCircle className="h-3 w-3 text-muted-foreground" />
    }
  }

  const getRelationshipColor = (relationship: NPC["relationship"]) => {
    switch (relationship) {
      case "friendly":
        return "border-green-500/50 text-green-500"
      case "hostile":
        return "border-destructive/50 text-destructive"
      default:
        return "border-border text-muted-foreground"
    }
  }

  if (npcs.length === 0) {
    return (
      <Card className="bg-card border-border border-dashed">
        <CardContent className="p-12 text-center">
          <User className="h-16 w-16 mx-auto text-muted-foreground opacity-30 mb-4" />
          <h3 className="font-serif text-xl font-bold text-foreground mb-2">No NPCs Yet</h3>
          <p className="text-muted-foreground mb-6">Generate your first NPC to populate your world</p>
          <Button asChild className="bg-primary hover:bg-primary/90">
            <Link href="/npcs/generate">
              <Plus className="h-4 w-4 mr-2" />
              Generate NPC
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search NPCs..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-input border-border"
                />
              </div>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px] bg-input border-border">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="all" className="focus:bg-accent">
                  All Status
                </SelectItem>
                <SelectItem value="alive" className="focus:bg-accent">
                  Alive
                </SelectItem>
                <SelectItem value="dead" className="focus:bg-accent">
                  Dead
                </SelectItem>
                <SelectItem value="unknown" className="focus:bg-accent">
                  Unknown
                </SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterRelationship} onValueChange={setFilterRelationship}>
              <SelectTrigger className="w-[140px] bg-input border-border">
                <SelectValue placeholder="Relationship" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="all" className="focus:bg-accent">
                  All
                </SelectItem>
                <SelectItem value="friendly" className="focus:bg-accent">
                  Friendly
                </SelectItem>
                <SelectItem value="neutral" className="focus:bg-accent">
                  Neutral
                </SelectItem>
                <SelectItem value="hostile" className="focus:bg-accent">
                  Hostile
                </SelectItem>
              </SelectContent>
            </Select>
            <Button asChild className="bg-primary hover:bg-primary/90">
              <Link href="/npcs/generate">
                <Plus className="h-4 w-4 mr-2" />
                New NPC
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* NPC Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredNPCs.map((npc) => (
          <Card key={npc.id} className="bg-card border-border hover:border-primary/50 transition-colors group">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getStatusIcon(npc.status)}
                  <h3 className="font-serif font-bold text-foreground group-hover:text-primary transition-colors">
                    {npc.name}
                  </h3>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  onClick={() => deleteNPC(npc.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <p className="text-sm text-muted-foreground mb-3">
                {npc.race} {npc.occupation}
              </p>

              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                <MapPin className="h-3 w-3" />
                {npc.location}
              </div>

              <div className="flex flex-wrap gap-1 mb-3">
                <Badge variant="outline" className={cn("text-xs", getRelationshipColor(npc.relationship))}>
                  {npc.relationship}
                </Badge>
                {npc.tags.slice(0, 2).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs border-border text-muted-foreground">
                    {tag}
                  </Badge>
                ))}
              </div>

              {npc.personality && (
                <p className="text-xs text-muted-foreground line-clamp-2">{npc.personality.join(", ")}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredNPCs.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No NPCs match your filters</p>
        </div>
      )}
    </div>
  )
}
