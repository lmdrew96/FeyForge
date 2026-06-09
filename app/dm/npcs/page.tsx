"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { AppShell } from "@/components/app-shell"
import { useActiveCampaign } from "@/lib/hooks/use-campaign-data"
import { ALIGNMENTS } from "@/lib/character/constants"
import { partitionHomebrew, rawHomebrewId } from "@/lib/homebrew"
import { open5eApi, type Open5eMonster } from "@/lib/open5e-api"
import { toast } from "sonner"
import { postAi } from "@/lib/ai-client"
import Link from "next/link"
import { Plus, Sparkles, Loader2, Pencil, Trash2, Users, BookMarked, ChevronDown } from "lucide-react"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
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

// A persistent NPC's optional "fights as…" combat stat block link. Homebrew id is
// the raw Id<"homebrew">; matches convex/schema.ts statblockRefValidator.
type NpcStatblockRef =
  | { kind: "srd"; monsterName: string }
  | { kind: "homebrew"; homebrewId: Id<"homebrew"> }

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
  statblockRef: NpcStatblockRef | undefined
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
  statblockRef: undefined,
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
  statblockRef: n.statblockRef,
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

// ── Read-only expanded detail ───────────────────────────────────────────────
// Shown inline when a card is expanded. Prose fields run through the shared
// markdown renderer (NPC text is AI-generated and may contain markdown).

function DetailBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p
        className="text-[10px] font-semibold uppercase tracking-widest mb-0.5"
        style={{ color: "var(--scene-text-muted)" }}
      >
        {label}
      </p>
      {children}
    </div>
  )
}

const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const

function StatBlock({ stats }: { stats: NonNullable<NpcDoc["stats"]> }) {
  return (
    <DetailBlock label="Stat block">
      <div className="flex gap-3 text-xs mb-1.5" style={{ color: "var(--scene-text-primary)" }}>
        <span>CR {stats.cr}</span>
        <span>AC {stats.ac}</span>
        <span>HP {stats.hp}</span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 text-center">
        {ABILITY_KEYS.map((k) => (
          <div
            key={k}
            className="rounded p-1"
            style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}
          >
            <div className="text-[9px] uppercase" style={{ color: "var(--scene-text-muted)" }}>{k}</div>
            <div className="text-xs font-semibold" style={{ color: "var(--scene-text-primary)" }}>
              {stats.abilities[k]}
            </div>
          </div>
        ))}
      </div>
    </DetailBlock>
  )
}

