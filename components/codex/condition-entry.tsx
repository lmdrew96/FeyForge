"use client"

import { Bookmark, BookmarkCheck, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useCodexStore, type Open5eCondition } from "@/lib/codex-store"

interface ConditionEntryProps {
  condition: Open5eCondition
  isExpanded: boolean
}

export function ConditionEntry({ condition, isExpanded }: ConditionEntryProps) {
  const { isBookmarked, addBookmark, removeBookmark } = useCodexStore()
  const bookmarked = isBookmarked(`condition-${condition.slug}`)

  const handleToggleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (bookmarked) {
      removeBookmark(`condition-${condition.slug}`)
    } else {
      addBookmark({
        id: `condition-${condition.slug}`,
        category: "conditions",
        name: condition.name,
        slug: condition.slug,
      })
    }
  }

  if (!isExpanded) return null

  // Parse description into bullet points if it contains them
  const descriptionLines = condition.desc.split("\n").filter((line) => line.trim())

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/30">
          <AlertCircle className="h-3 w-3 mr-1" />
          Condition
        </Badge>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggleBookmark}
          className={`h-8 w-8 ${bookmarked ? "text-fey-gold" : "text-muted-foreground hover:text-fey-gold"}`}
        >
          {bookmarked ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
        </Button>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-orange-400" />
          Effects
        </h4>
        <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
          {descriptionLines.map((line, idx) => {
            // Check if line starts with a bullet point indicator
            if (line.trim().startsWith("-") || line.trim().startsWith("*") || line.trim().startsWith("•")) {
              return (
                <div key={idx} className="flex gap-2">
                  <span className="text-fey-cyan flex-shrink-0">•</span>
                  <span>{line.replace(/^[-*•]\s*/, "")}</span>
                </div>
              )
            }
            return <p key={idx}>{line}</p>
          })}
        </div>
      </div>

      {/* Source */}
      <div className="pt-2 border-t border-border/50">
        <p className="text-xs text-muted-foreground">
          Source: {condition.document__title}
        </p>
      </div>
    </div>
  )
}
