"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import {
  ArrowLeft,
  Calendar,
  Users,
  Sparkles,
  Gift,
  Scroll,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Star,
  MapPin,
} from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useSessionStore, type Session } from "@/lib/session-store"
import { EditSessionDialog } from "@/components/sessions/edit-session-dialog"

export default function SessionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { sessions, deleteSession, initialize, isInitialized } = useSessionStore()
  const [session, setSession] = useState<Session | null>(null)
  const [showPrepNotes, setShowPrepNotes] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  useEffect(() => {
    if (!isInitialized) {
      initialize()
    }
  }, [initialize, isInitialized])

  useEffect(() => {
    const id = params.id as string
    const found = sessions.find(s => s.id === id)
    if (found) {
      setSession(found)
    }
  }, [params.id, sessions])

  const handleDelete = async () => {
    if (session) {
      await deleteSession(session.id)
      router.push("/sessions")
    }
  }

  if (!session) {
    return (
      <AppShell pageTitle="Session">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <Scroll className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-2xl font-display font-bold text-foreground mb-4">
              Session Not Found
            </h1>
            <p className="text-foreground/70 mb-6">
              The session you&apos;re looking for doesn&apos;t exist.
            </p>
            <Button asChild className="bg-fey-purple hover:bg-fey-purple/80">
              <Link href="/sessions">Return to Sessions</Link>
            </Button>
          </div>
        </div>
      </AppShell>
    )
  }

  const formattedDate = format(new Date(session.date), "MMMM d, yyyy")

  return (
    <AppShell pageTitle={`Session ${session.number}: ${session.title}`}>
      <div className="p-3 sm:p-4 lg:p-6 w-full max-w-full">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Back Button */}
          <Link
            href="/sessions"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Sessions
          </Link>

          {/* Header Card */}
          <Card className="bg-card/80 backdrop-blur-sm border-border">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge
                      variant="outline"
                      className="bg-fey-purple/10 text-fey-purple border-fey-purple/30"
                    >
                      Session {session.number}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`${session.status === 'completed' ? 'bg-fey-forest/10 text-fey-forest border-fey-forest/30' : 'bg-fey-gold/10 text-fey-gold border-fey-gold/30'}`}
                    >
                      {session.status}
                    </Badge>
                  </div>
                  <CardTitle className="text-2xl font-display">{session.title}</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-2">
                    <Calendar className="h-4 w-4" />
                    {formattedDate}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditDialogOpen(true)}
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Session?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete Session {session.number}: {session.title}.
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary */}
              {session.summary && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Summary
                  </h3>
                  <p className="text-foreground leading-relaxed">{session.summary}</p>
                </div>
              )}

              {/* Stats Row */}
              <div className="flex flex-wrap gap-4">
                {(session.xpAwarded ?? 0) > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-fey-gold/10 border border-fey-gold/20">
                    <Sparkles className="h-4 w-4 text-fey-gold" />
                    <span className="text-fey-gold font-medium">{session.xpAwarded} XP</span>
                  </div>
                )}
                {session.npcsEncountered.length > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-fey-cyan/10 border border-fey-cyan/20">
                    <Users className="h-4 w-4 text-fey-cyan" />
                    <span className="text-fey-cyan font-medium">
                      {session.npcsEncountered.length} NPC{session.npcsEncountered.length !== 1 ? "s" : ""} Encountered
                    </span>
                  </div>
                )}
                {session.locationsVisited.length > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-fey-forest/10 border border-fey-forest/20">
                    <MapPin className="h-4 w-4 text-fey-forest" />
                    <span className="text-fey-forest font-medium">
                      {session.locationsVisited.length} Location{session.locationsVisited.length !== 1 ? "s" : ""} Visited
                    </span>
                  </div>
                )}
              </div>

              {/* NPCs Encountered */}
              {session.npcsEncountered.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    NPCs Encountered
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {session.npcsEncountered.map((npcId) => (
                      <Badge key={npcId} variant="secondary">
                        {npcId}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Locations Visited */}
              {session.locationsVisited.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Locations Visited
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {session.locationsVisited.map((location) => (
                      <Badge key={location} variant="outline" className="bg-fey-forest/10 border-fey-forest/30 text-fey-forest">
                        {location}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Highlights */}
              {session.highlights.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                    <Star className="h-4 w-4 text-fey-gold" />
                    Highlights
                  </h3>
                  <ul className="space-y-2">
                    {session.highlights.map((highlight, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-2 text-foreground"
                      >
                        <span className="text-fey-gold mt-1">•</span>
                        {highlight}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Loot */}
              {session.loot.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                    <Gift className="h-4 w-4 text-fey-forest" />
                    Loot Gained
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {session.loot.map((item, index) => (
                      <Badge
                        key={index}
                        variant="outline"
                        className="bg-fey-forest/10 border-fey-forest/30 text-fey-forest"
                      >
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Prep Notes */}
              {session.prepNotes && (
                <div>
                  <button
                    onClick={() => setShowPrepNotes(!showPrepNotes)}
                    className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2 hover:text-foreground transition-colors"
                  >
                    {showPrepNotes ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                    Prep Notes {showPrepNotes ? "(Click to hide)" : "(Click to reveal)"}
                  </button>
                  {showPrepNotes && (
                    <div className="p-4 rounded-lg bg-muted/50 border border-border">
                      <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                        {session.prepNotes}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Dialog */}
      <EditSessionDialog
        session={session}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />
    </AppShell>
  )
}
