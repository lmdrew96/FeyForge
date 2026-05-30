"use client"

import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { AppShell } from "@/components/app-shell"
import { useCampaignStore } from "@/lib/campaign-store"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Plus, BookMarked, Check, Pencil, Trash2, UserPlus, Copy, RefreshCw, UserMinus, Crown } from "lucide-react"
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
import { type Edition, EDITIONS, DEFAULT_EDITION, EDITION_LABELS, EDITION_DESCRIPTIONS, resolveEdition } from "@/lib/editions"

type CampaignDraft = {
  name: string
  description: string
  edition: Edition
}

const EMPTY_DRAFT: CampaignDraft = { name: "", description: "", edition: DEFAULT_EDITION }

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
  const [inviteCampaignId, setInviteCampaignId] = useState<Id<"campaigns"> | null>(null)

  const inviteCampaign = campaigns?.find((c) => c._id === inviteCampaignId) ?? null

  const openCreate = () => {
    setEditingId(null)
    setDraft(EMPTY_DRAFT)
    setFormOpen(true)
  }

  const openEdit = (id: Id<"campaigns">, name: string, description?: string, edition?: string) => {
    setEditingId(id)
    setDraft({ name, description: description ?? "", edition: resolveEdition(edition) })
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
        await updateCampaign({ id: editingId, name, description, edition: draft.edition })
        toast.success("Campaign updated.")
      } else {
        const newId = await createCampaign({ name, description, isActive: true, edition: draft.edition })
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
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}
                          title="D&D ruleset for this campaign"
                        >
                          {EDITION_LABELS[resolveEdition(campaign.edition)]}
                        </span>
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
                        onClick={() => setInviteCampaignId(campaign._id)}
                        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-opacity hover:opacity-80"
                        style={{
                          background: "color-mix(in srgb, var(--scene-accent) 14%, transparent)",
                          color: "var(--scene-accent)",
                        }}
                        title="Invite players"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Invite
                      </button>
                      <button
                        onClick={() => openEdit(campaign._id, campaign.name, campaign.description, campaign.edition)}
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
            <div className="space-y-2">
              <Label>Ruleset</Label>
              <div className="grid grid-cols-2 gap-2">
                {EDITIONS.map((ed) => {
                  const active = draft.edition === ed
                  return (
                    <button
                      key={ed}
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, edition: ed }))}
                      className="rounded-md px-3 py-2 text-left transition-opacity hover:opacity-90"
                      style={{
                        background: active ? "color-mix(in srgb, var(--scene-accent) 16%, transparent)" : "var(--scene-surface)",
                        border: `1px solid ${active ? "color-mix(in srgb, var(--scene-accent) 45%, transparent)" : "var(--scene-border)"}`,
                      }}
                    >
                      <div className="text-sm font-medium" style={{ color: active ? "var(--scene-accent)" : "var(--scene-text-primary)" }}>
                        {EDITION_LABELS[ed]}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--scene-text-muted)" }}>
                        {EDITION_DESCRIPTIONS[ed]}
                      </div>
                    </button>
                  )
                })}
              </div>
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

      <Dialog open={inviteCampaign !== null} onOpenChange={(open) => !open && setInviteCampaignId(null)}>
        <DialogContent>
          {inviteCampaign && (
            <InviteDialogBody campaign={inviteCampaign} />
          )}
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

function InviteDialogBody({ campaign }: { campaign: Doc<"campaigns"> }) {
  const members = useQuery(api.campaignMembers.listMembers, { campaignId: campaign._id })
  const regenerate = useMutation(api.campaignMembers.regenerateJoinCode)
  const removeMember = useMutation(api.campaignMembers.removeMember)
  const [regenerating, setRegenerating] = useState(false)

  const code = campaign.joinCode ?? null
  const link =
    code && typeof window !== "undefined" ? `${window.location.origin}/session/join/${code}` : ""

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied.`)
    } catch {
      toast.error("Couldn't copy to clipboard.")
    }
  }

  const handleRegenerate = async () => {
    setRegenerating(true)
    try {
      await regenerate({ campaignId: campaign._id })
      toast.success("New invite code generated. The old link no longer works.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't regenerate the code.")
    } finally {
      setRegenerating(false)
    }
  }

  const handleRemove = async (memberId: Id<"campaignMembers">) => {
    try {
      await removeMember({ memberId })
      toast.success("Player removed.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove that player.")
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Invite players to {campaign.name}</DialogTitle>
        <DialogDescription>
          Share the code or link. Players sign in, pick a character, and join your party.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-5">
        {/* Code + link */}
        <div className="space-y-2">
          <Label>Invite code</Label>
          <div className="flex items-center gap-2">
            <code
              className="flex-1 px-3 py-2 rounded-md text-base font-mono tracking-widest text-center"
              style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
            >
              {code ?? "—"}
            </code>
            <Button variant="outline" size="icon" onClick={() => code && copy(code, "Code")} disabled={!code} title="Copy code">
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleRegenerate} disabled={regenerating} title="Regenerate code">
              <RefreshCw className={cn("h-4 w-4", regenerating && "animate-spin")} />
            </Button>
          </div>
          <button
            onClick={() => link && copy(link, "Invite link")}
            disabled={!link}
            className="text-xs underline underline-offset-2 transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ color: "var(--scene-accent)" }}
          >
            Copy invite link
          </button>
        </div>

        {/* Roster */}
        <div className="space-y-2">
          <Label>Party</Label>
          {members === undefined ? (
            <div className="h-12 rounded-md animate-pulse" style={{ background: "var(--scene-surface)" }} />
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div
                  key={m._id}
                  className="flex items-center gap-3 px-3 py-2 rounded-md"
                  style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
                >
                  {m.role === "dm" ? (
                    <Crown className="h-4 w-4 flex-shrink-0" style={{ color: "var(--scene-accent)" }} />
                  ) : (
                    <span className="h-4 w-4 flex-shrink-0 rounded-full" style={{ background: "var(--scene-border)" }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: "var(--scene-text-primary)" }}>
                      {m.character?.name ?? (m.role === "dm" ? "Dungeon Master" : "Player")}
                      {m.isMe && <span className="text-xs ml-1.5" style={{ color: "var(--scene-text-muted)" }}>(you)</span>}
                    </p>
                    <p className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
                      {m.role === "dm" ? "DM" : "Player"}
                    </p>
                  </div>
                  {m.role === "player" && (
                    <button
                      onClick={() => handleRemove(m._id)}
                      className="p-1.5 rounded transition-opacity hover:opacity-80"
                      style={{ color: "var(--scene-text-muted)" }}
                      title="Remove player"
                    >
                      <UserMinus className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
