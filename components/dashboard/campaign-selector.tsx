"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, ChevronDown, Crown, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useCampaignStore } from "@/lib/campaign-store"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { getErrorMessage, isAuthError } from "@/lib/errors"

export function CampaignSelector() {
  const {
    campaigns,
    activeCampaignId,
    setActiveCampaign,
    initialize,
    isInitialized,
    createCampaign,
    isLoading,
  } = useCampaignStore()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newCampaignName, setNewCampaignName] = useState("")
  const [newCampaignDescription, setNewCampaignDescription] = useState("")

  useEffect(() => {
    if (!isInitialized) initialize()
  }, [initialize, isInitialized])

  const activeCampaign = useMemo(() => {
    return campaigns.find((c) => c.id === activeCampaignId)
  }, [campaigns, activeCampaignId])

  const handleCreateCampaign = async () => {
    if (!newCampaignName.trim()) return

    try {
      const newId = await createCampaign({
        name: newCampaignName.trim(),
        description: newCampaignDescription.trim() || "",
        isActive: true,
      })
      setActiveCampaign(newId)
      setIsDialogOpen(false)
      setNewCampaignName("")
      setNewCampaignDescription("")
    } catch (error) {
      const message = getErrorMessage(error, "Failed to create campaign")
      if (isAuthError(message)) {
        toast.error("Please log in to create a campaign")
      } else {
        toast.error(message)
      }
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between bg-card/80 border-border hover:border-fey-cyan hover:bg-card transition-colors"
          >
            <div className="flex items-center gap-2 truncate">
              <Crown className="h-4 w-4 text-fey-gold shrink-0" />
              <span className="truncate">
                {activeCampaign?.name || "Select Campaign"}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[280px]">
          {campaigns.map((campaign) => (
            <DropdownMenuItem
              key={campaign.id}
              onClick={() => setActiveCampaign(campaign.id)}
              className={cn(
                "cursor-pointer",
                campaign.id === activeCampaignId && "bg-fey-cyan/10"
              )}
            >
              <div className="flex items-center gap-2 w-full">
                {campaign.id === activeCampaignId ? (
                  <Check className="h-4 w-4 text-fey-cyan shrink-0" />
                ) : (
                  <div className="h-4 w-4 shrink-0" />
                )}
                <span className="truncate">{campaign.name}</span>
              </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer text-fey-cyan"
            onClick={() => setIsDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Campaign
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Campaign</DialogTitle>
            <DialogDescription>
              Start a new adventure! Give your campaign a name and optional
              description.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="campaign-name">Campaign Name</Label>
              <Input
                id="campaign-name"
                placeholder="e.g., Lost Mines of Phandelver"
                value={newCampaignName}
                onChange={(e) => setNewCampaignName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaign-description">
                Description (optional)
              </Label>
              <Textarea
                id="campaign-description"
                placeholder="A brief description of your campaign..."
                value={newCampaignDescription}
                onChange={(e) => setNewCampaignDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateCampaign}
              disabled={!newCampaignName.trim() || isLoading}
            >
              {isLoading ? "Creating..." : "Create Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
