"use client"

/**
 * Spells Panel Component
 * Displays spells and spell slots for spellcasters
 */

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sparkles, ChevronDown, ChevronRight, Flame, Zap, Target } from "lucide-react"
import type { SpellProperty, SpellcastingInfo } from "@/lib/character/types"
import { formatModifier } from "@/lib/character/constants"

interface SpellsPanelProps {
  spells: SpellProperty[]
  spellcasting: SpellcastingInfo | null
  onCastSpell?: (spellId: string, slotLevel?: number) => void
  onTogglePrepared?: (spellId: string) => void
  onUseSpellSlot?: (level: number) => void
  onRestoreSpellSlots?: () => void
}

const SPELL_SCHOOLS: Record<string, { color: string; abbr: string }> = {
  abjuration: { color: "text-blue-400", abbr: "Abj" },
  conjuration: { color: "text-yellow-400", abbr: "Con" },
  divination: { color: "text-purple-400", abbr: "Div" },
  enchantment: { color: "text-pink-400", abbr: "Enc" },
  evocation: { color: "text-red-400", abbr: "Evo" },
  illusion: { color: "text-indigo-400", abbr: "Ill" },
  necromancy: { color: "text-gray-400", abbr: "Nec" },
  transmutation: { color: "text-green-400", abbr: "Tra" },
}

