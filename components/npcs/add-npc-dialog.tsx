"use client"

import { useState } from "react"
import { Plus, UserCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useNPCStore } from "@/lib/npc-store"
import { useActiveCampaignId } from "@/lib/hooks/use-campaign-data"
import { toast } from "sonner"
import { getErrorMessage, isAuthError } from "@/lib/errors"

interface AddNPCDialogProps {
  trigger?: React.ReactNode
}

export function AddNPCDialog({ trigger }: AddNPCDialogProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { addNPC } = useNPCStore()
  const activeCampaignId = useActiveCampaignId()

  // Form state - matching FeyForge NPC type
  const [name, setName] = useState("")
  const [race, setRace] = useState("")
  const [occupation, setOccupation] = useState("")
  const [age, setAge] = useState("")
  const [gender, setGender] = useState("")
  const [alignment, setAlignment] = useState("neutral")
  const [appearance, setAppearance] = useState("")
  const [personalityInput, setPersonalityInput] = useState("")
  const [mannerisms, setMannerisms] = useState("")
  const [voiceDescription, setVoiceDescription] = useState("")
  const [motivation, setMotivation] = useState("")
  const [secret, setSecret] = useState("")
  const [backstory, setBackstory] = useState("")
  const [location, setLocation] = useState("")
  const [faction, setFaction] = useState("")
  const [relationship, setRelationship] = useState<
    "friendly" | "neutral" | "hostile"
  >("neutral")
  const [status, setStatus] = useState<"alive" | "dead" | "unknown">("alive")

  const resetForm = () => {
    setName("")
    setRace("")
    setOccupation("")
    setAge("")
    setGender("")
    setAlignment("neutral")
    setAppearance("")
    setPersonalityInput("")
    setMannerisms("")
    setVoiceDescription("")
    setMotivation("")
    setSecret("")
    setBackstory("")
    setLocation("")
    setFaction("")
    setRelationship("neutral")
    setStatus("alive")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim() || !occupation.trim() || !race.trim() || !location.trim())
      return
    if (!activeCampaignId) return

    setIsSubmitting(true)

    try {
      // Parse personality traits from comma-separated input
      const personalityTraits = personalityInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)

      await addNPC({
        campaignId: activeCampaignId,
        name: name.trim(),
        race: race.trim(),
        occupation: occupation.trim(),
        age: age.trim() || "Unknown",
        gender: gender.trim() || "Unknown",
        alignment: alignment,
        appearance: appearance.trim() || "No description",
        personality:
          personalityTraits.length > 0 ? personalityTraits : ["Unknown"],
        mannerisms: mannerisms.trim() || "None noted",
        voiceDescription: voiceDescription.trim() || "No description",
        motivation: motivation.trim() || "Unknown",
        secret: secret.trim() || "None known",
        backstory: backstory.trim() || "Unknown",
        location: location.trim(),
        faction: faction.trim() || null,
        relationship,
        status,
        tags: [],
        notes: null,
        stats: null,
      })

      resetForm()
      setOpen(false)
    } catch (error) {
      console.error("Failed to add NPC:", error)
      const message = getErrorMessage(error, "Failed to add NPC")
      if (isAuthError(message)) {
        toast.error("Please log in to add NPCs")
      } else {
        toast.error(message)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const isFormValid =
    name.trim() &&
    occupation.trim() &&
    race.trim() &&
    location.trim() &&
    activeCampaignId

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="bg-fey-cyan hover:bg-fey-cyan/90 text-white flex-shrink-0">
            <Plus className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden xs:inline">Add NPC</span>
            <span className="xs:hidden">Add</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden bg-card flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <UserCircle className="w-5 h-5 text-fey-cyan" />
            Add New NPC
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <form onSubmit={handleSubmit} className="space-y-4 pb-4">
            {/* Required Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="npc-name">
                  Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="npc-name"
                  placeholder="Enter NPC name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="npc-occupation">
                  Occupation <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="npc-occupation"
                  placeholder="e.g., Tavern Keeper, Blacksmith"
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                  className="bg-background"
                />
              </div>
            </div>

            {/* Race & Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="npc-race">
                  Race <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="npc-race"
                  placeholder="e.g., Human, Elf, Dwarf"
                  value={race}
                  onChange={(e) => setRace(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="npc-location">
                  Location <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="npc-location"
                  placeholder="e.g., The Wandering Willow Tavern"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="bg-background"
                />
              </div>
            </div>

            {/* Age, Gender & Alignment */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="npc-age">Age</Label>
                <Input
                  id="npc-age"
                  placeholder="e.g., 45, Middle-aged"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="npc-gender">Gender</Label>
                <Input
                  id="npc-gender"
                  placeholder="e.g., Male, Female"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="npc-alignment">Alignment</Label>
                <Select value={alignment} onValueChange={setAlignment}>
                  <SelectTrigger id="npc-alignment" className="bg-background">
                    <SelectValue placeholder="Select alignment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lawful good">Lawful Good</SelectItem>
                    <SelectItem value="neutral good">Neutral Good</SelectItem>
                    <SelectItem value="chaotic good">Chaotic Good</SelectItem>
                    <SelectItem value="lawful neutral">
                      Lawful Neutral
                    </SelectItem>
                    <SelectItem value="neutral">True Neutral</SelectItem>
                    <SelectItem value="chaotic neutral">
                      Chaotic Neutral
                    </SelectItem>
                    <SelectItem value="lawful evil">Lawful Evil</SelectItem>
                    <SelectItem value="neutral evil">Neutral Evil</SelectItem>
                    <SelectItem value="chaotic evil">Chaotic Evil</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Faction, Relationship & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="npc-faction">Faction</Label>
                <Input
                  id="npc-faction"
                  placeholder="e.g., Thieves Guild"
                  value={faction}
                  onChange={(e) => setFaction(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="npc-relationship">Relationship</Label>
                <Select
                  value={relationship}
                  onValueChange={(v) =>
                    setRelationship(v as "friendly" | "neutral" | "hostile")
                  }
                >
                  <SelectTrigger
                    id="npc-relationship"
                    className="bg-background"
                  >
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="neutral">Neutral</SelectItem>
                    <SelectItem value="hostile">Hostile</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="npc-status">Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) =>
                    setStatus(v as "alive" | "dead" | "unknown")
                  }
                >
                  <SelectTrigger id="npc-status" className="bg-background">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alive">Alive</SelectItem>
                    <SelectItem value="dead">Dead</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Appearance */}
            <div className="space-y-2">
              <Label htmlFor="npc-appearance">Appearance</Label>
              <Textarea
                id="npc-appearance"
                placeholder="Physical description, notable features, clothing..."
                value={appearance}
                onChange={(e) => setAppearance(e.target.value)}
                className="bg-background min-h-[60px] resize-none"
              />
            </div>

            {/* Personality Traits */}
            <div className="space-y-2">
              <Label htmlFor="npc-personality">
                Personality Traits (comma-separated)
              </Label>
              <Input
                id="npc-personality"
                placeholder="e.g., Grumpy, Honest, Generous"
                value={personalityInput}
                onChange={(e) => setPersonalityInput(e.target.value)}
                className="bg-background"
              />
            </div>

            {/* Mannerisms & Voice */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="npc-mannerisms">Mannerisms</Label>
                <Input
                  id="npc-mannerisms"
                  placeholder="Quirks and habits"
                  value={mannerisms}
                  onChange={(e) => setMannerisms(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="npc-voice">Voice Description</Label>
                <Input
                  id="npc-voice"
                  placeholder="e.g., Deep and gravelly"
                  value={voiceDescription}
                  onChange={(e) => setVoiceDescription(e.target.value)}
                  className="bg-background"
                />
              </div>
            </div>

            {/* Motivation */}
            <div className="space-y-2">
              <Label htmlFor="npc-motivation">Motivation</Label>
              <Textarea
                id="npc-motivation"
                placeholder="What drives this NPC? What do they want?"
                value={motivation}
                onChange={(e) => setMotivation(e.target.value)}
                className="bg-background min-h-[60px] resize-none"
              />
            </div>

            {/* Secret */}
            <div className="space-y-2">
              <Label htmlFor="npc-secret">Secret</Label>
              <Textarea
                id="npc-secret"
                placeholder="Something the party doesn't know..."
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                className="bg-background min-h-[60px] resize-none"
              />
            </div>

            {/* Backstory */}
            <div className="space-y-2">
              <Label htmlFor="npc-backstory">Backstory</Label>
              <Textarea
                id="npc-backstory"
                placeholder="The NPC's history and background..."
                value={backstory}
                onChange={(e) => setBackstory(e.target.value)}
                className="bg-background min-h-[80px] resize-none"
              />
            </div>
          </form>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              resetForm()
              setOpen(false)
            }}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-fey-cyan hover:bg-fey-cyan/90 text-white"
            disabled={!isFormValid || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Add NPC
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
