"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, ChevronRight, Scroll } from "lucide-react"
import Link from "next/link"
import { useSessionStore } from "@/lib/session-store"
import { format } from "date-fns"

export function RecentSessions() {
  const sessions = useSessionStore((s) => s.sessions)

  // Sort by date descending and take last 3
  const recentSessions = [...sessions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3)

  // Show placeholder if no sessions
  if (recentSessions.length === 0) {
    return (
      <Card className="bg-card border-border card-hover">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <Scroll className="h-5 w-5 text-primary icon-glow" />
            <CardTitle className="font-serif text-xl text-gold-gradient">Recent Sessions</CardTitle>
          </div>
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
            <Link href="/sessions">
              View All <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <div className="magical-divider mx-6" />
        <CardContent className="pt-4">
          <div className="text-center py-12 space-y-4">
            <div className="h-16 w-16 mx-auto rounded-xl bg-accent/50 flex items-center justify-center border border-border">
              <Scroll className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-foreground font-medium">No sessions recorded yet</p>
              <p className="text-sm text-muted-foreground mt-1">Begin your adventure!</p>
            </div>
            <Button asChild className="animate-pulse-glow">
              <Link href="/sessions/new">Start Your First Session</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card border-border card-hover">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <Scroll className="h-5 w-5 text-primary icon-glow" />
          <CardTitle className="font-serif text-xl text-gold-gradient">Recent Sessions</CardTitle>
        </div>
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
          <Link href="/sessions">
            View All <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <div className="magical-divider mx-6" />
      <CardContent className="space-y-3 pt-4">
        {recentSessions.map((session, index) => (
          <Link
            key={session.id}
            href={`/sessions/${session.id}`}
            className="flex items-center justify-between p-4 rounded-lg bg-accent/20 hover:bg-accent/40 transition-all duration-300 cursor-pointer block border border-transparent hover:border-primary/20 hover:shadow-[0_0_20px_-10px_oklch(0.55_0.25_280_/_0.3)]"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground">#{session.number}</span>
                <h3 className="font-medium text-foreground">{session.title}</h3>
                <Badge
                  variant={session.status === "planned" ? "default" : "secondary"}
                  className={
                    session.status === "planned"
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : session.status === "completed"
                        ? "bg-forest-green/20 text-forest-green border border-forest-green/30"
                        : "bg-secondary text-secondary-foreground"
                  }
                >
                  {session.status}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(session.date), "MMM d, yyyy")}
                </span>
                {session.duration && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {Math.floor(session.duration / 60)}h {session.duration % 60}m
                  </span>
                )}
              </div>
              {session.highlights.length > 0 && (
                <div className="flex gap-2 mt-2">
                  {session.highlights.slice(0, 2).map((highlight) => (
                    <Badge
                      key={highlight}
                      variant="outline"
                      className="text-xs border-border/50 text-muted-foreground bg-background/50"
                    >
                      {highlight}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
