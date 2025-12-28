"use client"

import { useCharacterStore } from "@/lib/character-store"
import { equipmentPackages, startingGold } from "@/lib/character-data"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Package, Coins, Sword, Shield } from "lucide-react"
import { cn } from "@/lib/utils"

export function StepEquipment() {
  const { character, updateCharacter } = useCharacterStore()

  const classKey = character.characterClass as keyof typeof equipmentPackages
  const equipment = equipmentPackages[classKey] || equipmentPackages.default
  const goldAmount = startingGold[classKey as keyof typeof startingGold] || "5d4 × 10 gp"

  const toggleEquipment = (itemName: string) => {
    const current = character.selectedEquipment
    if (current.includes(itemName)) {
      updateCharacter({ selectedEquipment: current.filter((e) => e !== itemName) })
    } else {
      updateCharacter({ selectedEquipment: [...current, itemName] })
    }
  }

  return (
    <div className="space-y-8 min-w-0">
      {/* Equipment Choice */}
      <RadioGroup
        value={character.equipmentChoice}
        onValueChange={(value) => updateCharacter({ equipmentChoice: value as "packages" | "gold" })}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <Label htmlFor="packages" className="cursor-pointer">
          <Card
            className={cn(
              "border-2 transition-all duration-300 overflow-hidden",
              character.equipmentChoice === "packages"
                ? "border-fey-cyan bg-fey-cyan/10 shadow-lg shadow-fey-cyan/20"
                : "border-border bg-card hover:border-fey-purple/50",
            )}
          >
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                <RadioGroupItem value="packages" id="packages" className="mt-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-5 w-5 text-fey-cyan shrink-0" />
                    <span className="font-semibold text-base sm:text-lg text-foreground">Starting Equipment</span>
                  </div>
                  <p className="text-sm text-foreground/80 break-words">
                    Choose from pre-selected equipment packages based on your class.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Label>

        <Label htmlFor="gold" className="cursor-pointer">
          <Card
            className={cn(
              "border-2 transition-all duration-300 overflow-hidden",
              character.equipmentChoice === "gold"
                ? "border-fey-gold bg-fey-gold/10 shadow-lg shadow-fey-gold/20"
                : "border-border bg-card hover:border-fey-purple/50",
            )}
          >
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                <RadioGroupItem value="gold" id="gold" className="mt-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Coins className="h-5 w-5 text-fey-gold shrink-0" />
                    <span className="font-semibold text-base sm:text-lg text-foreground">Starting Gold</span>
                  </div>
                  <p className="text-sm text-foreground/80">Roll for gold and buy your own equipment.</p>
                  <Badge className="mt-2 bg-fey-gold/20 text-fey-forest dark:text-fey-gold font-medium border border-fey-gold/30">
                    {goldAmount}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </Label>
      </RadioGroup>

      {/* Equipment Packages */}
      {character.equipmentChoice === "packages" && (
        <div className="space-y-4">
          <Label className="text-lg font-semibold flex items-center gap-2 text-foreground">
            <Sparkles className="h-4 w-4 text-fey-cyan shrink-0" />
            Select Your Equipment
          </Label>

          <Card className="bg-card border-2 border-border overflow-hidden">
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-3 sm:space-y-4">
                {equipment.map((item, index) => {
                  const isSelected = character.selectedEquipment.includes(item.name)

                  return (
                    <div
                      key={index}
                      className={cn(
                        "flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border-2 transition-all cursor-pointer min-w-0 overflow-hidden",
                        isSelected
                          ? "border-fey-cyan bg-fey-cyan/10"
                          : "border-border hover:border-fey-purple/50 bg-secondary/30",
                      )}
                      onClick={() => toggleEquipment(item.name)}
                    >
                      <Checkbox
                        checked={isSelected}
                        className="data-[state=checked]:bg-fey-cyan data-[state=checked]:border-fey-cyan shrink-0"
                      />
                      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 overflow-hidden">
                        {item.name.toLowerCase().includes("weapon") ||
                        item.name.toLowerCase().includes("sword") ||
                        item.name.toLowerCase().includes("axe") ? (
                          <Sword className="h-5 w-5 text-fey-purple shrink-0" />
                        ) : item.name.toLowerCase().includes("armor") || item.name.toLowerCase().includes("shield") ? (
                          <Shield className="h-5 w-5 text-fey-silver shrink-0" />
                        ) : (
                          <Package className="h-5 w-5 text-fey-sage shrink-0" />
                        )}
                        <span
                          className={cn("font-medium truncate", isSelected ? "text-foreground" : "text-foreground/80")}
                        >
                          {item.name}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Gold Option Info */}
      {character.equipmentChoice === "gold" && (
        <Card className="bg-secondary/30 border-2 border-fey-gold/30 overflow-hidden">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-fey-gold">
              <Coins className="h-5 w-5 shrink-0" />
              Starting Gold
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <p className="text-foreground/80 mb-4 break-words">
              Your class ({character.characterClass || "Not selected"}) grants you{" "}
              <span className="font-semibold text-fey-gold">{goldAmount}</span> to spend on equipment.
            </p>
            <p className="text-sm text-foreground/70 italic">
              Equipment purchasing will be available when you view your character sheet.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Equipment Preview */}
      {character.selectedEquipment.length > 0 && (
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-foreground/80">Selected Equipment:</Label>
          <div className="flex flex-wrap gap-2 overflow-hidden">
            {character.selectedEquipment.map((item) => (
              <Badge
                key={item}
                variant="secondary"
                className="px-3 py-1 bg-fey-cyan/20 text-fey-cyan font-medium border border-fey-cyan/30 max-w-full truncate"
              >
                {item}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
