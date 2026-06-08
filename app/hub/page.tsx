"use client"

import { useEffect, useState, type ReactNode, type ElementType, type FormEvent } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { AppShell } from "@/components/app-shell"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import { useCampaignStore } from "@/lib/campaign-store"
import { toast } from "sonner"
import { BookText, ScrollText, Eye, Pencil, Save, ListChecks, Users, Plus, Trash2, Check, X } from "lucide-react"

// The Player Campaign Hub — a player's between-sessions home. Slice 1 surfaces
// two tabs: Journal (a persistent, campaign-scoped markdown notebook private to
// the member) and Recaps (the DM-authored playerRecaps, read-only). Mirrors the
// wiki page's shell/markdown/campaign-resolution conventions.

type CampaignId = Id<"campaigns">
type HubTab = "journal" | "quests" | "recaps" | "people"
const TAB_STORAGE_KEY = "feyforge:hub-tab"
const HUB_TABS: readonly HubTab[] = ["journal", "quests", "recaps", "people"]

function HubShell({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">{children}</div>
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div
      className="rounded-lg border border-dashed p-8 text-center"
      style={{ borderColor: "var(--scene-border)" }}
    >
      <p className="text-base font-semibold" style={{ color: "var(--scene-text-primary)" }}>
        {title}
      </p>
      <p className="mt-1 text-sm" style={{ color: "var(--scene-text-muted)" }}>
        {body}
      </p>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: ElementType
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors"
      style={{
        color: active ? "var(--scene-accent)" : "var(--scene-text-muted)",
        borderColor: active ? "var(--scene-accent)" : "transparent",
      }}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}

function SegButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: ElementType
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors"
      style={{
        background: active ? "var(--scene-bg)" : "transparent",
        color: active ? "var(--scene-accent)" : "var(--scene-text-muted)",
        border: `1px solid ${active ? "var(--scene-border)" : "transparent"}`,
      }}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}

export default function HubPage() {
  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId) as CampaignId | null
  const [tab, setTab] = useState<HubTab>("journal")

  // Restore the last-used tab (client-only).
  useEffect(() => {
    const saved = localStorage.getItem(TAB_STORAGE_KEY)
    if (saved && (HUB_TABS as readonly string[]).includes(saved)) setTab(saved as HubTab)
  }, [])

  const selectTab = (t: HubTab) => {
    setTab(t)
    localStorage.setItem(TAB_STORAGE_KEY, t)
  }

  if (!activeCampaignId) {
    return (
      <AppShell>
        <HubShell>
          <EmptyState
            title="No campaign selected"
            body="Pick an active campaign from the dashboard or campaigns page to open your hub."
          />
        </HubShell>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <HubShell>
        <div className="mb-5">
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
          >
            Campaign Hub
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--scene-text-muted)" }}>
            Your campaign journal and the recaps your DM has shared.
          </p>
        </div>

        <div className="flex gap-1 mb-5 border-b overflow-x-auto" style={{ borderColor: "var(--scene-border)" }}>
          <TabButton active={tab === "journal"} onClick={() => selectTab("journal")} icon={BookText} label="Journal" />
          <TabButton active={tab === "quests"} onClick={() => selectTab("quests")} icon={ListChecks} label="Quests" />
          <TabButton active={tab === "recaps"} onClick={() => selectTab("recaps")} icon={ScrollText} label="Recaps" />
          <TabButton active={tab === "people"} onClick={() => selectTab("people")} icon={Users} label="People" />
        </div>

        {/* Keyed by campaign so editor/draft state resets cleanly on a campaign switch. */}
        {tab === "journal" && <JournalTab key={activeCampaignId} campaignId={activeCampaignId} />}
        {tab === "quests" && <QuestsTab key={activeCampaignId} campaignId={activeCampaignId} />}
        {tab === "recaps" && <RecapsTab key={activeCampaignId} campaignId={activeCampaignId} />}
        {tab === "people" && <PeopleTab key={activeCampaignId} campaignId={activeCampaignId} />}
      </HubShell>
    </AppShell>
  )
}

