"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useSessionStore, type Session } from "@/lib/session-store"
import { Calendar, Clock, Plus, Scroll, ChevronRight, Trash2 } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export function SessionList() {
  const { sessions, deleteSession } = useSessionStore()

  const sortedSessions = [...sessions].sort((a, b) => {
    if (a.status === "planned" && b.status !== "planned") return -1
    if (b.status === "planned" && a.status !== "planned") return 1
    return new Date(b.date).getTime() - new Date(a.date).getTime()
  })

  const getStatusColor = (status: Session["status"]) => {
    switch (status) {
      case "completed":
        return "bg-green-500/20 text-green-500 border-green-500/30"
      case "planned":
        return "bg-primary/20 text-primary border-primary/30"
      case "cancelled":
        return "bg-destructive/20 text-destructive border-destructive/30"
    }
  }

  if (sessions.length === 0) {
    return (
      <Card className="bg-card border-border border-dashed">
        <CardContent className="p-12 text-center">
          <Scroll className="h-16 w-16 mx-auto text-muted-foreground opacity-30 mb-4" />
          <h3 className="font-serif text-xl font-bold text-foreground mb-2">No Sessions Yet</h3>
          <p className="text-muted-foreground mb-6">Start tracking your campaign sessions</p>
          <Button asChild className="bg-primary hover:bg-primary/90">
            <Link href="/sessions/new">
              <Plus className="h-4 w-4 mr-2" />
              Create Session
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground">
            {sessions.filter((s) => s.status === "completed").length} completed sessions
          </p>
        </div>
        <Button asChild className="bg-primary hover:bg-primary/90">
          <Link href="/sessions/new">
            <Plus className="h-4 w-4 mr-2" />
            New Session
          </Link>
        </Button>
      </div>

      <div className="space-y-3">
        {sortedSessions.map((session) => (
          <Card
            key={session.id}
            className={cn(
              "bg-card border-border hover:border-primary/50 transition-colors cursor-pointer group",
              session.status === "planned" && "border-primary/30",
            )}
          >
            <Link href={`/sessions/${session.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Session Number */}
                    <div className="h-12 w-12 rounded-lg bg-accent flex items-center justify-center shrink-0">
                      <span className="font-serif text-xl font-bold text-primary">#{session.number}</span>
                    </div>

                    {/* Session Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-serif font-bold text-foreground group-hover:text-primary transition-colors truncate">
                          {session.title}
                        </h3>
                        <Badge className={cn("text-xs shrink-0", getStatusColor(session.status))}>
                          {session.status}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(session.date).toLocaleDateString()}
                        </span>
                        {session.duration && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {Math.floor(session.duration / 60)}h {session.duration % 60}m
                          </span>
                        )}
                      </div>

                      {/* Highlights */}
                      {session.highlights.length > 0 && (
                        <div className="flex gap-2 mt-2">
                          {session.highlights.slice(0, 3).map((highlight, i) => (
                            <Badge key={i} variant="outline" className="text-xs border-border text-muted-foreground">
                              {highlight}
                            </Badge>
                          ))}
                          {session.highlights.length > 3 && (
                            <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                              +{session.highlights.length - 3} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.preventDefault()
                        deleteSession(session.id)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  )
}
