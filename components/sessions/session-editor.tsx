"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSessionStore, type Session, type SessionNote } from "@/lib/session-store"
import { useRouter } from "next/navigation"
import { Save, Plus, X, Sparkles, BookOpen, Swords, MessageSquare, Gem, GitBranch, Clock, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"

interface SessionEditorProps {
  session?: Session
  isNew?: boolean
}

const noteTypeIcons = {
  narrative: BookOpen,
  combat: Swords,
  roleplay: MessageSquare,
  loot: Gem,
  decision: GitBranch,
}

const noteTypeColors = {
  narrative: "border-primary/50 bg-primary/10",
  combat: "border-destructive/50 bg-destructive/10",
  roleplay: "border-green-500/50 bg-green-500/10",
  loot: "border-yellow-500/50 bg-yellow-500/10",
  decision: "border-purple-500/50 bg-purple-500/10",
}

export function SessionEditor({ session, isNew = false }: SessionEditorProps) {
  const router = useRouter()
  const { addSession, updateSession, addNoteToSession } = useSessionStore()
  const sessions = useSessionStore((state) => state.sessions)

  const [formData, setFormData] = useState<Partial<Session>>({
    number: session?.number || sessions.length + 1,
    title: session?.title || "",
    date: session?.date || new Date(),
    status: session?.status || "planned",
    summary: session?.summary || "",
    prepNotes: session?.prepNotes || "",
    highlights: session?.highlights || [],
    loot: session?.loot || [],
    npcsEncountered: session?.npcsEncountered || [],
    locationsVisited: session?.locationsVisited || [],
    notes: session?.notes || [],
    plotThreads: session?.plotThreads || [],
    playerRecap: session?.playerRecap || "",
  })

  const [newHighlight, setNewHighlight] = useState("")
  const [newLoot, setNewLoot] = useState("")
  const [newNote, setNewNote] = useState("")
  const [noteType, setNoteType] = useState<SessionNote["type"]>("narrative")
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false)
  const [isGeneratingPrep, setIsGeneratingPrep] = useState(false)
  const [isGeneratingRecap, setIsGeneratingRecap] = useState(false)

  const handleSave = () => {
    if (isNew) {
      const id = addSession(formData as Omit<Session, "id" | "createdAt" | "updatedAt">)
      router.push(`/sessions/${id}`)
    } else if (session) {
      updateSession(session.id, formData)
    }
  }

  const addHighlight = () => {
    if (!newHighlight.trim()) return
    setFormData((prev) => ({
      ...prev,
      highlights: [...(prev.highlights || []), newHighlight.trim()],
    }))
    setNewHighlight("")
  }

  const removeHighlight = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      highlights: prev.highlights?.filter((_, i) => i !== index),
    }))
  }

  const addLoot = () => {
    if (!newLoot.trim()) return
    setFormData((prev) => ({
      ...prev,
      loot: [...(prev.loot || []), newLoot.trim()],
    }))
    setNewLoot("")
  }

  const removeLoot = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      loot: prev.loot?.filter((_, i) => i !== index),
    }))
  }

  const addNote = () => {
    if (!newNote.trim()) return
    const note: SessionNote = {
      id: crypto.randomUUID(),
      sessionId: session?.id || "",
      content: newNote.trim(),
      timestamp: new Date(),
      type: noteType,
    }
    setFormData((prev) => ({
      ...prev,
      notes: [...(prev.notes || []), note],
    }))
    setNewNote("")
  }

  const handleGenerateSummary = async () => {
    setIsGeneratingSummary(true)
    console.log("[v0] Generating session summary...")
    try {
      const response = await fetch("/api/session/generate-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: formData.notes,
          highlights: formData.highlights,
          sessionNumber: formData.number,
          title: formData.title,
        }),
      })

      if (!response.ok) throw new Error("Failed to generate summary")

      const data = await response.json()
      setFormData((prev) => ({ ...prev, summary: data.summary }))
      console.log("[v0] Generated summary length:", data.summary.length)
    } catch (error) {
      console.error("[v0] Summary generation error:", error)
      alert("Failed to generate summary. Please try again.")
    } finally {
      setIsGeneratingSummary(false)
    }
  }

  const handleGeneratePrep = async () => {
    setIsGeneratingPrep(true)
    console.log("[v0] Generating session prep...")
    try {
      const response = await fetch("/api/session/generate-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: formData.summary,
          plotThreads: formData.plotThreads,
          sessionNumber: formData.number,
          title: formData.title,
        }),
      })

      if (!response.ok) throw new Error("Failed to generate prep")

      const data = await response.json()
      setFormData((prev) => ({ ...prev, prepNotes: data.prepNotes }))
      console.log("[v0] Generated prep notes length:", data.prepNotes.length)
    } catch (error) {
      console.error("[v0] Prep generation error:", error)
      alert("Failed to generate prep notes. Please try again.")
    } finally {
      setIsGeneratingPrep(false)
    }
  }

  const handleGenerateRecap = async () => {
    setIsGeneratingRecap(true)
    console.log("[v0] Generating player recap...")
    try {
      const response = await fetch("/api/session/generate-recap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: formData.summary,
          highlights: formData.highlights,
          sessionNumber: formData.number,
          title: formData.title,
        }),
      })

      if (!response.ok) throw new Error("Failed to generate recap")

      const data = await response.json()
      setFormData((prev) => ({ ...prev, playerRecap: data.recap }))
      console.log("[v0] Generated recap length:", data.recap.length)
    } catch (error) {
      console.error("[v0] Recap generation error:", error)
      alert("Failed to generate recap. Please try again.")
    } finally {
      setIsGeneratingRecap(false)
    }
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="details" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3 bg-muted">
          <TabsTrigger value="details" className="data-[state=active]:bg-accent">
            Details
          </TabsTrigger>
          <TabsTrigger value="notes" className="data-[state=active]:bg-accent">
            Notes
          </TabsTrigger>
          <TabsTrigger value="prep" className="data-[state=active]:bg-accent">
            Prep
          </TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="mt-6 space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-serif text-foreground">Session Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-foreground">Session Number</Label>
                  <Input
                    type="number"
                    value={formData.number}
                    onChange={(e) => setFormData((prev) => ({ ...prev, number: Number.parseInt(e.target.value) || 1 }))}
                    className="bg-input border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(v) => setFormData((prev) => ({ ...prev, status: v as Session["status"] }))}
                  >
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="planned" className="focus:bg-accent">
                        Planned
                      </SelectItem>
                      <SelectItem value="completed" className="focus:bg-accent">
                        Completed
                      </SelectItem>
                      <SelectItem value="cancelled" className="focus:bg-accent">
                        Cancelled
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">Title</Label>
                <Input
                  placeholder="The Sunken Temple"
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  className="bg-input border-border"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Date
                  </Label>
                  <Input
                    type="date"
                    value={formData.date ? new Date(formData.date).toISOString().split("T")[0] : ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, date: new Date(e.target.value) }))}
                    className="bg-input border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Duration (minutes)
                  </Label>
                  <Input
                    type="number"
                    placeholder="240"
                    value={formData.duration || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, duration: Number.parseInt(e.target.value) || undefined }))
                    }
                    className="bg-input border-border"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">Summary</Label>
                <Textarea
                  placeholder="What happened this session..."
                  value={formData.summary}
                  onChange={(e) => setFormData((prev) => ({ ...prev, summary: e.target.value }))}
                  className="bg-input border-border min-h-[120px]"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateSummary}
                  disabled={isGeneratingSummary || (!formData.notes?.length && !formData.highlights?.length)}
                  className="w-full border-primary/50 text-primary hover:bg-primary/10 bg-transparent mt-2"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {isGeneratingSummary ? "Generating..." : "Generate Summary with AI"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Highlights */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-serif text-foreground">Session Highlights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Add a highlight..."
                  value={newHighlight}
                  onChange={(e) => setNewHighlight(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addHighlight()}
                  className="bg-input border-border"
                />
                <Button onClick={addHighlight} className="bg-primary hover:bg-primary/90">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.highlights?.map((highlight, i) => (
                  <Badge key={i} variant="outline" className="border-primary/50 text-foreground pr-1">
                    {highlight}
                    <button onClick={() => removeHighlight(i)} className="ml-2 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Loot */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-serif text-foreground flex items-center gap-2">
                <Gem className="h-5 w-5 text-primary" />
                Loot & Rewards
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Add loot..."
                  value={newLoot}
                  onChange={(e) => setNewLoot(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addLoot()}
                  className="bg-input border-border"
                />
                <Button onClick={addLoot} className="bg-primary hover:bg-primary/90">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {formData.loot?.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded bg-accent/30 border border-border"
                  >
                    <span className="text-foreground">{item}</span>
                    <button onClick={() => removeLoot(i)} className="text-muted-foreground hover:text-destructive">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="mt-6 space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-serif text-foreground">Session Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Note */}
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Select value={noteType} onValueChange={(v) => setNoteType(v as SessionNote["type"])}>
                    <SelectTrigger className="w-[140px] bg-input border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="narrative" className="focus:bg-accent">
                        Narrative
                      </SelectItem>
                      <SelectItem value="combat" className="focus:bg-accent">
                        Combat
                      </SelectItem>
                      <SelectItem value="roleplay" className="focus:bg-accent">
                        Roleplay
                      </SelectItem>
                      <SelectItem value="loot" className="focus:bg-accent">
                        Loot
                      </SelectItem>
                      <SelectItem value="decision" className="focus:bg-accent">
                        Decision
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  placeholder="Add a note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="bg-input border-border min-h-[100px]"
                />
                <Button onClick={addNote} className="w-full bg-primary hover:bg-primary/90">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Note
                </Button>
              </div>

              {/* Notes List */}
              <div className="space-y-3 pt-4 border-t border-border">
                {formData.notes?.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No notes yet. Start documenting your session!
                  </p>
                ) : (
                  formData.notes?.map((note) => {
                    const Icon = noteTypeIcons[note.type]
                    return (
                      <div key={note.id} className={cn("p-4 rounded-lg border", noteTypeColors[note.type])}>
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="h-4 w-4" />
                          <span className="text-xs font-medium capitalize">{note.type}</span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {new Date(note.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-foreground text-sm whitespace-pre-wrap">{note.content}</p>
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Prep Tab */}
        <TabsContent value="prep" className="mt-6 space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-serif text-foreground">Session Preparation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground">Prep Notes</Label>
                <Textarea
                  placeholder="What do you need to prepare for this session..."
                  value={formData.prepNotes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, prepNotes: e.target.value }))}
                  className="bg-input border-border min-h-[200px]"
                />
              </div>

              <Button
                variant="outline"
                onClick={handleGeneratePrep}
                disabled={isGeneratingPrep}
                className="w-full border-primary/50 text-primary hover:bg-primary/10 bg-transparent"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {isGeneratingPrep ? "Generating..." : "Generate Session Prep with AI"}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-serif text-foreground">Player Recap</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground">Last Session Recap</Label>
                <Textarea
                  placeholder="What happened last session (to share with players)..."
                  value={formData.playerRecap}
                  onChange={(e) => setFormData((prev) => ({ ...prev, playerRecap: e.target.value }))}
                  className="bg-input border-border min-h-[150px]"
                />
              </div>

              <Button
                variant="outline"
                onClick={handleGenerateRecap}
                disabled={isGeneratingRecap || !formData.summary}
                className="w-full border-primary/50 text-primary hover:bg-primary/10 bg-transparent"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {isGeneratingRecap ? "Generating..." : "Generate Recap with AI"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.back()} className="border-border bg-transparent">
          Cancel
        </Button>
        <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 border-glow">
          <Save className="h-4 w-4 mr-2" />
          {isNew ? "Create Session" : "Save Changes"}
        </Button>
      </div>
    </div>
  )
}
