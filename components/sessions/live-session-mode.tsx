"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSessionStore, type Session, type SessionNote, type PlannedEncounter } from "@/lib/session-store"
import { useCampaignNPCs } from "@/lib/hooks/use-campaign-data"
import {
  Play,
  Pause,
  Timer,
  Plus,
  BookOpen,
  Swords,
  MessageSquare,
  Gem,
  GitBranch,
  Target,
  Users,
  Skull,
  Check,
  X,
  Award,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { XPCalculator } from "./xp-calculator"

interface LiveSessionModeProps {
  session: Session
  onExit: () => void
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

export function LiveSessionMode({ session, onExit }: LiveSessionModeProps) {
  const { updateSession } = useSessionStore()
  const campaignNPCs = useCampaignNPCs()

  // Timer state
  const [isRunning, setIsRunning] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // XP calculator visibility
  const [showXPCalculator, setShowXPCalculator] = useState(false)

  // Quick note state
  const [quickNote, setQuickNote] = useState("")
  const [noteType, setNoteType] = useState<SessionNote["type"]>("narrative")

  // Local copy of session data for live updates
  const [localSession, setLocalSession] = useState(session)

  // Timer effect
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1)
      }, 1000)
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isRunning])

  // Format time display
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  // Add quick note
  const addQuickNote = () => {
    if (!quickNote.trim()) return

    const note: SessionNote = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      content: quickNote.trim(),
      timestamp: new Date(),
      type: noteType,
    }

    const updatedSession = {
      ...localSession,
      notes: [...localSession.notes, note],
    }

    setLocalSession(updatedSession)
    updateSession(session.id, { notes: updatedSession.notes })
    setQuickNote("")
  }

  // Toggle objective
  const toggleObjective = (id: string) => {
    const updatedObjectives = localSession.objectives?.map((obj) =>
      obj.id === id ? { ...obj, completed: !obj.completed } : obj,
    )

    const updatedSession = { ...localSession, objectives: updatedObjectives }
    setLocalSession(updatedSession)
    updateSession(session.id, { objectives: updatedObjectives })
  }

  // Update encounter status
  const updateEncounterStatus = (id: string, status: PlannedEncounter["status"]) => {
    const updatedEncounters = localSession.plannedEncounters?.map((enc) => (enc.id === id ? { ...enc, status } : enc))

    const updatedSession = { ...localSession, plannedEncounters: updatedEncounters }
    setLocalSession(updatedSession)
    updateSession(session.id, { plannedEncounters: updatedEncounters })
  }

  // Save duration on exit
  const handleExit = () => {
    if (elapsedSeconds > 0) {
      const durationMinutes = Math.ceil(elapsedSeconds / 60)
      updateSession(session.id, { duration: durationMinutes })
    }
    onExit()
  }

  // Get selected NPCs
  const selectedNPCs = campaignNPCs.filter((npc) => localSession.plannedNPCs?.includes(npc.id))

  // Calculate completed XP
  const completedXP =
    localSession.plannedEncounters
      ?.filter((enc) => enc.status === "completed")
      .reduce((sum, enc) => sum + (enc.xpReward || 0), 0) || 0

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-serif font-bold text-foreground">
              Session {localSession.number}: {localSession.title}
            </h1>
            <Badge variant="outline" className="text-lg font-mono">
              <Timer className="h-4 w-4 mr-2" />
              {formatTime(elapsedSeconds)}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsRunning(!isRunning)}
              className={cn(isRunning && "border-green-500 text-green-500")}
            >
              {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowXPCalculator(!showXPCalculator)}
              className={cn(showXPCalculator && "border-yellow-500 text-yellow-500")}
            >
              <Award className="h-4 w-4 mr-2" />
              Award XP
            </Button>
            <Button variant="outline" onClick={handleExit}>
              Exit Live Mode
            </Button>
          </div>
        </div>
      </div>

      {/* XP Calculator Slide-out */}
      {showXPCalculator && (
        <div className="fixed right-0 top-[73px] bottom-0 w-full max-w-md bg-background border-l border-border shadow-lg z-50 overflow-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-serif font-bold">Award Experience</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowXPCalculator(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <XPCalculator
              sessionId={session.id}
              plannedEncounters={localSession.plannedEncounters}
              onXPAwarded={() => {
                setShowXPCalculator(false)
              }}
            />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid h-[calc(100vh-73px)] grid-cols-1 lg:grid-cols-3 gap-4 p-4">
        {/* Left Column - Quick Notes & Log */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Quick Note Input */}
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex gap-2">
                <Select value={noteType} onValueChange={(v) => setNoteType(v as SessionNote["type"])}>
                  <SelectTrigger className="w-[130px] bg-input border-border">
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
                <Textarea
                  placeholder="Quick note... (press Enter to add)"
                  value={quickNote}
                  onChange={(e) => setQuickNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      addQuickNote()
                    }
                  }}
                  className="flex-1 bg-input border-border min-h-[60px] max-h-[100px]"
                />
                <Button onClick={addQuickNote} className="bg-primary hover:bg-primary/90 self-end">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Session Log */}
          <Card className="bg-card border-border flex-1">
            <CardHeader className="py-3">
              <CardTitle className="font-serif text-foreground text-lg">Session Log</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-350px)]">
                <div className="space-y-2 p-4">
                  {localSession.notes.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No notes yet. Start documenting your session!
                    </p>
                  ) : (
                    [...localSession.notes].reverse().map((note) => {
                      const Icon = noteTypeIcons[note.type]
                      return (
                        <div key={note.id} className={cn("p-3 rounded-lg border", noteTypeColors[note.type])}>
                          <div className="flex items-center gap-2 mb-1">
                            <Icon className="h-3 w-3" />
                            <span className="text-xs font-medium capitalize">{note.type}</span>
                            <span className="text-xs text-muted-foreground ml-auto">
                              {new Date(note.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-foreground text-sm whitespace-pre-wrap break-words overflow-hidden">
                            {note.content}
                          </p>
                        </div>
                      )
                    })
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Objectives, Encounters, NPCs */}
        <div className="flex flex-col gap-4">
          {/* Objectives */}
          <Card className="bg-card border-border">
            <CardHeader className="py-3">
              <CardTitle className="font-serif text-foreground text-lg flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Objectives
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-2">
                  {localSession.objectives?.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">No objectives</p>
                  ) : (
                    localSession.objectives?.map((objective) => (
                      <button
                        key={objective.id}
                        onClick={() => toggleObjective(objective.id)}
                        className={cn(
                          "w-full flex items-center gap-2 p-2 rounded text-left transition-opacity min-w-0",
                          objective.completed && "opacity-60",
                        )}
                      >
                        <div
                          className={cn(
                            "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                            objective.completed ? "bg-primary border-primary" : "border-muted-foreground",
                          )}
                        >
                          {objective.completed && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                        <span
                          className={cn("text-sm flex-1 min-w-0 break-words", objective.completed && "line-through text-muted-foreground")}
                        >
                          {objective.text}
                        </span>
                        <Badge variant="outline" className="text-xs capitalize shrink-0">
                          {objective.priority}
                        </Badge>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Encounters */}
          <Card className="bg-card border-border">
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="font-serif text-foreground text-lg flex items-center gap-2">
                  <Skull className="h-4 w-4 text-destructive" />
                  Encounters
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  {completedXP.toLocaleString()} XP earned
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-2">
                  {localSession.plannedEncounters?.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">No encounters planned</p>
                  ) : (
                    localSession.plannedEncounters?.map((encounter) => (
                      <div
                        key={encounter.id}
                        className={cn(
                          "p-2 rounded border border-border flex items-center justify-between",
                          encounter.status === "completed" && "opacity-60 bg-green-500/5",
                          encounter.status === "skipped" && "opacity-40",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Swords className={cn("h-4 w-4", difficultyColors[encounter.difficulty])} />
                          <span className="text-sm font-medium">{encounter.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateEncounterStatus(encounter.id, "completed")}
                            disabled={encounter.status === "completed"}
                          >
                            <Check className={cn("h-4 w-4", encounter.status === "completed" && "text-green-500")} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateEncounterStatus(encounter.id, "skipped")}
                            disabled={encounter.status === "skipped"}
                          >
                            <X className={cn("h-4 w-4", encounter.status === "skipped" && "text-muted-foreground")} />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* NPCs */}
          <Card className="bg-card border-border flex-1">
            <CardHeader className="py-3">
              <CardTitle className="font-serif text-foreground text-lg flex items-center gap-2">
                <Users className="h-4 w-4 text-green-500" />
                Session NPCs ({selectedNPCs.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <ScrollArea className="h-[calc(100vh-680px)] min-h-[150px]">
                <div className="space-y-2">
                  {selectedNPCs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">No NPCs selected</p>
                  ) : (
                    selectedNPCs.map((npc) => (
                      <div key={npc.id} className="p-2 rounded border border-border">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{npc.name}</span>
                          <Badge variant="outline" className="text-xs capitalize">
                            {npc.relationship}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {npc.race} {npc.occupation}
                        </p>
                        {npc.voiceDescription && (
                          <p className="text-xs text-primary mt-1 italic">"{npc.voiceDescription}"</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
