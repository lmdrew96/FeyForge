"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, Crown, Users, Trash2 } from "lucide-react"
import { useCampaignStore, type Campaign } from "@/lib/campaign-store"

export function CampaignSelector() {
  const { campaigns, activeCampaignId, setActiveCampaign, createCampaign, deleteCampaign } = useCampaignStore()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null)

  // Form state for new campaign
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    description: "",
    role: "DM" as "DM" | "Player",
    playerCount: 4,
  })

  const currentCampaign = campaigns.find((c) => c.id === activeCampaignId)

  const handleCreateCampaign = () => {
    if (!newCampaign.name.trim()) return

    createCampaign(newCampaign)
    setNewCampaign({ name: "", description: "", role: "DM", playerCount: 4 })
    setIsCreateOpen(false)
  }

  const handleDeleteCampaign = () => {
    if (campaignToDelete) {
      deleteCampaign(campaignToDelete.id)
      setCampaignToDelete(null)
      setIsDeleteOpen(false)
    }
  }

  const handleDeleteClick = (campaign: Campaign, e: React.MouseEvent) => {
    e.stopPropagation()
    setCampaignToDelete(campaign)
    setIsDeleteOpen(true)
  }

  // Show create prompt if no campaigns exist
  if (campaigns.length === 0) {
    return (
      <div className="pb-6 mb-6 border-b-2 border-primary/10">
        <div className="p-5">
          <div className="text-center py-4">
            <Crown className="h-10 w-10 mx-auto text-primary/50 mb-3" />
            <h3 className="font-serif text-lg font-bold mb-2">No Campaigns Yet</h3>
            <p className="text-muted-foreground text-sm mb-4">Create your first campaign to get started</p>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Campaign
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle className="font-serif">Create New Campaign</DialogTitle>
                  <DialogDescription>Start a new adventure. Add details about your campaign.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Campaign Name</Label>
                    <Input
                      id="name"
                      value={newCampaign.name}
                      onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                      placeholder="Curse of Strahd"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={newCampaign.description}
                      onChange={(e) => setNewCampaign({ ...newCampaign, description: e.target.value })}
                      placeholder="A gothic horror adventure in Barovia..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="role">Your Role</Label>
                      <Select
                        value={newCampaign.role}
                        onValueChange={(value: "DM" | "Player") => setNewCampaign({ ...newCampaign, role: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DM">Dungeon Master</SelectItem>
                          <SelectItem value="Player">Player</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="players">Players</Label>
                      <Input
                        id="players"
                        type="number"
                        min={1}
                        max={10}
                        value={newCampaign.playerCount}
                        onChange={(e) =>
                          setNewCampaign({ ...newCampaign, playerCount: Number.parseInt(e.target.value) || 1 })
                        }
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateCampaign} disabled={!newCampaign.name.trim()}>
                    Create Campaign
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-6 mb-6 border-b-2 border-primary/10">
      <div className="py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
              <Crown className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-silver/70 mb-1.5 uppercase tracking-wider font-medium">Active Campaign</p>
              <Select value={activeCampaignId || ""} onValueChange={setActiveCampaign}>
                <SelectTrigger className="w-full bg-transparent border-none focus:ring-0 h-11 px-0 text-foreground font-serif text-xl">
                  <SelectValue placeholder="Select a campaign" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border rounded-xl backdrop-blur-xl">
                  {campaigns.map((campaign) => (
                    <SelectItem
                      key={campaign.id}
                      value={campaign.id}
                      className="focus:bg-accent focus:text-accent-foreground font-serif rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <span>{campaign.name}</span>
                        <span className={campaign.role === "DM" ? "badge-copper" : "badge-lavender"}>
                          {campaign.role}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Player count display */}
          <div className="text-center hidden sm:flex flex-col items-center gap-1 px-5">
            <Users className="h-5 w-5 text-primary" />
            <p className="text-3xl font-bold font-serif text-primary">{currentCampaign?.playerCount ?? 0}</p>
            <p className="text-xs text-muted-foreground">Players</p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            {currentCampaign && (
              <Button
                size="icon"
                variant="ghost"
                className="hover:bg-destructive/10 h-11 w-11 rounded-xl"
                onClick={(e) => handleDeleteClick(currentCampaign, e)}
              >
                <Trash2 className="h-5 w-5 text-muted-foreground hover:text-destructive" />
              </Button>
            )}

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button size="icon" variant="ghost" className="hover:bg-primary/10 h-11 w-11 rounded-xl">
                  <Plus className="h-5 w-5 text-primary" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle className="font-serif">Create New Campaign</DialogTitle>
                  <DialogDescription>Start a new adventure. Add details about your campaign.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name2">Campaign Name</Label>
                    <Input
                      id="name2"
                      value={newCampaign.name}
                      onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                      placeholder="Curse of Strahd"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description2">Description</Label>
                    <Textarea
                      id="description2"
                      value={newCampaign.description}
                      onChange={(e) => setNewCampaign({ ...newCampaign, description: e.target.value })}
                      placeholder="A gothic horror adventure in Barovia..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="role2">Your Role</Label>
                      <Select
                        value={newCampaign.role}
                        onValueChange={(value: "DM" | "Player") => setNewCampaign({ ...newCampaign, role: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DM">Dungeon Master</SelectItem>
                          <SelectItem value="Player">Player</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="players2">Players</Label>
                      <Input
                        id="players2"
                        type="number"
                        min={1}
                        max={10}
                        value={newCampaign.playerCount}
                        onChange={(e) =>
                          setNewCampaign({ ...newCampaign, playerCount: Number.parseInt(e.target.value) || 1 })
                        }
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateCampaign} disabled={!newCampaign.name.trim()}>
                    Create Campaign
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Campaign</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{campaignToDelete?.name}&quot;? This will NOT delete NPCs, sessions,
              or other data associated with this campaign, but they will no longer be visible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteCampaign}>
              Delete Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
