"use client"

import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { AppShell } from "@/components/app-shell"
import { useActiveCampaign } from "@/lib/hooks/use-campaign-data"
import { toast } from "sonner"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, ScrollText, BookMarked } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  completed: "Completed",
  cancelled: "Cancelled",
}

const STATUS_COLORS: Record<string, string> = {
  planned: "var(--scene-accent)",
  completed: "var(--scene-text-muted)",
  cancelled: "#ef4444",
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

export default function SessionsPage() {
  const router = useRouter()
  const activeCampaign = useActiveCampaign()
  const campaignId = activeCampaign?._id
  const allSessions = useQuery(api.sessions.listSessions)
  const loading = allSessions === undefined
  const sessions = campaignId && allSessions
    ? allSessions
        .filter((s) => s.campaignId === campaignId)
        .sort((a, b) => (b.number ?? 0) - (a.number ?? 0))
    : []

  const createSession = useMutation(api.sessions.createSession)

  const [formOpen, setFormOpen] = useState(false)
  const [draftNumber, setDraftNumber] = useState(1)
  const [draftTitle, setDraftTitle] = useState("")
  const [draftDate, setDraftDate] = useState(toDateInputValue(Date.now()))
  const [draftStatus, setDraftStatus] = useState<"planned" | "completed" | "cancelled">("planned")
  const [saving, setSaving] = useState(false)

  const openCreate = () => {
    const nextNumber = sessions.length > 0 ? Math.max(...sessions.map((s) => s.number ?? 0)) + 1 : 1
    setDraftNumber(nextNumber)
    setDraftTitle("")
    setDraftDate(toDateInputValue(Date.now()))
    setDraftStatus("planned")
    setFormOpen(true)
  }

  const handleSave = async () => {
    if (!campaignId) {
      toast.error("Select an active campaign first.")
      return
    }
    const title = draftTitle.trim()
    if (!title) {
      toast.error("Give the session a title.")
      return
    }
    setSaving(true)
    try {
      const newId = await createSession({
        campaignId,
        number: draftNumber,
        title,
        date: fromDateInputValue(draftDate),
        status: draftStatus,
        plotThreads: [],
        highlights: [],
        loot: [],
        npcsEncountered: [],
        locationsVisited: [],
        objectives: [],
        plannedEncounters: [],
        plannedNPCs: [],
      })
      toast.success("Session created.")
      setFormOpen(false)
      router.push(`/sessions/${newId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create session.")
    } finally {
      setSaving(false)
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
              Sessions
            </h1>
            {activeCampaign && (
              <p className="text-sm mt-1" style={{ color: "var(--scene-text-muted)" }}>
                Campaign: {activeCampaign.name} · {sessions.length} session{sessions.length !== 1 ? "s" : ""}
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
              New Session
            </button>
          )}
        </div>

        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl h-24 animate-pulse"
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
              Activate a campaign to manage sessions.
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

        {!loading && activeCampaign && sessions.length === 0 && (
          <div
            className="rounded-xl p-12 text-center"
            style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
          >
            <ScrollText
              className="h-12 w-12 mx-auto mb-4"
              style={{ color: "var(--scene-text-muted)", opacity: 0.4 }}
            />
            <h2
              className="text-lg font-bold mb-2"
              style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
            >
              No sessions yet
            </h2>
            <p className="text-sm mb-6" style={{ color: "var(--scene-text-muted)" }}>
              Plan your first session — prep notes, recap, and summary can all be drafted with AI.
            </p>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
            >
              <Plus className="h-4 w-4" />
              Plan your first session
            </button>
          </div>
        )}

        {!loading && activeCampaign && sessions.length > 0 && (
          <div className="space-y-3">
            {sessions.map((session) => (
              <Link
                key={session._id}
                href={`/sessions/${session._id}`}
                className="block rounded-xl p-5 transition-opacity hover:opacity-90"
                style={{
                  background: "var(--scene-surface)",
                  border: "1px solid var(--scene-border)",
                }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="rounded-lg w-12 h-12 flex flex-col items-center justify-center shrink-0"
                    style={{
                      background: "color-mix(in srgb, var(--scene-accent) 12%, var(--scene-bg))",
                      border: "1px solid color-mix(in srgb, var(--scene-accent) 25%, transparent)",
                    }}
                  >
                    <div className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
                      S
                    </div>
                    <div
                      className="text-sm font-bold"
                      style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-accent)" }}
                    >
                      {session.number}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3
                        className="font-bold truncate"
                        style={{
                          fontFamily: "var(--font-cinzel)",
                          color: "var(--scene-text-primary)",
                        }}
                      >
                        {session.title}
                      </h3>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          background: "color-mix(in srgb, " + STATUS_COLORS[session.status] + " 16%, transparent)",
                          color: STATUS_COLORS[session.status],
                        }}
                      >
                        {STATUS_LABELS[session.status]}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "var(--scene-text-muted)" }}>
                      {new Date(session.date).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                    {session.summary && (
                      <p className="text-sm mt-2 line-clamp-2" style={{ color: "var(--scene-text-muted)" }}>
                        {session.summary}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New session</DialogTitle>
            <DialogDescription>
              Set the basics — you can fill in prep notes, summary, and recap inside the session.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="session-number">Number</Label>
                <Input
                  id="session-number"
                  type="number"
                  min={1}
                  value={draftNumber}
                  onChange={(e) => setDraftNumber(Math.max(1, Number(e.target.value) || 1))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="session-date">Date</Label>
                <Input
                  id="session-date"
                  type="date"
                  value={draftDate}
                  onChange={(e) => setDraftDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-title">Title</Label>
              <Input
                id="session-title"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="The Frostspine Crossing"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-status">Status</Label>
              <Select
                value={draftStatus}
                onValueChange={(value) => setDraftStatus(value as typeof draftStatus)}
              >
                <SelectTrigger id="session-status">
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
