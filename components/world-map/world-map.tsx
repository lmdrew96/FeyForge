"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import Image from "next/image"
import { useWorldMapStore } from "@/lib/world-map-store"
import { useActiveCampaignId } from "@/lib/hooks/use-campaign-data"
import { LocationPinMarker } from "@/components/world-map/location-pin"
import { LocationInfoPopover } from "@/components/world-map/location-info-popover"
import { Card } from "@/components/ui/card"
import { Map, ImageOff } from "lucide-react"

export function WorldMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [showMeasureLine, setShowMeasureLine] = useState(false)
  
  const activeCampaignId = useActiveCampaignId()
  const {
    zoom,
    panX,
    panY,
    setPan,
    setZoom,
    isMeasuring,
    measurePoints,
    addMeasurePoint,
    clearMeasurePoints,
    getPinsByCampaign,
    getMapByCampaign,
    selectedPinId,
    selectPin,
    getPin,
  } = useWorldMapStore()
  
  const currentMap = activeCampaignId ? getMapByCampaign(activeCampaignId) : undefined
  const pins = activeCampaignId ? getPinsByCampaign(activeCampaignId) : []
  const visiblePins = currentMap?.fogOfWarEnabled 
    ? pins.filter(p => p.isRevealed) 
    : pins
  const selectedPin = selectedPinId ? getPin(selectedPinId) : null
  
  // Handle mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setZoom(zoom + delta)
  }, [zoom, setZoom])
  
  // Handle drag start
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return // Only left click
    if (isMeasuring) {
      // Add measurement point
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        // Get click position relative to container
        const clickX = e.clientX - rect.left
        const clickY = e.clientY - rect.top
        
        // Reverse the transform: translate(panX, panY) scale(zoom) from top-left origin
        // To get the position on the unscaled map: (click - pan) / zoom
        const x = ((clickX - panX) / zoom) / rect.width * 100
        const y = ((clickY - panY) / zoom) / rect.height * 100
        
        addMeasurePoint({ x, y })
        setShowMeasureLine(true)
      }
      return
    }
    
    setIsDragging(true)
    setDragStart({ x: e.clientX - panX, y: e.clientY - panY })
  }, [isMeasuring, panX, panY, zoom, addMeasurePoint])
  
  // Handle drag move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return
    
    const newPanX = e.clientX - dragStart.x
    const newPanY = e.clientY - dragStart.y
    setPan(newPanX, newPanY)
  }, [isDragging, dragStart, setPan])
  
  // Handle drag end
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])
  
  // Handle touch events for mobile
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null)
  const [lastPinchDistance, setLastPinchDistance] = useState<number | null>(null)
  
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setTouchStart({ x: e.touches[0].clientX - panX, y: e.touches[0].clientY - panY })
    } else if (e.touches.length === 2) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      setLastPinchDistance(distance)
    }
  }, [panX, panY])
  
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && touchStart) {
      const newPanX = e.touches[0].clientX - touchStart.x
      const newPanY = e.touches[0].clientY - touchStart.y
      setPan(newPanX, newPanY)
    } else if (e.touches.length === 2 && lastPinchDistance !== null) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      const delta = (distance - lastPinchDistance) / 200
      setZoom(zoom + delta)
      setLastPinchDistance(distance)
    }
  }, [touchStart, lastPinchDistance, zoom, setPan, setZoom])
  
  const handleTouchEnd = useCallback(() => {
    setTouchStart(null)
    setLastPinchDistance(null)
  }, [])
  
  // Calculate distance for measurement
  const measureDistance = measurePoints.length >= 2
    ? Math.sqrt(
        Math.pow(measurePoints[1].x - measurePoints[0].x, 2) +
        Math.pow(measurePoints[1].y - measurePoints[0].y, 2)
      ).toFixed(1)
    : null
  
  // Clear measurement when switching modes
  useEffect(() => {
    if (!isMeasuring) {
      setShowMeasureLine(false)
      clearMeasurePoints()
    }
  }, [isMeasuring, clearMeasurePoints])
  
  // Close popover when clicking outside
  const handleMapClick = useCallback((e: React.MouseEvent) => {
    // Only deselect if clicking on the map background, not on a pin
    const target = e.target as HTMLElement
    if (!target.closest('[data-pin]')) {
      selectPin(null)
    }
  }, [selectPin])
  
  return (
    <div
      ref={containerRef}
      className={`w-full h-full overflow-hidden bg-muted/30 relative ${
        isDragging ? "cursor-grabbing" : isMeasuring ? "cursor-crosshair" : "cursor-grab"
      }`}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleMapClick}
    >
      {/* Map Container */}
      <div
        className="absolute w-full h-full origin-top-left transition-transform duration-75"
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
        }}
      >
        {/* Background - Placeholder or Custom Map */}
        {currentMap?.imageUrl ? (
          <Image
            src={currentMap.imageUrl}
            alt={currentMap.name || "World Map"}
            fill
            className="object-contain pointer-events-none select-none"
            draggable={false}
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
            <div className="bg-card/80 backdrop-blur-sm rounded-xl p-8 text-center max-w-md mx-4 border border-border">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <Map className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No Map Uploaded</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Upload a custom world map image to get started. You can still add location pins to the canvas.
              </p>
              <div className="grid grid-cols-4 gap-4 opacity-20">
                {/* Placeholder grid pattern */}
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="aspect-square rounded border-2 border-dashed border-muted-foreground/30" />
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Location Pins */}
        {visiblePins.map((pin) => (
          <LocationPinMarker
            key={pin.id}
            pin={pin}
            isSelected={selectedPinId === pin.id}
            onClick={() => selectPin(pin.id)}
          />
        ))}
        
        {/* Measurement Line */}
        {showMeasureLine && measurePoints.length >= 1 && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {measurePoints.length >= 2 && (
              <>
                <line
                  x1={`${measurePoints[0].x}%`}
                  y1={`${measurePoints[0].y}%`}
                  x2={`${measurePoints[1].x}%`}
                  y2={`${measurePoints[1].y}%`}
                  stroke="var(--fey-cyan)"
                  strokeWidth={2 / zoom}
                  strokeDasharray={`${4 / zoom} ${4 / zoom}`}
                />
                {/* Start point */}
                <circle
                  cx={`${measurePoints[0].x}%`}
                  cy={`${measurePoints[0].y}%`}
                  r={6 / zoom}
                  fill="var(--fey-cyan)"
                />
                {/* End point */}
                <circle
                  cx={`${measurePoints[1].x}%`}
                  cy={`${measurePoints[1].y}%`}
                  r={6 / zoom}
                  fill="var(--fey-cyan)"
                />
              </>
            )}
          </svg>
        )}
      </div>
      
      {/* Measurement Display */}
      {isMeasuring && measurePoints.length >= 2 && measureDistance && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
          <Card className="px-4 py-2 bg-card/90 backdrop-blur-sm">
            <p className="text-sm font-medium">
              Distance: <span className="text-fey-cyan">{measureDistance}%</span>
              <span className="text-muted-foreground text-xs ml-2">(of map width)</span>
            </p>
          </Card>
        </div>
      )}
      
      {/* Measurement Instructions */}
      {isMeasuring && measurePoints.length < 2 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
          <Card className="px-4 py-2 bg-card/90 backdrop-blur-sm">
            <p className="text-sm text-muted-foreground">
              {measurePoints.length === 0 
                ? "Click to set the first point" 
                : "Click to set the second point"}
            </p>
          </Card>
        </div>
      )}
      
      {/* Selected Pin Popover */}
      {selectedPin && (
        <LocationInfoPopover 
          pin={selectedPin} 
          onClose={() => selectPin(null)} 
        />
      )}
      
      {/* Zoom Level Indicator */}
      <div className="absolute top-4 right-4 z-10">
        <Card className="px-3 py-1.5 bg-card/80 backdrop-blur-sm">
          <p className="text-xs font-medium text-muted-foreground">
            {Math.round(zoom * 100)}%
          </p>
        </Card>
      </div>
    </div>
  )
}
