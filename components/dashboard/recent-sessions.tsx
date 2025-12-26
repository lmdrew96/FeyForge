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
        <div className="flex items-center justify-between spacing-header border-b border-border/20">
          <div className="flex items-center gap-fluid-sm">
            <Scroll className="icon-sm text-primary" />
            <h2 className="font-serif text-title-lg text-silver">Recent Sessions</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-muted-foreground hover:text-foreground rounded-button text-subtitle btn-height-sm px-fluid-sm"
          >
            <Link href="/sessions">
              <span className="hidden xs:inline">View All</span>
              <span className="xs:hidden">All</span>
              <ChevronRight className="ml-0.5 sm:ml-1 icon-xs" />
            </Link>
          </Button>
        </div>
        <div className="text-center py-8 sm:py-12 space-y-fluid-md">
          <div className="container-lg mx-auto rounded-2xl bg-primary/5 flex items-center justify-center border border-primary/10">
            <Scroll className="icon-2xl text-primary/50" />
          </div>
          <div>
            <p className="text-display text-foreground font-medium">No sessions recorded yet</p>
            <p className="text-subtitle text-muted-foreground mt-1">Begin your adventure!</p>
          </div>
          <Button asChild className="btn-primary text-display btn-height">
            <Link href="/sessions/new">Start Your First Session</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between spacing-header border-b border-border/20">
        <div className="flex items-center gap-fluid-sm">
          <Scroll className="icon-sm text-primary" />
          <h2 className="font-serif text-title-lg text-silver">Recent Sessions</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="text-muted-foreground hover:text-foreground rounded-button text-subtitle btn-height-sm px-fluid-sm"
        >
          <Link href="/sessions">
            <span className="hidden xs:inline">View All</span>
            <span className="xs:hidden">All</span>
            <ChevronRight className="ml-0.5 sm:ml-1 icon-xs" />
          </Link>
        </Button>
      </div>
      <div className="space-y-fluid-md">
        {recentSessions.map((session, index) => (
          <Link
            key={session.id}
            href={`/sessions/${session.id}`}
            className="flex items-center justify-between spacing-compact rounded-card hover:bg-primary/5 transition-colors cursor-pointer block border border-border/10 hover:border-primary/30 active:scale-[0.99]"
          >
            <div className="space-y-1 sm:space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-fluid-sm flex-wrap">
                <span className="text-label-sm font-mono text-muted-foreground">#{session.number}</span>
                <h3 className="font-medium text-display text-foreground truncate">{session.title}</h3>
                <Badge
                  className={`text-label-sm ${
                    session.status === "planned"
                      ? "badge-emerald"
                      : session.status === "completed"
                        ? "badge-teal"
                        : "badge-lavender"
                  }`}
                >
                  {session.status}
                </Badge>
              </div>
              <div className="flex items-center gap-fluid flex-wrap text-label-sm text-muted-foreground">
                <span className="flex items-center gap-0.5 sm:gap-1">
                  <Calendar className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  {format(new Date(session.date), "MMM d, yyyy")}
                </span>
                {session.duration && (
                  <span className="flex items-center gap-0.5 sm:gap-1">
                    <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    {Math.floor(session.duration / 60)}h {session.duration % 60}m
                  </span>
                )}
              </div>
              {session.highlights.length > 0 && (
                <div className="flex gap-fluid-sm mt-1.5 sm:mt-2 flex-wrap">
                  {session.highlights.slice(0, 2).map((highlight) => (
                    <Badge
                      key={highlight}
                      variant="outline"
                      className="text-label-sm border-border/40 text-muted-foreground bg-background/30 backdrop-blur-sm rounded-full"
                    >
                      {highlight}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <ChevronRight className="icon-sm text-muted-foreground shrink-0 ml-1.5 sm:ml-2" />
          </Link>
        ))}
      </div>
    </div>
  )
}
