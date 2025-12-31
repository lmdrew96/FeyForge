"use client"

import { useState } from "react"
import { Plus, MapPin, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
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
import { useWorldMapStore, type LocationPin } from "@/lib/world-map-store"
import { useActiveCampaignId } from "@/lib/hooks/use-campaign-data"

interface AddPinDialogProps {
  trigger?: React.ReactNode
  defaultPosition?: { x: number; y: number }
}

const locationTypes: { value: LocationPin["type"]; label: string }[] = [
  { value: "city", label: "City" },
  { value: "town", label: "Town" },
  { value: "village", label: "Village" },
  { value: "dungeon", label: "Dungeon" },
  { value: "landmark", label: "Landmark" },
  { value: "poi", label: "Point of Interest" },
  { value: "other", label: "Other" },
]

export function AddPinDialog({ trigger, defaultPosition }: AddPinDialogProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { addPin } = useWorldMapStore()
  const activeCampaignId = useActiveCampaignId()
  
  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [type, setType] = useState<LocationPin["type"]>("poi")
  const [xPosition, setXPosition] = useState(defaultPosition?.x?.toString() || "50")
  const [yPosition, setYPosition] = useState(defaultPosition?.y?.toString() || "50")
  const [notes, setNotes] = useState("")
  const [isRevealed, setIsRevealed] = useState(true)
  
  const resetForm = () => {
    setName("")
    setDescription("")
    setType("poi")
    setXPosition(defaultPosition?.x?.toString() || "50")
    setYPosition(defaultPosition?.y?.toString() || "50")
    setNotes("")
    setIsRevealed(true)
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim() || !activeCampaignId) return
    
    setIsSubmitting(true)
    
    try {
      const newPin: LocationPin = {
        id: `pin-${Date.now()}`,
        campaignId: activeCampaignId,
        name: name.trim(),
        description: description.trim(),
        x: parseFloat(xPosition) || 50,
        y: parseFloat(yPosition) || 50,
        type,
        notableNPCs: [],
        connectedLocations: [],
        isRevealed,
        notes: notes.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      
      addPin(newPin)
      resetForm()
      setOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={(value) => {
      setOpen(value)
      if (!value) resetForm()
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2">
            <MapPin className="h-4 w-4" />
            <span className="hidden sm:inline">Add Location</span>
            <span className="sm:hidden">Add</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Add Location Pin
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="pin-name">Location Name</Label>
            <Input
              id="pin-name"
              placeholder="e.g., Thornhaven, The Shadow Gate"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          
          {/* Type */}
          <div className="space-y-2">
            <Label htmlFor="pin-type">Location Type</Label>
            <Select value={type} onValueChange={(value) => setType(value as LocationPin["type"])}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {locationTypes.map((locType) => (
                  <SelectItem key={locType.value} value={locType.value}>
                    {locType.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Position */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pin-x">X Position (%)</Label>
              <Input
                id="pin-x"
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="50"
                value={xPosition}
                onChange={(e) => setXPosition(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pin-y">Y Position (%)</Label>
              <Input
                id="pin-y"
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="50"
                value={yPosition}
                onChange={(e) => setYPosition(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Position is a percentage of the map size. 0,0 is top-left, 100,100 is bottom-right.
          </p>
          
          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="pin-description">Description</Label>
            <Textarea
              id="pin-description"
              placeholder="Describe this location..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          
          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="pin-notes">DM Notes (Optional)</Label>
            <Textarea
              id="pin-notes"
              placeholder="Private notes for the DM..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
          
          {/* Revealed Toggle */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="pin-revealed"
              checked={isRevealed}
              onCheckedChange={(checked) => setIsRevealed(checked === true)}
            />
            <Label htmlFor="pin-revealed" className="text-sm font-normal cursor-pointer">
              Visible to players (when Fog of War is enabled)
            </Label>
          </div>
          
          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Add Location
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
