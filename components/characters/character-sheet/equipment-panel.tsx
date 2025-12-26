"use client"

/**
 * Equipment Panel Component
 * Displays and manages character inventory
 */

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  Package, 
  Sword, 
  Shield, 
  Wand2, 
  Coins, 
  Weight,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import type { ItemProperty, WeaponProperty, ArmorProperty, Currency } from "@/lib/character/types"
import { CURRENCY } from "@/lib/character/constants"

interface EquipmentPanelProps {
  items: ItemProperty[]
  currency: Currency
  carryingCapacity: number
  currentLoad: number
  onToggleEquip?: (itemId: string) => void
  onUpdateCurrency?: (currency: Partial<Currency>) => void
}

const CATEGORY_ICONS: Record<ItemProperty["category"], typeof Package> = {
  weapon: Sword,
  armor: Shield,
  magic: Wand2,
  gear: Package,
  consumable: Package,
  treasure: Coins,
  tool: Package,
}

export function EquipmentPanel({ 
  items, 
  currency,
  carryingCapacity,
  currentLoad,
  onToggleEquip,
  onUpdateCurrency,
}: EquipmentPanelProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["weapon", "armor"])
  )

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedCategories(newExpanded)
  }

  // Group items by category
  const groupedItems = items.reduce((acc, item) => {
    const category = item.category
    if (!acc[category]) acc[category] = []
    acc[category].push(item)
    return acc
  }, {} as Record<string, ItemProperty[]>)

  const encumbrancePercentage = (currentLoad / carryingCapacity) * 100
  const isEncumbered = currentLoad > carryingCapacity

  // Calculate total gold value
  const totalGoldValue = 
    (currency.pp * 10) + 
    currency.gp + 
    (currency.ep * 0.5) + 
    (currency.sp * 0.1) + 
    (currency.cp * 0.01)

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Equipment
          </div>
          <Badge 
            variant={isEncumbered ? "destructive" : "secondary"}
            className="font-normal"
          >
            <Weight className="h-3 w-3 mr-1" />
            {currentLoad.toFixed(1)} / {carryingCapacity} lb
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Currency */}
        <div className="p-3 rounded-lg bg-accent/30 border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground flex items-center gap-1">
              <Coins className="h-4 w-4 text-yellow-400" />
              Currency
            </span>
            <span className="text-xs text-muted-foreground">
              ≈ {totalGoldValue.toFixed(2)} GP
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {(Object.keys(CURRENCY) as (keyof Currency)[]).map((type) => (
              <div key={type} className="text-center">
                <p className="text-xs text-muted-foreground uppercase">
                  {CURRENCY[type].abbr}
                </p>
                <p className="text-sm font-bold text-foreground">
                  {currency[type]}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Encumbrance Bar */}
        <div className="space-y-1">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all ${
                isEncumbered ? "bg-red-500" : "bg-green-500"
              }`}
              style={{ width: `${Math.min(100, encumbrancePercentage)}%` }}
            />
          </div>
          {isEncumbered && (
            <p className="text-xs text-red-400">Encumbered! Speed reduced.</p>
          )}
        </div>

        {/* Items by Category */}
        <ScrollArea className="h-[300px]">
          <div className="space-y-2">
            {Object.entries(groupedItems).map(([category, categoryItems]) => {
              const Icon = CATEGORY_ICONS[category as ItemProperty["category"]] || Package
              const isExpanded = expandedCategories.has(category)

              return (
                <div key={category} className="border border-border rounded-lg overflow-hidden">
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between p-2 bg-accent/30 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground capitalize">
                        {category}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {categoryItems.length}
                      </Badge>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>

                  {/* Category Items */}
                  {isExpanded && (
                    <div className="divide-y divide-border">
                      {categoryItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 p-2 hover:bg-accent/20 transition-colors"
                        >
                          {onToggleEquip && (category === "weapon" || category === "armor") && (
                            <Checkbox
                              checked={item.equipped}
                              onCheckedChange={() => onToggleEquip(item.id)}
                              className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm truncate ${
                              item.equipped ? "text-primary font-medium" : "text-foreground"
                            }`}>
                              {item.name}
                              {item.quantity > 1 && (
                                <span className="text-muted-foreground"> ×{item.quantity}</span>
                              )}
                            </p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground truncate">
                                {item.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {(item as ArmorProperty).baseAC && (
                              <Badge variant="outline" className="text-xs">
                                AC {(item as ArmorProperty).baseAC}
                              </Badge>
                            )}
                            {(item as WeaponProperty).damageDice && (
                              <Badge variant="outline" className="text-xs">
                                {(item as WeaponProperty).damageDice}
                              </Badge>
                            )}
                            <span>{(item.weight * item.quantity).toFixed(1)} lb</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {items.length === 0 && (
              <div className="p-8 text-center">
                <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No equipment yet</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
