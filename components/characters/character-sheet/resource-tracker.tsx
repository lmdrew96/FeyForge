"use client"

/**
 * Resource Tracker Component
 * Tracks spell slots, class resources (Ki, Rage, etc.), and other expendable resources
 */

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { 
  Sparkles, 
  Flame, 
  Moon, 
  Sun, 
  Zap,
  RotateCcw,
  Circle,
  CheckCircle2,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ============================================
// SPELL SLOT TRACKER
// ============================================

interface SpellSlotLevel {
  level: number
  total: number
  used: number
}

interface SpellSlotTrackerProps {
  slots: SpellSlotLevel[]
  onUseSlot: (level: number) => void
  onRestoreSlot: (level: number) => void
  onRestoreAll: () => void
}

export function SpellSlotTracker({ 
  slots, 
  onUseSlot, 
  onRestoreSlot, 
  onRestoreAll 
}: SpellSlotTrackerProps) {
  return (
    <Card className="bg-card/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-400" />
            Spell Slots
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRestoreAll}
                  className="h-7 px-2 text-xs"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Long Rest
                </Button>
              </TooltipTrigger>
              <TooltipContent>Restore all spell slots</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {slots.filter(s => s.total > 0).map((slot) => (
          <SpellSlotRow
            key={slot.level}
            level={slot.level}
            total={slot.total}
            used={slot.used}
            onUse={() => onUseSlot(slot.level)}
            onRestore={() => onRestoreSlot(slot.level)}
          />
        ))}
        {slots.filter(s => s.total > 0).length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">
            No spell slots available
          </p>
        )}
      </CardContent>
    </Card>
  )
}

interface SpellSlotRowProps {
  level: number
  total: number
  used: number
  onUse: () => void
  onRestore: () => void
}

function SpellSlotRow({ level, total, used, onUse, onRestore }: SpellSlotRowProps) {
  const available = total - used
  const ordinal = getOrdinal(level)

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground w-12">
        {ordinal}
      </span>
      <div className="flex gap-1 flex-1">
        {Array.from({ length: total }).map((_, i) => (
          <button
            key={i}
            onClick={() => i < available ? onUse() : onRestore()}
            className={cn(
              "w-5 h-5 rounded-full border-2 transition-all",
              i < available
                ? "bg-purple-500/20 border-purple-500 hover:bg-purple-500/40"
                : "bg-muted/30 border-muted-foreground/30 hover:border-purple-500/50"
            )}
            title={i < available ? "Click to use slot" : "Click to restore slot"}
          >
            {i >= available && (
              <span className="sr-only">Used</span>
            )}
          </button>
        ))}
      </div>
      <span className="text-xs text-muted-foreground w-10 text-right">
        {available}/{total}
      </span>
    </div>
  )
}

function getOrdinal(n: number): string {
  const ordinals = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"]
  return ordinals[n] || `${n}th`
}

// ============================================
// CLASS RESOURCE TRACKER
// ============================================

interface ClassResource {
  id: string
  name: string
  current: number
  max: number
  rechargeOn: "shortRest" | "longRest" | "dawn" | "turn"
  icon?: "flame" | "zap" | "moon" | "sun" | "sparkles"
  color?: string
}

interface ClassResourceTrackerProps {
  resources: ClassResource[]
  onUseResource: (id: string) => void
  onRestoreResource: (id: string, amount?: number) => void
  onShortRest: () => void
  onLongRest: () => void
}

export function ClassResourceTracker({
  resources,
  onUseResource,
  onRestoreResource,
  onShortRest,
  onLongRest,
}: ClassResourceTrackerProps) {
  if (resources.length === 0) return null

  return (
    <Card className="bg-card/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400" />
            Class Resources
          </CardTitle>
          <div className="flex gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onShortRest}
                    className="h-7 px-2 text-xs"
                  >
                    <Moon className="h-3 w-3 mr-1" />
                    Short
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Short Rest - Restore some resources</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onLongRest}
                    className="h-7 px-2 text-xs"
                  >
                    <Sun className="h-3 w-3 mr-1" />
                    Long
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Long Rest - Restore all resources</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {resources.map((resource) => (
          <ResourceRow
            key={resource.id}
            resource={resource}
            onUse={() => onUseResource(resource.id)}
            onRestore={(amount) => onRestoreResource(resource.id, amount)}
          />
        ))}
      </CardContent>
    </Card>
  )
}

