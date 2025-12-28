"use client"

import { Bookmark, BookmarkCheck, Sparkles, Link } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useCodexStore, type Open5eMagicItem } from "@/lib/codex-store"

interface ItemEntryProps {
  item: Open5eMagicItem
  isExpanded: boolean
}

export function ItemEntry({ item, isExpanded }: ItemEntryProps) {
  const { isBookmarked, addBookmark, removeBookmark } = useCodexStore()
  const bookmarked = isBookmarked(`item-${item.slug}`)

  const handleToggleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (bookmarked) {
      removeBookmark(`item-${item.slug}`)
    } else {
      addBookmark({
        id: `item-${item.slug}`,
        category: "magicitems",
        name: item.name,
        slug: item.slug,
      })
    }
  }

  const getRarityColor = () => {
    const colors: Record<string, string> = {
      common: "bg-gray-500/20 text-gray-400 border-gray-500/30",
      uncommon: "bg-green-500/20 text-green-400 border-green-500/30",
      rare: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      "very rare": "bg-purple-500/20 text-purple-400 border-purple-500/30",
      legendary: "bg-orange-500/20 text-orange-400 border-orange-500/30",
      artifact: "bg-red-500/20 text-red-400 border-red-500/30",
    }
    return colors[item.rarity.toLowerCase()] || "bg-muted text-muted-foreground"
  }

  if (!isExpanded) return null

  return (
    <div className="p-4 space-y-4">
      {/* Header with badges */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{item.type}</Badge>
        <Badge variant="outline" className={getRarityColor()}>
          {item.rarity}
        </Badge>
        {item.requires_attunement && item.requires_attunement !== "---" && (
          <Badge variant="outline" className="bg-fey-purple/10 text-fey-purple border-fey-purple/30">
            <Link className="h-3 w-3 mr-1" />
            {item.requires_attunement === "requires attunement" 
              ? "Attunement" 
              : item.requires_attunement}
          </Badge>
        )}
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
          <Sparkles className="h-4 w-4 text-fey-gold" />
          Description
        </h4>
        <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {item.desc}
        </div>
      </div>

      {/* Source */}
      <div className="pt-2 border-t border-border/50">
        <p className="text-xs text-muted-foreground">
          Source: {item.document__title}
        </p>
      </div>
    </div>
  )
}
