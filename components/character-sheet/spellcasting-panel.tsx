"use client"

// ... existing imports ...
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import type { Character } from "@/lib/characters-store"
import { ChevronDown, Plus, Sparkles, Trash2, Wand2 } from "lucide-react"
import { useState } from "react"

interface SpellcastingPanelProps {
  character: Character
  isEditing: boolean
  onUpdate: (data: Partial<Character>) => void
}

export function SpellcastingPanel({ character, isEditing, onUpdate }: SpellcastingPanelProps) {
  const [expandedLevels, setExpandedLevels] = useState<number[]>([0, 1])
  const [newSpell, setNewSpell] = useState({ name: "", level: 0 })

  const spellcasting = character.spellcasting
  if (!spellcasting) return null

  const toggleLevel = (level: number) => {
    setExpandedLevels((prev) => (prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]))
  }

  const expendSpellSlot = (slotLevel: number) => {
    const updated = spellcasting.spellSlots.map((slot) =>
      slot.level === slotLevel && slot.used < slot.total ? { ...slot, used: slot.used + 1 } : slot,
    )
    onUpdate({ spellcasting: { ...spellcasting, spellSlots: updated } })
  }

  const restoreSpellSlot = (slotLevel: number) => {
    const updated = spellcasting.spellSlots.map((slot) =>
      slot.level === slotLevel && slot.used > 0 ? { ...slot, used: slot.used - 1 } : slot,
    )
    onUpdate({ spellcasting: { ...spellcasting, spellSlots: updated } })
  }

  const togglePrepared = (spellName: string) => {
    const updated = spellcasting.spells.map((spell) =>
      spell.name === spellName ? { ...spell, prepared: !spell.prepared } : spell,
    )
    onUpdate({ spellcasting: { ...spellcasting, spells: updated } })
  }

  const addSpell = () => {
    if (newSpell.name.trim()) {
      onUpdate({
        spellcasting: {
          ...spellcasting,
          spells: [...spellcasting.spells, { name: newSpell.name.trim(), level: newSpell.level, prepared: false }],
        },
      })
      setNewSpell({ name: "", level: 0 })
    }
  }

  const removeSpell = (spellName: string) => {
    onUpdate({
      spellcasting: {
        ...spellcasting,
        spells: spellcasting.spells.filter((s) => s.name !== spellName),
      },
    })
  }

  // Group spells by level
  const spellsByLevel = spellcasting.spells.reduce(
    (acc, spell) => {
      if (!acc[spell.level]) acc[spell.level] = []
      acc[spell.level].push(spell)
      return acc
    },
    {} as Record<number, typeof spellcasting.spells>,
  )

  const spellLevels = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(
    (level) => spellsByLevel[level]?.length || level <= Math.max(...spellcasting.spellSlots.map((s) => s.level), 0),
  )

  return (
    <Card className="p-4 bg-card/80 backdrop-blur-sm border-fey-sage/30 overflow-hidden">
      <h2 className="text-lg font-display font-semibold mb-4 text-fey-gold flex items-center gap-2">
        <Wand2 className="h-5 w-5 shrink-0" />
        Spellcasting
      </h2>

      {/* Spellcasting Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 p-2 sm:p-3 rounded-lg bg-background/50 overflow-hidden">
        <div className="text-center min-w-0">
          <p className="text-xs text-muted-foreground truncate">Ability</p>
          <p className="font-semibold text-foreground text-sm sm:text-base truncate">{spellcasting.ability}</p>
        </div>
        <div className="text-center min-w-0">
          <p className="text-xs text-muted-foreground truncate">Save DC</p>
          <p className="font-semibold text-fey-cyan text-sm sm:text-base">{spellcasting.saveDC}</p>
        </div>
        <div className="text-center min-w-0">
          <p className="text-xs text-muted-foreground truncate">Attack</p>
          <p className="font-semibold text-fey-cyan text-sm sm:text-base">+{spellcasting.attackBonus}</p>
        </div>
      </div>

      {/* Spell Slots */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">Spell Slots</h3>
        <div className="flex flex-wrap gap-2">
          {spellcasting.spellSlots.map((slot) => (
            <div
              key={slot.level}
              className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-lg bg-background/50"
            >
              <span className="text-xs text-muted-foreground">L{slot.level}</span>
              <div className="flex gap-0.5 sm:gap-1">
                {Array.from({ length: slot.total }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (i < slot.used) {
                        restoreSpellSlot(slot.level)
                      } else {
                        expendSpellSlot(slot.level)
                      }
                    }}
                    className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full transition-colors ${
                      i < slot.total - slot.used ? "bg-fey-purple" : "border-2 border-fey-sage/50"
                    }`}
                    aria-label={`Spell slot ${slot.level}-${i + 1}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Spells by Level */}
      <div className="space-y-2">
        {spellLevels.map((level) => {
          const levelSpells = spellsByLevel[level] || []

          return (
            <Collapsible key={level} open={expandedLevels.includes(level)} onOpenChange={() => toggleLevel(level)}>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between p-2 rounded-lg bg-background/50 hover:bg-fey-forest/10 transition-colors min-w-0 overflow-hidden">
                  <div className="flex items-center gap-2 min-w-0">
                    <Sparkles className="h-4 w-4 text-fey-purple shrink-0" />
                    <span className="font-medium text-foreground truncate">
                      {level === 0 ? "Cantrips" : `Level ${level}`}
                    </span>
                    <Badge variant="secondary" className="ml-1 bg-fey-sage/20 text-xs shrink-0">
                      {levelSpells.length}
                    </Badge>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${
                      expandedLevels.includes(level) ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="pl-2 sm:pl-4 py-2 space-y-1">
                  {levelSpells.map((spell) => (
                    <div
                      key={spell.name}
                      className={`flex items-center justify-between py-1.5 px-2 rounded-md min-w-0 overflow-hidden ${
                        spell.prepared ? "bg-fey-purple/10" : "hover:bg-background/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                        {level > 0 && (
                          <Checkbox
                            checked={spell.prepared}
                            onCheckedChange={() => togglePrepared(spell.name)}
                            className="data-[state=checked]:bg-fey-purple data-[state=checked]:border-fey-purple shrink-0"
                          />
                        )}
                        <span
                          className={`text-sm truncate ${
                            spell.prepared || level === 0 ? "font-medium text-foreground" : "text-muted-foreground"
                          }`}
                        >
                          {spell.name}
                        </span>
                        {spell.concentration && (
                          <Badge variant="outline" className="text-xs border-fey-cyan text-fey-cyan shrink-0">
                            C
                          </Badge>
                        )}
                        {spell.ritual && (
                          <Badge variant="outline" className="text-xs border-fey-gold text-fey-gold shrink-0">
                            R
                          </Badge>
                        )}
                      </div>
                      {isEditing && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeSpell(spell.name)}
                          className="h-6 w-6 text-destructive hover:text-destructive shrink-0"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {levelSpells.length === 0 && (
                    <p className="text-sm text-muted-foreground py-2">No spells at this level</p>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )
        })}
      </div>

      {/* Add Spell Form */}
      {isEditing && (
        <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-fey-sage/20">
          <Input
            placeholder="Spell name"
            value={newSpell.name}
            onChange={(e) => setNewSpell({ ...newSpell, name: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && addSpell()}
            className="flex-1 min-w-[120px] h-8 text-sm"
          />
          <Input
            type="number"
            placeholder="Lvl"
            value={newSpell.level}
            onChange={(e) => setNewSpell({ ...newSpell, level: Number.parseInt(e.target.value) || 0 })}
            className="w-12 sm:w-14 h-8 text-sm text-center"
            min={0}
            max={9}
          />
          <Button size="icon" onClick={addSpell} className="h-8 w-8 bg-fey-purple hover:bg-fey-purple/80 shrink-0">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </Card>
  )
}
