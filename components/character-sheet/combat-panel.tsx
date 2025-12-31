"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { Character, CharacterUpdateInput, ActionProperty } from "@/lib/character/types"
import { Plus, Swords, Trash2 } from "lucide-react"
import { useState } from "react"

// Simple attack structure for UI compatibility
// TODO: Migrate to use ActionProperty from character.properties
interface SimpleAttack {
  name: string
  attackBonus: number
  damage: string
  damageType: string
}

interface CombatPanelProps {
  character: Character
  isEditing: boolean
  onUpdate: (data: CharacterUpdateInput) => void
}

// Helper to extract attacks from properties or use fallback
function getAttacks(character: Character): SimpleAttack[] {
  const actionProperties = character.properties?.filter(
    (p): p is ActionProperty => p.type === 'action' && p.attack !== undefined
  ) ?? []
  
  if (actionProperties.length > 0) {
    return actionProperties.map(action => ({
      name: action.name,
      attackBonus: action.attack?.bonus ?? 0,
      damage: action.damage?.map(d => `${d.diceCount}d${d.diceSize}${d.bonus ? `+${d.bonus}` : ''}`).join(' + ') ?? '',
      damageType: action.damage?.[0]?.damageType ?? 'slashing'
    }))
  }
  
  // Fallback to legacy attacks array if it exists on character
  return (character as any).attacks ?? []
}

