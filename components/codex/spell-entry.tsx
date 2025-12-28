"use client"

import { Bookmark, BookmarkCheck, Clock, Target, Sparkles, BookOpen, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useCodexStore, type Open5eSpell } from "@/lib/codex-store"

interface SpellEntryProps {
  spell: Open5eSpell
  isExpanded: boolean
}

export function SpellEntry({ spell, isExpanded }: SpellEntryProps) {
  const { isBookmarked, addBookmark, removeBookmark } = useCodexStore()
  const bookmarked = isBookmarked(`spell-${spell.slug}`)

  const handleToggleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (bookmarked) {
      removeBookmark(`spell-${spell.slug}`)
    } else {
      addBookmark({
        id: `spell-${spell.slug}`,
        category: "spells",
        name: spell.name,
        slug: spell.slug,
      })
    }
  }

  const getLevelText = () => {
    if (spell.level_int === 0) return "Cantrip"
    const suffix = spell.level_int === 1 ? "st" : spell.level_int === 2 ? "nd" : spell.level_int === 3 ? "rd" : "th"
    return `${spell.level_int}${suffix} level`
  }

  const getSchoolColor = () => {
    const colors: Record<string, string> = {
      Abjuration: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      Conjuration: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      Divination: "bg-purple-500/20 text-purple-400 border-purple-500/30",
      Enchantment: "bg-pink-500/20 text-pink-400 border-pink-500/30",
      Evocation: "bg-red-500/20 text-red-400 border-red-500/30",
      Illusion: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
      Necromancy: "bg-gray-500/20 text-gray-400 border-gray-500/30",
      Transmutation: "bg-green-500/20 text-green-400 border-green-500/30",
    }
    return colors[spell.school] || "bg-muted text-muted-foreground"
  }

  if (!isExpanded) return null

  return (
    <div className="p-4 space-y-4">
      {/* Header with badges and bookmark */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={getSchoolColor()}>
          {spell.school}
        </Badge>
        <Badge variant="secondary">{getLevelText()}</Badge>
        {spell.ritual === "yes" && (
          <Badge variant="outline" className="bg-fey-purple/10 text-fey-purple border-fey-purple/30">
            Ritual
          </Badge>
        )}
        {spell.concentration === "yes" && (
          <Badge variant="outline" className="bg-fey-cyan/10 text-fey-cyan border-fey-cyan/30">
            Concentration
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

      {/* Spell Info Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Casting Time</p>
            <p className="font-medium">{spell.casting_time}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Range</p>
            <p className="font-medium">{spell.range}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Components</p>
            <p className="font-medium">{spell.components}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Duration</p>
            <p className="font-medium">{spell.duration}</p>
          </div>
        </div>
      </div>

      {/* Material Component */}
      {spell.material && (
        <div className="text-sm bg-muted/50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">Material Component</p>
          <p className="italic">{spell.material}</p>
        </div>
      )}

      {/* Description */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          Description
        </h4>
        <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {spell.desc}
        </div>
      </div>

      {/* At Higher Levels */}
      {spell.higher_level && (
        <div className="space-y-2 bg-fey-cyan/5 rounded-lg p-3 border border-fey-cyan/20">
          <h4 className="text-sm font-semibold text-fey-cyan">At Higher Levels</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">{spell.higher_level}</p>
        </div>
      )}

      {/* Classes */}
      {spell.dnd_class && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Users className="h-4 w-4" />
            Available To
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {spell.dnd_class.split(", ").map((cls) => (
              <Badge key={cls} variant="outline" className="text-xs">
                {cls}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Source */}
      <div className="pt-2 border-t border-border/50">
        <p className="text-xs text-muted-foreground">
          Source: {spell.document__title}
        </p>
      </div>
    </div>
  )
}
