"use client"

/**
 * Main Character Sheet Component
 * Composes all character sheet panels into a complete display
 */

import { useState } from "react"
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
  Play,
  PawPrint,
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
import { PlayMode } from "./play-mode"
import { ResourcePanel } from "./resource-tracker"
import { QuickActions } from "./quick-actions"
import { AlternateFormsTracker } from "./alternate-forms"

import type { Character, SpellProperty, FeatureProperty, ItemProperty, CalculatedStats, ClassResourceProperty, AlternateFormProperty, WeaponProperty } from "@/lib/character/types"

// Helper types and functions for component props conversion
type SpellSlotLevel = { level: number; total: number; used: number }
type ClassResource = { id: string; name: string; current: number; max: number; rechargeOn: "shortRest" | "longRest" | "dawn" | "turn" }
type AttackAction = {
  id: string
  name: string
  type: "melee" | "ranged" | "spell"
  attackBonus: number
  damage: { dice: string; bonus: number; type: string }
  properties?: string[]
  range?: { normal: number; long?: number }
  reach?: number
}
type SpellAction = {
  id: string
  name: string
  level: number
  school: string
  castingTime: string
  saveDC?: number
  spellAttackBonus?: number
  damage?: { dice: string; type: string }
}

function convertSpellSlots(slots?: Record<number, { total: number; used: number }>): SpellSlotLevel[] {
  if (!slots) return []
  return Object.entries(slots).map(([level, data]) => ({
    level: parseInt(level),
    total: data.total,
    used: data.used,
  }))
}

function convertClassResources(resources: ClassResourceProperty[]): ClassResource[] {
  return resources
    .filter(r => r.rechargeOn !== "never")
    .map(r => ({
      id: r.id,
      name: r.name,
      current: r.current,
      max: r.max,
      rechargeOn: r.rechargeOn as "shortRest" | "longRest" | "dawn" | "turn",
    }))
}

function buildAttackActions(equipment: ItemProperty[], stats: CalculatedStats): AttackAction[] {
  const attacks: AttackAction[] = []
  
  for (const item of equipment) {
    if (item.category === "weapon" && item.equipped) {
      const weapon = item as unknown as WeaponProperty
      const isFinesse = weapon.properties?.includes("finesse")
      const isMelee = !weapon.properties?.includes("ranged")
      const isRanged = weapon.properties?.includes("ranged") || weapon.properties?.includes("thrown")
      
      const strMod = stats.abilityModifiers.strength
      const dexMod = stats.abilityModifiers.dexterity
      const abilityMod = isFinesse ? Math.max(strMod, dexMod) : (isRanged ? dexMod : strMod)
      
      attacks.push({
        id: weapon.id,
        name: weapon.name,
        type: isRanged ? "ranged" : "melee",
        attackBonus: abilityMod + stats.proficiencyBonus,
        damage: {
          dice: weapon.damageDice || "1d6",
          bonus: abilityMod,
          type: weapon.damageType || "bludgeoning",
        },
        properties: weapon.properties,
        reach: isMelee ? 5 : undefined,
        range: weapon.range || (isRanged ? { normal: 30, long: 120 } : undefined),
      })
    }
  }
  
  return attacks
}

function buildSpellActions(spells: SpellProperty[], stats: CalculatedStats): SpellAction[] {
  return spells
    .filter(s => s.prepared || s.spellLevel === 0)
    .map(s => ({
      id: s.id,
      name: s.name,
      level: s.spellLevel,
      school: s.school,
      castingTime: s.castingTime || "1 action",
      spellAttackBonus: stats.proficiencyBonus + (stats.abilityModifiers.intelligence || 0),
      saveDC: 8 + stats.proficiencyBonus + (stats.abilityModifiers.intelligence || 0),
      damage: s.damage ? { 
        dice: `${s.damage.diceCount}d${s.damage.diceSize}`, 
        type: s.damage.damageType 
      } : undefined,
    }))
}

interface CharacterSheetProps {
  character: Character
  calculatedStats?: CalculatedStats
  onBack?: () => void
  onEdit?: () => void
}

