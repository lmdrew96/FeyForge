"use client"

import type React from "react"
import Link from "next/link"
import { UserCircle, MapPin, Shield, ChevronDown, ChevronUp, ExternalLink } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { NPC } from "@/lib/npcs-store"

interface NPCCardProps {
  npc: NPC
  isExpanded: boolean
  onToggleExpand: () => void
}

export function NPCCard({ npc, isExpanded, onToggleExpand }: NPCCardProps) {
  // Get importance color
  const getImportanceColor = () => {
    switch (npc.importance) {
      case "key":
        return "bg-fey-gold/20 border-fey-gold/50 text-fey-gold"
      case "major":
        return "bg-fey-purple/20 border-fey-purple/50 text-fey-purple"
      case "minor":
        return "bg-muted border-border text-muted-foreground"
      default:
        return "bg-muted border-border text-muted-foreground"
    }
  }

  // Get importance label
  const getImportanceLabel = () => {
    switch (npc.importance) {
      case "key":
        return "Key"
      case "major":
        return "Major"
      case "minor":
        return "Minor"
      default:
        return npc.importance
    }
  }

  return (
    <Card
      className={`group relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-fey-cyan/10 hover:border-fey-cyan/30 bg-card/80 backdrop-blur-sm ${
        isExpanded ? "ring-2 ring-fey-cyan/30" : ""
      }`}
    >
      <CardContent className="p-0">
        {/* Portrait Section */}
        <div className="relative aspect-[4/3] bg-gradient-to-br from-fey-forest/20 to-fey-purple/20 overflow-hidden">
          {npc.imageUrl ? (
            <img
              src={npc.imageUrl}
              alt={npc.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-muted/50 flex items-center justify-center">
                <UserCircle className="w-8 h-8 sm:w-10 sm:h-10 text-fey-cyan" />
              </div>
            </div>
          )}

          {/* Importance Badge */}
          <Badge className={`absolute top-2 right-2 border text-xs ${getImportanceColor()}`}>
            {getImportanceLabel()}
          </Badge>
        </div>

        {/* Info Section */}
        <div className="p-3 sm:p-4 space-y-2 sm:space-y-3 min-w-0">
          {/* Name */}
          <h3 className="font-semibold text-foreground text-base sm:text-lg truncate min-w-0">
            {npc.name}
          </h3>

          {/* Role */}
          <div className="flex items-center gap-1.5 text-sm text-foreground/80">
            <Shield className="w-3.5 h-3.5 text-fey-cyan flex-shrink-0" />
            <span className="truncate">{npc.role}</span>
          </div>

          {/* Faction & Location Tags */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
            {npc.faction && (
              <Badge
                variant="outline"
                className="text-xs shrink-0 bg-fey-purple/10 border-fey-purple/30 text-fey-purple truncate max-w-[120px]"
              >
                {npc.faction}
              </Badge>
            )}
            {npc.location && (
              <Badge
                variant="outline"
                className="text-xs shrink-0 bg-fey-forest/10 border-fey-forest/30 text-fey-forest truncate max-w-[120px]"
              >
                <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
                {npc.location}
              </Badge>
            )}
          </div>

          {/* Expand/Collapse Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleExpand}
            className="w-full text-xs sm:text-sm"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />
                <span>Hide Details</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />
                <span>View Details</span>
              </>
            )}
          </Button>
        </div>

        {/* Expanded Detail Section */}
        {isExpanded && (
          <div className="border-t border-border/50 p-3 sm:p-4 space-y-4 bg-muted/20">
            {/* Race & Class */}
            {(npc.race || npc.class) && (
              <div className="space-y-1">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Details
                </h4>
                <div className="flex flex-wrap gap-2 text-sm text-foreground">
                  {npc.race && <span>{npc.race}</span>}
                  {npc.race && npc.class && <span className="text-muted-foreground">·</span>}
                  {npc.class && <span>{npc.class}</span>}
                </div>
              </div>
            )}

            {/* Personality */}
            <div className="space-y-1">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Personality
              </h4>
              <p className="text-sm text-foreground leading-relaxed">
                {npc.personality || "No personality notes yet."}
              </p>
            </div>

            {/* Goals/Motivations */}
            {npc.goals && (
              <div className="space-y-1">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Goals & Motivations
                </h4>
                <p className="text-sm text-foreground leading-relaxed">{npc.goals}</p>
              </div>
            )}

            {/* Relationships */}
            {npc.relationships && (
              <div className="space-y-1">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Relationships
                </h4>
                <p className="text-sm text-foreground leading-relaxed">{npc.relationships}</p>
              </div>
            )}

            {/* View Full Sheet Link */}
            <Button
              variant="outline"
              size="sm"
              asChild
              className="w-full mt-2 bg-fey-cyan/10 border-fey-cyan/30 text-fey-cyan hover:bg-fey-cyan/20"
            >
              <Link href={`/npcs/${npc.id}`}>
                <ExternalLink className="w-3 h-3 mr-1.5" />
                View Full Sheet
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
