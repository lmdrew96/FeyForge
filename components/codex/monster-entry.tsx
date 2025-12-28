"use client"

import { Bookmark, BookmarkCheck, Heart, Shield, Footprints, Eye, Sword, Zap, Star, Skull } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useCodexStore, type Open5eMonster } from "@/lib/codex-store"

interface MonsterEntryProps {
  monster: Open5eMonster
  isExpanded: boolean
}

export function MonsterEntry({ monster, isExpanded }: MonsterEntryProps) {
  const { isBookmarked, addBookmark, removeBookmark } = useCodexStore()
  const bookmarked = isBookmarked(`monster-${monster.slug}`)

  const handleToggleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (bookmarked) {
      removeBookmark(`monster-${monster.slug}`)
    } else {
      addBookmark({
        id: `monster-${monster.slug}`,
        category: "monsters",
        name: monster.name,
        slug: monster.slug,
      })
    }
  }

  const getAbilityModifier = (score: number) => {
    const mod = Math.floor((score - 10) / 2)
    return mod >= 0 ? `+${mod}` : `${mod}`
  }

  const getCRColor = () => {
    const cr = monster.cr
    if (cr <= 1) return "bg-green-500/20 text-green-400 border-green-500/30"
    if (cr <= 4) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
    if (cr <= 10) return "bg-orange-500/20 text-orange-400 border-orange-500/30"
    if (cr <= 17) return "bg-red-500/20 text-red-400 border-red-500/30"
    return "bg-purple-500/20 text-purple-400 border-purple-500/30"
  }

  const formatSpeed = (speed: Record<string, number>) => {
    return Object.entries(speed)
      .map(([type, value]) => (type === "walk" ? `${value} ft.` : `${type} ${value} ft.`))
      .join(", ")
  }

  if (!isExpanded) return null

  return (
    <div className="p-4 space-y-4">
      {/* Header with type and CR */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          {monster.size} {monster.type}
          {monster.subtype && ` (${monster.subtype})`}
        </Badge>
        <Badge variant="outline" className={getCRColor()}>
          CR {monster.challenge_rating}
        </Badge>
        <Badge variant="outline">{monster.alignment}</Badge>
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

      {/* Combat Stats */}
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3">
          <Shield className="h-5 w-5 text-fey-cyan flex-shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Armor Class</p>
            <p className="font-bold">{monster.armor_class}</p>
            {monster.armor_desc && (
              <p className="text-xs text-muted-foreground">{monster.armor_desc}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3">
          <Heart className="h-5 w-5 text-red-400 flex-shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Hit Points</p>
            <p className="font-bold">{monster.hit_points}</p>
            <p className="text-xs text-muted-foreground">{monster.hit_dice}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3">
          <Footprints className="h-5 w-5 text-fey-purple flex-shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Speed</p>
            <p className="font-bold text-xs">{formatSpeed(monster.speed)}</p>
          </div>
        </div>
      </div>

      {/* Ability Scores */}
      <div className="grid grid-cols-6 gap-2 text-center">
        {[
          { label: "STR", value: monster.strength },
          { label: "DEX", value: monster.dexterity },
          { label: "CON", value: monster.constitution },
          { label: "INT", value: monster.intelligence },
          { label: "WIS", value: monster.wisdom },
          { label: "CHA", value: monster.charisma },
        ].map((ability) => (
          <div key={ability.label} className="bg-card border border-border/50 rounded-lg p-2">
            <p className="text-xs font-medium text-muted-foreground">{ability.label}</p>
            <p className="font-bold text-lg">{ability.value}</p>
            <p className="text-xs text-fey-cyan">{getAbilityModifier(ability.value)}</p>
          </div>
        ))}
      </div>

      {/* Defenses & Senses */}
      <div className="space-y-2 text-sm">
        {monster.damage_vulnerabilities && (
          <div className="flex gap-2">
            <span className="font-medium text-red-400 min-w-[140px]">Vulnerabilities:</span>
            <span className="text-muted-foreground">{monster.damage_vulnerabilities}</span>
          </div>
        )}
        {monster.damage_resistances && (
          <div className="flex gap-2">
            <span className="font-medium text-yellow-400 min-w-[140px]">Resistances:</span>
            <span className="text-muted-foreground">{monster.damage_resistances}</span>
          </div>
        )}
        {monster.damage_immunities && (
          <div className="flex gap-2">
            <span className="font-medium text-green-400 min-w-[140px]">Immunities:</span>
            <span className="text-muted-foreground">{monster.damage_immunities}</span>
          </div>
        )}
        {monster.condition_immunities && (
          <div className="flex gap-2">
            <span className="font-medium text-blue-400 min-w-[140px]">Condition Imm.:</span>
            <span className="text-muted-foreground">{monster.condition_immunities}</span>
          </div>
        )}
        {monster.senses && (
          <div className="flex gap-2">
            <Eye className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <span className="text-muted-foreground">{monster.senses}</span>
          </div>
        )}
        {monster.languages && (
          <div className="flex gap-2">
            <span className="font-medium min-w-[140px]">Languages:</span>
            <span className="text-muted-foreground">{monster.languages || "None"}</span>
          </div>
        )}
      </div>

      {/* Special Abilities */}
      {monster.special_abilities && monster.special_abilities.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Star className="h-4 w-4 text-fey-gold" />
            Special Abilities
          </h4>
          <div className="space-y-3">
            {monster.special_abilities.map((ability, idx) => (
              <div key={idx} className="text-sm">
                <p className="font-medium text-foreground">{ability.name}</p>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{ability.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {monster.actions && monster.actions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Sword className="h-4 w-4 text-red-400" />
            Actions
          </h4>
          <div className="space-y-3">
            {monster.actions.map((action, idx) => (
              <div key={idx} className="text-sm">
                <p className="font-medium text-foreground">{action.name}</p>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{action.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bonus Actions */}
      {monster.bonus_actions && monster.bonus_actions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-400" />
            Bonus Actions
          </h4>
          <div className="space-y-3">
            {monster.bonus_actions.map((action, idx) => (
              <div key={idx} className="text-sm">
                <p className="font-medium text-foreground">{action.name}</p>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{action.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reactions */}
      {monster.reactions && monster.reactions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-400" />
            Reactions
          </h4>
          <div className="space-y-3">
            {monster.reactions.map((reaction, idx) => (
              <div key={idx} className="text-sm">
                <p className="font-medium text-foreground">{reaction.name}</p>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{reaction.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legendary Actions */}
      {monster.legendary_actions && monster.legendary_actions.length > 0 && (
        <div className="space-y-2 bg-fey-gold/5 rounded-lg p-3 border border-fey-gold/20">
          <h4 className="text-sm font-semibold text-fey-gold flex items-center gap-2">
            <Skull className="h-4 w-4" />
            Legendary Actions
          </h4>
          {monster.legendary_desc && (
            <p className="text-sm text-muted-foreground italic">{monster.legendary_desc}</p>
          )}
          <div className="space-y-3">
            {monster.legendary_actions.map((action, idx) => (
              <div key={idx} className="text-sm">
                <p className="font-medium text-foreground">{action.name}</p>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{action.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Source */}
      <div className="pt-2 border-t border-border/50">
        <p className="text-xs text-muted-foreground">
          Source: {monster.document__title}
        </p>
      </div>
    </div>
  )
}
