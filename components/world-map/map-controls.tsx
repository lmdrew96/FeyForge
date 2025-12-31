"use client"

import { ZoomIn, ZoomOut, RotateCcw, Eye, EyeOff, Ruler } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useWorldMapStore } from "@/lib/world-map-store"
import { useActiveCampaignId } from "@/lib/hooks/use-campaign-data"

export function MapControls() {
  const activeCampaignId = useActiveCampaignId()
  const {
    zoom,
    setZoom,
    resetView,
    isMeasuring,
    toggleMeasuring,
    clearMeasurePoints,
    getMapByCampaign,
    toggleFogOfWar,
  } = useWorldMapStore()
  
  const currentMap = activeCampaignId ? getMapByCampaign(activeCampaignId) : undefined
  
  const handleZoomIn = () => {
    setZoom(zoom + 0.25)
  }
  
  const handleZoomOut = () => {
    setZoom(zoom - 0.25)
  }
  
  const handleResetView = () => {
    resetView()
    clearMeasurePoints()
  }
  
  const handleToggleFog = () => {
    if (currentMap) {
      toggleFogOfWar(currentMap.id)
    }
  }
  
  return (
    <Card className="p-2 bg-card/90 backdrop-blur-sm flex flex-col gap-1">
      {/* Zoom Controls */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleZoomIn}
        disabled={zoom >= 4}
        className="h-9 w-9"
        title="Zoom In"
      >
        <ZoomIn className="h-4 w-4" />
      </Button>
      
      <Button
        variant="ghost"
        size="icon"
        onClick={handleZoomOut}
        disabled={zoom <= 0.25}
        className="h-9 w-9"
        title="Zoom Out"
      >
        <ZoomOut className="h-4 w-4" />
      </Button>
      
      <div className="h-px bg-border my-1" />
      
      {/* Reset View */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleResetView}
        className="h-9 w-9"
        title="Reset View"
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
      
      <div className="h-px bg-border my-1" />
      
      {/* Measurement Tool */}
      <Button
        variant={isMeasuring ? "default" : "ghost"}
        size="icon"
        onClick={toggleMeasuring}
        className="h-9 w-9"
        title={isMeasuring ? "Stop Measuring" : "Measure Distance"}
      >
        <Ruler className="h-4 w-4" />
      </Button>
      
      {/* Fog of War Toggle */}
      <Button
        variant={currentMap?.fogOfWarEnabled ? "default" : "ghost"}
        size="icon"
        onClick={handleToggleFog}
        className="h-9 w-9"
        title={currentMap?.fogOfWarEnabled ? "Disable Fog of War" : "Enable Fog of War"}
      >
        {currentMap?.fogOfWarEnabled ? (
          <Eye className="h-4 w-4" />
        ) : (
          <EyeOff className="h-4 w-4" />
        )}
      </Button>
    </Card>
  )
}