function JournalTab({ campaignId }: { campaignId: CampaignId }) {
  const journal = useQuery(api.campaignJournal.get, { campaignId })
  const upsert = useMutation(api.campaignJournal.upsert)

  const [mode, setMode] = useState<"write" | "preview">("write")
  const [draft, setDraft] = useState("")
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  // Seed the editor once the journal resolves (undefined = loading, null = none
  // yet). Seed only once so a reactive refetch never clobbers unsaved edits.
  useEffect(() => {
    if (!loaded && journal !== undefined) {
      setDraft(journal?.content ?? "")
      setLoaded(true)
    }
  }, [journal, loaded])

  if (journal === undefined) {
    return (
      <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
        Loading…
      </p>
    )
  }

  const saved = journal?.content ?? ""
  const dirty = loaded && draft !== saved

  const handleSave = async () => {
    if (saving || !dirty) return
    setSaving(true)
    try {
      await upsert({ campaignId, content: draft })
      toast.success("Journal saved")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save your journal")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex gap-1">
          <SegButton active={mode === "write"} onClick={() => setMode("write")} icon={Pencil} label="Write" />
          <SegButton active={mode === "preview"} onClick={() => setMode("preview")} icon={Eye} label="Preview" />
        </div>
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : dirty ? "Save" : "Saved"}
        </button>
      </div>

      {mode === "write" ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Keep a running journal of your adventures — sessions, clues, NPCs you've met, theories. Markdown supported."
          className="w-full min-h-[55vh] resize-y rounded-md p-3 text-sm leading-relaxed outline-none"
          style={{
            background: "var(--scene-surface)",
            border: "1px solid var(--scene-border)",
            color: "var(--scene-text-primary)",
          }}
        />
      ) : draft.trim() ? (
        <div
          className="rounded-md p-4 min-h-[55vh]"
          style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
        >
          <MarkdownRenderer content={draft} />
        </div>
      ) : (
        <EmptyState title="Nothing to preview" body="Switch to Write and start your journal." />
      )}
    </div>
  )
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function RecapsTab({ campaignId }: { campaignId: CampaignId }) {
  const recaps = useQuery(api.sessions.listRecapsForCampaign, { campaignId })

  if (recaps === undefined) {
    return (
      <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
        Loading…
      </p>
    )
  }

  if (recaps.length === 0) {
    return (
      <EmptyState
        title="No recaps yet"
        body="Your DM hasn't shared any session recaps. They'll appear here after each session."
      />
    )
  }

  // Newest first — the common need is "what happened last time."
  const ordered = [...recaps].reverse()

  return (
    <div className="space-y-4">
      {ordered.map((r) => (
        <div
          key={r._id}
          className="rounded-md p-4"
          style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
        >
          <div className="flex items-baseline justify-between gap-3 mb-2">
            <h2
              className="text-base font-semibold"
              style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
            >
              Session {r.number}: {r.title}
            </h2>
            <span className="text-xs shrink-0" style={{ color: "var(--scene-text-muted)" }}>
              {formatDate(r.date)}
            </span>
          </div>
          {r.summary && (
            <p className="text-sm italic mb-2" style={{ color: "var(--scene-text-muted)" }}>
              {r.summary}
            </p>
          )}
          <MarkdownRenderer content={r.playerRecap} />
        </div>
      ))}
    </div>
  )
}

