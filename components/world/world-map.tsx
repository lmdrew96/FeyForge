"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { MapPin, Plus, Castle, Home, Skull, Mountain, Trees, Star, Eye, EyeOff, Trash2 } from "lucide-react"
import { useWorldStore, type MapLocation } from "@/lib/world-store"
import { useCampaignLocations, useActiveCampaignId } from "@/lib/hooks/use-campaign-data"

const locationTypeConfig: Record<MapLocation["type"], { icon: typeof MapPin; color: string; label: string }> = {
  city: { icon: Castle, color: "text-amber-400", label: "City" },
  town: { icon: Home, color: "text-blue-400", label: "Town" },
  village: { icon: Home, color: "text-green-400", label: "Village" },
  dungeon: { icon: Skull, color: "text-red-400", label: "Dungeon" },
  landmark: { icon: Mountain, color: "text-purple-400", label: "Landmark" },
  wilderness: { icon: Trees, color: "text-emerald-400", label: "Wilderness" },
  poi: { icon: Star, color: "text-yellow-400", label: "Point of Interest" },
}

export function WorldMap() {
  const locations = useCampaignLocations()
  const { addLocation, updateLocation, deleteLocation, toggleVisited } = useWorldStore()
  const activeCampaignId = useActiveCampaignId()
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null)
  const [isAddingLocation, setIsAddingLocation] = useState(false)
  const [showUnvisited, setShowUnvisited] = useState(true)
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null)
  const [newLocation, setNewLocation] = useState({
    name: "",
    type: "poi" as MapLocation["type"],
    description: "",
    notes: "",
  })

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isAddingLocation) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setClickPosition({ x, y })
  }

  const handleAddLocation = () => {
    if (!clickPosition || !newLocation.name) return
    addLocation({
      ...newLocation,
      campaignId: activeCampaignId || undefined,
      x: clickPosition.x,
      y: clickPosition.y,
      visited: false,
    })
    setNewLocation({ name: "", type: "poi", description: "", notes: "" })
    setClickPosition(null)
    setIsAddingLocation(false)
  }

  const filteredLocations = showUnvisited ? locations : locations.filter((loc) => loc.visited)

  return (
    <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-[1fr,350px] min-w-0">
      {/* Map Area */}
      <Card className="border-primary/20 bg-card/50 backdrop-blur overflow-hidden">
        <CardHeader className="pb-2 px-3 sm:px-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
            <CardTitle className="font-cinzel text-gold flex items-center gap-2 text-base sm:text-lg">
              <MapPin className="h-4 w-4 sm:h-5 sm:w-5" />
              World Map
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Switch id="show-unvisited" checked={showUnvisited} onCheckedChange={setShowUnvisited} />
                <Label htmlFor="show-unvisited" className="text-xs sm:text-sm text-muted-foreground">
                  <span className="hidden xs:inline">Show Unvisited</span>
                  <span className="xs:hidden">Unvisited</span>
                </Label>
              </div>
              <Button
                variant={isAddingLocation ? "default" : "outline"}
                size="sm"
                onClick={() => setIsAddingLocation(!isAddingLocation)}
                className={`text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3 ${
                  isAddingLocation ? "bg-gold text-background hover:bg-gold/90" : "border-gold/30 hover:border-gold/60"
                }`}
              >
                <Plus className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                {isAddingLocation ? "Click to Place" : "Add Location"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-2 sm:p-4">
          {/* Map Container */}
          <div
            className="relative w-full aspect-[4/3] sm:aspect-[16/10] rounded-lg overflow-hidden cursor-crosshair touch-manipulation"
            onClick={handleMapClick}
            style={{
              backgroundImage: `url('/fantasy-world-map-parchment-style-with-mountains-f.jpg')`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            {/* Overlay for better pin visibility */}
            <div className="absolute inset-0 bg-background/20" />

            {/* Location Pins - larger touch targets on mobile */}
            {filteredLocations.map((location) => {
              const config = locationTypeConfig[location.type]
              const Icon = config.icon
              return (
                <button
                  key={location.id}
                  className={`absolute transform -translate-x-1/2 -translate-y-full transition-all duration-200 hover:scale-125 active:scale-110 group p-1.5 sm:p-1 min-w-[44px] min-h-[44px] flex items-end justify-center ${
                    !location.visited ? "opacity-60" : ""
                  }`}
                  style={{ left: `${location.x}%`, top: `${location.y}%` }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedLocation(location)
                  }}
                >
                  <div className="relative">
                    <MapPin className={`h-6 w-6 sm:h-8 sm:w-8 ${config.color} drop-shadow-lg`} />
                    <Icon className="absolute top-0.5 sm:top-1 left-1/2 -translate-x-1/2 h-2.5 w-2.5 sm:h-3 sm:w-3 text-background" />
                  </div>
                  {/* Tooltip - hidden on touch devices */}
                  <div className="hidden sm:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-background/95 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity border border-primary/20 pointer-events-none">
                    {location.name}
                  </div>
                </button>
              )
            })}

            {/* Click position indicator when adding */}
            {clickPosition && isAddingLocation && (
              <div
                className="absolute transform -translate-x-1/2 -translate-y-1/2 animate-pulse"
                style={{ left: `${clickPosition.x}%`, top: `${clickPosition.y}%` }}
              >
                <div className="w-6 h-6 rounded-full border-2 border-gold bg-gold/30" />
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-3">
            {Object.entries(locationTypeConfig).map(([type, config]) => {
              const Icon = config.icon
              return (
                <div key={type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon className={`h-4 w-4 ${config.color}`} />
                  <span>{config.label}</span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Sidebar */}
      <div className="space-y-4">
        {/* Add Location Form */}
        {isAddingLocation && clickPosition && (
          <Card className="border-gold/30 bg-card/50 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-cinzel text-gold">New Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={newLocation.name}
                  onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                  placeholder="Location name..."
                  className="border-primary/20 bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={newLocation.type}
                  onValueChange={(value: MapLocation["type"]) => setNewLocation({ ...newLocation, type: value })}
                >
                  <SelectTrigger className="border-primary/20 bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(locationTypeConfig).map(([type, config]) => (
                      <SelectItem key={type} value={type}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={newLocation.description}
                  onChange={(e) => setNewLocation({ ...newLocation, description: e.target.value })}
                  placeholder="Describe this location..."
                  className="border-primary/20 bg-background/50 min-h-[80px]"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleAddLocation}
                  disabled={!newLocation.name}
                  className="flex-1 bg-gold text-background hover:bg-gold/90"
                >
                  Add Location
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setClickPosition(null)
                    setIsAddingLocation(false)
                  }}
                  className="border-primary/20"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Selected Location Details */}
        {selectedLocation && !isAddingLocation && (
          <Card className="border-primary/20 bg-card/50 backdrop-blur">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="font-cinzel text-gold flex items-center gap-2">
                    {(() => {
                      const Icon = locationTypeConfig[selectedLocation.type].icon
                      return <Icon className={`h-5 w-5 ${locationTypeConfig[selectedLocation.type].color}`} />
                    })()}
                    {selectedLocation.name}
                  </CardTitle>
                  <Badge variant="outline" className="mt-1 border-primary/30">
                    {locationTypeConfig[selectedLocation.type].label}
                  </Badge>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSelectedLocation(null)} className="h-8 w-8">
                  <span className="text-lg">&times;</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{selectedLocation.description}</p>

              {selectedLocation.notes && (
                <div className="p-3 rounded-lg bg-background/50 border border-primary/10">
                  <p className="text-xs font-medium text-gold mb-1">DM Notes</p>
                  <p className="text-sm">{selectedLocation.notes}</p>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-primary/10">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleVisited(selectedLocation.id)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {selectedLocation.visited ? (
                    <>
                      <Eye className="mr-2 h-4 w-4" />
                      Visited
                    </>
                  ) : (
                    <>
                      <EyeOff className="mr-2 h-4 w-4" />
                      Not Visited
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    deleteLocation(selectedLocation.id)
                    setSelectedLocation(null)
                  }}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Locations List */}
        <Card className="border-primary/20 bg-card/50 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-cinzel text-gold">All Locations</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {locations.map((location) => {
                  const config = locationTypeConfig[location.type]
                  const Icon = config.icon
                  return (
                    <button
                      key={location.id}
                      className={`w-full p-3 rounded-lg border text-left transition-colors ${
                        selectedLocation?.id === location.id
                          ? "border-gold/50 bg-gold/10"
                          : "border-primary/10 bg-background/30 hover:border-primary/30"
                      } ${!location.visited ? "opacity-60" : ""}`}
                      onClick={() => setSelectedLocation(location)}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${config.color}`} />
                        <span className="font-medium">{location.name}</span>
                        {!location.visited && <EyeOff className="h-3 w-3 text-muted-foreground ml-auto" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{location.description}</p>
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