interface ResourceRowProps {
  resource: ClassResource
  onUse: () => void
  onRestore: (amount?: number) => void
}

function ResourceRow({ resource, onUse, onRestore }: ResourceRowProps) {
  const IconComponent = getResourceIcon(resource.icon)
  const color = resource.color || "amber"

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconComponent className={`h-4 w-4 text-${color}-400`} />
          <span className="text-sm font-medium">{resource.name}</span>
        </div>
        <Badge variant="outline" className="text-xs">
          {getRechargeLabel(resource.rechargeOn)}
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex gap-1 flex-1">
          {resource.max <= 10 ? (
            // Show individual bubbles for small numbers
            Array.from({ length: resource.max }).map((_, i) => (
              <button
                key={i}
                onClick={() => i < resource.current ? onUse() : onRestore(1)}
                className={cn(
                  "w-5 h-5 rounded-full border-2 transition-all",
                  i < resource.current
                    ? `bg-${color}-500/20 border-${color}-500 hover:bg-${color}-500/40`
                    : "bg-muted/30 border-muted-foreground/30 hover:border-amber-500/50"
                )}
              />
            ))
          ) : (
            // Show counter for large numbers
            <div className="flex items-center gap-2 flex-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={onUse}
                disabled={resource.current === 0}
              >
                -
              </Button>
              <div className="flex-1 text-center">
                <span className="text-lg font-bold">{resource.current}</span>
                <span className="text-muted-foreground">/{resource.max}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => onRestore(1)}
                disabled={resource.current >= resource.max}
              >
                +
              </Button>
            </div>
          )}
        </div>
        {resource.max <= 10 && (
          <span className="text-xs text-muted-foreground w-10 text-right">
            {resource.current}/{resource.max}
          </span>
        )}
      </div>
    </div>
  )
}

function getResourceIcon(icon?: string) {
  switch (icon) {
    case "flame": return Flame
    case "zap": return Zap
    case "moon": return Moon
    case "sun": return Sun
    case "sparkles": return Sparkles
    default: return Circle
  }
}

function getRechargeLabel(rechargeOn: string): string {
  switch (rechargeOn) {
    case "shortRest": return "Short Rest"
    case "longRest": return "Long Rest"
    case "dawn": return "Dawn"
    case "turn": return "Per Turn"
    default: return rechargeOn
  }
}

// ============================================
// COMBINED RESOURCE PANEL
// ============================================

interface ResourcePanelProps {
  spellSlots?: SpellSlotLevel[]
  classResources?: ClassResource[]
  onUseSpellSlot?: (level: number) => void
  onRestoreSpellSlot?: (level: number) => void
  onRestoreAllSpellSlots?: () => void
  onUseClassResource?: (id: string) => void
  onRestoreClassResource?: (id: string, amount?: number) => void
  onShortRest?: () => void
  onLongRest?: () => void
}

export function ResourcePanel({
  spellSlots = [],
  classResources = [],
  onUseSpellSlot = () => {},
  onRestoreSpellSlot = () => {},
  onRestoreAllSpellSlots = () => {},
  onUseClassResource = () => {},
  onRestoreClassResource = () => {},
  onShortRest = () => {},
  onLongRest = () => {},
}: ResourcePanelProps) {
  const hasSpellSlots = spellSlots.some(s => s.total > 0)
  const hasClassResources = classResources.length > 0

  if (!hasSpellSlots && !hasClassResources) {
    return null
  }

  return (
    <div className="space-y-4">
      {hasSpellSlots && (
        <SpellSlotTracker
          slots={spellSlots}
          onUseSlot={onUseSpellSlot}
          onRestoreSlot={onRestoreSpellSlot}
          onRestoreAll={onRestoreAllSpellSlots}
        />
      )}
      {hasClassResources && (
        <ClassResourceTracker
          resources={classResources}
          onUseResource={onUseClassResource}
          onRestoreResource={onRestoreClassResource}
          onShortRest={onShortRest}
          onLongRest={onLongRest}
        />
      )}
    </div>
  )
}
