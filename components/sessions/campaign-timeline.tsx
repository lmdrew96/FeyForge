"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCampaignSessions, useCampaignPlotThreads } from "@/lib/hooks/use-campaign-data"
import { type Session, type PlotThread } from "@/lib/session-store"
import {
  Calendar,
  Clock,
  GitBranch,
  Star,
  Swords,
  Users,
  ChevronDown,
  ChevronUp,
  Filter,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

type TimelineEvent = {
  id: string
  date: Date
  type: "session" | "plot_start" | "plot_resolved"
  session?: Session
  plotThread?: PlotThread
  title: string
  description?: string
}

export function CampaignTimeline() {
  const sessions = useCampaignSessions()
  const plotThreads = useCampaignPlotThreads()

  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<"all" | "sessions" | "plots">("all")

  // Build timeline events
  const timelineEvents = useMemo(() => {
    const events: TimelineEvent[] = []

    // Add sessions
    sessions.forEach((session) => {
      events.push({
        id: `session-${session.id}`,
        date: new Date(session.date),
        type: "session",
        session,
        title: `Session ${session.number}: ${session.title}`,
        description: session.summary ?? undefined,
      })
    })

    // Add plot thread events
    plotThreads.forEach((thread) => {
      // Plot start
      events.push({
        id: `plot-start-${thread.id}`,
        date: new Date(thread.createdAt),
        type: "plot_start",
        plotThread: thread,
        title: `Plot Introduced: ${thread.title}`,
        description: thread.description,
      })

      // Plot resolved
      if (thread.status === "resolved" && thread.resolvedAt) {
        events.push({
          id: `plot-resolved-${thread.id}`,
          date: new Date(thread.resolvedAt),
          type: "plot_resolved",
          plotThread: thread,
          title: `Plot Resolved: ${thread.title}`,
        })
      }
    })

    // Sort by date (newest first)
    return events.sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [sessions, plotThreads])

  // Filter events
  const filteredEvents = useMemo(() => {
    if (filter === "all") return timelineEvents
    if (filter === "sessions") return timelineEvents.filter((e) => e.type === "session")
    if (filter === "plots") return timelineEvents.filter((e) => e.type !== "session")
    return timelineEvents
  }, [timelineEvents, filter])

  const toggleSession = (id: string) => {
    setExpandedSessions((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Get event icon and colors
  const getEventStyle = (event: TimelineEvent) => {
    switch (event.type) {
      case "session":
        return {
          icon: Calendar,
          color: "bg-fey-cyan",
          borderColor: "border-fey-cyan/50",
        }
      case "plot_start":
        return {
          icon: GitBranch,
          color: "bg-fey-purple",
          borderColor: "border-fey-purple/50",
        }
      case "plot_resolved":
        return {
          icon: Star,
          color: "bg-fey-gold",
          borderColor: "border-fey-gold/50",
        }
    }
  }

  // Calculate campaign stats
  const stats = useMemo(() => {
    const completedSessions = sessions.filter((s) => s.status === "completed").length
    const totalDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0)
    const activePlots = plotThreads.filter((t) => t.status === "active").length
    const resolvedPlots = plotThreads.filter((t) => t.status === "resolved").length

    return { completedSessions, totalDuration, activePlots, resolvedPlots }
  }, [sessions, plotThreads])

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours === 0) return `${mins}m`
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  if (sessions.length === 0 && plotThreads.length === 0) {
    return (
      <Card className="bg-card/80 backdrop-blur-sm border-border">
        <CardContent className="p-12 text-center">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-serif font-bold mb-2">No Timeline Yet</h3>
          <p className="text-muted-foreground">
            Create sessions and plot threads to see your campaign timeline.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card/80 backdrop-blur-sm border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-fey-cyan/20">
                <Calendar className="h-5 w-5 text-fey-cyan" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.completedSessions}</p>
                <p className="text-xs text-muted-foreground">Sessions Played</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur-sm border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatDuration(stats.totalDuration)}</p>
                <p className="text-xs text-muted-foreground">Total Play Time</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur-sm border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-fey-purple/20">
                <GitBranch className="h-5 w-5 text-fey-purple" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.activePlots}</p>
                <p className="text-xs text-muted-foreground">Active Plot Threads</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur-sm border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-fey-gold/20">
                <Star className="h-5 w-5 text-fey-gold" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.resolvedPlots}</p>
                <p className="text-xs text-muted-foreground">Plots Resolved</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <Card className="bg-card/80 backdrop-blur-sm border-border">
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <CardTitle className="font-serif text-foreground flex items-center gap-2">
            <Calendar className="h-5 w-5 text-fey-cyan" />
            Campaign Timeline
          </CardTitle>
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="w-[140px] bg-input border-border">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="all" className="focus:bg-accent">All Events</SelectItem>
              <SelectItem value="sessions" className="focus:bg-accent">Sessions Only</SelectItem>
              <SelectItem value="plots" className="focus:bg-accent">Plot Threads</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <div className="relative pl-8 pr-4 py-4">
              {/* Timeline line */}
              <div className="absolute left-[23px] top-0 bottom-0 w-0.5 bg-border" />

              {/* Events */}
              <div className="space-y-4">
                {filteredEvents.map((event) => {
                  const style = getEventStyle(event)
                  const Icon = style.icon
                  const isExpanded = expandedSessions.has(event.id)

                  return (
                    <div key={event.id} className="relative">
                      {/* Timeline dot */}
                      <div className={cn(
                        "absolute -left-[23px] w-6 h-6 rounded-full flex items-center justify-center",
                        style.color
                      )}>
                        <Icon className="h-3 w-3 text-white" />
                      </div>

                      {/* Event card */}
                      <div className={cn(
                        "ml-4 p-4 rounded-lg border",
                        style.borderColor,
                        "bg-card/50 hover:bg-accent/20 transition-colors"
                      )}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs text-muted-foreground">
                                {event.date.toLocaleDateString("en-US", {
                                  weekday: "short",
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                              {event.type === "session" && event.session?.status && (
                                <Badge variant="outline" className="text-xs capitalize">
                                  {event.session.status}
                                </Badge>
                              )}
                              {event.plotThread && (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-xs capitalize",
                                    event.plotThread.importance === "major" && "border-fey-gold/50 text-fey-gold",
                                    event.plotThread.importance === "minor" && "border-fey-cyan/50 text-fey-cyan",
                                    event.plotThread.importance === "side" && "border-gray-500/50 text-gray-500"
                                  )}
                                >
                                  {event.plotThread.importance}
                                </Badge>
                              )}
                            </div>
                            <h4 className="font-medium">{event.title}</h4>
                            {event.description && !isExpanded && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                {event.description}
                              </p>
                            )}
                          </div>

                          {event.type === "session" && (
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => toggleSession(event.id)}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                              <Button asChild variant="outline" size="sm">
                                <Link href={`/sessions/${event.session?.id}`}>
                                  View
                                </Link>
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Expanded session details */}
                        {event.type === "session" && isExpanded && event.session && (
                          <div className="mt-4 pt-4 border-t border-border space-y-3">
                            {event.session.summary && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Summary</p>
                                <p className="text-sm">{event.session.summary}</p>
                              </div>
                            )}

                            {event.session.highlights && event.session.highlights.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Highlights</p>
                                <div className="flex flex-wrap gap-1">
                                  {event.session.highlights.map((h, i) => (
                                    <Badge key={i} variant="secondary" className="text-xs">
                                      {h}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="flex gap-4 text-xs text-muted-foreground">
                              {event.session.duration && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDuration(event.session.duration)}
                                </span>
                              )}
                              {event.session.plannedEncounters && event.session.plannedEncounters.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <Swords className="h-3 w-3" />
                                  {event.session.plannedEncounters.filter((e) => e.status === "completed").length}/
                                  {event.session.plannedEncounters.length} encounters
                                </span>
                              )}
                              {event.session.npcsEncountered && event.session.npcsEncountered.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {event.session.npcsEncountered.length} NPCs
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