function NpcExpanded({ npc }: { npc: NpcDoc }) {
  const facts: [string, string][] = [
    ["Age", npc.age],
    ["Gender", npc.gender],
    ["Alignment", npc.alignment],
    ["Faction", npc.faction ?? ""],
  ].filter((f): f is [string, string] => Boolean(f[1]))

  return (
    // Clicks inside the detail body shouldn't collapse the card — that lets the DM
    // select text or follow a markdown link. Collapse stays on the header / "Show
    // less" row, which sit outside this wrapper.
    <div
      className="mt-4 space-y-3 border-t pt-4"
      style={{ borderColor: "var(--scene-border)" }}
      onClick={(e) => e.stopPropagation()}
    >
      {facts.length > 0 && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {facts.map(([k, v]) => (
            <div key={k} className="text-xs">
              <span className="font-semibold" style={{ color: "var(--scene-text-muted)" }}>{k}: </span>
              <span style={{ color: "var(--scene-text-primary)" }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {npc.appearance && (
        <DetailBlock label="Appearance">
          <MarkdownRenderer variant="scene" content={npc.appearance} className="text-sm" />
        </DetailBlock>
      )}

      {npc.personality.length > 0 && (
        <DetailBlock label="Personality">
          <div className="flex flex-wrap gap-1">
            {npc.personality.map((t) => (
              <span
                key={t}
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}
              >
                {t}
              </span>
            ))}
          </div>
        </DetailBlock>
      )}

      {npc.mannerisms && (
        <DetailBlock label="Mannerisms">
          <MarkdownRenderer variant="scene" content={npc.mannerisms} className="text-sm" />
        </DetailBlock>
      )}
      {npc.voiceDescription && (
        <DetailBlock label="Voice">
          <MarkdownRenderer variant="scene" content={npc.voiceDescription} className="text-sm" />
        </DetailBlock>
      )}
      {npc.motivation && (
        <DetailBlock label="Motivation">
          <MarkdownRenderer variant="scene" content={npc.motivation} className="text-sm" />
        </DetailBlock>
      )}
      {npc.backstory && (
        <DetailBlock label="Backstory">
          <MarkdownRenderer variant="scene" content={npc.backstory} className="text-sm" />
        </DetailBlock>
      )}

      {npc.stats && <StatBlock stats={npc.stats} />}
      {npc.statblockRef && (
        <DetailBlock label="Combat">
          <p className="text-xs" style={{ color: "var(--scene-text-primary)" }}>
            Fights as {npc.statblockRef.kind === "srd" ? npc.statblockRef.monsterName : "a homebrew stat block"}
          </p>
        </DetailBlock>
      )}

      {npc.secret && (
        <div
          className="rounded-md p-2.5"
          style={{
            background: "color-mix(in srgb, var(--scene-accent) 10%, transparent)",
            border: "1px solid color-mix(in srgb, var(--scene-accent) 30%, transparent)",
          }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-0.5"
            style={{ color: "var(--scene-accent)" }}
          >
            Secret · DM only
          </p>
          <MarkdownRenderer variant="scene" content={npc.secret} className="text-sm" />
        </div>
      )}

      {npc.tags.length > 0 && (
        <DetailBlock label="Tags">
          <div className="flex flex-wrap gap-1">
            {npc.tags.map((t) => (
              <span
                key={t}
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}
              >
                {t}
              </span>
            ))}
          </div>
        </DetailBlock>
      )}

      {npc.notes && (
        <div className="rounded-md p-2.5" style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: "var(--scene-text-muted)" }}>
            DM notes
          </p>
          <MarkdownRenderer variant="scene" content={npc.notes} className="text-sm" />
        </div>
      )}
    </div>
  )
}

// Optional "fights as…" stat block picker for the NPC form. SRD = search the baked
// open5e monsters; Homebrew = pick from the DM's homebrew monster stat blocks. The
// chosen ref lets the NPC enter combat fighting from that stat block (Part B). Keyed
// by the editing NPC in the parent so its local mode resets per NPC.
function StatblockPicker({
  value,
  onChange,
}: {
  value: NpcStatblockRef | undefined
  onChange: (ref: NpcStatblockRef | undefined) => void
}) {
  const homebrewDocs = useQuery(api.homebrew.listForBuilder)
  const homebrewMonsters = useMemo(() => partitionHomebrew(homebrewDocs).monsters, [homebrewDocs])
  const [mode, setMode] = useState<"none" | "srd" | "homebrew">(value?.kind ?? "none")
  const [srdQuery, setSrdQuery] = useState("")
  const [srdMonsters, setSrdMonsters] = useState<Open5eMonster[]>([])
  const [srdLoading, setSrdLoading] = useState(false)
  const [srdLoaded, setSrdLoaded] = useState(false)

  const ensureSrd = () => {
    if (srdLoaded || srdLoading) return
    setSrdLoading(true)
    open5eApi
      .getMonsters()
      .then((m) => {
        setSrdMonsters(m)
        setSrdLoaded(true)
      })
      .catch(() => {})
      .finally(() => setSrdLoading(false))
  }

  const srdMatches = useMemo(() => {
    const q = srdQuery.trim().toLowerCase()
    if (!q) return []
    return srdMonsters.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 12)
  }, [srdQuery, srdMonsters])

  const selectMode = (m: "none" | "srd" | "homebrew") => {
    setMode(m)
    if (m === "none") onChange(undefined)
    if (m === "srd") ensureSrd()
  }

  const TABS = [
    { key: "none" as const, label: "No stat block" },
    { key: "srd" as const, label: "SRD monster" },
    { key: "homebrew" as const, label: "Homebrew" },
  ]

  return (
    <div className="space-y-2">
      <Label>
        Combat stat block{" "}
        <span style={{ color: "var(--scene-text-muted)" }}>· optional — lets this NPC join initiative</span>
      </Label>
      <div className="inline-flex rounded-md overflow-hidden" style={{ border: "1px solid var(--scene-border)" }}>
        {TABS.map((t) => {
          const on = mode === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => selectMode(t.key)}
              className="px-2.5 py-1 text-xs font-medium transition-colors"
              style={{ background: on ? "var(--scene-accent)" : "transparent", color: on ? "var(--scene-bg)" : "var(--scene-text-muted)" }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {mode === "srd" &&
        (value?.kind === "srd" && value.monsterName ? (
          <div className="flex items-center gap-2 text-sm">
            <span style={{ color: "var(--scene-text-primary)" }}>
              Fights as <strong>{value.monsterName}</strong>
            </span>
            <button type="button" onClick={() => onChange(undefined)} className="text-xs underline" style={{ color: "var(--scene-text-muted)" }}>
              change
            </button>
          </div>
        ) : (
          <div className="relative">
            <Input
              value={srdQuery}
              onFocus={ensureSrd}
              onChange={(e) => setSrdQuery(e.target.value)}
              placeholder={srdLoading ? "Loading SRD monsters…" : "Search SRD monsters (Bandit, Archmage…)"}
            />
            {srdQuery.trim() !== "" && srdMatches.length > 0 && (
              <div
                className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-md shadow-lg"
                style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
              >
                {srdMatches.map((m) => (
                  <button
                    key={m.slug}
                    type="button"
                    onClick={() => {
                      onChange({ kind: "srd", monsterName: m.name })
                      setSrdQuery("")
                    }}
                    className="w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 hover:opacity-80"
                    style={{ borderBottom: "1px solid var(--scene-border)" }}
                  >
                    <span style={{ color: "var(--scene-text-primary)" }}>{m.name}</span>
                    <span className="shrink-0 text-xs" style={{ color: "var(--scene-text-muted)" }}>
                      CR {m.challenge_rating} · AC {m.armor_class} · {m.hit_points} HP
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

      {mode === "homebrew" &&
        (homebrewMonsters.length > 0 ? (
          <Select
            value={value?.kind === "homebrew" ? value.homebrewId : ""}
            onValueChange={(id) => onChange({ kind: "homebrew", homebrewId: id as Id<"homebrew"> })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a homebrew stat block" />
            </SelectTrigger>
            <SelectContent>
              {homebrewMonsters.map((m) => (
                <SelectItem key={m.id} value={rawHomebrewId(m.id)}>
                  {m.name} · CR {m.challengeRating} · AC {m.armorClass} · {m.hitPoints} HP
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
            No homebrew monsters yet — create them in Homebrew.
          </p>
        ))}
    </div>
  )
}

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
  // Cards expand in place to reveal full details; multiple can be open at once.
  const [expandedIds, setExpandedIds] = useState<Set<Id<"npcs">>>(new Set())

  const toggleExpand = (id: Id<"npcs">) =>
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

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
        statblockRef: draft.statblockRef,
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
            {npcs.map((npc) => {
              const expanded = expandedIds.has(npc._id)
              return (
              <div
                key={npc._id}
                onClick={() => toggleExpand(npc._id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    toggleExpand(npc._id)
                  }
                }}
                role="button"
                tabIndex={0}
                aria-expanded={expanded}
                className="rounded-xl p-5 group relative cursor-pointer transition-colors focus:outline-none focus-visible:ring-2"
                style={{
                  background: "var(--scene-surface)",
                  border: "1px solid var(--scene-border)",
                }}
              >
                <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); openEdit(npc) }}
                    className="p-1.5 rounded"
                    style={{ color: "var(--scene-text-muted)" }}
                    title="Edit NPC"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setPendingDelete(npc._id) }}
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

                {/* Collapsed: a teaser of the motivation. Expanded: the full sheet. */}
                {!expanded && npc.motivation && (
                  <p className="text-xs mt-3 line-clamp-2" style={{ color: "var(--scene-text-muted)" }}>
                    {npc.motivation}
                  </p>
                )}
                {expanded && <NpcExpanded npc={npc} />}

                <div className="mt-3 flex items-center justify-center gap-1 text-[10px] uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
                  {expanded ? "Show less" : "Show details"}
                  <ChevronDown
                    className="h-3.5 w-3.5 transition-transform"
                    style={{ transform: expanded ? "rotate(180deg)" : "none" }}
                  />
                </div>
              </div>
              )
            })}
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

            <StatblockPicker
              key={editingId ?? "new"}
              value={draft.statblockRef}
              onChange={(ref) => setField("statblockRef", ref)}
            />
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
