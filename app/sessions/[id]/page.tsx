"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { ArrowLeft, Loader2, Sparkles, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { postAi } from "@/lib/ai-client"

type SessionDoc = Doc<"gameSessions">

type EditState = {
  number: number
  title: string
  date: string
  status: "planned" | "completed" | "cancelled"
  summary: string
  prepNotes: string
  playerRecap: string
  highlights: string
  plotThreads: string
  loot: string
  npcsEncountered: string
  locationsVisited: string
  xpAwarded: number
}

const toDateInputValue = (ms: number) => {
  const d = new Date(ms)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const fromDateInputValue = (str: string) => {
  if (!str) return Date.now()
  return new Date(`${str}T00:00:00`).getTime()
}

const draftFromSession = (s: SessionDoc): EditState => ({
  number: s.number,
  title: s.title,
  date: toDateInputValue(s.date),
  status: s.status,
  summary: s.summary ?? "",
  prepNotes: s.prepNotes ?? "",
  playerRecap: s.playerRecap ?? "",
  highlights: s.highlights.join("\n"),
  plotThreads: s.plotThreads.join("\n"),
  loot: s.loot.join("\n"),
  npcsEncountered: s.npcsEncountered.join("\n"),
  locationsVisited: s.locationsVisited.join("\n"),
  xpAwarded: s.xpAwarded ?? 0,
})

const linesToArray = (s: string) =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)

