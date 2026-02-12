"use client"

import { useState, useEffect } from "react"
import { Pencil, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useSessionStore, type Session } from "@/lib/session-store"
import { toast } from "sonner"
import { getErrorMessage, isAuthError } from "@/lib/errors"

interface EditSessionDialogProps {
  session: Session
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditSessionDialog({
  session,
  open,
  onOpenChange,
}: EditSessionDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { updateSession } = useSessionStore()

  // Form state
  const [title, setTitle] = useState(session.title)
  const [date, setDate] = useState(
    new Date(session.date).toISOString().split("T")[0]
  )
  const [summary, setSummary] = useState(session.summary || "")
  const [xpAwarded, setXpAwarded] = useState(
    (session.xpAwarded || 0).toString()
  )
  const [lootInput, setLootInput] = useState("")
  const [loot, setLoot] = useState<string[]>(session.loot || [])
  const [highlightsInput, setHighlightsInput] = useState("")
  const [highlights, setHighlights] = useState<string[]>(
    session.highlights || []
  )
  const [prepNotes, setPrepNotes] = useState(session.prepNotes || "")

  // Reset form when session changes
  useEffect(() => {
    setTitle(session.title)
    setDate(new Date(session.date).toISOString().split("T")[0])
    setSummary(session.summary || "")
    setXpAwarded((session.xpAwarded || 0).toString())
    setLoot(session.loot || [])
    setHighlights(session.highlights || [])
    setPrepNotes(session.prepNotes || "")
  }, [session])

  const handleAddLoot = () => {
    if (lootInput.trim()) {
      setLoot([...loot, lootInput.trim()])
      setLootInput("")
    }
  }

  const handleRemoveLoot = (index: number) => {
    setLoot(loot.filter((_, i) => i !== index))
  }

  const handleAddHighlight = () => {
    if (highlightsInput.trim()) {
      setHighlights([...highlights, highlightsInput.trim()])
      setHighlightsInput("")
    }
  }

  const handleRemoveHighlight = (index: number) => {
    setHighlights(highlights.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) return

    setIsSubmitting(true)

    try {
      await updateSession(session.id, {
        title: title.trim(),
        date: new Date(date),
        summary: summary.trim() || undefined,
        xpAwarded: parseInt(xpAwarded) || undefined,
        loot,
        highlights,
        prepNotes: prepNotes.trim() || undefined,
      })

      onOpenChange(false)
    } catch (error) {
      const message = getErrorMessage(error, "Failed to update session")
      if (isAuthError(message)) {
        toast.error("Please log in to update sessions")
      } else {
        toast.error(message)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const isFormValid = title.trim()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden bg-card flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <Pencil className="w-5 h-5 text-fey-purple" />
            Edit Session
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <form onSubmit={handleSubmit} className="space-y-4 pb-4">
            {/* Session Number Badge */}
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="bg-fey-purple/10 text-fey-purple border-fey-purple/30"
              >
                Session {session.number}
              </Badge>
            </div>

            {/* Title and Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="edit-session-title">
                  Session Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="edit-session-title"
                  placeholder="e.g., The Dragon's Lair"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-session-date">Date</Label>
                <Input
                  id="edit-session-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-session-xp">XP Awarded</Label>
                <Input
                  id="edit-session-xp"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={xpAwarded}
                  onChange={(e) => setXpAwarded(e.target.value)}
                  className="bg-background"
                />
              </div>
            </div>

            {/* Summary */}
            <div className="space-y-2">
              <Label htmlFor="edit-session-summary">Session Summary</Label>
              <Textarea
                id="edit-session-summary"
                placeholder="What happened this session?"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="bg-background min-h-[80px] resize-none"
              />
            </div>

            {/* Loot */}
            <div className="space-y-2">
              <Label>Loot Gained</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add loot item..."
                  value={lootInput}
                  onChange={(e) => setLootInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleAddLoot()
                    }
                  }}
                  className="bg-background flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleAddLoot}
                  disabled={!lootInput.trim()}
                >
                  Add
                </Button>
              </div>
              {loot.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {loot.map((item, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="bg-fey-gold/10 text-fey-gold border-fey-gold/30 pr-1"
                    >
                      {item}
                      <button
                        type="button"
                        onClick={() => handleRemoveLoot(index)}
                        className="ml-1 p-0.5 hover:bg-fey-gold/20 rounded"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Highlights */}
            <div className="space-y-2">
              <Label>Key Story Beats</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add story highlight..."
                  value={highlightsInput}
                  onChange={(e) => setHighlightsInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleAddHighlight()
                    }
                  }}
                  className="bg-background flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleAddHighlight}
                  disabled={!highlightsInput.trim()}
                >
                  Add
                </Button>
              </div>
              {highlights.length > 0 && (
                <ul className="space-y-1 pl-1">
                  {highlights.map((highlight, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2 text-sm text-foreground/80"
                    >
                      <span className="text-fey-purple mt-0.5">•</span>
                      <span className="flex-1">{highlight}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveHighlight(index)}
                        className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Prep Notes (DM only) */}
            <div className="space-y-2">
              <Label htmlFor="edit-session-prep-notes">
                Prep Notes{" "}
                <Badge variant="secondary" className="ml-2 text-[10px]">
                  Private
                </Badge>
              </Label>
              <Textarea
                id="edit-session-prep-notes"
                placeholder="Private notes for future reference..."
                value={prepNotes}
                onChange={(e) => setPrepNotes(e.target.value)}
                className="bg-background min-h-[80px] resize-none"
              />
            </div>
          </form>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting}
            className="bg-fey-purple hover:bg-fey-purple/90 text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
