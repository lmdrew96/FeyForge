"use client"

import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { AppShell } from "@/components/app-shell"
import { useCampaignStore } from "@/lib/campaign-store"
import { toast } from "sonner"
import { Plus, BookMarked, Check, Pencil, Trash2 } from "lucide-react"
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type CampaignDraft = {
  name: string
  description: string
}

const EMPTY_DRAFT: CampaignDraft = { name: "", description: "" }

export default function CampaignsPage() {
  const campaigns = useQuery(api.campaigns.list)
  const createCampaign = useMutation(api.campaigns.create)
  const updateCampaign = useMutation(api.campaigns.update)
  const removeCampaign = useMutation(api.campaigns.remove)

  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId)
  const setActiveCampaign = useCampaignStore((s) => s.setActiveCampaign)
  const resetActive = useCampaignStore((s) => s.reset)

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<Id<"campaigns"> | null>(null)
  const [draft, setDraft] = useState<CampaignDraft>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Id<"campaigns"> | null>(null)

  const openCreate = () => {
    setEditingId(null)
    setDraft(EMPTY_DRAFT)
    setFormOpen(true)
  }

  const openEdit = (id: Id<"campaigns">, name: string, description?: string) => {
    setEditingId(id)
    setDraft({ name, description: description ?? "" })
    setFormOpen(true)
  }

  const handleSave = async () => {
    const name = draft.name.trim()
    if (!name) {
      toast.error("Campaign needs a name.")
      return
    }
    setSaving(true)
    try {
      const description = draft.description.trim() || undefined
      if (editingId) {
        await updateCampaign({ id: editingId, name, description })
        toast.success("Campaign updated.")
      } else {
        const newId = await createCampaign({ name, description, isActive: true })
        setActiveCampaign(newId)
        toast.success("Campaign created.")
      }
      setFormOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save campaign.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: Id<"campaigns">) => {
    try {
      await removeCampaign({ id })
      if (activeCampaignId === id) {
        const next = campaigns?.find((c) => c._id !== id)
        if (next) setActiveCampaign(next._id)
        else resetActive()
      }
      toast.success("Campaign deleted.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete campaign.")
    } finally {
      setPendingDelete(null)
    }
  }

  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
            >
              Campaigns
            </h1>
            {campaigns && campaigns.length > 0 && (
              <p className="text-sm mt-1" style={{ color: "var(--scene-text-muted)" }}>
                {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80"
            style={{
              background: "var(--scene-accent)",
              color: "var(--scene-bg)",
            }}
          >
            <Plus className="h-4 w-4" />
            New Campaign
          </button>
        </div>

        {campaigns === undefined && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl animate-pulse h-24"
                style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
              />
            ))}
          </div>
        )}

        {campaigns && campaigns.length === 0 && (
          <div
            className="rounded-xl p-12 text-center"
            style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
          >
            <BookMarked
              className="h-12 w-12 mx-auto mb-4"
              style={{ color: "var(--scene-text-muted)", opacity: 0.4 }}
            />
            <h2
              className="text-lg font-bold mb-2"
              style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
            >
              No campaigns yet
            </h2>
            <p className="text-sm mb-6" style={{ color: "var(--scene-text-muted)" }}>
              Spin up your first campaign to organize NPCs, sessions, and the world.
            </p>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
            >
              <Plus className="h-4 w-4" />
              Create your first campaign
            </button>
          </div>
        )}

        {campaigns && campaigns.length > 0 && (
          <div className="space-y-3">
            {campaigns.map((campaign) => {
              const isActive = activeCampaignId === campaign._id
              return (
                <div
                  key={campaign._id}
                  className="rounded-xl p-5 group"
                  style={{
                    background: isActive
                      ? "color-mix(in srgb, var(--scene-accent) 6%, var(--scene-surface))"
                      : "var(--scene-surface)",
                    border: `1px solid ${
                      isActive
                        ? "color-mix(in srgb, var(--scene-accent) 30%, var(--scene-border))"
                        : "var(--scene-border)"
                    }`,
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3
                          className="font-bold truncate"
                          style={{
                            fontFamily: "var(--font-cinzel)",
                            color: "var(--scene-text-primary)",
                          }}
                        >
                          {campaign.name}
                        </h3>
                        {isActive && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                            style={{
                              background: "color-mix(in srgb, var(--scene-accent) 18%, transparent)",
                              color: "var(--scene-accent)",
                            }}
                          >
                            <Check className="h-3 w-3" />
                            Active
                          </span>
                        )}
                      </div>
                      {campaign.description && (
                        <p
                          className="text-sm"
                          style={{ color: "var(--scene-text-muted)" }}
                        >
                          {campaign.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!isActive && (
                        <button
                          onClick={() => setActiveCampaign(campaign._id)}
                          className="text-xs px-3 py-1.5 rounded-md transition-opacity hover:opacity-80"
                          style={{
                            background: "var(--scene-border)",
                            color: "var(--scene-text-primary)",
                          }}
                        >
                          Set active
                        </button>
                      )}
                      <button
                        onClick={() => openEdit(campaign._id, campaign.name, campaign.description)}
                        className="p-1.5 rounded transition-opacity hover:opacity-80"
                        style={{ color: "var(--scene-text-muted)" }}
                        title="Rename campaign"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setPendingDelete(campaign._id)}
                        className="p-1.5 rounded transition-opacity hover:opacity-80"
                        style={{ color: "var(--scene-text-muted)" }}
                        title="Delete campaign"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit campaign" : "New campaign"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update the campaign name or description."
                : "Name your campaign. You can add details now or later."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="campaign-name">Name</Label>
              <Input
                id="campaign-name"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="The Frostspine Expedition"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSave()
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaign-description">Description (optional)</Label>
              <Textarea
                id="campaign-description"
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="A short premise, the party's quest, or your DM notes."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editingId ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the campaign itself. Characters, NPCs, and sessions linked to it stay
              put but lose their campaign association.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && handleDelete(pendingDelete)}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  )
}
