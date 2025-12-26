"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useSessionStore, type Session, type SessionNote, type SessionObjective, type PlannedEncounter } from "@/lib/session-store"
import { useCampaignSessions, useActiveCampaignId, useCampaignNPCs } from "@/lib/hooks/use-campaign-data"
import { open5eApi, type Open5eMonster } from "@/lib/open5e-api"
import { useRouter } from "next/navigation"
import { Save, Plus, X, Sparkles, BookOpen, Swords, MessageSquare, Gem, GitBranch, Clock, Calendar, Target, Users, Skull, ChevronDown, ChevronUp, Search, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { XPCalculator } from "./xp-calculator"

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

const difficultyColors = {
  trivial: "text-gray-400",
  easy: "text-green-500",
  medium: "text-yellow-500",
  hard: "text-orange-500",
  deadly: "text-red-500",
}

const priorityColors = {
  primary: "border-primary bg-primary/10",
  secondary: "border-blue-500/50 bg-blue-500/10",
  optional: "border-muted-foreground/30 bg-muted/10",
}

export function SessionEditor({ session, isNew = false }: SessionEditorProps) {
  const router = useRouter()
  const { addSession, updateSession, addNoteToSession } = useSessionStore()
  const sessions = useCampaignSessions()
  const activeCampaignId = useActiveCampaignId()
  const campaignNPCs = useCampaignNPCs()

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
    objectives: session?.objectives || [],
    plannedEncounters: session?.plannedEncounters || [],
    plannedNPCs: session?.plannedNPCs || [],
    xpAwarded: session?.xpAwarded,
  })

  const [newHighlight, setNewHighlight] = useState("")
  const [newLoot, setNewLoot] = useState("")
  const [newNote, setNewNote] = useState("")
  const [noteType, setNoteType] = useState<SessionNote["type"]>("narrative")
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false)
  const [isGeneratingPrep, setIsGeneratingPrep] = useState(false)
  const [isGeneratingRecap, setIsGeneratingRecap] = useState(false)

  // New state for objectives
  const [newObjective, setNewObjective] = useState("")
  const [objectivePriority, setObjectivePriority] = useState<SessionObjective["priority"]>("primary")

  // New state for encounters
  const [showEncounterForm, setShowEncounterForm] = useState(false)
  const [encounterName, setEncounterName] = useState("")
  const [encounterDescription, setEncounterDescription] = useState("")
  const [encounterDifficulty, setEncounterDifficulty] = useState<PlannedEncounter["difficulty"]>("medium")
  const [monsterSearch, setMonsterSearch] = useState("")
  const [searchResults, setSearchResults] = useState<Open5eMonster[]>([])
  const [selectedMonsters, setSelectedMonsters] = useState<Open5eMonster[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // Search monsters from Open5e
  useEffect(() => {
    if (!monsterSearch.trim()) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await open5eApi.getMonsters({ search: monsterSearch })
        setSearchResults(results.slice(0, 10))
      } catch (error) {
        console.error("Monster search failed:", error)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [monsterSearch])

  const handleSave = () => {
    if (isNew) {
      const sessionData = {
        ...formData,
        campaignId: activeCampaignId || "",
      } as Omit<Session, "id" | "createdAt" | "updatedAt">
      const id = addSession(sessionData)
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

  // Objective helpers
  const addObjective = () => {
    if (!newObjective.trim()) return
    const objective: SessionObjective = {
      id: crypto.randomUUID(),
      text: newObjective.trim(),
      completed: false,
      priority: objectivePriority,
    }
    setFormData((prev) => ({
      ...prev,
      objectives: [...(prev.objectives || []), objective],
    }))
    setNewObjective("")
  }

  const toggleObjective = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      objectives: prev.objectives?.map((obj) =>
        obj.id === id ? { ...obj, completed: !obj.completed } : obj
      ),
    }))
  }

  const removeObjective = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      objectives: prev.objectives?.filter((obj) => obj.id !== id),
    }))
  }

  // Encounter helpers
  const addEncounter = () => {
    if (!encounterName.trim()) return
    const encounter: PlannedEncounter = {
      id: crypto.randomUUID(),
      name: encounterName.trim(),
      description: encounterDescription.trim() || undefined,
      difficulty: encounterDifficulty,
      monsterSlugs: selectedMonsters.map((m) => m.slug),
      status: "planned",
      xpReward: selectedMonsters.reduce((sum, m) => sum + getXPByCR(m.cr), 0),
    }
    setFormData((prev) => ({
      ...prev,
      plannedEncounters: [...(prev.plannedEncounters || []), encounter],
    }))
    // Reset form
    setEncounterName("")
    setEncounterDescription("")
    setEncounterDifficulty("medium")
    setSelectedMonsters([])
    setMonsterSearch("")
    setShowEncounterForm(false)
  }

  const updateEncounterStatus = (id: string, status: PlannedEncounter["status"]) => {
    setFormData((prev) => ({
      ...prev,
      plannedEncounters: prev.plannedEncounters?.map((enc) =>
        enc.id === id ? { ...enc, status } : enc
      ),
    }))
  }

  const removeEncounter = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      plannedEncounters: prev.plannedEncounters?.filter((enc) => enc.id !== id),
    }))
  }

  // NPC roster helpers
  const toggleNPC = (npcId: string) => {
    setFormData((prev) => {
      const current = prev.plannedNPCs || []
      const isSelected = current.includes(npcId)
      return {
        ...prev,
        plannedNPCs: isSelected
          ? current.filter((id) => id !== npcId)
          : [...current, npcId],
      }
    })
  }

  // XP calculation helper
  const getXPByCR = (cr: number): number => {
    const xpTable: Record<number, number> = {
      0: 10, 0.125: 25, 0.25: 50, 0.5: 100, 1: 200, 2: 450, 3: 700, 4: 1100,
      5: 1800, 6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900, 11: 7200,
      12: 8400, 13: 10000, 14: 11500, 15: 13000, 16: 15000, 17: 18000,
      18: 20000, 19: 22000, 20: 25000, 21: 33000, 22: 41000, 23: 50000,
      24: 62000, 25: 75000, 26: 90000, 27: 105000, 28: 120000, 29: 135000, 30: 155000,
    }
    return xpTable[cr] || 0
  }

  // Calculate total planned XP
  const totalPlannedXP = formData.plannedEncounters?.reduce((sum, enc) => sum + (enc.xpReward || 0), 0) || 0

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

          {/* XP Calculator - only show for existing sessions */}
          {!isNew && session && (
            <XPCalculator
              sessionId={session.id}
              plannedEncounters={formData.plannedEncounters}
              onXPAwarded={(xp) => {
                setFormData((prev) => ({ ...prev, xpAwarded: xp }))
              }}
            />
          )}
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
          {/* Session Objectives */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-serif text-foreground flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Session Objectives
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Objective */}
              <div className="flex gap-2">
                <Select value={objectivePriority} onValueChange={(v) => setObjectivePriority(v as SessionObjective["priority"])}>
                  <SelectTrigger className="w-[120px] bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="primary" className="focus:bg-accent">Primary</SelectItem>
                    <SelectItem value="secondary" className="focus:bg-accent">Secondary</SelectItem>
                    <SelectItem value="optional" className="focus:bg-accent">Optional</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Add an objective..."
                  value={newObjective}
                  onChange={(e) => setNewObjective(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addObjective()}
                  className="flex-1 bg-input border-border"
                />
                <Button onClick={addObjective} className="bg-primary hover:bg-primary/90">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Objectives List */}
              <div className="space-y-2">
                {formData.objectives?.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4 text-sm">
                    No objectives yet. Add goals for this session!
                  </p>
                ) : (
                  formData.objectives?.map((objective) => (
                    <div
                      key={objective.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border transition-opacity",
                        priorityColors[objective.priority],
                        objective.completed && "opacity-60"
                      )}
                    >
                      <Checkbox
                        checked={objective.completed}
                        onCheckedChange={() => toggleObjective(objective.id)}
                        className="border-muted-foreground"
                      />
                      <span className={cn(
                        "flex-1 text-sm",
                        objective.completed && "line-through text-muted-foreground"
                      )}>
                        {objective.text}
                      </span>
                      <Badge variant="outline" className="text-xs capitalize">
                        {objective.priority}
                      </Badge>
                      <button
                        onClick={() => removeObjective(objective.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Planned Encounters */}
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-serif text-foreground flex items-center gap-2">
                <Skull className="h-5 w-5 text-destructive" />
                Planned Encounters
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  Total XP: {totalPlannedXP.toLocaleString()}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEncounterForm(!showEncounterForm)}
                  className="border-border"
                >
                  {showEncounterForm ? <ChevronUp className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Encounter Form */}
              {showEncounterForm && (
                <div className="space-y-3 p-4 rounded-lg border border-border bg-accent/20">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-foreground text-sm">Encounter Name</Label>
                      <Input
                        placeholder="Goblin Ambush"
                        value={encounterName}
                        onChange={(e) => setEncounterName(e.target.value)}
                        className="bg-input border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-foreground text-sm">Difficulty</Label>
                      <Select value={encounterDifficulty} onValueChange={(v) => setEncounterDifficulty(v as PlannedEncounter["difficulty"])}>
                        <SelectTrigger className="bg-input border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                          <SelectItem value="trivial" className="focus:bg-accent">Trivial</SelectItem>
                          <SelectItem value="easy" className="focus:bg-accent">Easy</SelectItem>
                          <SelectItem value="medium" className="focus:bg-accent">Medium</SelectItem>
                          <SelectItem value="hard" className="focus:bg-accent">Hard</SelectItem>
                          <SelectItem value="deadly" className="focus:bg-accent">Deadly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-foreground text-sm">Description (optional)</Label>
                    <Textarea
                      placeholder="Brief description of the encounter..."
                      value={encounterDescription}
                      onChange={(e) => setEncounterDescription(e.target.value)}
                      className="bg-input border-border min-h-[60px]"
                    />
                  </div>

                  {/* Monster Search */}
                  <div className="space-y-2">
                    <Label className="text-foreground text-sm">Add Monsters (Open5e)</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search monsters..."
                        value={monsterSearch}
                        onChange={(e) => setMonsterSearch(e.target.value)}
                        className="bg-input border-border pl-9"
                      />
                    </div>

                    {/* Search Results */}
                    {searchResults.length > 0 && (
                      <ScrollArea className="h-[150px] rounded border border-border bg-background">
                        <div className="p-2 space-y-1">
                          {searchResults.map((monster) => (
                            <button
                              key={monster.slug}
                              onClick={() => {
                                if (!selectedMonsters.find((m) => m.slug === monster.slug)) {
                                  setSelectedMonsters([...selectedMonsters, monster])
                                }
                                setMonsterSearch("")
                                setSearchResults([])
                              }}
                              className="w-full flex items-center justify-between p-2 rounded hover:bg-accent text-left"
                            >
                              <span className="text-sm">{monster.name}</span>
                              <span className="text-xs text-muted-foreground">
                                CR {monster.challenge_rating} ({getXPByCR(monster.cr).toLocaleString()} XP)
                              </span>
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    )}

                    {isSearching && (
                      <p className="text-xs text-muted-foreground">Searching...</p>
                    )}

                    {/* Selected Monsters */}
                    {selectedMonsters.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {selectedMonsters.map((monster) => (
                          <Badge key={monster.slug} variant="secondary" className="gap-1">
                            {monster.name} (CR {monster.challenge_rating})
                            <button
                              onClick={() => setSelectedMonsters(selectedMonsters.filter((m) => m.slug !== monster.slug))}
                              className="ml-1 hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button onClick={addEncounter} disabled={!encounterName.trim()} className="w-full bg-primary hover:bg-primary/90">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Encounter
                  </Button>
                </div>
              )}

              {/* Encounters List */}
              <div className="space-y-2">
                {formData.plannedEncounters?.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4 text-sm">
                    No encounters planned. Click + to add one!
                  </p>
                ) : (
                  formData.plannedEncounters?.map((encounter) => (
                    <div
                      key={encounter.id}
                      className={cn(
                        "p-3 rounded-lg border border-border",
                        encounter.status === "completed" && "opacity-60 bg-green-500/5",
                        encounter.status === "skipped" && "opacity-40"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Swords className={cn("h-4 w-4", difficultyColors[encounter.difficulty])} />
                          <span className="font-medium">{encounter.name}</span>
                          <Badge variant="outline" className={cn("text-xs capitalize", difficultyColors[encounter.difficulty])}>
                            {encounter.difficulty}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {encounter.xpReward?.toLocaleString() || 0} XP
                          </span>
                          <Select
                            value={encounter.status}
                            onValueChange={(v) => updateEncounterStatus(encounter.id, v as PlannedEncounter["status"])}
                          >
                            <SelectTrigger className="h-7 w-[100px] text-xs bg-input border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-popover border-border">
                              <SelectItem value="planned" className="focus:bg-accent text-xs">Planned</SelectItem>
                              <SelectItem value="completed" className="focus:bg-accent text-xs">Completed</SelectItem>
                              <SelectItem value="skipped" className="focus:bg-accent text-xs">Skipped</SelectItem>
                            </SelectContent>
                          </Select>
                          <button
                            onClick={() => removeEncounter(encounter.id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      {encounter.description && (
                        <p className="text-sm text-muted-foreground mb-2">{encounter.description}</p>
                      )}
                      {encounter.monsterSlugs.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {encounter.monsterSlugs.map((slug) => (
                            <Badge key={slug} variant="outline" className="text-xs">
                              {slug.replace(/-/g, " ")}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* NPC Roster */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-serif text-foreground flex items-center gap-2">
                <Users className="h-5 w-5 text-green-500" />
                NPC Roster for This Session
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {campaignNPCs.length === 0 ? (
                <p className="text-center text-muted-foreground py-4 text-sm">
                  No NPCs in this campaign yet. Create some in the NPCs section!
                </p>
              ) : (
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2 pr-4">
                    {campaignNPCs.map((npc) => {
                      const isSelected = formData.plannedNPCs?.includes(npc.id)
                      return (
                        <button
                          key={npc.id}
                          onClick={() => toggleNPC(npc.id)}
                          className={cn(
                            "w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left",
                            isSelected
                              ? "border-primary bg-primary/10"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <div>
                            <span className="font-medium">{npc.name}</span>
                            <span className="text-sm text-muted-foreground ml-2">
                              {npc.race} {npc.occupation}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs capitalize">
                              {npc.relationship}
                            </Badge>
                            {isSelected && <Check className="h-4 w-4 text-primary" />}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </ScrollArea>
              )}
              {(formData.plannedNPCs?.length || 0) > 0 && (
                <p className="text-sm text-muted-foreground">
                  {formData.plannedNPCs?.length} NPC{formData.plannedNPCs?.length !== 1 ? "s" : ""} selected
                </p>
              )}
            </CardContent>
          </Card>

          {/* Prep Notes */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-serif text-foreground">Additional Prep Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Textarea
                  placeholder="What else do you need to prepare for this session..."
                  value={formData.prepNotes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, prepNotes: e.target.value }))}
                  className="bg-input border-border min-h-[150px]"
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
