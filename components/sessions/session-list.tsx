"use client"

import { useState, useMemo } from "react"
import { Search, ScrollText, Trash2, Download, ChevronDown, ChevronUp } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { useSessionStore, type Session } from "@/lib/session-store"
import { useCampaignSessions, useCampaignCharacters, useActiveCampaign } from "@/lib/hooks/use-campaign-data"
import { SessionCard } from "./session-card"
import { AddSessionDialog } from "./add-session-dialog"

export function SessionList() {
  const { deleteSession } = useSessionStore()
  const campaignSessions = useCampaignSessions()
  const characters = useCampaignCharacters()
  const activeCampaign = useActiveCampaign()

  const [searchQuery, setSearchQuery] = useState("")
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null)
  const [deleteConfirmSession, setDeleteConfirmSession] = useState<string | null>(null)

  // Sort sessions by number (newest first)
  const sortedSessions = useMemo(() => {
    return [...campaignSessions].sort((a, b) => b.number - a.number)
  }, [campaignSessions])

  // Filter sessions based on search
  const filteredSessions = useMemo(() => {
    if (!searchQuery) return sortedSessions

    const query = searchQuery.toLowerCase()
    return sortedSessions.filter(
      (session) =>
        session.title.toLowerCase().includes(query) ||
        (session.summary?.toLowerCase().includes(query) ?? false) ||
        session.highlights.some((h) => h.toLowerCase().includes(query)) ||
        (session.prepNotes?.toLowerCase().includes(query) ?? false)
    )
  }, [sortedSessions, searchQuery])

  // Get character details for attendees
  const getCharacterName = (characterId: string) => {
    const character = characters.find((c) => c.id === characterId)
    return character?.name || "Unknown"
  }

  const handleToggleExpand = (sessionId: string) => {
    setExpandedSessionId(expandedSessionId === sessionId ? null : sessionId)
  }

  const handleDeleteSession = async (sessionId: string) => {
    await deleteSession(sessionId)
    setDeleteConfirmSession(null)
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null)
    }
  }

  const handleExportSessions = () => {
    const exportData = {
      campaign: activeCampaign?.name || "Unknown Campaign",
      exportedAt: new Date().toISOString(),
      sessions: sortedSessions.map((session) => ({
        ...session,
      })),
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${activeCampaign?.name || "campaign"}-sessions.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const hasActiveFilters = searchQuery !== ""

  const clearFilters = () => {
    setSearchQuery("")
  }

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      {/* Header with Search and Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Input
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 bg-card/50 border-border/50 w-full"
          />
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Export Button */}
          {sortedSessions.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportSessions}
              className="hidden sm:flex"
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          )}

          {/* Add Session Button */}
          <AddSessionDialog />
        </div>
      </div>

      {/* Results Count */}
      {sortedSessions.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-foreground/70">
            <ScrollText className="h-4 w-4 flex-shrink-0" />
            <span>
              {filteredSessions.length} of {sortedSessions.length} session
              {sortedSessions.length !== 1 ? "s" : ""}
              {hasActiveFilters && " (filtered)"}
            </span>
          </div>

          {/* Mobile Export Button */}
          {sortedSessions.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportSessions}
              className="sm:hidden text-muted-foreground"
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {/* Sessions List or Empty State */}
      {filteredSessions.length > 0 ? (
        <div className="space-y-3 sm:space-y-4">
          {filteredSessions.map((session) => (
            <div key={session.id} className="relative group">
              <SessionCard
                session={session}
                isExpanded={expandedSessionId === session.id}
                onToggleExpand={() => handleToggleExpand(session.id)}
                onDelete={() => setDeleteConfirmSession(session.id)}
              />
            </div>
          ))}
        </div>
      ) : sortedSessions.length === 0 ? (
        // No sessions at all - Empty state
        <Card className="bg-card/50 backdrop-blur-sm border-dashed border-2 border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16 px-4 text-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-fey-purple/10 flex items-center justify-center mb-4">
              <ScrollText className="w-8 h-8 sm:w-10 sm:h-10 text-fey-purple" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2">
              No sessions yet
            </h3>
            <p className="text-sm sm:text-base text-foreground/70 mb-6 max-w-sm">
              Chronicle your adventures! Log your first session to keep track of your campaign story.
            </p>
            <AddSessionDialog
              trigger={
                <Button className="bg-fey-purple hover:bg-fey-purple/90 text-white">
                  Start Your First Session
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        // Has sessions but none match search
        <Card className="bg-card/50 backdrop-blur-sm border-dashed border-2 border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16 px-4 text-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-fey-cyan/10 flex items-center justify-center mb-4">
              <Search className="w-8 h-8 sm:w-10 sm:h-10 text-fey-cyan" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2">
              No matches found
            </h3>
            <p className="text-sm sm:text-base text-foreground/70 mb-6 max-w-sm">
              No sessions match your search. Try different keywords.
            </p>
            <Button variant="outline" onClick={clearFilters}>
              Clear Search
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmSession} onOpenChange={() => setDeleteConfirmSession(null)}>
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this session log from your
              campaign.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => deleteConfirmSession && handleDeleteSession(deleteConfirmSession)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
