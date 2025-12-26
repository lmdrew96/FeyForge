"use client"

/**
 * Step 4: Equipment
 * Starting equipment selection or gold
 */

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Coins, Package, Plus, X } from "lucide-react"
import type { CharacterCreationData, ItemProperty } from "@/lib/character/types"

interface Step4EquipmentProps {
  data: CharacterCreationData
  onUpdate: (updates: Partial<CharacterCreationData>) => void
  classEquipment?: string
  backgroundEquipment?: string
}

// Common starting equipment items for selection
const COMMON_EQUIPMENT: { name: string; category: ItemProperty["category"]; weight: number }[] = [
  // Weapons
  { name: "Longsword", category: "weapon", weight: 3 },
  { name: "Shortsword", category: "weapon", weight: 2 },
  { name: "Dagger", category: "weapon", weight: 1 },
  { name: "Handaxe", category: "weapon", weight: 2 },
  { name: "Longbow", category: "weapon", weight: 2 },
  { name: "Shortbow", category: "weapon", weight: 2 },
  { name: "Crossbow, light", category: "weapon", weight: 5 },
  { name: "Quarterstaff", category: "weapon", weight: 4 },
  { name: "Mace", category: "weapon", weight: 4 },
  // Armor
  { name: "Leather Armor", category: "armor", weight: 10 },
  { name: "Chain Mail", category: "armor", weight: 55 },
  { name: "Scale Mail", category: "armor", weight: 45 },
  { name: "Shield", category: "armor", weight: 6 },
  // Gear
  { name: "Backpack", category: "gear", weight: 5 },
  { name: "Bedroll", category: "gear", weight: 7 },
  { name: "Rope (50 feet)", category: "gear", weight: 10 },
  { name: "Torch (10)", category: "gear", weight: 10 },
  { name: "Rations (5 days)", category: "gear", weight: 10 },
  { name: "Waterskin", category: "gear", weight: 5 },
  { name: "Tinderbox", category: "gear", weight: 1 },
  // Packs
  { name: "Explorer's Pack", category: "gear", weight: 59 },
  { name: "Dungeoneer's Pack", category: "gear", weight: 61 },
  { name: "Priest's Pack", category: "gear", weight: 24 },
  { name: "Scholar's Pack", category: "gear", weight: 10 },
]

