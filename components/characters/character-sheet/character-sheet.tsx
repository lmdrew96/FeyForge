"use client"

/**
 * Main Character Sheet Component
 * Composes all character sheet panels into a complete display
 */

import { useCharacterStore } from "@/lib/character-store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  User, 
  Sword, 
  Sparkles, 
  Scroll,
  ArrowLeft,
  Edit,
  RotateCcw,
  Bed,
} from "lucide-react"

// Import panel components
import { AbilityScoresDisplay } from "./ability-scores"
import { SkillsPanel } from "./skills-panel"
import { SavingThrowsPanel } from "./saving-throws-panel"
import { CombatStats } from "./combat-stats"
import { HitPointsPanel } from "./hit-points-panel"
import { EquipmentPanel } from "./equipment-panel"
import { FeaturesPanel } from "./features-panel"
import { SpellsPanel } from "./spells-panel"

import type { Character, SpellProperty, FeatureProperty, ItemProperty, CalculatedStats } from "@/lib/character/types"

interface CharacterSheetProps {
  character: Character
  calculatedStats?: CalculatedStats
  onBack?: () => void
  onEdit?: () => void
}

export function CharacterSheet({ character, calculatedStats, onBack, onEdit }: CharacterSheetProps) {
  const { 
    updateCharacter,
    healCharacter,
    damageCharacter,
    addDeathSave,
    resetDeathSaves,
    updateCurrency,
    getCalculatedStats,
  } = useCharacterStore()

  // Get stats from props or fetch from store
  const stats = calculatedStats || getCalculatedStats(character.id)

  // Extract properties by type
  const spells = (character.properties?.filter(p => p.type === "spell") || []) as SpellProperty[]
  const features = (character.properties?.filter(p => p.type === "feature") || []) as FeatureProperty[]
  const equipment = (character.properties?.filter(p => p.type === "item") || []) as ItemProperty[]

  // Calculate encumbrance
  const totalWeight = equipment.reduce((sum, item) => sum + (item.weight * item.quantity), 0)
  const carryCapacity = stats ? stats.carryingCapacity : (character.baseAbilities.strength * 15)

  // Event handlers
  const handleHeal = (amount: number) => {
    healCharacter(character.id, amount)
  }

  const handleDamage = (amount: number) => {
    damageCharacter(character.id, amount)
  }

  const handleDeathSaveSuccess = () => {
    addDeathSave(character.id, true)
  }

  const handleDeathSaveFailure = () => {
    addDeathSave(character.id, false)
  }

  const handleResetDeathSaves = () => {
    resetDeathSaves(character.id)
  }

  const handleShortRest = () => {
    // Restore some resources on short rest
    // For now just reset some features
    const updatedProperties = character.properties?.map(p => {
      if (p.type === "feature" && p.uses && p.uses.rechargeOn === "shortRest") {
        return { ...p, uses: { ...p.uses, current: p.uses.max } }
      }
      return p
    })
    updateCharacter(character.id, { properties: updatedProperties })
  }

  const handleLongRest = () => {
    // Restore HP and features on long rest
    const updatedProperties = character.properties?.map(p => {
      if (p.type === "feature" && p.uses) {
        return { ...p, uses: { ...p.uses, current: p.uses.max } }
      }
      return p
    })
    
    // Restore spell slots
    let updatedSpellcasting = character.spellcasting
    if (updatedSpellcasting) {
      const restoredSlots = Object.fromEntries(
        Object.entries(updatedSpellcasting.spellSlots).map(([level, slots]) => [
          level,
          { ...slots, used: 0 }
        ])
      )
      updatedSpellcasting = { ...updatedSpellcasting, spellSlots: restoredSlots }
    }
    
    updateCharacter(character.id, { 
      properties: updatedProperties,
      hitPoints: { ...character.hitPoints, current: character.hitPoints.max },
      spellcasting: updatedSpellcasting,
    })
  }

  const handleUseFeature = (featureId: string) => {
    const feature = features.find(f => f.id === featureId)
    if (feature?.uses && feature.uses.current > 0) {
      const updatedProperties = character.properties?.map(p => 
        p.id === featureId && p.type === "feature" && p.uses
          ? { ...p, uses: { ...p.uses, current: p.uses.current - 1 } }
          : p
      )
      updateCharacter(character.id, { properties: updatedProperties })
    }
  }

  const handleTogglePreparedSpell = (spellId: string) => {
    const updatedProperties = character.properties?.map(p => 
      p.id === spellId && p.type === "spell"
        ? { ...p, prepared: !p.prepared }
        : p
    )
    updateCharacter(character.id, { properties: updatedProperties })
  }

  const handleUseSpellSlot = (level: number) => {
    if (!character.spellcasting) return
    const currentSlots = character.spellcasting.spellSlots[level]
    if (currentSlots && currentSlots.used < currentSlots.total) {
      updateCharacter(character.id, {
        spellcasting: {
          ...character.spellcasting,
          spellSlots: {
            ...character.spellcasting.spellSlots,
            [level]: { ...currentSlots, used: currentSlots.used + 1 }
          }
        }
      })
    }
  }

  const handleRestoreSpellSlots = () => {
    if (!character.spellcasting) return
    const restoredSlots = Object.fromEntries(
      Object.entries(character.spellcasting.spellSlots).map(([level, slots]) => [
        level,
        { ...slots, used: 0 }
      ])
    )
    updateCharacter(character.id, {
      spellcasting: {
        ...character.spellcasting,
        spellSlots: restoredSlots
      }
    })
  }

  const handleCurrencyChange = (type: "pp" | "gp" | "ep" | "sp" | "cp", delta: number) => {
    const currentAmount = character.currency[type]
    const newAmount = Math.max(0, currentAmount + delta)
    updateCurrency(character.id, { [type]: newAmount })
  }

  // Calculated stats shortcuts - get from store or props
  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Error loading character stats</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center gap-4">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
          <div>
            <h1 className="text-xl font-bold text-foreground">{character.name}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{character.race}</span>
              <span>•</span>
              <span>{character.class}</span>
              {character.subclass && (
                <>
                  <span>-</span>
                  <span>{character.subclass}</span>
                </>
              )}
              <span>•</span>
              <Badge variant="secondary">Level {character.level}</Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleShortRest}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Short Rest
          </Button>
          <Button variant="outline" size="sm" onClick={handleLongRest}>
            <Bed className="h-4 w-4 mr-1" />
            Long Rest
          </Button>
          {onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="overview" className="h-full flex flex-col">
          <div className="px-4 pt-4 bg-background">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="overview" className="gap-1">
                <User className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="combat" className="gap-1">
                <Sword className="h-4 w-4" />
                Combat
              </TabsTrigger>
              <TabsTrigger value="spells" className="gap-1">
                <Sparkles className="h-4 w-4" />
                Spells
              </TabsTrigger>
              <TabsTrigger value="features" className="gap-1">
                <Scroll className="h-4 w-4" />
                Features
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1 p-4">
            {/* Overview Tab */}
            <TabsContent value="overview" className="mt-0">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Left Column - Stats */}
                <div className="space-y-4">
                  <AbilityScoresDisplay 
                    abilities={stats.abilities}
                    modifiers={stats.abilityModifiers}
                  />
                  <SavingThrowsPanel 
                    savingThrows={stats.savingThrows}
                    proficiencies={character.savingThrowProficiencies}
                  />
                </div>

                {/* Middle Column - Skills */}
                <div className="space-y-4">
                  <SkillsPanel 
                    skillModifiers={stats.skillModifiers}
                    proficiencies={character.skillProficiencies}
                    expertise={character.skillExpertise}
                  />
                </div>

                {/* Right Column - Character Info */}
                <div className="space-y-4">
                  <HitPointsPanel
                    hitPoints={character.hitPoints}
                    onHeal={handleHeal}
                    onDamage={handleDamage}
                  />
                  <CombatStats
                    armorClass={stats.armorClass}
                    initiative={stats.initiative}
                    speed={stats.speed}
                    proficiencyBonus={stats.proficiencyBonus}
                    passivePerception={stats.passivePerception}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Combat Tab */}
            <TabsContent value="combat" className="mt-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <CombatStats
                    armorClass={stats.armorClass}
                    initiative={stats.initiative}
                    speed={stats.speed}
                    proficiencyBonus={stats.proficiencyBonus}
                    passivePerception={stats.passivePerception}
                  />
                  <HitPointsPanel
                    hitPoints={character.hitPoints}
                    onHeal={handleHeal}
                    onDamage={handleDamage}
                  />
                </div>
                <div className="space-y-4">
                  <EquipmentPanel
                    items={equipment}
                    currency={character.currency}
                    carryingCapacity={carryCapacity}
                    currentLoad={totalWeight}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Spells Tab */}
            <TabsContent value="spells" className="mt-0">
              <SpellsPanel
                spells={spells}
                spellcasting={character.spellcasting || null}
                onTogglePrepared={handleTogglePreparedSpell}
                onUseSpellSlot={handleUseSpellSlot}
                onRestoreSpellSlots={handleRestoreSpellSlots}
              />
            </TabsContent>

            {/* Features Tab */}
            <TabsContent value="features" className="mt-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <FeaturesPanel
                  features={features}
                  onUseFeature={handleUseFeature}
                />
                <EquipmentPanel
                  items={equipment}
                  currency={character.currency}
                  carryingCapacity={carryCapacity}
                  currentLoad={totalWeight}
                />
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </div>
    </div>
  )
}
