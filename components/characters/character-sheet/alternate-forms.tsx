"use client"

/**
 * Alternate Forms Tracker
 * Tracks Wildshape, Polymorph, and other transformation forms
 */

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { 
  PawPrint, 
  Heart, 
  Shield, 
  Footprints,
  Search,
  Plus,
  RotateCcw,
  Sparkles,
  Clock,
  Zap,
  Loader2,
  Check,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { open5eApi, type Open5eMonster } from "@/lib/open5e-api"
import type { AlternateFormProperty, AbilityScores } from "@/lib/character/types"
import { ABILITIES, ABILITY_ABBREVIATIONS, formatModifier, getAbilityModifier } from "@/lib/character/constants"

// ============================================
// TYPES
// ============================================

interface AlternateFormsTrackerProps {
  forms: AlternateFormProperty[]
  currentFormId: string | null
  characterLevel: number
  wildshapeUses?: { current: number; max: number }
  onTransform: (formId: string) => void
  onRevert: () => void
  onAddForm: (form: AlternateFormProperty) => void
  onRemoveForm: (formId: string) => void
  onUpdateFormHP: (formId: string, hp: number) => void
  onUseWildshape?: () => void
  onRestoreWildshape?: () => void
}

// ============================================
// MAIN COMPONENT
// ============================================

export function AlternateFormsTracker({
  forms,
  currentFormId,
  characterLevel,
  wildshapeUses,
  onTransform,
  onRevert,
  onAddForm,
  onRemoveForm,
  onUpdateFormHP,
  onUseWildshape,
  onRestoreWildshape,
}: AlternateFormsTrackerProps) {
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [monsters, setMonsters] = useState<Open5eMonster[]>([])
  const [loading, setLoading] = useState(false)
  const [crFilter, setCrFilter] = useState<string>("all")

  const currentForm = forms.find(f => f.id === currentFormId)
  const isTransformed = !!currentForm

  // Calculate max CR based on druid level (for Wildshape)
  const maxCR = useMemo(() => {
    if (characterLevel >= 8) return 1
    if (characterLevel >= 4) return 0.5
    return 0.25
  }, [characterLevel])

  // Load beasts from Open5e
  const loadMonsters = async () => {
    setLoading(true)
    try {
      const data = await open5eApi.getMonsters({ type: "beast" })
      // Filter to beasts only for wildshape
      setMonsters(data.filter(m => m.type.toLowerCase() === "beast"))
    } catch (error) {
      console.error("Failed to load monsters:", error)
    } finally {
      setLoading(false)
    }
  }

  // Filter monsters
  const filteredMonsters = useMemo(() => {
    return monsters.filter(m => {
      if (searchQuery && !m.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }
      if (crFilter !== "all") {
        const crValue = parseFloat(crFilter)
        if (m.cr !== crValue) return false
      }
      // Filter by max CR
      if (m.cr > maxCR) return false
      return true
    })
  }, [monsters, searchQuery, crFilter, maxCR])

  const handleAddFromMonster = (monster: Open5eMonster) => {
    const form: AlternateFormProperty = {
      id: crypto.randomUUID(),
      type: "alternateForm",
      name: monster.name,
      description: "",
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      formSource: "wildshape",
      creatureName: monster.name,
      creatureSlug: monster.slug,
      formHP: {
        current: monster.hit_points,
        max: monster.hit_points,
      },
      formAC: monster.armor_class,
      formSpeed: monster.speed || { walk: 30 },
      formAbilities: {
        strength: monster.strength,
        dexterity: monster.dexterity,
        constitution: monster.constitution,
        intelligence: monster.intelligence,
        wisdom: monster.wisdom,
        charisma: monster.charisma,
      },
      canSpeak: false,
      canCastSpells: characterLevel >= 18, // Beast Spells at level 18
      retainMentalStats: false,
      retainProficiencies: true,
      retainClassFeatures: false,
      crLimit: monster.cr,
    }

    onAddForm(form)
    setShowAddDialog(false)
  }

  return (
    <Card className={cn(
      "bg-card/50",
      isTransformed && "border-green-500/50 bg-green-500/5"
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <PawPrint className="h-4 w-4 text-green-400" />
            Alternate Forms
            {isTransformed && (
              <Badge variant="default" className="bg-green-500">
                Transformed
              </Badge>
            )}
          </CardTitle>
          {wildshapeUses && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Wild Shape:</span>
              <div className="flex gap-1">
                {Array.from({ length: wildshapeUses.max }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-4 h-4 rounded-full border-2",
                      i < wildshapeUses.current
                        ? "bg-green-500 border-green-500"
                        : "border-green-500/50"
                    )}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Form Display */}
        {currentForm && (
          <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-green-400" />
                {currentForm.creatureName}
              </h4>
              <Button
                variant="outline"
                size="sm"
                onClick={onRevert}
                className="border-green-500/50 text-green-400"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Revert
              </Button>
            </div>

            {/* Form Stats */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-background/50 rounded p-2">
                <Heart className="h-4 w-4 text-red-500 mx-auto mb-1" />
                <div className="text-sm font-bold">
                  {currentForm.formHP.current}/{currentForm.formHP.max}
                </div>
                <div className="text-[10px] text-muted-foreground">HP</div>
              </div>
              <div className="bg-background/50 rounded p-2">
                <Shield className="h-4 w-4 text-blue-500 mx-auto mb-1" />
                <div className="text-sm font-bold">{currentForm.formAC}</div>
                <div className="text-[10px] text-muted-foreground">AC</div>
              </div>
              <div className="bg-background/50 rounded p-2">
                <Footprints className="h-4 w-4 text-green-500 mx-auto mb-1" />
                <div className="text-sm font-bold">{currentForm.formSpeed.walk || 0}ft</div>
                <div className="text-[10px] text-muted-foreground">Speed</div>
              </div>
              <div className="bg-background/50 rounded p-2">
                <Zap className="h-4 w-4 text-yellow-500 mx-auto mb-1" />
                <div className="text-sm font-bold">CR {currentForm.crLimit}</div>
                <div className="text-[10px] text-muted-foreground">Rating</div>
              </div>
            </div>

            {/* Form Ability Scores */}
            <div className="grid grid-cols-6 gap-1">
              {ABILITIES.map(ability => (
                <div key={ability} className="text-center bg-background/30 rounded p-1">
                  <div className="text-[10px] text-muted-foreground">
                    {ABILITY_ABBREVIATIONS[ability]}
                  </div>
                  <div className="text-sm font-medium">
                    {currentForm.formAbilities[ability]}
                  </div>
                  <div className="text-[10px] text-primary">
                    {formatModifier(getAbilityModifier(currentForm.formAbilities[ability]))}
                  </div>
                </div>
              ))}
            </div>

            {/* Form HP Management */}
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="HP change"
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const input = e.target as HTMLInputElement
                    const value = parseInt(input.value)
                    if (!isNaN(value)) {
                      const newHP = Math.max(0, Math.min(
                        currentForm.formHP.max,
                        currentForm.formHP.current + value
                      ))
                      onUpdateFormHP(currentForm.id, newHP)
                      input.value = ""
                    }
                  }
                }}
              />
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  onUpdateFormHP(currentForm.id, 0)
                  onRevert()
                }}
              >
                Drop Form (0 HP)
              </Button>
            </div>
          </div>
        )}

        {/* Known Forms List */}
        {!isTransformed && forms.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm text-muted-foreground">Known Forms</h4>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {forms.map(form => (
                  <div
                    key={form.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border hover:border-green-500/50 transition-all"
                  >
                    <div>
                      <span className="font-medium">{form.creatureName}</span>
                      <div className="flex gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>HP {form.formHP.max}</span>
                        <span>•</span>
                        <span>AC {form.formAC}</span>
                        <span>•</span>
                        <span>CR {form.crLimit}</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          onUseWildshape?.()
                          onTransform(form.id)
                        }}
                        disabled={wildshapeUses && wildshapeUses.current <= 0}
                        className="text-green-400 border-green-500/50"
                      >
                        Transform
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveForm(form.id)}
                        className="text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Add Form Button */}
        {!isTransformed && (
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  if (monsters.length === 0) loadMonsters()
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Beast Form
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <PawPrint className="h-5 w-5" />
                  Add Beast Form
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Filters */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search beasts..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={crFilter} onValueChange={setCrFilter}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="CR" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All CR</SelectItem>
                      <SelectItem value="0">CR 0</SelectItem>
                      <SelectItem value="0.125">CR 1/8</SelectItem>
                      <SelectItem value="0.25">CR 1/4</SelectItem>
                      <SelectItem value="0.5">CR 1/2</SelectItem>
                      <SelectItem value="1">CR 1</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <p className="text-sm text-muted-foreground">
                  Max CR: {maxCR} (Level {characterLevel} Druid)
                </p>

                {/* Beast List */}
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {filteredMonsters.map(monster => (
                        <div
                          key={monster.slug}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border hover:border-primary/50 transition-all cursor-pointer"
                          onClick={() => handleAddFromMonster(monster)}
                        >
                          <div>
                            <span className="font-medium">{monster.name}</span>
                            <div className="flex gap-2 text-xs text-muted-foreground mt-0.5">
                              <span>{monster.size}</span>
                              <span>•</span>
                              <span>HP {monster.hit_points}</span>
                              <span>•</span>
                              <span>AC {monster.armor_class}</span>
                              <span>•</span>
                              <span>CR {monster.challenge_rating}</span>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      {filteredMonsters.length === 0 && (
                        <p className="text-center text-muted-foreground py-8">
                          No beasts found matching your criteria
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  )
}
