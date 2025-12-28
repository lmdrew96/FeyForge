"use client"

// ... existing imports ...
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import type { Character } from "@/lib/characters-store"
import { Backpack, Coins, Plus, Trash2, Weight } from "lucide-react"
import { useState } from "react"

interface InventoryPanelProps {
  character: Character
  isEditing: boolean
  onUpdate: (data: Partial<Character>) => void
}

export function InventoryPanel({ character, isEditing, onUpdate }: InventoryPanelProps) {
  const [newItem, setNewItem] = useState({ name: "", quantity: 1, weight: 0 })

  const totalWeight = character.equipment.reduce((sum, item) => sum + item.weight * item.quantity, 0)
  const carryCapacity = character.abilities.strength * 15

  const addItem = () => {
    if (newItem.name.trim()) {
      onUpdate({
        equipment: [...character.equipment, { ...newItem, name: newItem.name.trim(), equipped: false }],
      })
      setNewItem({ name: "", quantity: 1, weight: 0 })
    }
  }

  const removeItem = (index: number) => {
    onUpdate({
      equipment: character.equipment.filter((_, i) => i !== index),
    })
  }

  const toggleEquipped = (index: number) => {
    const updated = [...character.equipment]
    updated[index] = { ...updated[index], equipped: !updated[index].equipped }
    onUpdate({ equipment: updated })
  }

  const toggleAttuned = (index: number) => {
    const updated = [...character.equipment]
    updated[index] = { ...updated[index], attuned: !updated[index].attuned }
    onUpdate({ equipment: updated })
  }

  const updateCurrency = (type: keyof Character["currency"], value: number) => {
    onUpdate({
      currency: { ...character.currency, [type]: value },
    })
  }

  const currencyTypes = [
    { key: "pp", label: "PP", color: "bg-slate-300 text-slate-800" },
    { key: "gp", label: "GP", color: "bg-yellow-400 text-yellow-900" },
    { key: "ep", label: "EP", color: "bg-blue-300 text-blue-900" },
    { key: "sp", label: "SP", color: "bg-gray-300 text-gray-800" },
    { key: "cp", label: "CP", color: "bg-orange-400 text-orange-900" },
  ] as const

  const attunedCount = character.equipment.filter((e) => e.attuned).length

  return (
    <Card className="p-4 bg-card/80 backdrop-blur-sm border-fey-sage/30 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
        <h2 className="text-lg font-display font-semibold text-fey-gold flex items-center gap-2">
          <Backpack className="h-5 w-5 shrink-0" />
          Inventory
        </h2>
        <div className="flex items-center gap-2 text-sm">
          <Weight className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className={totalWeight > carryCapacity ? "text-destructive" : "text-muted-foreground"}>
            {totalWeight}/{carryCapacity} lbs
          </span>
        </div>
      </div>

      {/* Currency */}
      <div className="mb-4 p-3 rounded-lg bg-background/50 overflow-hidden">
        <div className="flex items-center gap-2 mb-2">
          <Coins className="h-4 w-4 text-fey-gold shrink-0" />
          <span className="text-sm font-medium text-foreground">Currency</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {currencyTypes.map(({ key, label, color }) => (
            <div key={key} className="flex items-center gap-1">
              <Badge className={`${color} text-xs shrink-0`}>{label}</Badge>
              {isEditing ? (
                <Input
                  type="number"
                  value={character.currency[key]}
                  onChange={(e) => updateCurrency(key, Number.parseInt(e.target.value) || 0)}
                  className="w-14 sm:w-16 h-7 text-sm text-center"
                  min={0}
                />
              ) : (
                <span className="text-sm font-medium">{character.currency[key]}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Attunement indicator */}
      <div className="mb-3 text-sm text-muted-foreground">
        Attuned: <span className={attunedCount >= 3 ? "text-fey-gold font-semibold" : ""}>{attunedCount}/3</span>
      </div>

      {/* Equipment List */}
      <div className="space-y-1">
        {character.equipment.map((item, index) => (
          <div
            key={index}
            className={`flex items-center gap-2 p-2 rounded-lg transition-colors min-w-0 ${
              item.equipped ? "bg-fey-forest/10" : "hover:bg-background/50"
            }`}
          >
            <Checkbox
              checked={item.equipped}
              onCheckedChange={() => toggleEquipped(index)}
              className="data-[state=checked]:bg-fey-forest data-[state=checked]:border-fey-forest shrink-0"
              aria-label={`${item.name} equipped`}
            />
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`text-sm truncate ${item.equipped ? "font-medium text-foreground" : "text-muted-foreground"}`}
                >
                  {item.name}
                </span>
                {item.attuned && (
                  <Badge variant="outline" className="text-xs border-fey-purple text-fey-purple shrink-0">
                    Attuned
                  </Badge>
                )}
              </div>
            </div>
            <span className="text-xs text-muted-foreground shrink-0">x{item.quantity}</span>
            <span className="text-xs text-muted-foreground shrink-0 w-10 sm:w-12 text-right hidden xs:inline">
              {item.weight} lb
            </span>
            {isEditing && (
              <>
                {item.attuned !== undefined && (
                  <Button
                    size="sm"
                    variant={item.attuned ? "default" : "outline"}
                    onClick={() => toggleAttuned(index)}
                    className="h-6 text-xs shrink-0 hidden sm:inline-flex"
                    disabled={!item.attuned && attunedCount >= 3}
                  >
                    Attune
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeItem(index)}
                  className="h-6 w-6 text-destructive hover:text-destructive shrink-0"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        ))}

        {character.equipment.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No items in inventory</p>
        )}

        {/* Add Item Form */}
        {isEditing && (
          <div className="flex flex-wrap gap-2 pt-3 mt-3 border-t border-fey-sage/20">
            <Input
              placeholder="Item name"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && addItem()}
              className="flex-1 min-w-[120px] h-8 text-sm"
            />
            <Input
              type="number"
              placeholder="Qty"
              value={newItem.quantity}
              onChange={(e) => setNewItem({ ...newItem, quantity: Number.parseInt(e.target.value) || 1 })}
              className="w-12 sm:w-14 h-8 text-sm text-center"
              min={1}
            />
            <Input
              type="number"
              placeholder="Wt"
              value={newItem.weight}
              onChange={(e) => setNewItem({ ...newItem, weight: Number.parseFloat(e.target.value) || 0 })}
              className="w-12 sm:w-16 h-8 text-sm text-center"
              min={0}
              step={0.1}
            />
            <Button size="icon" onClick={addItem} className="h-8 w-8 bg-fey-forest hover:bg-fey-forest/80 shrink-0">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
