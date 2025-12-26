"use client"

/**
 * Features Panel Component
 * Displays racial and class features with uses tracking
 */

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Star, Zap, Users, BookOpen, ChevronDown, ChevronRight, Minus, Plus } from "lucide-react"
import type { FeatureProperty } from "@/lib/character/types"

interface FeaturesPanelProps {
  features: FeatureProperty[]
  onUseFeature?: (featureId: string) => void
  onRestoreFeature?: (featureId: string) => void
  onToggleFeature?: (featureId: string) => void
}

const SOURCE_ICONS: Record<FeatureProperty["source"], typeof Star> = {
  race: Users,
  class: Zap,
  background: BookOpen,
  feat: Star,
  other: Star,
}

const SOURCE_COLORS: Record<FeatureProperty["source"], string> = {
  race: "text-green-400",
  class: "text-blue-400",
  background: "text-purple-400",
  feat: "text-yellow-400",
  other: "text-muted-foreground",
}

export function FeaturesPanel({ features, onUseFeature, onRestoreFeature, onToggleFeature }: FeaturesPanelProps) {
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(new Set())

  const toggleFeature = (id: string) => {
    const newExpanded = new Set(expandedFeatures)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedFeatures(newExpanded)
  }

  // Group features by source
  const groupedFeatures = features.reduce(
    (acc, feature) => {
      const source = feature.source
      if (!acc[source]) acc[source] = []
      acc[source].push(feature)
      return acc
    },
    {} as Record<string, FeatureProperty[]>,
  )

  // Order: race, class, background, feat, other
  const sourceOrder: FeatureProperty["source"][] = ["race", "class", "background", "feat", "other"]

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Star className="h-4 w-4" />
          Features & Traits
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[400px]">
          <div className="space-y-4">
            {sourceOrder.map((source) => {
              const sourceFeatures = groupedFeatures[source]
              if (!sourceFeatures || sourceFeatures.length === 0) return null

              const Icon = SOURCE_ICONS[source]
              const colorClass = SOURCE_COLORS[source]

              return (
                <div key={source} className="space-y-2">
                  {/* Source Header */}
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${colorClass}`} />
                    <span className="text-sm font-medium text-muted-foreground capitalize">{source} Features</span>
                    <Badge variant="secondary" className="text-xs">
                      {sourceFeatures.length}
                    </Badge>
                  </div>

                  {/* Features */}
                  <div className="space-y-1 pl-6">
                    {sourceFeatures.map((feature) => {
                      const isExpanded = expandedFeatures.has(feature.id)
                      const hasUses = feature.uses && feature.uses.max > 0

                      return (
                        <div
                          key={feature.id}
                          className={`rounded-lg border transition-all ${
                            feature.active ? "border-border bg-card" : "border-border/50 bg-muted/30 opacity-60"
                          }`}
                        >
                          {/* Feature Header */}
                          <button
                            onClick={() => toggleFeature(feature.id)}
                            className="w-full flex items-center justify-between p-2 hover:bg-accent/30 transition-colors rounded-lg"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground">{feature.name}</span>
                              {feature.level && (
                                <Badge variant="outline" className="text-xs">
                                  Lvl {feature.level}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {hasUses && (
                                <Badge
                                  variant={feature.uses!.current > 0 ? "default" : "secondary"}
                                  className="text-xs"
                                >
                                  {feature.uses!.current}/{feature.uses!.max}
                                </Badge>
                              )}
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </button>

                          {/* Feature Details */}
                          {isExpanded && (
                            <div className="px-2 pb-2 space-y-2">
                              {feature.description && (
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words overflow-hidden">
                                  {feature.description}
                                </p>
                              )}

                              {/* Uses Controls */}
                              {hasUses && (onUseFeature || onRestoreFeature) && (
                                <div className="flex items-center gap-2 pt-2 border-t border-border">
                                  <span className="text-xs text-muted-foreground">
                                    Uses: {feature.uses!.current}/{feature.uses!.max}
                                  </span>
                                  <span className="text-xs text-muted-foreground capitalize">
                                    (Recharges on {feature.uses!.rechargeOn.replace(/([A-Z])/g, " $1").trim()})
                                  </span>
                                  <div className="flex-1" />
                                  {onUseFeature && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        onUseFeature(feature.id)
                                      }}
                                      disabled={feature.uses!.current <= 0}
                                      className="h-6 text-xs"
                                    >
                                      <Minus className="h-3 w-3 mr-1" />
                                      Use
                                    </Button>
                                  )}
                                  {onRestoreFeature && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        onRestoreFeature(feature.id)
                                      }}
                                      disabled={feature.uses!.current >= feature.uses!.max}
                                      className="h-6 text-xs"
                                    >
                                      <Plus className="h-3 w-3 mr-1" />
                                      Restore
                                    </Button>
                                  )}
                                </div>
                              )}

                              {/* Toggle Active */}
                              {onToggleFeature && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onToggleFeature(feature.id)
                                  }}
                                  className="w-full h-6 text-xs text-muted-foreground"
                                >
                                  {feature.active ? "Disable" : "Enable"} Feature
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {features.length === 0 && (
              <div className="p-8 text-center">
                <Star className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No features yet</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

/**
 * Compact features list
 */
interface CompactFeaturesListProps {
  features: FeatureProperty[]
}

export function CompactFeaturesList({ features }: CompactFeaturesListProps) {
  if (features.length === 0) {
    return <p className="text-sm text-muted-foreground italic">No features</p>
  }

  return (
    <div className="space-y-1">
      {features.slice(0, 5).map((feature) => (
        <div key={feature.id} className="flex items-center justify-between text-sm">
          <span className="text-foreground truncate">{feature.name}</span>
          {feature.uses && feature.uses.max > 0 && (
            <Badge variant="secondary" className="text-xs ml-2">
              {feature.uses.current}/{feature.uses.max}
            </Badge>
          )}
        </div>
      ))}
      {features.length > 5 && <p className="text-xs text-muted-foreground">+{features.length - 5} more...</p>}
    </div>
  )
}
