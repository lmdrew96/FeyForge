"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { type NPC, npcRaces, npcOccupations } from "@/lib/npc-store"
import { X, Plus, Save } from "lucide-react"

const alignments = [
  "Lawful Good",
  "Neutral Good",
  "Chaotic Good",
  "Lawful Neutral",
  "True Neutral",
  "Chaotic Neutral",
  "Lawful Evil",
  "Neutral Evil",
  "Chaotic Evil",
]

interface NPCEditDialogProps {
  npc: Partial<NPC> | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (npc: Partial<NPC>) => void
  mode: "edit" | "review"
}

export function NPCEditDialog({
  npc,
  open,
  onOpenChange,
  onSave,
  mode,
}: NPCEditDialogProps) {
  const [formData, setFormData] = useState<Partial<NPC>>({})
  const [newTrait, setNewTrait] = useState("")
  const [newTag, setNewTag] = useState("")

  useEffect(() => {
    if (npc && open) {
      setFormData({ ...npc })
    }
  }, [npc, open])

  const updateField = <K extends keyof NPC>(field: K, value: NPC[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const addPersonalityTrait = () => {
    if (newTrait.trim()) {
      const current = formData.personality || []
      updateField("personality", [...current, newTrait.trim()])
      setNewTrait("")
    }
  }

  const removePersonalityTrait = (index: number) => {
    const current = formData.personality || []
    updateField(
      "personality",
      current.filter((_, i) => i !== index)
    )
  }

  const addTag = () => {
    if (newTag.trim()) {
      const current = formData.tags || []
      if (!current.includes(newTag.trim())) {
        updateField("tags", [...current, newTag.trim()])
      }
      setNewTag("")
    }
  }

  const removeTag = (index: number) => {
    const current = formData.tags || []
    updateField(
      "tags",
      current.filter((_, i) => i !== index)
    )
  }

  const handleSave = () => {
    onSave(formData)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Edit NPC" : "Review NPC"}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6 py-2">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-fey-cyan">Basic Info</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={formData.name || ""}
                    onChange={(e) => updateField("name", e.target.value)}
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Age</Label>
                  <Input
                    value={formData.age || ""}
                    onChange={(e) => updateField("age", e.target.value)}
                    placeholder="e.g., middle-aged, young adult"
                    className="bg-background/50"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Race</Label>
                  <Select
                    value={formData.race || ""}
                    onValueChange={(v) => updateField("race", v)}
                  >
                    <SelectTrigger className="bg-background/50">
                      <SelectValue placeholder="Select race" />
                    </SelectTrigger>
                    <SelectContent>
                      {npcRaces.map((race) => (
                        <SelectItem key={race} value={race}>
                          {race}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Occupation</Label>
                  <Select
                    value={formData.occupation || ""}
                    onValueChange={(v) => updateField("occupation", v)}
                  >
                    <SelectTrigger className="bg-background/50">
                      <SelectValue placeholder="Select occupation" />
                    </SelectTrigger>
                    <SelectContent>
                      {npcOccupations.map((occ) => (
                        <SelectItem key={occ} value={occ}>
                          {occ}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Alignment</Label>
                  <Select
                    value={formData.alignment || ""}
                    onValueChange={(v) => updateField("alignment", v)}
                  >
                    <SelectTrigger className="bg-background/50">
                      <SelectValue placeholder="Select alignment" />
                    </SelectTrigger>
                    <SelectContent>
                      {alignments.map((alignment) => (
                        <SelectItem key={alignment} value={alignment}>
                          {alignment}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Gender</Label>
                <Input
                  value={formData.gender || ""}
                  onChange={(e) => updateField("gender", e.target.value)}
                  className="bg-background/50"
                />
              </div>
            </div>

            {/* Appearance & Voice */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-fey-cyan">Appearance & Voice</h3>
              <div className="space-y-2">
                <Label>Appearance</Label>
                <Textarea
                  value={formData.appearance || ""}
                  onChange={(e) => updateField("appearance", e.target.value)}
                  className="bg-background/50 min-h-[80px]"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Voice Description</Label>
                  <Textarea
                    value={formData.voiceDescription || ""}
                    onChange={(e) => updateField("voiceDescription", e.target.value)}
                    className="bg-background/50 min-h-[60px]"
                    placeholder="How they speak..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mannerisms</Label>
                  <Textarea
                    value={formData.mannerisms || ""}
                    onChange={(e) => updateField("mannerisms", e.target.value)}
                    className="bg-background/50 min-h-[60px]"
                    placeholder="Distinctive habits..."
                  />
                </div>
              </div>
            </div>

            {/* Personality */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-fey-cyan">Personality</h3>
              <div className="space-y-2">
                <Label>Personality Traits</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.personality?.map((trait, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="border-fey-cyan/30 pr-1"
                    >
                      {trait}
                      <button
                        onClick={() => removePersonalityTrait(index)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newTrait}
                    onChange={(e) => setNewTrait(e.target.value)}
                    placeholder="Add personality trait"
                    className="bg-background/50"
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addPersonalityTrait())}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={addPersonalityTrait}
                    className="shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Motivation</Label>
                <Textarea
                  value={formData.motivation || ""}
                  onChange={(e) => updateField("motivation", e.target.value)}
                  className="bg-background/50 min-h-[60px]"
                  placeholder="What drives this NPC..."
                />
              </div>

              <div className="space-y-2">
                <Label className="text-destructive">Secret</Label>
                <Textarea
                  value={formData.secret || ""}
                  onChange={(e) => updateField("secret", e.target.value)}
                  className="bg-background/50 min-h-[60px]"
                  placeholder="A hidden secret..."
                />
              </div>
            </div>

            {/* Story */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-fey-cyan">Story</h3>
              <div className="space-y-2">
                <Label>Backstory</Label>
                <Textarea
                  value={formData.backstory || ""}
                  onChange={(e) => updateField("backstory", e.target.value)}
                  className="bg-background/50 min-h-[80px]"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input
                    value={formData.location || ""}
                    onChange={(e) => updateField("location", e.target.value)}
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Relationship</Label>
                  <Select
                    value={formData.relationship || "neutral"}
                    onValueChange={(v) =>
                      updateField("relationship", v as NPC["relationship"])
                    }
                  >
                    <SelectTrigger className="bg-background/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="neutral">Neutral</SelectItem>
                      <SelectItem value="hostile">Hostile</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status || "alive"}
                    onValueChange={(v) => updateField("status", v as NPC["status"])}
                  >
                    <SelectTrigger className="bg-background/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alive">Alive</SelectItem>
                      <SelectItem value="dead">Dead</SelectItem>
                      <SelectItem value="unknown">Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Meta */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-fey-cyan">Meta</h3>
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.tags?.map((tag, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="border-border pr-1"
                    >
                      {tag}
                      <button
                        onClick={() => removeTag(index)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Add tag"
                    className="bg-background/50"
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={addTag}
                    className="shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes || ""}
                  onChange={(e) => updateField("notes", e.target.value)}
                  className="bg-background/50 min-h-[60px]"
                  placeholder="Additional notes..."
                />
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            className="bg-fey-cyan hover:bg-fey-cyan/90 text-white"
          >
            <Save className="h-4 w-4 mr-2" />
            {mode === "edit" ? "Save Changes" : "Save NPC"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