export function SpellsPanel({
  spells,
  spellcasting,
  onCastSpell,
  onTogglePrepared,
  onUseSpellSlot,
  onRestoreSpellSlots,
}: SpellsPanelProps) {
  const [expandedSpells, setExpandedSpells] = useState<Set<string>>(new Set())
  const [expandedLevels, setExpandedLevels] = useState<Set<number>>(new Set([0, 1]))

  const toggleSpell = (id: string) => {
    const newExpanded = new Set(expandedSpells)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedSpells(newExpanded)
  }

  const toggleLevel = (level: number) => {
    const newExpanded = new Set(expandedLevels)
    if (newExpanded.has(level)) {
      newExpanded.delete(level)
    } else {
      newExpanded.add(level)
    }
    setExpandedLevels(newExpanded)
  }

  // Group spells by level
  const spellsByLevel = spells.reduce(
    (acc, spell) => {
      const level = spell.spellLevel
      if (!acc[level]) acc[level] = []
      acc[level].push(spell)
      return acc
    },
    {} as Record<number, SpellProperty[]>,
  )

  // Sort levels
  const sortedLevels = Object.keys(spellsByLevel)
    .map(Number)
    .sort((a, b) => a - b)

  if (!spellcasting) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-8 text-center">
          <Sparkles className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">This character is not a spellcaster</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Spells
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <Target className="h-3 w-3" />
              DC {spellcasting.spellSaveDC}
            </span>
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              {formatModifier(spellcasting.spellAttackBonus)}
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Spell Slots */}
        <div className="p-3 rounded-lg bg-accent/30 border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Spell Slots</span>
            {onRestoreSpellSlots && (
              <Button variant="ghost" size="sm" onClick={onRestoreSpellSlots} className="h-6 text-xs">
                Restore All
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(spellcasting.spellSlots)
              .filter(([_, slots]) => slots.total > 0)
              .map(([level, slots]) => (
                <div key={level} className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground w-8">Lvl {level}:</span>
                  <div className="flex gap-0.5">
                    {Array.from({ length: slots.total }).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => i < slots.total - slots.used && onUseSpellSlot?.(Number.parseInt(level))}
                        className={`w-4 h-4 rounded-full border-2 transition-colors ${
                          i < (slots.total - slots.used)
                            ? "bg-primary border-primary hover:bg-primary/80"
                            : "border-muted-foreground"
                        }`}
                        title={i < slots.total - slots.used ? "Available" : "Used"}
                      />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Spells List */}
        <ScrollArea className="h-[350px]">
          <div className="space-y-2">
            {sortedLevels.map((level) => {
              const levelSpells = spellsByLevel[level]
              const isExpanded = expandedLevels.has(level)
              const preparedCount = levelSpells.filter((s) => s.prepared).length

              return (
                <div key={level} className="border border-border rounded-lg overflow-hidden">
                  {/* Level Header */}
                  <button
                    onClick={() => toggleLevel(level)}
                    className="w-full flex items-center justify-between p-2 bg-accent/30 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {level === 0 ? "Cantrips" : `${level}${getOrdinalSuffix(level)} Level`}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {levelSpells.length} spell{levelSpells.length !== 1 ? "s" : ""}
                      </Badge>
                      {level > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {preparedCount} prepared
                        </Badge>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>

                  {/* Spells */}
                  {isExpanded && (
                    <div className="divide-y divide-border">
                      {levelSpells.map((spell) => {
                        const isSpellExpanded = expandedSpells.has(spell.id)
                        const schoolInfo = SPELL_SCHOOLS[spell.school] || {
                          color: "text-muted-foreground",
                          abbr: "???",
                        }

                        return (
                          <div key={spell.id} className="bg-card">
                            {/* Spell Header */}
                            <button
                              onClick={() => toggleSpell(spell.id)}
                              className="w-full flex items-center gap-2 p-2 hover:bg-accent/20 transition-colors"
                            >
                              {level > 0 && onTogglePrepared && (
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onTogglePrepared(spell.id)
                                  }}
                                  className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer ${
                                    spell.prepared
                                      ? "bg-primary border-primary"
                                      : "border-muted-foreground hover:border-primary"
                                  }`}
                                >
                                  {spell.prepared && <span className="text-primary-foreground text-xs">✓</span>}
                                </div>
                              )}
                              <span
                                className={`text-sm ${spell.prepared || level === 0 ? "text-foreground" : "text-muted-foreground"}`}
                              >
                                {spell.name}
                              </span>
                              {spell.concentration && (
                                <Badge variant="outline" className="text-xs">
                                  C
                                </Badge>
                              )}
                              {spell.ritual && (
                                <Badge variant="outline" className="text-xs">
                                  R
                                </Badge>
                              )}
                              <span className="flex-1" />
                              <Badge variant="secondary" className={`text-xs ${schoolInfo.color}`}>
                                {schoolInfo.abbr}
                              </Badge>
                              {isSpellExpanded ? (
                                <ChevronDown className="h-3 w-3 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                              )}
                            </button>

                            {/* Spell Details */}
                            {isSpellExpanded && (
                              <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div>
                                    <span className="text-muted-foreground">Casting Time: </span>
                                    <span className="text-foreground">{spell.castingTime}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Range: </span>
                                    <span className="text-foreground">{spell.range}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Components: </span>
                                    <span className="text-foreground">
                                      {[
                                        spell.components.verbal && "V",
                                        spell.components.somatic && "S",
                                        spell.components.material && "M",
                                      ]
                                        .filter(Boolean)
                                        .join(", ")}
                                      {spell.components.materialCost && ` (${spell.components.materialCost})`}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Duration: </span>
                                    <span className="text-foreground">{spell.duration}</span>
                                  </div>
                                </div>

                                {spell.damage && (
                                  <div className="flex items-center gap-2">
                                    <Flame className="h-3 w-3 text-red-400" />
                                    <span className="text-sm text-foreground">
                                      {spell.damage.diceCount}d{spell.damage.diceSize}
                                      {spell.damage.bonus ? ` + ${spell.damage.bonus}` : ""} {spell.damage.damageType}
                                    </span>
                                  </div>
                                )}

                                {spell.description && (
                                  <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words overflow-hidden line-clamp-4">
                                    {spell.description}
                                  </p>
                                )}

                                {onCastSpell && (spell.prepared || level === 0) && (
                                  <Button
                                    size="sm"
                                    onClick={() => onCastSpell(spell.id, level > 0 ? level : undefined)}
                                    className="w-full h-7 text-xs"
                                  >
                                    <Zap className="h-3 w-3 mr-1" />
                                    Cast Spell
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}

            {spells.length === 0 && (
              <div className="p-8 text-center">
                <Sparkles className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No spells known</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return s[(v - 20) % 10] || s[v] || s[0]
}
