"use client"

import { useState } from "react"
import { Plus, User, Crown, Bug } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCombatStore, type CombatantType } from "@/lib/combat-store"
import { useCharacterStore } from "@/lib/feyforge-character-store"
import { useCampaignCharacters } from "@/lib/hooks/use-campaign-data"

export function AddCombatantDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [type, setType] = useState<CombatantType>("monster")
  const [initiative, setInitiative] = useState("")
  const [initiativeBonus, setInitiativeBonus] = useState("")
  const [ac, setAC] = useState("10")
  const [hp, setHP] = useState("")
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null)

  const { addCombatant } = useCombatStore()
  const characters = useCampaignCharacters()
  const { getCalculatedStats } = useCharacterStore()

  const resetForm = () => {
    setName("")
    setType("monster")
    setInitiative("")
    setInitiativeBonus("")
    setAC("10")
    setHP("")
    setSelectedCharacterId(null)
  }

  const rollInitiative = (bonus = 0) => {
    const roll = Math.floor(Math.random() * 20) + 1 + bonus
    setInitiative(roll.toString())
  }

  const handleAddCustom = () => {
    if (!name || !hp) return

    addCombatant({
      name,
      type,
      initiative: Number.parseInt(initiative) || 0,
      initiativeBonus: Number.parseInt(initiativeBonus) || 0,
      armorClass: Number.parseInt(ac) || 10,
      hitPoints: {
        current: Number.parseInt(hp),
        max: Number.parseInt(hp),
        temp: 0,
      },
      conditions: [],
      deathSaves: type === "pc" ? { successes: 0, failures: 0 } : undefined,
      notes: "",
    })

    resetForm()
    setOpen(false)
  }

  const handleAddCharacter = (characterId: string) => {
    const character = characters.find((c) => c.id === characterId)
    if (!character) return

    // Get calculated stats for AC, or calculate basic DEX-based AC
    const calcStats = getCalculatedStats(characterId)
    const dexMod = Math.floor((character.baseAbilities.dex - 10) / 2)
    const armorClass = calcStats?.armorClass ?? (10 + dexMod)
    const initBonus = dexMod
    const roll = Math.floor(Math.random() * 20) + 1 + initBonus

    addCombatant({
      name: character.name,
      type: "pc",
      initiative: roll,
      initiativeBonus: initBonus,
      armorClass,
      hitPoints: {
        current: character.hitPoints.current,
        max: character.hitPoints.max,
        temp: character.hitPoints.temp,
      },
      conditions: [],
      deathSaves: { successes: 0, failures: 0 },
      notes: "",
      characterId: character.id,
    })

    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-fey-cyan hover:bg-fey-cyan/90 text-white">
          <Plus className="h-4 w-4 mr-2 flex-shrink-0" />
          <span className="hidden sm:inline">Add Combatant</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader className="min-w-0">
          <DialogTitle>Add Combatant</DialogTitle>
          <DialogDescription>Add a PC, NPC, or monster to the combat tracker.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="custom" className="w-full min-w-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="custom">Custom</TabsTrigger>
            <TabsTrigger value="characters">Characters</TabsTrigger>
          </TabsList>

          <TabsContent value="custom" className="space-y-4 mt-4 min-w-0">
            {/* Type Selection */}
            <div className="space-y-2">
              <Label>Type</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={type === "pc" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setType("pc")}
                  className="flex-1 min-w-[60px]"
                >
                  <User className="h-4 w-4 mr-1 flex-shrink-0" />
                  <span className="truncate">PC</span>
                </Button>
                <Button
                  variant={type === "npc" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setType("npc")}
                  className="flex-1 min-w-[60px]"
                >
                  <Crown className="h-4 w-4 mr-1 flex-shrink-0" />
                  <span className="truncate">NPC</span>
                </Button>
                <Button
                  variant={type === "monster" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setType("monster")}
                  className="flex-1 min-w-[60px]"
                >
                  <Bug className="h-4 w-4 mr-1 flex-shrink-0" />
                  <span className="truncate">Monster</span>
                </Button>
              </div>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter name..." />
            </div>

            {/* Initiative */}
            <div className="space-y-2">
              <Label>Initiative</Label>
              <div className="flex flex-wrap gap-2">
                <Input
                  type="number"
                  value={initiative}
                  onChange={(e) => setInitiative(e.target.value)}
                  placeholder="Init"
                  className="flex-1 min-w-[80px]"
                />
                <Input
                  type="number"
                  value={initiativeBonus}
                  onChange={(e) => setInitiativeBonus(e.target.value)}
                  placeholder="Bonus"
                  className="w-16 sm:w-20 flex-shrink-0"
                />
                <Button
                  variant="outline"
                  onClick={() => rollInitiative(Number.parseInt(initiativeBonus) || 0)}
                  className="flex-shrink-0"
                >
                  Roll
                </Button>
              </div>
            </div>

            {/* AC & HP */}
            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              <div className="space-y-2 min-w-0">
                <Label htmlFor="ac">AC</Label>
                <Input id="ac" type="number" value={ac} onChange={(e) => setAC(e.target.value)} min="1" />
              </div>
              <div className="space-y-2 min-w-0">
                <Label htmlFor="hp">HP</Label>
                <Input
                  id="hp"
                  type="number"
                  value={hp}
                  onChange={(e) => setHP(e.target.value)}
                  placeholder="Max HP"
                  min="1"
                />
              </div>
            </div>

            <Button onClick={handleAddCustom} disabled={!name || !hp} className="w-full">
              <Plus className="h-4 w-4 mr-2 flex-shrink-0" />
              Add to Combat
            </Button>
          </TabsContent>

          <TabsContent value="characters" className="space-y-4 mt-4 min-w-0 overflow-hidden">
            {characters.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No characters found.</p>
                <p className="text-sm">Create characters first to add them here.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto overflow-x-hidden">
                {characters.map((character) => (
                  <button
                    key={character.id}
                    onClick={() => handleAddCharacter(character.id)}
                    className="w-full p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left flex items-center gap-2 sm:gap-3 min-w-0 overflow-hidden"
                  >
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <p className="font-medium truncate text-sm sm:text-base">{character.name}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">
                        Lv {character.level} {character.characterClass}
                      </p>
                    </div>
                    <div className="text-xs sm:text-sm text-muted-foreground flex-shrink-0">
                      {character.hitPoints.current}/{character.hitPoints.max}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
