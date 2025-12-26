"use client"

/**
 * Equipment Wizard Component
 * Guided starting equipment selection based on class
 */

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { 
  Sword, 
  Shield, 
  Package, 
  Coins,
  ChevronRight,
  Check,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { open5eApi, type Open5eWeapon, type Open5eArmor } from "@/lib/open5e-api"
import type { ItemProperty } from "@/lib/character/types"

// ============================================
// TYPES
// ============================================

interface EquipmentChoice {
  id: string
  prompt: string
  options: EquipmentOption[]
  selectedIndex?: number
  customization?: Record<string, string>
}

interface EquipmentOption {
  label: string
  items: EquipmentItem[]
  requiresChoice?: {
    type: "weapon" | "armor" | "tool"
    category?: string
    prompt: string
  }
}

interface EquipmentItem {
  name: string
  type: "weapon" | "armor" | "gear" | "tool"
  quantity?: number
  slug?: string
}

interface EquipmentWizardProps {
  characterClass: string
  onComplete: (equipment: ItemProperty[], gold: number) => void
  onBack?: () => void
}

// ============================================
// STARTING EQUIPMENT BY CLASS
// ============================================

const CLASS_STARTING_EQUIPMENT: Record<string, EquipmentChoice[]> = {
  fighter: [
    {
      id: "armor",
      prompt: "Choose your armor",
      options: [
        { 
          label: "Chain mail", 
          items: [{ name: "Chain Mail", type: "armor" }] 
        },
        { 
          label: "Leather armor, longbow, and 20 arrows", 
          items: [
            { name: "Leather Armor", type: "armor" },
            { name: "Longbow", type: "weapon" },
            { name: "Arrows", type: "gear", quantity: 20 },
          ] 
        },
      ],
    },
    {
      id: "weapons",
      prompt: "Choose your weapons",
      options: [
        { 
          label: "A martial weapon and a shield", 
          items: [{ name: "Shield", type: "armor" }],
          requiresChoice: { type: "weapon", category: "martial", prompt: "Choose a martial weapon" }
        },
        { 
          label: "Two martial weapons", 
          items: [],
          requiresChoice: { type: "weapon", category: "martial", prompt: "Choose two martial weapons" }
        },
      ],
    },
    {
      id: "ranged",
      prompt: "Choose your ranged option",
      options: [
        { 
          label: "A light crossbow and 20 bolts", 
          items: [
            { name: "Light Crossbow", type: "weapon" },
            { name: "Crossbow Bolts", type: "gear", quantity: 20 },
          ] 
        },
        { 
          label: "Two handaxes", 
          items: [{ name: "Handaxe", type: "weapon", quantity: 2 }] 
        },
      ],
    },
    {
      id: "pack",
      prompt: "Choose your pack",
      options: [
        { 
          label: "Dungeoneer's pack", 
          items: [{ name: "Dungeoneer's Pack", type: "gear" }] 
        },
        { 
          label: "Explorer's pack", 
          items: [{ name: "Explorer's Pack", type: "gear" }] 
        },
      ],
    },
  ],
  wizard: [
    {
      id: "weapon",
      prompt: "Choose your weapon",
      options: [
        { 
          label: "A quarterstaff", 
          items: [{ name: "Quarterstaff", type: "weapon" }] 
        },
        { 
          label: "A dagger", 
          items: [{ name: "Dagger", type: "weapon" }] 
        },
      ],
    },
    {
      id: "focus",
      prompt: "Choose your arcane focus",
      options: [
        { 
          label: "A component pouch", 
          items: [{ name: "Component Pouch", type: "gear" }] 
        },
        { 
          label: "An arcane focus", 
          items: [{ name: "Arcane Focus", type: "gear" }] 
        },
      ],
    },
    {
      id: "pack",
      prompt: "Choose your pack",
      options: [
        { 
          label: "Scholar's pack", 
          items: [{ name: "Scholar's Pack", type: "gear" }] 
        },
        { 
          label: "Explorer's pack", 
          items: [{ name: "Explorer's Pack", type: "gear" }] 
        },
      ],
    },
  ],
  rogue: [
    {
      id: "weapon",
      prompt: "Choose your weapon",
      options: [
        { 
          label: "A rapier", 
          items: [{ name: "Rapier", type: "weapon" }] 
        },
        { 
          label: "A shortsword", 
          items: [{ name: "Shortsword", type: "weapon" }] 
        },
      ],
    },
    {
      id: "ranged",
      prompt: "Choose your ranged weapon",
      options: [
        { 
          label: "A shortbow and quiver of 20 arrows", 
          items: [
            { name: "Shortbow", type: "weapon" },
            { name: "Arrows", type: "gear", quantity: 20 },
          ] 
        },
        { 
          label: "A shortsword", 
          items: [{ name: "Shortsword", type: "weapon" }] 
        },
      ],
    },
    {
      id: "pack",
      prompt: "Choose your pack",
      options: [
        { 
          label: "Burglar's pack", 
          items: [{ name: "Burglar's Pack", type: "gear" }] 
        },
        { 
          label: "Dungeoneer's pack", 
          items: [{ name: "Dungeoneer's Pack", type: "gear" }] 
        },
        { 
          label: "Explorer's pack", 
          items: [{ name: "Explorer's Pack", type: "gear" }] 
        },
      ],
    },
  ],
  cleric: [
    {
      id: "weapon",
      prompt: "Choose your weapon",
      options: [
        { 
          label: "A mace", 
          items: [{ name: "Mace", type: "weapon" }] 
        },
        { 
          label: "A warhammer (if proficient)", 
          items: [{ name: "Warhammer", type: "weapon" }] 
        },
      ],
    },
    {
      id: "armor",
      prompt: "Choose your armor",
      options: [
        { 
          label: "Scale mail", 
          items: [{ name: "Scale Mail", type: "armor" }] 
        },
        { 
          label: "Leather armor", 
          items: [{ name: "Leather Armor", type: "armor" }] 
        },
        { 
          label: "Chain mail (if proficient)", 
          items: [{ name: "Chain Mail", type: "armor" }] 
        },
      ],
    },
    {
      id: "ranged",
      prompt: "Choose your secondary weapon",
      options: [
        { 
          label: "A light crossbow and 20 bolts", 
          items: [
            { name: "Light Crossbow", type: "weapon" },
            { name: "Crossbow Bolts", type: "gear", quantity: 20 },
          ] 
        },
        { 
          label: "Any simple weapon", 
          items: [],
          requiresChoice: { type: "weapon", category: "simple", prompt: "Choose a simple weapon" }
        },
      ],
    },
    {
      id: "pack",
      prompt: "Choose your pack",
      options: [
        { 
          label: "Priest's pack", 
          items: [{ name: "Priest's Pack", type: "gear" }] 
        },
        { 
          label: "Explorer's pack", 
          items: [{ name: "Explorer's Pack", type: "gear" }] 
        },
      ],
    },
  ],
  // Default for classes not specifically defined
  default: [
    {
      id: "pack",
      prompt: "Choose your adventuring pack",
      options: [
        { 
          label: "Explorer's pack", 
          items: [{ name: "Explorer's Pack", type: "gear" }] 
        },
        { 
          label: "Dungeoneer's pack", 
          items: [{ name: "Dungeoneer's Pack", type: "gear" }] 
        },
      ],
    },
  ],
}

// Starting gold by class (for the "take gold instead" option)
const CLASS_STARTING_GOLD: Record<string, string> = {
  barbarian: "2d4 × 10",
  bard: "5d4 × 10",
  cleric: "5d4 × 10",
  druid: "2d4 × 10",
  fighter: "5d4 × 10",
  monk: "5d4",
  paladin: "5d4 × 10",
  ranger: "5d4 × 10",
  rogue: "4d4 × 10",
  sorcerer: "3d4 × 10",
  warlock: "4d4 × 10",
  wizard: "4d4 × 10",
  default: "4d4 × 10",
}

// ============================================
// EQUIPMENT WIZARD COMPONENT
// ============================================

export function EquipmentWizard({
  characterClass,
  onComplete,
  onBack,
}: EquipmentWizardProps) {
  const [useGoldInstead, setUseGoldInstead] = useState(false)
  const [goldAmount, setGoldAmount] = useState<number>(0)
  const [choices, setChoices] = useState<EquipmentChoice[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [weapons, setWeapons] = useState<Open5eWeapon[]>([])
  const [loading, setLoading] = useState(true)
  const [customWeaponChoices, setCustomWeaponChoices] = useState<Record<string, string[]>>({})

  // Get equipment choices for this class
  useEffect(() => {
    const classKey = characterClass.toLowerCase()
    const equipmentChoices = CLASS_STARTING_EQUIPMENT[classKey] || CLASS_STARTING_EQUIPMENT.default
    setChoices(equipmentChoices.map(c => ({ ...c, selectedIndex: undefined })))
  }, [characterClass])

  // Load weapons from Open5e
  useEffect(() => {
    async function loadWeapons() {
      setLoading(true)
      try {
        const weaponData = await open5eApi.getWeapons("all")
        setWeapons(weaponData)
      } catch (error) {
        console.error("Failed to load weapons:", error)
      } finally {
        setLoading(false)
      }
    }
    loadWeapons()
  }, [])

  // Filter weapons by category
  const getWeaponsByCategory = (category: string) => {
    if (category === "martial") {
      return weapons.filter(w => w.category.toLowerCase().includes("martial"))
    }
    if (category === "simple") {
      return weapons.filter(w => w.category.toLowerCase().includes("simple"))
    }
    return weapons
  }

  const handleOptionSelect = (choiceIndex: number, optionIndex: number) => {
    setChoices(prev => {
      const updated = [...prev]
      updated[choiceIndex] = {
        ...updated[choiceIndex],
        selectedIndex: optionIndex,
      }
      return updated
    })
  }

  const handleWeaponChoice = (choiceId: string, weaponName: string, slotIndex: number = 0) => {
    setCustomWeaponChoices(prev => {
      const current = prev[choiceId] || []
      const updated = [...current]
      updated[slotIndex] = weaponName
      return { ...prev, [choiceId]: updated }
    })
  }

  const isComplete = useMemo(() => {
    if (useGoldInstead) return goldAmount > 0
    
    return choices.every(choice => {
      if (choice.selectedIndex === undefined) return false
      
      const option = choice.options[choice.selectedIndex]
      if (option.requiresChoice) {
        const customChoices = customWeaponChoices[choice.id] || []
        const requiredCount = option.requiresChoice.prompt.includes("two") ? 2 : 1
        return customChoices.filter(Boolean).length >= requiredCount
      }
      
      return true
    })
  }, [choices, useGoldInstead, goldAmount, customWeaponChoices])

  const handleComplete = () => {
    if (useGoldInstead) {
      onComplete([], goldAmount)
      return
    }

    const equipment: ItemProperty[] = []
    
    for (const choice of choices) {
      if (choice.selectedIndex === undefined) continue
      
      const option = choice.options[choice.selectedIndex]
      
      // Add base items
      for (const item of option.items) {
        equipment.push(createItemProperty(item))
      }
      
      // Add custom weapon choices
      if (option.requiresChoice) {
        const customChoices = customWeaponChoices[choice.id] || []
        for (const weaponName of customChoices) {
          if (weaponName) {
            equipment.push(createItemProperty({ name: weaponName, type: "weapon" }))
          }
        }
      }
    }

    onComplete(equipment, 0)
  }

  const startingGoldDice = CLASS_STARTING_GOLD[characterClass.toLowerCase()] || CLASS_STARTING_GOLD.default

  return (
    <Card className="bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Package className="h-5 w-5 text-amber-400" />
            Starting Equipment
          </CardTitle>
          <Badge variant="outline" className="capitalize">
            {characterClass}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Gold vs Equipment Toggle */}
        <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex-1">
            <h4 className="font-medium">Equipment Selection</h4>
            <p className="text-sm text-muted-foreground">
              Choose starting equipment or take gold instead
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={!useGoldInstead ? "default" : "outline"}
              size="sm"
              onClick={() => setUseGoldInstead(false)}
            >
              <Sword className="h-4 w-4 mr-1" />
              Equipment
            </Button>
            <Button
              variant={useGoldInstead ? "default" : "outline"}
              size="sm"
              onClick={() => setUseGoldInstead(true)}
            >
              <Coins className="h-4 w-4 mr-1" />
              Gold ({startingGoldDice} gp)
            </Button>
          </div>
        </div>

        {useGoldInstead ? (
          /* Gold Input */
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Instead of starting equipment, you can take <strong>{startingGoldDice}</strong> gold pieces
              and purchase your own equipment. Roll or enter your starting gold below.
            </p>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label htmlFor="gold">Starting Gold (gp)</Label>
                <Input
                  id="gold"
                  type="number"
                  min={0}
                  value={goldAmount || ""}
                  onChange={(e) => setGoldAmount(parseInt(e.target.value) || 0)}
                  placeholder="Enter gold amount..."
                />
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  // Simple roll simulation for the dice
                  const match = startingGoldDice.match(/(\d+)d(\d+)(?:\s*×\s*(\d+))?/)
                  if (match) {
                    const count = parseInt(match[1])
                    const size = parseInt(match[2])
                    const multiplier = match[3] ? parseInt(match[3]) : 1
                    let total = 0
                    for (let i = 0; i < count; i++) {
                      total += Math.floor(Math.random() * size) + 1
                    }
                    setGoldAmount(total * multiplier)
                  }
                }}
              >
                Roll {startingGoldDice}
              </Button>
            </div>
          </div>
        ) : (
          /* Equipment Choices */
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-6">
              {choices.map((choice, choiceIndex) => (
                <div key={choice.id} className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-sm flex items-center justify-center">
                      {choiceIndex + 1}
                    </span>
                    {choice.prompt}
                  </h4>
                  
                  <RadioGroup
                    value={choice.selectedIndex?.toString()}
                    onValueChange={(value: string) => handleOptionSelect(choiceIndex, parseInt(value))}
                    className="space-y-2"
                  >
                    {choice.options.map((option, optionIndex) => (
                      <div key={optionIndex} className="space-y-2">
                        <div
                          className={cn(
                            "flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer",
                            choice.selectedIndex === optionIndex
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          )}
                          onClick={() => handleOptionSelect(choiceIndex, optionIndex)}
                        >
                          <RadioGroupItem value={optionIndex.toString()} id={`${choice.id}-${optionIndex}`} />
                          <Label 
                            htmlFor={`${choice.id}-${optionIndex}`}
                            className="flex-1 cursor-pointer"
                          >
                            <span className="font-medium">{option.label}</span>
                            {option.items.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {option.items.map((item, i) => (
                                  <Badge key={i} variant="secondary" className="text-xs">
                                    {item.quantity && item.quantity > 1 && `${item.quantity}× `}
                                    {item.name}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </Label>
                          {choice.selectedIndex === optionIndex && (
                            <Check className="h-4 w-4 text-primary flex-shrink-0" />
                          )}
                        </div>

                        {/* Custom weapon selection */}
                        {choice.selectedIndex === optionIndex && option.requiresChoice && (
                          <div className="ml-8 p-3 bg-muted/50 rounded-lg space-y-2">
                            <p className="text-sm text-muted-foreground">
                              {option.requiresChoice.prompt}
                            </p>
                            {option.requiresChoice.prompt.includes("two") ? (
                              <div className="grid grid-cols-2 gap-2">
                                <Select
                                  value={customWeaponChoices[choice.id]?.[0] || ""}
                                  onValueChange={(v) => handleWeaponChoice(choice.id, v, 0)}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="First weapon..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {getWeaponsByCategory(option.requiresChoice.category || "").map(w => (
                                      <SelectItem key={w.slug} value={w.name}>
                                        {w.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Select
                                  value={customWeaponChoices[choice.id]?.[1] || ""}
                                  onValueChange={(v) => handleWeaponChoice(choice.id, v, 1)}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Second weapon..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {getWeaponsByCategory(option.requiresChoice.category || "").map(w => (
                                      <SelectItem key={w.slug} value={w.name}>
                                        {w.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            ) : (
                              <Select
                                value={customWeaponChoices[choice.id]?.[0] || ""}
                                onValueChange={(v) => handleWeaponChoice(choice.id, v, 0)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select weapon..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {getWeaponsByCategory(option.requiresChoice.category || "").map(w => (
                                    <SelectItem key={w.slug} value={w.name}>
                                      {w.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t">
          {onBack && (
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
          )}
          <Button
            onClick={handleComplete}
            disabled={!isComplete}
            className="ml-auto"
          >
            <Check className="h-4 w-4 mr-2" />
            Confirm Equipment
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function createItemProperty(item: EquipmentItem): ItemProperty {
  const now = new Date()
  
  return {
    id: crypto.randomUUID(),
    type: "item",
    name: item.name,
    description: "",
    active: true,
    category: item.type === "weapon" ? "weapon" : item.type === "armor" ? "armor" : "gear",
    equipped: false,
    quantity: item.quantity || 1,
    weight: 0,
    modifiers: [],
    createdAt: now,
    updatedAt: now,
  } as ItemProperty
}