function FieldGroup({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2
          className="text-xs uppercase tracking-widest"
          style={{ color: "var(--scene-text-muted)" }}
        >
          {title}
        </h2>
        {action}
      </div>
      <div
        className="rounded-xl p-4 space-y-4"
        style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
      >
        {children}
      </div>
    </section>
  )
}

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const sessionId = id as Id<"gameSessions">
  const router = useRouter()

  const allSessions = useQuery(api.sessions.listSessions)
  const session = allSessions?.find((s) => s._id === sessionId) ?? null
  const plotThreadsAll = useQuery(api.sessions.listPlotThreads) ?? []
  const updateSession = useMutation(api.sessions.updateSession)
  const removeSession = useMutation(api.sessions.removeSession)

  const [draft, setDraft] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(false)

  const [generatingPrep, setGeneratingPrep] = useState(false)
  const [generatingSummary, setGeneratingSummary] = useState(false)
  const [generatingRecap, setGeneratingRecap] = useState(false)

  useEffect(() => {
    if (session && draft === null) setDraft(draftFromSession(session))
  }, [session, draft])

  if (allSessions === undefined) {
    return (
      <AppShell>
        <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl h-32"
              style={{ background: "var(--scene-surface)" }}
            />
          ))}
        </div>
      </AppShell>
    )
  }

  if (!session) {
    return (
      <AppShell>
        <div className="p-6 max-w-3xl mx-auto text-center">
          <p className="text-sm mb-4" style={{ color: "var(--scene-text-muted)" }}>
            Session not found.
          </p>
          <Link
            href="/sessions"
            className="text-sm hover:opacity-80 transition-opacity"
            style={{ color: "var(--scene-accent)" }}
          >
            ← Back to sessions
          </Link>
        </div>
      </AppShell>
    )
  }

  if (!draft) return null

  const setField = <K extends keyof EditState>(key: K, value: EditState[K]) =>
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev))

  const previousSession = allSessions
    .filter((s) => s.campaignId === session.campaignId && s.number < session.number)
    .sort((a, b) => b.number - a.number)[0]

  const handleGeneratePrep = async () => {
    setGeneratingPrep(true)
    try {
      const activeThreads = plotThreadsAll
        .filter(
          (t) =>
            t.campaignId === session.campaignId &&
            (t.status === "active" || t.status === "in-progress"),
        )
        .map((t) => ({ title: t.title, status: t.status }))
      const data = await postAi<{ prepNotes?: string }>("/api/session/generate-prep", {
        summary: previousSession?.summary ?? "",
        plotThreads: activeThreads,
        sessionNumber: previousSession?.number ?? session.number - 1,
      })
      if (data.prepNotes) setField("prepNotes", data.prepNotes)
      toast.success("Prep notes drafted.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't generate prep notes.")
    } finally {
      setGeneratingPrep(false)
    }
  }

  const handleGenerateSummary = async () => {
    setGeneratingSummary(true)
    try {
      const notes = [
        draft.prepNotes && { type: "prep", content: draft.prepNotes },
      ].filter(Boolean) as { type: string; content: string }[]
      const data = await postAi<{ summary?: string }>("/api/session/generate-summary", {
        notes,
        highlights: linesToArray(draft.highlights),
        sessionNumber: draft.number,
        title: draft.title,
      })
      if (data.summary) setField("summary", data.summary)
      toast.success("Summary drafted.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't generate summary.")
    } finally {
      setGeneratingSummary(false)
    }
  }

  const handleGenerateRecap = async () => {
    setGeneratingRecap(true)
    try {
      const data = await postAi<{ recap?: string }>("/api/session/generate-recap", {
        summary: draft.summary,
        highlights: linesToArray(draft.highlights),
        sessionNumber: draft.number,
        title: draft.title,
      })
      if (data.recap) setField("playerRecap", data.recap)
      toast.success("Player recap drafted.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't generate recap.")
    } finally {
      setGeneratingRecap(false)
    }
  }

  const handleSave = async () => {
    const title = draft.title.trim()
    if (!title) {
      toast.error("Session needs a title.")
      return
    }
    setSaving(true)
    try {
      await updateSession({
        id: sessionId,
        number: draft.number,
        title,
        date: fromDateInputValue(draft.date),
        status: draft.status,
        summary: draft.summary.trim() || undefined,
        prepNotes: draft.prepNotes.trim() || undefined,
        playerRecap: draft.playerRecap.trim() || undefined,
        highlights: linesToArray(draft.highlights),
        plotThreads: linesToArray(draft.plotThreads),
        loot: linesToArray(draft.loot),
        npcsEncountered: linesToArray(draft.npcsEncountered),
        locationsVisited: linesToArray(draft.locationsVisited),
        xpAwarded: draft.xpAwarded > 0 ? draft.xpAwarded : undefined,
      })
      toast.success("Session saved.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save session.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await removeSession({ id: sessionId })
      toast.success("Session removed.")
      router.push("/sessions")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove session.")
    } finally {
      setPendingDelete(false)
    }
  }

  const aiBtnStyle = {
    background: "color-mix(in srgb, var(--scene-accent) 12%, var(--scene-surface))",
    color: "var(--scene-accent)",
    border: "1px solid color-mix(in srgb, var(--scene-accent) 30%, var(--scene-border))",
  } as const

  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto pb-12">
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/sessions"
            className="inline-flex items-center gap-2 text-sm transition-opacity hover:opacity-80"
            style={{ color: "var(--scene-text-muted)" }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sessions
          </Link>
          <button
            onClick={() => setPendingDelete(true)}
            className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md transition-opacity hover:opacity-80"
            style={{
              background: "var(--scene-surface)",
              color: "var(--scene-text-muted)",
              border: "1px solid var(--scene-border)",
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>

        <div className="mb-6">
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
          >
            Session {draft.number}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--scene-text-muted)" }}>
            {draft.title || "Untitled"}
          </p>
        </div>

        <FieldGroup title="Basics">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="s-number">Number</Label>
              <Input
                id="s-number"
                type="number"
                min={1}
                value={draft.number}
                onChange={(e) => setField("number", Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-date">Date</Label>
              <Input
                id="s-date"
                type="date"
                value={draft.date}
                onChange={(e) => setField("date", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-status">Status</Label>
              <Select
                value={draft.status}
                onValueChange={(value) => setField("status", value as EditState["status"])}
              >
                <SelectTrigger id="s-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-title">Title</Label>
            <Input
              id="s-title"
              value={draft.title}
              onChange={(e) => setField("title", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-xp">XP awarded</Label>
            <Input
              id="s-xp"
              type="number"
              min={0}
              value={draft.xpAwarded}
              onChange={(e) => setField("xpAwarded", Math.max(0, Number(e.target.value) || 0))}
            />
          </div>
        </FieldGroup>

        <FieldGroup
          title="Prep notes"
          action={
            <button
              type="button"
              onClick={handleGeneratePrep}
              disabled={generatingPrep}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition-opacity hover:opacity-80 disabled:opacity-50"
              style={aiBtnStyle}
              title="Draft prep notes using the previous session's summary and active plot threads"
            >
              {generatingPrep ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {generatingPrep ? "Drafting…" : "AI draft"}
            </button>
          }
        >
          <Textarea
            rows={6}
            value={draft.prepNotes}
            onChange={(e) => setField("prepNotes", e.target.value)}
            placeholder="What to prepare, encounters, hooks…"
          />
        </FieldGroup>

        <FieldGroup
          title="Summary"
          action={
            <button
              type="button"
              onClick={handleGenerateSummary}
              disabled={generatingSummary}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition-opacity hover:opacity-80 disabled:opacity-50"
              style={aiBtnStyle}
              title="Draft a DM summary from your prep notes + highlights"
            >
              {generatingSummary ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {generatingSummary ? "Drafting…" : "AI draft"}
            </button>
          }
        >
          <Textarea
            rows={6}
            value={draft.summary}
            onChange={(e) => setField("summary", e.target.value)}
            placeholder="What happened in the session, for the DM's records."
          />
        </FieldGroup>

        <FieldGroup
          title="Player recap"
          action={
            <button
              type="button"
              onClick={handleGenerateRecap}
              disabled={generatingRecap}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition-opacity hover:opacity-80 disabled:opacity-50"
              style={aiBtnStyle}
              title="Draft a player-facing recap from the summary + highlights"
            >
              {generatingRecap ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {generatingRecap ? "Drafting…" : "AI draft"}
            </button>
          }
        >
          <Textarea
            rows={6}
            value={draft.playerRecap}
            onChange={(e) => setField("playerRecap", e.target.value)}
            placeholder="Share this with players before the next session."
          />
        </FieldGroup>

        <FieldGroup title="Highlights (one per line)">
          <Textarea
            rows={4}
            value={draft.highlights}
            onChange={(e) => setField("highlights", e.target.value)}
            placeholder={"Party freed the hostages\nAlric revealed his sister is alive"}
          />
        </FieldGroup>

        <FieldGroup title="Threads, loot, NPCs, locations">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="s-plot">Plot threads touched</Label>
              <Textarea
                id="s-plot"
                rows={3}
                value={draft.plotThreads}
                onChange={(e) => setField("plotThreads", e.target.value)}
                placeholder="One per line"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-loot">Loot</Label>
              <Textarea
                id="s-loot"
                rows={3}
                value={draft.loot}
                onChange={(e) => setField("loot", e.target.value)}
                placeholder="One per line"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-npcs">NPCs encountered</Label>
              <Textarea
                id="s-npcs"
                rows={3}
                value={draft.npcsEncountered}
                onChange={(e) => setField("npcsEncountered", e.target.value)}
                placeholder="One per line"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-locs">Locations visited</Label>
              <Textarea
                id="s-locs"
                rows={3}
                value={draft.locationsVisited}
                onChange={(e) => setField("locationsVisited", e.target.value)}
                placeholder="One per line"
              />
            </div>
          </div>
        </FieldGroup>

        <div className="flex items-center justify-end gap-3 mt-8 sticky bottom-4">
          <Button
            variant="outline"
            onClick={() => router.push("/sessions")}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      <AlertDialog open={pendingDelete} onOpenChange={setPendingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this session?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Session notes attached to it stay in the database but become orphaned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
