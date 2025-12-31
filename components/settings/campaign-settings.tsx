"use client"

import { useState, useEffect } from "react"
import { Plus, Pencil, Trash2, Check, Crown, X } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useCampaignStore, type Campaign } from "@/lib/campaign-store"

export function CampaignSettings() {
  const {
    campaigns,
    activeCampaignId,
    isInitialized,
    initialize,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    setActiveCampaign,
  } = useCampaignStore()

  // Initialize store on mount
  useEffect(() => {
    if (!isInitialized) {
      initialize()
    }
  }, [initialize, isInitialized])

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  const [deleteConfirmCampaign, setDeleteConfirmCampaign] = useState<Campaign | null>(null)

  // Form state for add/edit
  const [formName, setFormName] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formErrors, setFormErrors] = useState<{ name?: string }>({})

  const resetForm = () => {
    setFormName("")
    setFormDescription("")
    setFormErrors({})
  }

  const openAddDialog = () => {
    resetForm()
    setIsAddDialogOpen(true)
  }

  const openEditDialog = (campaign: Campaign) => {
    setFormName(campaign.name)
    setFormDescription(campaign.description ?? "")
    setFormErrors({})
    setEditingCampaign(campaign)
  }

  const closeDialogs = () => {
    setIsAddDialogOpen(false)
    setEditingCampaign(null)
    resetForm()
  }

  const validateForm = (): boolean => {
    const errors: { name?: string } = {}
    if (!formName.trim()) {
      errors.name = "Campaign name is required"
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleAddCampaign = async () => {
    if (!validateForm()) return

    try {
      await createCampaign({
        name: formName.trim(),
        description: formDescription.trim(),
        isActive: false,
      })
      closeDialogs()
    } catch (error) {
      console.error("Failed to create campaign:", error)
    }
  }

  const handleUpdateCampaign = async () => {
    if (!validateForm() || !editingCampaign) return

    try {
      await updateCampaign(editingCampaign.id, {
        name: formName.trim(),
        description: formDescription.trim(),
      })
      closeDialogs()
    } catch (error) {
      console.error("Failed to update campaign:", error)
    }
  }

  const handleDeleteCampaign = async () => {
    if (!deleteConfirmCampaign) return
    
    try {
      await deleteCampaign(deleteConfirmCampaign.id)
      setDeleteConfirmCampaign(null)
    } catch (error) {
      console.error("Failed to delete campaign:", error)
    }
  }

  const handleSetActive = (campaignId: string) => {
    setActiveCampaign(campaignId)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Crown className="h-5 w-5 text-fey-gold" />
                Your Campaigns
              </CardTitle>
              <CardDescription>
                Manage your campaigns and set your active adventure
              </CardDescription>
            </div>
            <Button onClick={openAddDialog} className="flex-shrink-0">
              <Plus className="h-4 w-4 mr-2" />
              New Campaign
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Crown className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">No campaigns yet</p>
              <p className="text-sm mt-1">Create your first campaign to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((campaign) => {
                const isActive = campaign.id === activeCampaignId
                return (
                  <div
                    key={campaign.id}
                    className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg border transition-all ${
                      isActive
                        ? "border-fey-cyan bg-fey-cyan/5"
                        : "border-border/50 hover:border-border hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium truncate">{campaign.name}</h3>
                        {isActive && (
                          <Badge variant="outline" className="text-fey-cyan border-fey-cyan/50">
                            Active
                          </Badge>
                        )}
                      </div>
                      {campaign.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {campaign.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Created {campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString() : "Unknown"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetActive(campaign.id)}
                          className="text-fey-cyan border-fey-cyan/50 hover:bg-fey-cyan/10"
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Set Active
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(campaign)}
                        className="h-8 w-8"
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit campaign</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirmCampaign(campaign)}
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete campaign</span>
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Campaign Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Campaign</DialogTitle>
            <DialogDescription>
              Start a new adventure. Give your campaign a name and description.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="campaign-name">
                Campaign Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="campaign-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., The Feywild Chronicles"
                className={formErrors.name ? "border-destructive" : ""}
              />
              {formErrors.name && (
                <p className="text-sm text-destructive">{formErrors.name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaign-description">Description</Label>
              <Textarea
                id="campaign-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="A brief description of your campaign..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={closeDialogs}>
              Cancel
            </Button>
            <Button onClick={handleAddCampaign}>Create Campaign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Campaign Dialog */}
      <Dialog open={!!editingCampaign} onOpenChange={(open) => !open && closeDialogs()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Campaign</DialogTitle>
            <DialogDescription>
              Update your campaign details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-campaign-name">
                Campaign Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-campaign-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., The Feywild Chronicles"
                className={formErrors.name ? "border-destructive" : ""}
              />
              {formErrors.name && (
                <p className="text-sm text-destructive">{formErrors.name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-campaign-description">Description</Label>
              <Textarea
                id="edit-campaign-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="A brief description of your campaign..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={closeDialogs}>
              Cancel
            </Button>
            <Button onClick={handleUpdateCampaign}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteConfirmCampaign}
        onOpenChange={(open) => !open && setDeleteConfirmCampaign(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Delete Campaign?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteConfirmCampaign?.name}&quot;? This action
              cannot be undone. All associated data will remain but will no longer be linked
              to this campaign.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCampaign}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