export function CombatPanel({ character, isEditing, onUpdate }: CombatPanelProps) {
  const attacks = getAttacks(character)
  const [newAttack, setNewAttack] = useState<SimpleAttack>({
    name: "",
    attackBonus: 0,
    damage: "",
    damageType: "",
  })

  // TODO: When adding attacks, should create ActionProperty in properties array
  const addAttack = () => {
    if (newAttack.name && newAttack.damage) {
      onUpdate({
        attacks: [...attacks, newAttack],
      } as CharacterUpdateInput)
      setNewAttack({ name: "", attackBonus: 0, damage: "", damageType: "" })
    }
  }

  const removeAttack = (index: number) => {
    onUpdate({
      attacks: attacks.filter((_, i) => i !== index),
    } as CharacterUpdateInput)
  }

  const updateAttack = (index: number, field: keyof SimpleAttack, value: string | number) => {
    const currentAttacks = [...attacks]
    currentAttacks[index] = { ...currentAttacks[index], [field]: value }
    onUpdate({ attacks: currentAttacks } as CharacterUpdateInput)
  }

  return (
    <Card className="p-4 bg-card/80 backdrop-blur-sm border-fey-sage/30 overflow-hidden">
      <h2 className="text-lg font-display font-semibold mb-4 text-fey-gold flex items-center gap-2">
        <Swords className="h-5 w-5 shrink-0" />
        <span className="truncate">Attacks & Actions</span>
      </h2>

      <div className="space-y-2">
        {/* Header - hidden on mobile */}
        <div className="hidden sm:grid sm:grid-cols-12 gap-2 text-xs text-muted-foreground px-2">
          <span className="col-span-4">Name</span>
          <span className="col-span-2 text-center">ATK</span>
          <span className="col-span-3">Damage</span>
          <span className="col-span-2">Type</span>
          {isEditing && <span className="col-span-1"></span>}
        </div>

        {/* Attacks List */}
        {attacks.map((attack, index) => (
          <div
            key={index}
            className="flex flex-col sm:grid sm:grid-cols-12 gap-2 items-start sm:items-center p-3 sm:p-2 rounded-lg bg-background/50 hover:bg-fey-forest/10 transition-colors"
          >
            {isEditing ? (
              <>
                <div className="w-full sm:col-span-4">
                  <span className="text-xs text-muted-foreground sm:hidden mb-1 block">Name</span>
                  <Input
                    value={attack.name}
                    onChange={(e) => updateAttack(index, "name", e.target.value)}
                    className="h-8 text-sm w-full"
                  />
                </div>
                <div className="w-full sm:w-auto sm:col-span-2">
                  <span className="text-xs text-muted-foreground sm:hidden mb-1 block">Attack Bonus</span>
                  <Input
                    type="number"
                    value={attack.attackBonus}
                    onChange={(e) => updateAttack(index, "attackBonus", Number.parseInt(e.target.value) || 0)}
                    className="h-8 text-sm text-center w-full sm:w-auto"
                  />
                </div>
                <div className="w-full sm:col-span-3">
                  <span className="text-xs text-muted-foreground sm:hidden mb-1 block">Damage</span>
                  <Input
                    value={attack.damage}
                    onChange={(e) => updateAttack(index, "damage", e.target.value)}
                    className="h-8 text-sm w-full"
                  />
                </div>
                <div className="w-full sm:col-span-2">
                  <span className="text-xs text-muted-foreground sm:hidden mb-1 block">Type</span>
                  <Input
                    value={attack.damageType}
                    onChange={(e) => updateAttack(index, "damageType", e.target.value)}
                    className="h-8 text-sm w-full"
                  />
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeAttack(index)}
                  className="sm:col-span-1 h-8 w-8 text-destructive hover:text-destructive self-end sm:self-auto"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <div className="w-full sm:w-auto sm:col-span-4 flex items-center justify-between sm:block">
                  <span className="font-medium text-foreground truncate">{attack.name}</span>
                  {/* Show ATK on mobile next to name */}
                  <span className="sm:hidden text-fey-cyan font-semibold">
                    {attack.attackBonus >= 0 ? "+" : ""}
                    {attack.attackBonus}
                  </span>
                </div>
                <span className="hidden sm:block sm:col-span-2 text-center text-fey-cyan font-semibold">
                  {attack.attackBonus >= 0 ? "+" : ""}
                  {attack.attackBonus}
                </span>
                <div className="w-full sm:w-auto sm:col-span-3 flex gap-2 sm:block">
                  <span className="text-foreground">{attack.damage}</span>
                  <span className="text-muted-foreground sm:hidden">({attack.damageType})</span>
                </div>
                <span className="hidden sm:block sm:col-span-3 text-sm text-muted-foreground truncate">
                  {attack.damageType}
                </span>
              </>
            )}
          </div>
        ))}

        {/* Add Attack Form */}
        {isEditing && (
          <div className="flex flex-col sm:grid sm:grid-cols-12 gap-2 items-start sm:items-center p-3 sm:p-2 mt-2 border-t border-fey-sage/20 pt-4">
            <div className="w-full sm:col-span-4">
              <span className="text-xs text-muted-foreground sm:hidden mb-1 block">Weapon Name</span>
              <Input
                placeholder="Weapon"
                value={newAttack.name}
                onChange={(e) => setNewAttack({ ...newAttack, name: e.target.value })}
                className="h-8 text-sm w-full"
              />
            </div>
            <div className="w-full sm:w-auto sm:col-span-2">
              <span className="text-xs text-muted-foreground sm:hidden mb-1 block">Attack Bonus</span>
              <Input
                type="number"
                placeholder="+0"
                value={newAttack.attackBonus || ""}
                onChange={(e) => setNewAttack({ ...newAttack, attackBonus: Number.parseInt(e.target.value) || 0 })}
                className="h-8 text-sm text-center w-full sm:w-auto"
              />
            </div>
            <div className="w-full sm:col-span-3">
              <span className="text-xs text-muted-foreground sm:hidden mb-1 block">Damage</span>
              <Input
                placeholder="1d8+4"
                value={newAttack.damage}
                onChange={(e) => setNewAttack({ ...newAttack, damage: e.target.value })}
                className="h-8 text-sm w-full"
              />
            </div>
            <div className="w-full sm:col-span-2">
              <span className="text-xs text-muted-foreground sm:hidden mb-1 block">Damage Type</span>
              <Input
                placeholder="Piercing"
                value={newAttack.damageType}
                onChange={(e) => setNewAttack({ ...newAttack, damageType: e.target.value })}
                className="h-8 text-sm w-full"
              />
            </div>
            <Button
              size="icon"
              onClick={addAttack}
              className="sm:col-span-1 h-8 w-8 bg-fey-forest hover:bg-fey-forest/80 self-end sm:self-auto shrink-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}

        {attacks.length === 0 && !isEditing && (
          <p className="text-sm text-muted-foreground text-center py-4">No attacks configured</p>
        )}
      </div>
    </Card>
  )
}