export function Step4Equipment({ data, onUpdate, classEquipment, backgroundEquipment }: Step4EquipmentProps) {
  const [useGold, setUseGold] = useState(!data.useStartingEquipment)
  const [goldAmount, setGoldAmount] = useState(data.startingGold || 100)
  const [customItemName, setCustomItemName] = useState("")

  const equipment = data.startingEquipment || []

  const addItem = (item: (typeof COMMON_EQUIPMENT)[0]) => {
    const newItem: ItemProperty = {
      id: crypto.randomUUID(),
      type: "item",
      name: item.name,
      category: item.category,
      equipped: false,
      quantity: 1,
      weight: item.weight,
      active: true,
      modifiers: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    onUpdate({
      startingEquipment: [...equipment, newItem],
      useStartingEquipment: true,
    })
  }

  const addCustomItem = () => {
    if (!customItemName.trim()) return

    const newItem: ItemProperty = {
      id: crypto.randomUUID(),
      type: "item",
      name: customItemName.trim(),
      category: "gear",
      equipped: false,
      quantity: 1,
      weight: 0,
      active: true,
      modifiers: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    onUpdate({
      startingEquipment: [...equipment, newItem],
      useStartingEquipment: true,
    })
    setCustomItemName("")
  }

  const removeItem = (id: string) => {
    onUpdate({
      startingEquipment: equipment.filter((e) => e.id !== id),
    })
  }

  const updateItemQuantity = (id: string, quantity: number) => {
    onUpdate({
      startingEquipment: equipment.map((e) => (e.id === id ? { ...e, quantity: Math.max(1, quantity) } : e)),
    })
  }

  const handleGoldChange = (amount: number) => {
    setGoldAmount(amount)
    onUpdate({
      startingGold: amount,
      useStartingEquipment: false,
    })
  }

  const totalWeight = equipment.reduce((sum, item) => sum + item.weight * item.quantity, 0)

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="font-serif text-2xl font-bold text-gold-gradient">Equipment</h2>
        <p className="text-muted-foreground mt-2">Choose your starting gear</p>
      </div>

      {/* Method Toggle */}
      <div className="flex justify-center gap-4 mb-6">
        <Button
          type="button"
          variant={!useGold ? "default" : "outline"}
          onClick={() => {
            setUseGold(false)
            onUpdate({ useStartingEquipment: true })
          }}
          className="gap-2"
        >
          <Package className="h-4 w-4" />
          Starting Equipment
        </Button>
        <Button
          type="button"
          variant={useGold ? "default" : "outline"}
          onClick={() => {
            setUseGold(true)
            onUpdate({ useStartingEquipment: false })
          }}
          className="gap-2"
        >
          <Coins className="h-4 w-4" />
          Starting Gold
        </Button>
      </div>

      {/* Class Equipment Info */}
      {classEquipment && (
        <div className="p-4 rounded-lg bg-accent/30 border border-border mb-6">
          <h3 className="font-medium text-foreground mb-2">Class Starting Equipment</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{classEquipment}</p>
        </div>
      )}

      {/* Background Equipment Info */}
      {backgroundEquipment && (
        <div className="p-4 rounded-lg bg-accent/30 border border-border mb-6">
          <h3 className="font-medium text-foreground mb-2">Background Equipment</h3>
          <p className="text-sm text-muted-foreground">{backgroundEquipment}</p>
        </div>
      )}

      {useGold ? (
        /* Gold Mode */
        <div className="max-w-md mx-auto space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gold" className="text-foreground font-medium">
              Starting Gold (GP)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="gold"
                type="number"
                min={0}
                value={goldAmount}
                onChange={(e) => handleGoldChange(Number.parseInt(e.target.value) || 0)}
                className="bg-input border-border"
              />
              <Badge variant="outline" className="whitespace-nowrap">
                <Coins className="h-3 w-3 mr-1" />
                {goldAmount} GP
              </Badge>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-sm text-muted-foreground">Typical starting gold by class:</p>
            <ul className="text-xs text-muted-foreground mt-2 grid grid-cols-2 gap-1">
              <li>• Barbarian: 2d4 × 10 (50 avg)</li>
              <li>• Bard: 5d4 × 10 (125 avg)</li>
              <li>• Cleric: 5d4 × 10 (125 avg)</li>
              <li>• Druid: 2d4 × 10 (50 avg)</li>
              <li>• Fighter: 5d4 × 10 (125 avg)</li>
              <li>• Monk: 5d4 (12 avg)</li>
              <li>• Paladin: 5d4 × 10 (125 avg)</li>
              <li>• Ranger: 5d4 × 10 (125 avg)</li>
              <li>• Rogue: 4d4 × 10 (100 avg)</li>
              <li>• Sorcerer: 3d4 × 10 (75 avg)</li>
              <li>• Warlock: 4d4 × 10 (100 avg)</li>
              <li>• Wizard: 4d4 × 10 (100 avg)</li>
            </ul>
          </div>
        </div>
      ) : (
        /* Equipment Selection Mode */
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Available Equipment */}
          <div className="space-y-4">
            <h3 className="font-medium text-foreground">Add Equipment</h3>

            {/* Custom Item */}
            <div className="flex gap-2">
              <Input
                placeholder="Add custom item..."
                value={customItemName}
                onChange={(e) => setCustomItemName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomItem()}
                className="bg-input border-border"
              />
              <Button type="button" size="icon" onClick={addCustomItem} disabled={!customItemName.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <ScrollArea className="h-[300px] rounded-lg border border-border p-3">
              <div className="space-y-1">
                {COMMON_EQUIPMENT.map((item) => {
                  const alreadyAdded = equipment.some((e) => e.name === item.name)
                  return (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => addItem(item)}
                      disabled={alreadyAdded}
                      className={`w-full flex items-center justify-between p-2 rounded-lg border transition-all ${
                        alreadyAdded
                          ? "border-border bg-muted/30 opacity-50"
                          : "border-border bg-card hover:border-primary/50"
                      }`}
                    >
                      <span className="text-sm text-foreground">{item.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs capitalize">
                          {item.category}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{item.weight} lb</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Selected Equipment */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-foreground">Your Equipment</h3>
              <Badge variant="secondary">{totalWeight} lb total</Badge>
            </div>

            {equipment.length === 0 ? (
              <div className="p-8 rounded-lg border border-dashed border-border text-center">
                <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No equipment selected yet</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px] rounded-lg border border-border p-3">
                <div className="space-y-2">
                  {equipment.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card min-w-0">
                      <span className="flex-1 text-sm text-foreground min-w-0 truncate">{item.name}</span>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateItemQuantity(item.id, Number.parseInt(e.target.value) || 1)}
                        className="w-16 h-8 text-center bg-input border-border shrink-0"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(item.id)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
