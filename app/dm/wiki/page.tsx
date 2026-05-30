"use client"

import { useMemo, useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { AppShell } from "@/components/app-shell"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import { useCampaignStore } from "@/lib/campaign-store"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { ScrollText, Plus, Eye, EyeOff, Pencil, Trash2, ArrowLeft, Save, X } from "lucide-react"

type WikiEntry = Doc<"wikiEntries">
type EntryId = Id<"wikiEntries">
type CampaignId = Id<"campaigns">

const TYPES = ["lore", "faction", "location", "other"] as const
type WikiType = (typeof TYPES)[number]
const TYPE_LABEL: Record<string, string> = {
  lore: "Lore",
  faction: "Faction",
  location: "Location",
  other: "Other",
}

const emptyDraft = (): { name: string; type: WikiType; content: string } => ({
  name: "",
  type: "lore",
  content: "",
})

export default function WikiPage() {
  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId) as CampaignId | null
  const role = useQuery(
    api.campaignMembers.getMyRole,
    activeCampaignId ? { campaignId: activeCampaignId } : "skip",
  )
  const entries = useQuery(
    api.wiki.list,
    activeCampaignId ? { campaignId: activeCampaignId } : "skip",
  )

  const createEntry = useMutation(api.wiki.create)
  const updateEntry = useMutation(api.wiki.update)
  const removeEntry = useMutation(api.wiki.remove)
  const setRevealed = useMutation(api.wiki.setRevealed)

  const [selectedId, setSelectedId] = useState<EntryId | null>(null)
  const [mode, setMode] = useState<"view" | "edit" | "new">("view")
  const [draft, setDraft] = useState(emptyDraft())
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [saving, setSaving] = useState(false)

  const isDM = role === "dm"

  const filtered = useMemo(() => {
    const list = entries ?? []
    return typeFilter === "all" ? list : list.filter((e) => e.type === typeFilter)
  }, [entries, typeFilter])

  const selected = useMemo(
    () => (selectedId ? (entries ?? []).find((e) => e._id === selectedId) ?? null : null),
    [entries, selectedId],
  )

  const startNew = () => {
    setDraft(emptyDraft())
    setSelectedId(null)
    setMode("new")
  }

  const startEdit = (entry: WikiEntry) => {
    setDraft({ name: entry.name, type: (entry.type as WikiType) ?? "other", content: entry.content ?? "" })
    setSelectedId(entry._id)
    setMode("edit")
  }

  const handleSave = async () => {
    if (!draft.name.trim() || !activeCampaignId) return
    setSaving(true)
    try {
      if (mode === "new") {
        const id = await createEntry({
          campaignId: activeCampaignId,
          type: draft.type,
          name: draft.name.trim(),
          content: draft.content.trim() || undefined,
        })
        setSelectedId(id)
      } else if (mode === "edit" && selectedId) {
        await updateEntry({
          entryId: selectedId,
          type: draft.type,
          name: draft.name.trim(),
          content: draft.content.trim() || undefined,
        })
      }
      setMode("view")
      toast.success("Saved.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the entry.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (entry: WikiEntry) => {
    if (!confirm(`Delete "${entry.name}"? This can't be undone.`)) return
    try {
      await removeEntry({ entryId: entry._id })
      if (selectedId === entry._id) {
        setSelectedId(null)
        setMode("view")
      }
      toast.success("Entry deleted.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete the entry.")
    }
  }

  const handleToggleReveal = async (entry: WikiEntry) => {
    try {
      await setRevealed({ entryId: entry._id, isRevealed: !entry.isRevealed })
      toast.success(entry.isRevealed ? "Hidden from players." : "Revealed to players.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update visibility.")
    }
  }

  // ── Empty / loading states ───────────────────────────────────────────────────
  if (!activeCampaignId) {
    return (
      <AppShell>
        <WikiShell>
          <EmptyState
            title="No campaign selected"
            body="Pick an active campaign from the dashboard or campaigns page to view its wiki."
          />
        </WikiShell>
      </AppShell>
    )
  }

  const editing = mode === "edit" || mode === "new"

  return (
    <AppShell>
      <WikiShell>
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
              Campaign Wiki
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--scene-text-muted)" }}>
              {isDM
                ? "Document lore, factions, and locations. Reveal entries to share them with your players."
                : "Lore your DM has shared with the party."}
            </p>
          </div>
          {isDM && (
            <button
              onClick={startNew}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium shrink-0 transition-opacity hover:opacity-90"
              style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
            >
              <Plus className="h-4 w-4" />
              New Entry
            </button>
          )}
        </div>

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:gap-6 lg:items-start">
          {/* List pane */}
          <div className={cn(selected || editing ? "hidden lg:block" : "block")}>
            {/* Type filter */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {["all", ...TYPES].map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className="px-2.5 py-1 rounded-full text-xs font-medium transition-opacity hover:opacity-90"
                  style={{
                    background: typeFilter === t ? "var(--scene-accent)" : "var(--scene-surface)",
                    color: typeFilter === t ? "var(--scene-bg)" : "var(--scene-text-muted)",
                    border: `1px solid ${typeFilter === t ? "var(--scene-accent)" : "var(--scene-border)"}`,
                  }}
                >
                  {t === "all" ? "All" : TYPE_LABEL[t]}
                </button>
              ))}
            </div>

            {entries === undefined ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 rounded-lg animate-pulse" style={{ background: "var(--scene-surface)" }} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                title={isDM ? "No entries yet" : "Nothing shared yet"}
                body={isDM ? "Create your first wiki entry to start building your campaign's lore." : "Your DM hasn't revealed any wiki entries for this campaign yet."}
              />
            ) : (
              <div className="rounded-xl overflow-hidden" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
                <div className="max-h-[72vh] overflow-y-auto">
                  {filtered.map((entry, i) => (
                    <button
                      key={entry._id}
                      onClick={() => { setSelectedId(entry._id); setMode("view") }}
                      className="flex items-center gap-3 px-4 py-2.5 w-full text-left transition-opacity hover:opacity-80"
                      style={{
                        borderBottom: i < filtered.length - 1 ? "1px solid var(--scene-border)" : "none",
                        background: entry._id === selectedId ? "color-mix(in srgb, var(--scene-accent) 10%, transparent)" : "transparent",
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--scene-text-primary)" }}>{entry.name}</p>
                        <p className="text-xs truncate" style={{ color: "var(--scene-text-muted)" }}>{TYPE_LABEL[entry.type] ?? entry.type}</p>
                      </div>
                      {isDM && (
                        <span
                          onClick={(e) => { e.stopPropagation(); handleToggleReveal(entry) }}
                          title={entry.isRevealed ? "Revealed to players — click to hide" : "Hidden from players — click to reveal"}
                          className="p-1 rounded transition-transform active:scale-90 hover:opacity-80 shrink-0"
                          style={{ color: entry.isRevealed ? "var(--scene-accent)" : "var(--scene-text-muted)" }}
                        >
                          {entry.isRevealed ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Detail / editor pane */}
          <div className={cn(selected || editing ? "block" : "hidden lg:block")}>
            {editing && isDM ? (
              <Editor
                draft={draft}
                setDraft={setDraft}
                saving={saving}
                onSave={handleSave}
                onCancel={() => setMode("view")}
              />
            ) : selected ? (
              <EntryDetail
                entry={selected}
                isDM={isDM}
                onBack={() => setSelectedId(null)}
                onEdit={() => startEdit(selected)}
                onDelete={() => handleDelete(selected)}
                onToggleReveal={() => handleToggleReveal(selected)}
              />
            ) : (
              <div className="rounded-xl p-8 text-center hidden lg:block" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
                <ScrollText className="h-7 w-7 mx-auto mb-3" style={{ color: "var(--scene-text-muted)", opacity: 0.4 }} />
                <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
                  Select an entry to read it{isDM ? ", or create a new one." : "."}
                </p>
              </div>
            )}
          </div>
        </div>
      </WikiShell>
    </AppShell>
  )
}

// ── Pieces ───────────────────────────────────────────────────────────────────

function WikiShell({ children }: { children: React.ReactNode }) {
  return <div className="p-4 sm:p-6 max-w-6xl mx-auto pb-12">{children}</div>
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl p-8 text-center" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
      <ScrollText className="h-8 w-8 mx-auto mb-3" style={{ color: "var(--scene-text-muted)", opacity: 0.4 }} />
      <h2 className="text-base font-semibold mb-1" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>{title}</h2>
      <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>{body}</p>
    </div>
  )
}

function EntryDetail({
  entry, isDM, onBack, onEdit, onDelete, onToggleReveal,
}: {
  entry: WikiEntry
  isDM: boolean
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
  onToggleReveal: () => void
}) {
  return (
    <div className="rounded-xl p-5 lg:sticky lg:top-6" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
      <button onClick={onBack} className="lg:hidden inline-flex items-center gap-1.5 text-sm mb-3 hover:opacity-80" style={{ color: "var(--scene-text-muted)" }}>
        <ArrowLeft className="h-4 w-4" />
        Back to list
      </button>

      <div className="flex items-start justify-between gap-3 mb-1">
        <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>{entry.name}</h2>
        {isDM && (
          <div className="flex items-center gap-1 shrink-0">
            <IconButton title={entry.isRevealed ? "Revealed — hide from players" : "Hidden — reveal to players"} onClick={onToggleReveal} active={!!entry.isRevealed}>
              {entry.isRevealed ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </IconButton>
            <IconButton title="Edit" onClick={onEdit}><Pencil className="h-4 w-4" /></IconButton>
            <IconButton title="Delete" onClick={onDelete}><Trash2 className="h-4 w-4" /></IconButton>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}>
          {TYPE_LABEL[entry.type] ?? entry.type}
        </span>
        {isDM && (
          <span className="text-xs" style={{ color: entry.isRevealed ? "var(--scene-accent)" : "var(--scene-text-muted)" }}>
            {entry.isRevealed ? "Visible to players" : "DM-only"}
          </span>
        )}
      </div>

      <div className="max-h-[68vh] overflow-y-auto pr-1">
        {entry.content?.trim() ? (
          <MarkdownRenderer content={entry.content} variant="scene" />
        ) : (
          <p className="text-sm italic" style={{ color: "var(--scene-text-muted)" }}>No content yet.</p>
        )}
      </div>
    </div>
  )
}

function Editor({
  draft, setDraft, saving, onSave, onCancel,
}: {
  draft: { name: string; type: WikiType; content: string }
  setDraft: (d: { name: string; type: WikiType; content: string }) => void
  saving: boolean
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="rounded-xl p-5" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Entry name…"
            className="flex-1 px-3 py-2 rounded-md text-sm bg-transparent outline-none"
            style={{ border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
          />
          <select
            value={draft.type}
            onChange={(e) => setDraft({ ...draft, type: e.target.value as WikiType })}
            className="px-3 py-2 rounded-md text-sm outline-none cursor-pointer"
            style={{ background: "var(--scene-bg)", color: "var(--scene-text-primary)", border: "1px solid var(--scene-border)" }}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>{TYPE_LABEL[t]}</option>
            ))}
          </select>
        </div>

        <textarea
          value={draft.content}
          onChange={(e) => setDraft({ ...draft, content: e.target.value })}
          placeholder="Write the entry… markdown supported (**bold**, # headings, - lists, etc.)"
          rows={10}
          className="w-full px-3 py-2 rounded-md text-sm bg-transparent outline-none resize-y font-mono"
          style={{ border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
        />

        {draft.content.trim() && (
          <div className="rounded-md p-3" style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}>
            <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--scene-text-muted)" }}>Preview</p>
            <MarkdownRenderer content={draft.content} variant="scene" />
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={onSave}
            disabled={saving || !draft.name.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm transition-opacity hover:opacity-90"
            style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function IconButton({
  children, onClick, title, active,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1.5 rounded transition-opacity hover:opacity-80"
      style={{ color: active ? "var(--scene-accent)" : "var(--scene-text-muted)" }}
    >
      {children}
    </button>
  )
}
