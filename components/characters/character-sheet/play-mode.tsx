"use client"

/**
 * Play Mode Component
 * Streamlined view for active gameplay - focuses on what you need at the table
 */

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Heart, 
  Shield, 
  Zap, 
  Footprints,
  Plus,
  Minus,
  RotateCcw,
  Skull,
  CheckCircle2,
  XCircle,
  Sparkles,
  StickyNote,
  AlertTriangle,
  Swords,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Character, CalculatedStats, DeathSaves, HitPoints } from "@/lib/character/types"
import type { Condition } from "@/lib/character/constants"
import { CONDITIONS, formatModifier } from "@/lib/character/constants"
import { ResourcePanel } from "./resource-tracker"
import { QuickActions, type AttackAction, type SpellAction } from "./quick-actions"

// ============================================
// PLAY MODE VIEW
// ============================================

interface PlayModeProps {
  character: Character
  calculatedStats: CalculatedStats
  onUpdateHP: (current: number, temp?: number) => void
  onAddDeathSave: (success: boolean) => void
  onResetDeathSaves: () => void
  onUseSpellSlot?: (level: number) => void
  onRestoreSpellSlot?: (level: number) => void
  onRestoreAllSpellSlots?: () => void
  onToggleCondition?: (condition: Condition) => void
  onShortRest?: () => void
  onLongRest?: () => void
  onUpdateNotes?: (notes: string) => void
}

