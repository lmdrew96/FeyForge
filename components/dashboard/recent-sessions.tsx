"use client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, ChevronRight, Scroll } from "lucide-react"
import Link from "next/link"
import { useCampaignSessions } from "@/lib/hooks/use-campaign-data"
import { format } from "date-fns"

export function RecentSessions() {
  const sessions = useCampaignSessions()

  // Sort by date descending and take last 3
  const recentSessions = [...sessions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3)

  // Show placeholder if no sessions
  if (recentSessions.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-border/20">
          <div className="flex items-center gap-2">
            <Scroll className="h-5 w-5 text-primary" />
            <h2 className="font-serif text-xl text-silver">Recent Sessions</h2>
          </div>
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground rounded-xl">
            <Link href="/sessions">
              View All <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="text-center py-12 space-y-4">
          <div className="h-20 w-20 mx-auto rounded-2xl bg-primary/5 flex items-center justify-center border border-primary/10">
            <Scroll className="h-10 w-10 text-primary/50" />
          </div>
          <div>
            <p className="text-foreground font-medium">No sessions recorded yet</p>
            <p className="text-sm text-muted-foreground mt-1">Begin your adventure!</p>
          </div>
          <Button asChild className="btn-primary">
            <Link href="/sessions/new">Start Your First Session</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-border/20">
        <div className="flex items-center gap-2">
          <Scroll className="h-5 w-5 text-primary" />
          <h2 className="font-serif text-xl text-silver">Recent Sessions</h2>
        </div>
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground rounded-xl">
          <Link href="/sessions">
            View All <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>
      <div className="space-y-3">
        {recentSessions.map((session, index) => (
          <Link
            key={session.id}
            href={`/sessions/${session.id}`}
            className="flex items-center justify-between p-4 rounded-2xl hover:bg-primary/5 transition-colors cursor-pointer block border border-border/10 hover:border-primary/30"
          >
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono text-muted-foreground">#{session.number}</span>
                <h3 className="font-medium text-foreground truncate">{session.title}</h3>
                <Badge
                  className={
                    session.status === "planned"
                      ? "badge-cyan"
                      : session.status === "completed"
                        ? "badge-teal"
                        : "badge-lavender"
                  }
                >
                  {session.status}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
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
                <div className="flex gap-2 mt-2 flex-wrap">
                  {session.highlights.slice(0, 2).map((highlight) => (
                    <Badge
                      key={highlight}
                      variant="outline"
                      className="text-xs border-border/40 text-muted-foreground bg-background/30 backdrop-blur-sm rounded-full"
                    >
                      {highlight}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 ml-2" />
          </Link>
        ))}
      </div>
    </div>
  )
}
