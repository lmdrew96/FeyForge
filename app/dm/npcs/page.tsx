"use client"

import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { AppShell } from "@/components/app-shell"
import { useActiveCampaign } from "@/lib/hooks/use-campaign-data"
import { ALIGNMENTS } from "@/lib/character/constants"
import { toast } from "sonner"
import { postAi } from "@/lib/ai-client"
import Link from "next/link"
import { Plus, Sparkles, Loader2, Pencil, Trash2, Users, BookMarked } from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type NpcDoc = Doc<"npcs">

type NpcGenerated = {
  name: string
  race: string
  occupation: string
  age: string
  gender: string
  alignment: string
  appearance: string
  personality: string[]
  mannerisms: string
  voiceDescription: string
  motivation: string
  secret: string
  backstory: string
}

type NpcDraft = {
  name: string
  race: string
  occupation: string
  age: string
  gender: string
  alignment: string
  appearance: string
  personality: string
  mannerisms: string
  voiceDescription: string
  motivation: string
  secret: string
  backstory: string
  location: string
  faction: string
  relationship: string
  status: string
  tags: string
  notes: string
}

const RELATIONSHIPS = ["ally", "friendly", "neutral", "hostile", "enemy", "unknown"] as const
const STATUSES = ["alive", "dead", "missing", "unknown"] as const

const EMPTY_DRAFT: NpcDraft = {
  name: "",
  race: "",
  occupation: "",
  age: "",
  gender: "",
  alignment: "",
  appearance: "",
  personality: "",
  mannerisms: "",
  voiceDescription: "",
  motivation: "",
  secret: "",
  backstory: "",
  location: "",
  faction: "",
  relationship: "neutral",
  status: "alive",
  tags: "",
  notes: "",
}

const draftFromNpc = (n: NpcDoc): NpcDraft => ({
  name: n.name,
  race: n.race,
  occupation: n.occupation,
  age: n.age,
  gender: n.gender,
  alignment: n.alignment,
  appearance: n.appearance,
  personality: n.personality.join("\n"),
  mannerisms: n.mannerisms,
  voiceDescription: n.voiceDescription,
  motivation: n.motivation,
  secret: n.secret,
  backstory: n.backstory,
  location: n.location,
  faction: n.faction ?? "",
  relationship: n.relationship,
  status: n.status,
  tags: n.tags.join(", "),
  notes: n.notes ?? "",
})

const draftFromGenerated = (g: NpcGenerated, base: NpcDraft): NpcDraft => ({
  ...base,
  name: g.name || base.name,
  race: g.race || base.race,
  occupation: g.occupation || base.occupation,
  age: g.age || base.age,
  gender: g.gender || base.gender,
  alignment: g.alignment || base.alignment,
  appearance: g.appearance || base.appearance,
  personality: g.personality?.length ? g.personality.join("\n") : base.personality,
  mannerisms: g.mannerisms || base.mannerisms,
  voiceDescription: g.voiceDescription || base.voiceDescription,
  motivation: g.motivation || base.motivation,
  secret: g.secret || base.secret,
  backstory: g.backstory || base.backstory,
})

