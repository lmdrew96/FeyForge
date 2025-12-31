"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Calendar,
  Users,
  Sparkles,
  Gift,
  ChevronDown,
  ChevronUp,
  Scroll,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  ExternalLink,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { format } from "date-fns"
import type { Session } from "@/lib/session-store"
import { EditSessionDialog } from "./edit-session-dialog"

interface SessionCardProps {
  session: Session
  isExpanded: boolean
  onToggleExpand: () => void
  onDelete: () => void
}

export function SessionCard({
  session,
  isExpanded,
  onToggleExpand,
  onDelete,
}: SessionCardProps) {
  const [showDmNotes, setShowDmNotes] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  const formattedDate = format(new Date(session.date), "MMMM d, yyyy")

  return (
    <>
      <Card
        className={`bg-card/80 backdrop-blur-sm border-border transition-all duration-200 ${
          isExpanded ? "ring-1 ring-fey-purple/30" : "hover:bg-card/90"
        }`}
      >
        <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
          <CollapsibleTrigger asChild>
            <button className="w-full text-left p-3 sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {/* Session Number and Title */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className="shrink-0 text-xs bg-fey-purple/10 text-fey-purple border-fey-purple/30"
                    >
                      Session {session.number}
                    </Badge>
                    <h3 className="font-semibold text-foreground text-sm sm:text-base truncate">
                      {session.title}
                    </h3>
                  </div>

                  {/* Summary */}
                  <p
                    className={`text-xs sm:text-sm text-foreground/70 mb-3 ${
                      isExpanded ? "" : "line-clamp-2"
                    }`}
                  >
                    {session.summary}
                  </p>

                  {/* Meta Info Row */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 flex-shrink-0" />
                      <span>{formattedDate}</span>
                    </div>
                    {(session.xpAwarded ?? 0) > 0 && (
                      <div className="flex items-center gap-1">
                        <Sparkles className="h-3 w-3 flex-shrink-0 text-fey-gold" />
                        <span className="text-fey-gold">{session.xpAwarded} XP</span>
                      </div>
                    )}
                    {session.npcsEncountered && session.npcsEncountered.length > 0 && (
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3 flex-shrink-0" />
                        <span>{session.npcsEncountered.length} NPC{session.npcsEncountered.length !== 1 ? "s" : ""}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Expand Icon */}
                <div className="flex-shrink-0 mt-1">
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </div>
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="pt-0 px-3 pb-3 sm:px-4 sm:pb-4 space-y-4">
              {/* Divider */}
              <div className="border-t border-border/50" />

              {/* NPCs Encountered */}
              {session.npcsEncountered && session.npcsEncountered.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Users className="h-4 w-4 text-fey-cyan" />
                    <span>NPCs Encountered</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {session.npcsEncountered.map((npcName, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="bg-fey-cyan/10 text-fey-cyan border-fey-cyan/20"
                      >
                        {npcName}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Loot */}
              {session.loot.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Gift className="h-4 w-4 text-fey-gold" />
                    <span>Loot Gained</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {session.loot.map((item, index) => (
                      <Badge
                        key={index}
                        variant="outline"
                        className="bg-fey-gold/10 text-fey-gold border-fey-gold/30"
                      >
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Story Highlights */}
              {session.highlights.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Scroll className="h-4 w-4 text-fey-purple" />
                    <span>Key Story Beats</span>
                  </div>
                  <ul className="space-y-1.5 ml-6">
                    {session.highlights.map((highlight, index) => (
                      <li
                        key={index}
                        className="text-xs sm:text-sm text-foreground/80 list-disc"
                      >
                        {highlight}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* DM Notes (Private - Collapsible) */}
              {session.prepNotes && (
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowDmNotes(!showDmNotes)
                    }}
                    className="text-muted-foreground hover:text-foreground -ml-2"
                  >
                    {showDmNotes ? (
                      <EyeOff className="h-4 w-4 mr-2" />
                    ) : (
                      <Eye className="h-4 w-4 mr-2" />
                    )}
                    <span>DM Notes</span>
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      Private
                    </Badge>
                  </Button>
                  {showDmNotes && (
                    <div className="p-3 rounded-lg bg-muted/30 border border-border/50 text-xs sm:text-sm text-foreground/80 whitespace-pre-wrap">
                      {session.prepNotes}
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="bg-fey-cyan/10 border-fey-cyan/30 text-fey-cyan hover:bg-fey-cyan/20"
                >
                  <Link href={`/sessions/${session.id}`} onClick={(e) => e.stopPropagation()}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Full View
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsEditDialogOpen(true)
                  }}
                  className="text-foreground/70 hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete()
                  }}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Edit Dialog */}
      <EditSessionDialog
        session={session}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />
    </>
  )
}