export function PlayMode({
  character,
  calculatedStats,
  onUpdateHP,
  onAddDeathSave,
  onResetDeathSaves,
  onUseSpellSlot,
  onRestoreSpellSlot,
  onRestoreAllSpellSlots,
  onToggleCondition,
  onShortRest,
  onLongRest,
  onUpdateNotes,
}: PlayModeProps) {
  const [sessionNotes, setSessionNotes] = useState("")
  const [activeConditions, setActiveConditions] = useState<Condition[]>([])
  const [hpInput, setHpInput] = useState("")

  const isUnconscious = character.hitPoints.current <= 0

  // Convert spell slots to the format ResourcePanel expects
  const spellSlots = useMemo(() => {
    if (!character.spellcasting?.spellSlots) return []
    
    return Object.entries(character.spellcasting.spellSlots).map(([level, data]) => ({
      level: parseInt(level),
      total: data.total,
      used: data.used,
    }))
  }, [character.spellcasting?.spellSlots])

  // Build quick actions from character properties
  const attacks = useMemo((): AttackAction[] => {
    const attackActions: AttackAction[] = []
    
    // Find weapon items that are equipped
    for (const prop of character.properties || []) {
      if (prop.type === "item" && "category" in prop && prop.category === "weapon" && prop.equipped) {
        const weapon = prop as any
        attackActions.push({
          id: prop.id,
          name: prop.name,
          type: weapon.weaponType === "ranged" ? "ranged" : "melee",
          attackBonus: calculatedStats.abilityModifiers.strength + calculatedStats.proficiencyBonus,
          damage: {
            dice: weapon.damageDice || "1d6",
            bonus: calculatedStats.abilityModifiers.strength,
            type: weapon.damageType || "slashing",
          },
          properties: weapon.properties,
        })
      }
    }

    // Add unarmed strike as fallback
    if (attackActions.length === 0) {
      attackActions.push({
        id: "unarmed",
        name: "Unarmed Strike",
        type: "melee",
        attackBonus: calculatedStats.abilityModifiers.strength + calculatedStats.proficiencyBonus,
        damage: {
          dice: "1d1",
          bonus: calculatedStats.abilityModifiers.strength,
          type: "bludgeoning",
        },
      })
    }

    return attackActions
  }, [character.properties, calculatedStats])

  const handleDamage = () => {
    const amount = parseInt(hpInput)
    if (isNaN(amount) || amount <= 0) return

    let newTemp = character.hitPoints.temp
    let damage = amount

    // Temp HP absorbs damage first
    if (newTemp > 0) {
      if (damage <= newTemp) {
        newTemp -= damage
        damage = 0
      } else {
        damage -= newTemp
        newTemp = 0
      }
    }

    const newCurrent = Math.max(0, character.hitPoints.current - damage)
    onUpdateHP(newCurrent, newTemp)
    setHpInput("")
  }

  const handleHeal = () => {
    const amount = parseInt(hpInput)
    if (isNaN(amount) || amount <= 0) return

    const newCurrent = Math.min(character.hitPoints.max, character.hitPoints.current + amount)
    onUpdateHP(newCurrent)
    setHpInput("")
  }

  const handleAddTempHP = () => {
    const amount = parseInt(hpInput)
    if (isNaN(amount) || amount <= 0) return

    // Temp HP doesn't stack, take the higher
    const newTemp = Math.max(character.hitPoints.temp, amount)
    onUpdateHP(character.hitPoints.current, newTemp)
    setHpInput("")
  }

  const handleConditionToggle = (condition: Condition) => {
    setActiveConditions(prev => 
      prev.includes(condition)
        ? prev.filter(c => c !== condition)
        : [...prev, condition]
    )
    onToggleCondition?.(condition)
  }

  return (
    <div className="space-y-4">
      {/* Top Stats Bar */}
      <div className="grid grid-cols-4 gap-2">
        <QuickStatCard
          icon={<Heart className="h-5 w-5 text-red-500" />}
          label="HP"
          value={`${character.hitPoints.current}/${character.hitPoints.max}`}
          subValue={character.hitPoints.temp > 0 ? `+${character.hitPoints.temp} temp` : undefined}
          highlight={character.hitPoints.current <= character.hitPoints.max / 4}
          highlightColor="red"
        />
        <QuickStatCard
          icon={<Shield className="h-5 w-5 text-blue-500" />}
          label="AC"
          value={calculatedStats.armorClass}
        />
        <QuickStatCard
          icon={<Zap className="h-5 w-5 text-yellow-500" />}
          label="Initiative"
          value={formatModifier(calculatedStats.initiative)}
        />
        <QuickStatCard
          icon={<Footprints className="h-5 w-5 text-green-500" />}
          label="Speed"
          value={`${calculatedStats.speed}ft`}
        />
      </div>

      {/* HP Management */}
      <Card className={cn(
        "bg-card/50",
        isUnconscious && "border-red-500/50"
      )}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Heart className="h-4 w-4" />
            Hit Points
            {isUnconscious && (
              <Badge variant="destructive" className="ml-2">
                <Skull className="h-3 w-3 mr-1" />
                Down!
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* HP Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>Current HP</span>
              <span className="font-bold">
                {character.hitPoints.current} / {character.hitPoints.max}
                {character.hitPoints.temp > 0 && (
                  <span className="text-cyan-400 ml-1">(+{character.hitPoints.temp})</span>
                )}
              </span>
            </div>
            <div className="h-4 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all",
                  character.hitPoints.current > character.hitPoints.max / 2
                    ? "bg-green-500"
                    : character.hitPoints.current > character.hitPoints.max / 4
                    ? "bg-yellow-500"
                    : "bg-red-500"
                )}
                style={{
                  width: `${Math.min(100, (character.hitPoints.current / character.hitPoints.max) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* HP Input */}
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Amount"
              value={hpInput}
              onChange={(e) => setHpInput(e.target.value)}
              className="flex-1"
              min={0}
            />
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={handleDamage}
              disabled={!hpInput}
            >
              <Minus className="h-4 w-4 mr-1" />
              Damage
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              onClick={handleHeal}
              disabled={!hpInput}
              className="bg-green-600 hover:bg-green-700"
            >
              <Plus className="h-4 w-4 mr-1" />
              Heal
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleAddTempHP}
              disabled={!hpInput}
            >
              <Shield className="h-4 w-4 mr-1" />
              Temp
            </Button>
          </div>

          {/* Death Saves (only show when at 0 HP) */}
          {isUnconscious && (
            <DeathSaveTracker
              deathSaves={character.deathSaves}
              onAddSuccess={() => onAddDeathSave(true)}
              onAddFailure={() => onAddDeathSave(false)}
              onReset={onResetDeathSaves}
            />
          )}
        </CardContent>
      </Card>

      {/* Conditions */}
      <Card className="bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Conditions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1">
            {CONDITIONS.map((condition) => (
              <Badge
                key={condition}
                variant={activeConditions.includes(condition) ? "default" : "outline"}
                className={cn(
                  "cursor-pointer transition-all",
                  activeConditions.includes(condition) && "bg-red-500/80"
                )}
                onClick={() => handleConditionToggle(condition)}
              >
                {condition}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Resources & Actions Tabs */}
      <Tabs defaultValue="actions" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="actions" className="text-xs">
            <Swords className="h-3 w-3 mr-1" />
            Actions
          </TabsTrigger>
          <TabsTrigger value="resources" className="text-xs">
            <Sparkles className="h-3 w-3 mr-1" />
            Resources
          </TabsTrigger>
          <TabsTrigger value="notes" className="text-xs">
            <StickyNote className="h-3 w-3 mr-1" />
            Notes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="actions" className="mt-4">
          <QuickActions
            attacks={attacks}
            spells={[]}
            proficiencyBonus={calculatedStats.proficiencyBonus}
          />
        </TabsContent>

        <TabsContent value="resources" className="mt-4">
          <ResourcePanel
            spellSlots={spellSlots}
            onUseSpellSlot={onUseSpellSlot}
            onRestoreSpellSlot={onRestoreSpellSlot}
            onRestoreAllSpellSlots={onRestoreAllSpellSlots}
            onShortRest={onShortRest}
            onLongRest={onLongRest}
          />
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <Card className="bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Session Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Quick notes for this session..."
                value={sessionNotes}
                onChange={(e) => {
                  setSessionNotes(e.target.value)
                  onUpdateNotes?.(e.target.value)
                }}
                className="min-h-[150px] resize-none"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Rest Buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={onShortRest}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Short Rest
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          onClick={onLongRest}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Long Rest
        </Button>
      </div>
    </div>
  )
}

// ============================================
// QUICK STAT CARD
// ============================================

interface QuickStatCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  subValue?: string
  highlight?: boolean
  highlightColor?: "red" | "yellow" | "green"
}

function QuickStatCard({ icon, label, value, subValue, highlight, highlightColor }: QuickStatCardProps) {
  return (
    <Card className={cn(
      "bg-card/50",
      highlight && highlightColor === "red" && "border-red-500/50 bg-red-500/10",
      highlight && highlightColor === "yellow" && "border-yellow-500/50 bg-yellow-500/10",
    )}>
      <CardContent className="p-3 text-center">
        <div className="flex justify-center mb-1">{icon}</div>
        <div className="text-lg font-bold">{value}</div>
        <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
        {subValue && (
          <div className="text-xs text-cyan-400">{subValue}</div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================
// DEATH SAVE TRACKER
// ============================================

interface DeathSaveTrackerProps {
  deathSaves: DeathSaves
  onAddSuccess: () => void
  onAddFailure: () => void
  onReset: () => void
}

function DeathSaveTracker({ deathSaves, onAddSuccess, onAddFailure, onReset }: DeathSaveTrackerProps) {
  const isStable = deathSaves.successes >= 3
  const isDead = deathSaves.failures >= 3

  return (
    <div className={cn(
      "border rounded-lg p-3 space-y-3",
      isDead && "border-red-500 bg-red-500/10",
      isStable && "border-green-500 bg-green-500/10"
    )}>
      <div className="flex items-center justify-between">
        <span className="font-medium flex items-center gap-2">
          <Skull className="h-4 w-4" />
          Death Saves
        </span>
        <Button variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw className="h-3 w-3" />
        </Button>
      </div>

      {isDead ? (
        <div className="text-center text-red-400 font-bold py-2">
          💀 DEAD 💀
        </div>
      ) : isStable ? (
        <div className="text-center text-green-400 font-bold py-2">
          ✨ STABLE ✨
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {/* Successes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-green-400">Successes</span>
            </div>
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center",
                    i < deathSaves.successes
                      ? "bg-green-500 border-green-500"
                      : "border-green-500/50"
                  )}
                >
                  {i < deathSaves.successes && <CheckCircle2 className="h-4 w-4 text-white" />}
                </div>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full border-green-500/50 text-green-400"
              onClick={onAddSuccess}
              disabled={deathSaves.successes >= 3}
            >
              <Plus className="h-3 w-3 mr-1" />
              Success
            </Button>
          </div>

          {/* Failures */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-red-400">Failures</span>
            </div>
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center",
                    i < deathSaves.failures
                      ? "bg-red-500 border-red-500"
                      : "border-red-500/50"
                  )}
                >
                  {i < deathSaves.failures && <XCircle className="h-4 w-4 text-white" />}
                </div>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full border-red-500/50 text-red-400"
              onClick={onAddFailure}
              disabled={deathSaves.failures >= 3}
            >
              <Plus className="h-3 w-3 mr-1" />
              Failure
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