export default function NpcsPage() {
  const activeCampaign = useActiveCampaign()
  const campaignId = activeCampaign?._id
  const allNpcs = useQuery(api.npcs.list)
  const loading = allNpcs === undefined
  const npcs = campaignId && allNpcs ? allNpcs.filter((n) => n.campaignId === campaignId) : []

  const createNpc = useMutation(api.npcs.create)
  const updateNpc = useMutation(api.npcs.update)
  const removeNpc = useMutation(api.npcs.remove)

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<Id<"npcs"> | null>(null)
  const [draft, setDraft] = useState<NpcDraft>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Id<"npcs"> | null>(null)

  const setField = <K extends keyof NpcDraft>(key: K, value: NpcDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const openCreate = () => {
    setEditingId(null)
    setDraft(EMPTY_DRAFT)
    setFormOpen(true)
  }

  const openEdit = (npc: NpcDoc) => {
    setEditingId(npc._id)
    setDraft(draftFromNpc(npc))
    setFormOpen(true)
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const data = await postAi<{ npc?: NpcGenerated }>("/api/npc/generate", {
        prompt: draft.notes || undefined,
        location: draft.location || undefined,
        occupation: draft.occupation || undefined,
        race: draft.race || undefined,
      })
      const npc = data.npc
      if (!npc) throw new Error("No NPC returned")
      setDraft((prev) => draftFromGenerated(npc, prev))
      toast.success("AI-generated NPC ready to review.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't generate NPC.")
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async () => {
    if (!campaignId) {
      toast.error("Select an active campaign first.")
      return
    }
    const name = draft.name.trim()
    if (!name) {
      toast.error("NPC needs a name.")
      return
    }
    setSaving(true)
    try {
      const args = {
        name,
        race: draft.race.trim(),
        occupation: draft.occupation.trim(),
        age: draft.age.trim(),
        gender: draft.gender.trim(),
        alignment: draft.alignment.trim(),
        appearance: draft.appearance.trim(),
        personality: draft.personality
          .split("\n")
          .map((p) => p.trim())
          .filter(Boolean),
        mannerisms: draft.mannerisms.trim(),
        voiceDescription: draft.voiceDescription.trim(),
        motivation: draft.motivation.trim(),
        secret: draft.secret.trim(),
        backstory: draft.backstory.trim(),
        location: draft.location.trim(),
        faction: draft.faction.trim() || undefined,
        relationship: draft.relationship,
        status: draft.status,
        tags: draft.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        notes: draft.notes.trim() || undefined,
      }
      if (editingId) {
        await updateNpc({ id: editingId, ...args })
        toast.success("NPC updated.")
      } else {
        await createNpc({ campaignId, ...args })
        toast.success("NPC created.")
      }
      setFormOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save NPC.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: Id<"npcs">) => {
    try {
      await removeNpc({ id })
      toast.success("NPC removed.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove NPC.")
    } finally {
      setPendingDelete(null)
    }
  }

  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
            >
              NPCs
            </h1>
            {activeCampaign && (
              <p className="text-sm mt-1" style={{ color: "var(--scene-text-muted)" }}>
                Campaign: {activeCampaign.name} · {npcs.length} NPC{npcs.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          {activeCampaign && (
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
            >
              <Plus className="h-4 w-4" />
              New NPC
            </button>
          )}
        </div>

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl h-32 animate-pulse"
                style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
              />
            ))}
          </div>
        )}

        {!loading && !activeCampaign && (
          <div
            className="rounded-xl p-8 text-center"
            style={{ background: "var(--scene-surface)", border: "1px dashed var(--scene-border)" }}
          >
            <BookMarked
              className="h-10 w-10 mx-auto mb-3"
              style={{ color: "var(--scene-text-muted)", opacity: 0.5 }}
            />
            <p className="text-sm mb-4" style={{ color: "var(--scene-text-muted)" }}>
              Activate a campaign to manage NPCs.
            </p>
            <Link
              href="/campaigns"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
            >
              Go to campaigns
            </Link>
          </div>
        )}

        {!loading && activeCampaign && npcs.length === 0 && (
          <div
            className="rounded-xl p-12 text-center"
            style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
          >
            <Users
              className="h-12 w-12 mx-auto mb-4"
              style={{ color: "var(--scene-text-muted)", opacity: 0.4 }}
            />
            <h2
              className="text-lg font-bold mb-2"
              style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
            >
              No NPCs yet
            </h2>
            <p className="text-sm mb-6" style={{ color: "var(--scene-text-muted)" }}>
              Build your cast from scratch, or let AI generate one to get going.
            </p>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
            >
              <Plus className="h-4 w-4" />
              Add your first NPC
            </button>
          </div>
        )}

        {!loading && activeCampaign && npcs.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {npcs.map((npc) => (
              <div
                key={npc._id}
                className="rounded-xl p-5 group relative"
                style={{
                  background: "var(--scene-surface)",
                  border: "1px solid var(--scene-border)",
                }}
              >
                <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(npc)}
                    className="p-1.5 rounded"
                    style={{ color: "var(--scene-text-muted)" }}
                    title="Edit NPC"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setPendingDelete(npc._id)}
                    className="p-1.5 rounded"
                    style={{ color: "var(--scene-text-muted)" }}
                    title="Delete NPC"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <h3
                  className="font-bold truncate pr-12"
                  style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
                >
                  {npc.name}
                </h3>
                <p className="text-xs truncate" style={{ color: "var(--scene-text-muted)" }}>
                  {[npc.race, npc.occupation].filter(Boolean).join(" · ")}
                </p>
                <div className="flex items-center gap-2 flex-wrap mt-3">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      background: "color-mix(in srgb, var(--scene-accent) 14%, transparent)",
                      color: "var(--scene-accent)",
                    }}
                  >
                    {npc.relationship}
                  </span>
                  {npc.status && npc.status !== "alive" && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}
                    >
                      {npc.status}
                    </span>
                  )}
                  {npc.location && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}
                    >
                      {npc.location}
                    </span>
                  )}
                </div>
                {npc.motivation && (
                  <p className="text-xs mt-3 line-clamp-2" style={{ color: "var(--scene-text-muted)" }}>
                    {npc.motivation}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit NPC" : "New NPC"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update this NPC's details."
                : "Fill in fields manually, or let AI generate a draft you can refine."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating || saving}
                className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-md transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{
                  background: "color-mix(in srgb, var(--scene-accent) 12%, var(--scene-surface))",
                  color: "var(--scene-accent)",
                  border: "1px solid color-mix(in srgb, var(--scene-accent) 30%, var(--scene-border))",
                }}
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {generating ? "Thinking…" : editingId ? "Re-roll with AI" : "Generate with AI"}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="npc-name">Name</Label>
                <Input
                  id="npc-name"
                  value={draft.name}
                  onChange={(e) => setField("name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="npc-race">Race</Label>
                <Input
                  id="npc-race"
                  value={draft.race}
                  onChange={(e) => setField("race", e.target.value)}
                  placeholder="Human, Elf, Tiefling…"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="npc-occupation">Occupation</Label>
                <Input
                  id="npc-occupation"
                  value={draft.occupation}
                  onChange={(e) => setField("occupation", e.target.value)}
                  placeholder="Innkeeper, Captain, Sage…"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="npc-location">Location</Label>
                <Input
                  id="npc-location"
                  value={draft.location}
                  onChange={(e) => setField("location", e.target.value)}
                  placeholder="Where the party meets them"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="npc-age">Age</Label>
                <Input
                  id="npc-age"
                  value={draft.age}
                  onChange={(e) => setField("age", e.target.value)}
                  placeholder="young adult, elderly…"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="npc-gender">Gender</Label>
                <Input
                  id="npc-gender"
                  value={draft.gender}
                  onChange={(e) => setField("gender", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="npc-alignment">Alignment</Label>
                <Select
                  value={draft.alignment || ""}
                  onValueChange={(value) => setField("alignment", value)}
                >
                  <SelectTrigger id="npc-alignment">
                    <SelectValue placeholder="Choose alignment" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALIGNMENTS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="npc-faction">Faction</Label>
                <Input
                  id="npc-faction"
                  value={draft.faction}
                  onChange={(e) => setField("faction", e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="npc-relationship">Relationship to party</Label>
                <Select
                  value={draft.relationship}
                  onValueChange={(value) => setField("relationship", value)}
                >
                  <SelectTrigger id="npc-relationship">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIPS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="npc-status">Status</Label>
                <Select
                  value={draft.status}
                  onValueChange={(value) => setField("status", value)}
                >
                  <SelectTrigger id="npc-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="npc-appearance">Appearance</Label>
              <Textarea
                id="npc-appearance"
                rows={2}
                value={draft.appearance}
                onChange={(e) => setField("appearance", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="npc-personality">Personality (one per line)</Label>
              <Textarea
                id="npc-personality"
                rows={3}
                value={draft.personality}
                onChange={(e) => setField("personality", e.target.value)}
                placeholder="Loyal to a fault&#10;Hates injustice&#10;Tells terrible jokes"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="npc-mannerisms">Mannerisms</Label>
                <Textarea
                  id="npc-mannerisms"
                  rows={2}
                  value={draft.mannerisms}
                  onChange={(e) => setField("mannerisms", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="npc-voice">Voice</Label>
                <Textarea
                  id="npc-voice"
                  rows={2}
                  value={draft.voiceDescription}
                  onChange={(e) => setField("voiceDescription", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="npc-motivation">Motivation</Label>
                <Textarea
                  id="npc-motivation"
                  rows={2}
                  value={draft.motivation}
                  onChange={(e) => setField("motivation", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="npc-secret">Secret</Label>
                <Textarea
                  id="npc-secret"
                  rows={2}
                  value={draft.secret}
                  onChange={(e) => setField("secret", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="npc-backstory">Backstory</Label>
              <Textarea
                id="npc-backstory"
                rows={4}
                value={draft.backstory}
                onChange={(e) => setField("backstory", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="npc-tags">Tags (comma-separated)</Label>
              <Input
                id="npc-tags"
                value={draft.tags}
                onChange={(e) => setField("tags", e.target.value)}
                placeholder="quest-giver, merchant, ally"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="npc-notes">DM notes</Label>
              <Textarea
                id="npc-notes"
                rows={3}
                value={draft.notes}
                onChange={(e) => setField("notes", e.target.value)}
                placeholder="Hooks, plot threads, or notes only the DM should see."
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
            <AlertDialogTitle>Delete this NPC?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone.
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