export function CharacterSheet({ character, calculatedStats, onBack, onEdit }: CharacterSheetProps) {
  const [activeTab, setActiveTab] = useState("overview")
  const { 
    updateCharacter,
    healCharacter,
    damageCharacter,
    addDeathSave,
    resetDeathSaves,
    updateCurrency,
    getCalculatedStats,
    shortRest,
    longRest,
    useSpellSlot,
    restoreSpellSlot,
    restoreAllSpellSlots,
    useClassResource,
    restoreClassResource,
    getClassResources,
    transformIntoForm,
    revertFromForm,
    getActiveForm,
    updateFormHP,
    addAlternateForm,
    removeAlternateForm,
  } = useCharacterStore()

  // Get stats from props or fetch from store
  const stats = calculatedStats || getCalculatedStats(character.id)

  // Extract properties by type
  const spells = (character.properties?.filter(p => p.type === "spell") || []) as SpellProperty[]
  const features = (character.properties?.filter(p => p.type === "feature") || []) as FeatureProperty[]
  const equipment = (character.properties?.filter(p => p.type === "item") || []) as ItemProperty[]
  const classResources = (character.properties?.filter(p => p.type === "classResource") || []) as ClassResourceProperty[]
  const alternateForms = (character.properties?.filter(p => p.type === "alternateForm") || []) as AlternateFormProperty[]

  // Check for wildshape/polymorph capable classes
  const hasAlternateForms = character.class?.toLowerCase() === "druid" || alternateForms.length > 0
  
  // Get active form if any
  const activeForm = getActiveForm(character.id)

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
    shortRest(character.id)
  }

  const handleLongRest = () => {
    longRest(character.id)
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
    useSpellSlot(character.id, level)
  }

  const handleRestoreSpellSlots = () => {
    restoreAllSpellSlots(character.id)
  }

  // Class resource handlers
  const handleUseClassResource = (resourceId: string, amount?: number) => {
    useClassResource(character.id, resourceId, amount)
  }

  const handleRestoreClassResource = (resourceId: string, amount?: number) => {
    restoreClassResource(character.id, resourceId, amount)
  }

  // Alternate form handlers
  const handleTransform = (formId: string) => {
    transformIntoForm(character.id, formId)
  }

  const handleRevertForm = () => {
    revertFromForm(character.id)
  }

  const handleAddForm = (form: AlternateFormProperty) => {
    addAlternateForm(character.id, form)
  }

  const handleRemoveForm = (formId: string) => {
    removeAlternateForm(character.id, formId)
  }

  const handleFormHPChange = (formId: string, hp: number) => {
    updateFormHP(character.id, formId, hp)
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="px-4 pt-4 bg-background">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="overview" className="gap-1">
                <User className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="play" className="gap-1">
                <Play className="h-4 w-4" />
                Play
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
              {hasAlternateForms && (
                <TabsTrigger value="forms" className="gap-1">
                  <PawPrint className="h-4 w-4" />
                  Forms
                </TabsTrigger>
              )}
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

            {/* Play Mode Tab - Streamlined for table use */}
            <TabsContent value="play" className="mt-0">
              <PlayMode
                character={character}
                calculatedStats={stats}
                onUpdateHP={(current, temp) => updateCharacter(character.id, { hitPoints: { ...character.hitPoints, current, temp: temp ?? character.hitPoints.temp } })}
                onAddDeathSave={(success) => addDeathSave(character.id, success)}
                onResetDeathSaves={() => resetDeathSaves(character.id)}
                onShortRest={handleShortRest}
                onLongRest={handleLongRest}
                onUseSpellSlot={handleUseSpellSlot}
                onRestoreSpellSlot={(level) => restoreSpellSlot(character.id, level)}
                onRestoreAllSpellSlots={() => restoreAllSpellSlots(character.id)}
              />
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
                  {/* Quick Actions for attacks */}
                  <QuickActions
                    attacks={buildAttackActions(equipment, stats)}
                    spells={buildSpellActions(spells, stats)}
                    proficiencyBonus={stats.proficiencyBonus}
                  />
                </div>
                <div className="space-y-4">
                  {/* Resource Panel for spell slots and class features */}
                  <ResourcePanel
                    spellSlots={convertSpellSlots(character.spellcasting?.spellSlots)}
                    classResources={convertClassResources(classResources)}
                    onUseSpellSlot={handleUseSpellSlot}
                    onRestoreSpellSlot={(level) => restoreSpellSlot(character.id, level)}
                    onRestoreAllSpellSlots={() => restoreAllSpellSlots(character.id)}
                    onUseClassResource={(id) => handleUseClassResource(id)}
                    onRestoreClassResource={(id, amount) => handleRestoreClassResource(id, amount)}
                    onShortRest={handleShortRest}
                    onLongRest={handleLongRest}
                  />
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

            {/* Forms Tab - Wildshape/Polymorph */}
            {hasAlternateForms && (
              <TabsContent value="forms" className="mt-0">
                <AlternateFormsTracker
                  forms={alternateForms}
                  currentFormId={activeForm?.id || null}
                  characterLevel={character.level}
                  onTransform={handleTransform}
                  onRevert={handleRevertForm}
                  onAddForm={handleAddForm}
                  onRemoveForm={handleRemoveForm}
                  onUpdateFormHP={handleFormHPChange}
                />
              </TabsContent>
            )}
          </ScrollArea>
        </Tabs>
      </div>
    </div>
  )
}