function QuestsTab({ campaignId }: { campaignId: CampaignId }) {
  const quests = useQuery(api.campaignQuests.list, { campaignId })
  const addQuest = useMutation(api.campaignQuests.add)

  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    const t = text.trim()
    if (!t || busy) return
    setBusy(true)
    try {
      await addQuest({ campaignId, text: t })
      setText("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add that quest")
    } finally {
      setBusy(false)
    }
  }

  const active = quests?.filter((q) => !q.done) ?? []
  const done = quests?.filter((q) => q.done) ?? []

  return (
    <div>
      <form onSubmit={handleAdd} className="flex gap-2 mb-4">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add an objective — a lead to chase, a promise to keep…"
          className="flex-1 rounded-md px-3 py-2 text-sm outline-none"
          style={{
            background: "var(--scene-surface)",
            border: "1px solid var(--scene-border)",
            color: "var(--scene-text-primary)",
          }}
        />
        <button
          type="submit"
          disabled={!text.trim() || busy}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-40 shrink-0"
          style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </form>

      {quests === undefined ? (
        <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
          Loading…
        </p>
      ) : quests.length === 0 ? (
        <EmptyState
          title="No quests yet"
          body="Track what your party is up to — add objectives and check them off as you go."
        />
      ) : (
        <div className="space-y-1.5">
          {active.map((q) => (
            <QuestRow key={q._id} quest={q} />
          ))}
          {done.length > 0 && (
            <>
              <p
                className="text-xs uppercase tracking-wide mt-5 mb-1.5"
                style={{ color: "var(--scene-text-muted)" }}
              >
                Completed
              </p>
              {done.map((q) => (
                <QuestRow key={q._id} quest={q} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function QuestRow({ quest }: { quest: { _id: Id<"campaignQuests">; text: string; done: boolean } }) {
  const toggle = useMutation(api.campaignQuests.toggle)
  const update = useMutation(api.campaignQuests.update)
  const remove = useMutation(api.campaignQuests.remove)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(quest.text)

  const saveEdit = async () => {
    const t = draft.trim()
    if (!t) return
    if (t !== quest.text) {
      try {
        await update({ id: quest._id, text: t })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't save")
        return
      }
    }
    setEditing(false)
  }

  if (editing) {
    return (
      <div
        className="flex items-center gap-2 rounded-md px-2 py-1.5"
        style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
      >
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void saveEdit()
            if (e.key === "Escape") {
              setDraft(quest.text)
              setEditing(false)
            }
          }}
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: "var(--scene-text-primary)" }}
        />
        <button onClick={() => void saveEdit()} aria-label="Save" className="p-1 rounded hover:opacity-80" style={{ color: "var(--scene-accent)" }}>
          <Check className="h-4 w-4" />
        </button>
        <button
          onClick={() => {
            setDraft(quest.text)
            setEditing(false)
          }}
          aria-label="Cancel"
          className="p-1 rounded hover:opacity-80"
          style={{ color: "var(--scene-text-muted)" }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="group flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-[var(--scene-surface)]">
      <button
        onClick={() => void toggle({ id: quest._id })}
        aria-label={quest.done ? "Mark not done" : "Mark done"}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors"
        style={{
          borderColor: quest.done ? "var(--scene-accent)" : "var(--scene-border)",
          background: quest.done ? "var(--scene-accent)" : "transparent",
          color: "var(--scene-bg)",
        }}
      >
        {quest.done && <Check className="h-3.5 w-3.5" />}
      </button>
      <button
        onDoubleClick={() => setEditing(true)}
        className="flex-1 text-left text-sm"
        style={{
          color: quest.done ? "var(--scene-text-muted)" : "var(--scene-text-primary)",
          textDecoration: quest.done ? "line-through" : undefined,
        }}
      >
        {quest.text}
      </button>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button onClick={() => setEditing(true)} aria-label="Edit" className="p-1 rounded hover:opacity-80" style={{ color: "var(--scene-text-muted)" }}>
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => void remove({ id: quest._id })} aria-label="Delete" className="p-1 rounded hover:opacity-80" style={{ color: "var(--scene-text-muted)" }}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

function PeopleTab({ campaignId }: { campaignId: CampaignId }) {
  const people = useQuery(api.liveSessions.listMetNpcsForCampaign, { campaignId })

  if (people === undefined) {
    return (
      <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
        Loading…
      </p>
    )
  }

  if (people.length === 0) {
    return (
      <EmptyState
        title="No one yet"
        body="NPCs your DM introduces during a session will show up here, so you can remember who you've met."
      />
    )
  }

  return (
    <div className="space-y-3">
      {people.map((p) => (
        <div
          key={p.title}
          className="flex gap-3 rounded-md p-3"
          style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
        >
          {p.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.imageUrl}
              alt={p.title}
              className="h-14 w-14 shrink-0 rounded-md object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold" style={{ color: "var(--scene-text-primary)" }}>
              {p.title}
            </h3>
            {p.body && (
              <div className="mt-0.5 text-sm" style={{ color: "var(--scene-text-muted)" }}>
                <MarkdownRenderer content={p.body} />
              </div>
            )}
            <p className="mt-1 text-xs" style={{ color: "var(--scene-text-muted)" }}>
              Last seen {formatDate(p.lastSeen)}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
