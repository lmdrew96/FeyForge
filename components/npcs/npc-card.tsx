"use client"

import type React from "react"
import Link from "next/link"
import { UserCircle, MapPin, Shield, ChevronDown, ChevronUp, ExternalLink, Heart, Skull, CircleHelp } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { NPC } from "@/lib/npc-store"

interface NPCCardProps {
  npc: NPC
  isExpanded: boolean
  onToggleExpand: () => void
}

export function NPCCard({ npc, isExpanded, onToggleExpand }: NPCCardProps) {
  // Get relationship color and icon
  const getRelationshipStyle = () => {
    switch (npc.relationship) {
      case "friendly":
        return { color: "bg-fey-forest/20 border-fey-forest/50 text-fey-forest", icon: Heart }
      case "hostile":
        return { color: "bg-red-500/20 border-red-500/50 text-red-500", icon: Skull }
      case "neutral":
      default:
        return { color: "bg-muted border-border text-muted-foreground", icon: CircleHelp }
    }
  }

  // Get status badge color
  const getStatusColor = () => {
    switch (npc.status) {
      case "alive":
        return "bg-fey-forest/20 border-fey-forest/50 text-fey-forest"
      case "dead":
        return "bg-red-500/20 border-red-500/50 text-red-500"
      case "unknown":
      default:
        return "bg-muted border-border text-muted-foreground"
    }
  }

  const relationshipStyle = getRelationshipStyle()
  const RelationshipIcon = relationshipStyle.icon

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

          {/* Relationship & Status Badges */}
          <div className="absolute top-2 right-2 flex gap-1">
            <Badge className={`border text-xs ${relationshipStyle.color}`}>
              <RelationshipIcon className="w-3 h-3 mr-1" />
              {npc.relationship}
            </Badge>
            <Badge className={`border text-xs ${getStatusColor()}`}>
              {npc.status}
            </Badge>
          </div>
        </div>

        {/* Info Section */}
        <div className="p-3 sm:p-4 space-y-2 sm:space-y-3 min-w-0">
          {/* Name */}
          <h3 className="font-semibold text-foreground text-base sm:text-lg truncate min-w-0">
            {npc.name}
          </h3>

          {/* Occupation */}
          <div className="flex items-center gap-1.5 text-sm text-foreground/80">
            <Shield className="w-3.5 h-3.5 text-fey-cyan flex-shrink-0" />
            <span className="truncate">{npc.occupation}</span>
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
            <Badge
              variant="outline"
              className="text-xs shrink-0 bg-fey-forest/10 border-fey-forest/30 text-fey-forest truncate max-w-[120px]"
            >
              <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
              {npc.location}
            </Badge>
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
            {/* Race, Age & Alignment */}
            <div className="space-y-1">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Details
              </h4>
              <div className="flex flex-wrap gap-2 text-sm text-foreground">
                <span>{npc.race}</span>
                <span className="text-muted-foreground">·</span>
                <span>{npc.age}</span>
                <span className="text-muted-foreground">·</span>
                <span>{npc.gender}</span>
                <span className="text-muted-foreground">·</span>
                <span>{npc.alignment}</span>
              </div>
            </div>

            {/* Appearance */}
            <div className="space-y-1">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Appearance
              </h4>
              <p className="text-sm text-foreground leading-relaxed">{npc.appearance}</p>
            </div>

            {/* Personality */}
            <div className="space-y-1">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Personality
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {npc.personality.map((trait, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {trait}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Motivation */}
            <div className="space-y-1">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Motivation
              </h4>
              <p className="text-sm text-foreground leading-relaxed">{npc.motivation}</p>
            </div>

            {/* Tags */}
            {npc.tags.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Tags
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {npc.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs bg-fey-cyan/10 border-fey-cyan/30 text-fey-cyan">
                      {tag}
                    </Badge>
                  ))}
                </div>
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
