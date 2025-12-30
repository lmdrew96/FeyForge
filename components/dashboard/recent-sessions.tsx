"use client"

import Link from "next/link"
import { Calendar, ChevronRight, Scroll, Sparkles } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useSessionsStore } from "@/lib/sessions-store"
import { useCampaignsStore } from "@/lib/campaigns-store"
import { formatDistanceToNow } from "date-fns"

export function RecentSessions() {
  const { activeCampaignId } = useCampaignsStore()
  const { getRecentSessions } = useSessionsStore()

  const recentSessions = activeCampaignId ? getRecentSessions(activeCampaignId, 5) : []

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border h-full min-w-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Scroll className="h-4 w-4 sm:h-5 sm:w-5 text-fey-purple flex-shrink-0" />
          <span className="truncate">Recent Sessions</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {recentSessions.length === 0 ? (
          <div className="px-4 sm:px-6 pb-6 text-center text-muted-foreground">
            <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No sessions yet</p>
            <p className="text-xs">Start your first session to track your adventure</p>
          </div>
        ) : (
          <ScrollArea className="h-[280px] sm:h-[320px]">
            <div className="space-y-1 px-3 sm:px-4 pb-4">
              {recentSessions.map((session) => (
                <Link
                  key={session.id}
                  href={`/sessions/${session.id}`}
                  className="block w-full text-left p-2 sm:p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge
                          variant="outline"
                          className="shrink-0 text-[10px] sm:text-xs bg-fey-purple/10 text-fey-purple border-fey-purple/30"
                        >
                          #{session.sessionNumber}
                        </Badge>
                        <h4 className="font-medium text-foreground truncate text-xs sm:text-sm">{session.title}</h4>
                      </div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-2 mb-2">
                        {session.summary}
                      </p>
                      <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground flex-wrap">
                        <Calendar className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">
                          {formatDistanceToNow(new Date(session.date), { addSuffix: true })}
                        </span>
                        {session.xpAwarded > 0 && (
                          <>
                            <span className="mx-1">·</span>
                            <span className="text-fey-gold whitespace-nowrap">{session.xpAwarded} XP</span>
                          </>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                  </div>
                </Link>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
