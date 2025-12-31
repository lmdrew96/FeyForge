"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Sparkles, ChevronRight, Crown, Calendar } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useCampaignStore } from "@/lib/campaign-store"
import { useSessionStore } from "@/lib/session-store"

export function ActiveCampaigns() {
  const { campaigns, activeCampaignId, setActiveCampaign, initialize: initCampaigns, isInitialized: campaignsInitialized } = useCampaignStore()
  const { sessions, initialize: initSessions, isInitialized: sessionsInitialized } = useSessionStore()

  useEffect(() => {
    if (!campaignsInitialized) initCampaigns()
    if (!sessionsInitialized) initSessions()
  }, [initCampaigns, initSessions, campaignsInitialized, sessionsInitialized])

  const getSessionCount = (campaignId: string) => {
    return sessions.filter((s) => s.campaignId === campaignId).length
  }

  const formatDate = (date: Date) => {
    try {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    } catch {
      return "Unknown"
    }
  }

  if (campaigns.length === 0) {
    return (
      <Card className="bg-card/80 backdrop-blur-sm border-border">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Sparkles className="h-5 w-5 text-fey-gold" />
            Active Campaigns
          </CardTitle>
          <CardDescription>Your ongoing adventures</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Sparkles className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              No campaigns yet. Start your first adventure!
            </p>
            <Link href="/settings">
              <Button variant="outline" className="border-fey-gold/30 hover:bg-fey-gold/10">
                Create Campaign
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <Sparkles className="h-5 w-5 text-fey-gold" />
          Active Campaigns
        </CardTitle>
        <CardDescription>Your ongoing adventures</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {campaigns.map((campaign) => {
          const isActive = campaign.id === activeCampaignId
          const sessionCount = getSessionCount(campaign.id)

          return (
            <div
              key={campaign.id}
              className={`group flex items-center gap-3 p-3 sm:p-4 rounded-lg border transition-colors ${
                isActive
                  ? "border-fey-gold/30 bg-fey-gold/5"
                  : "border-border hover:border-fey-gold/20 hover:bg-muted/30"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-medium text-foreground truncate">
                    {campaign.name}
                  </h4>
                  {isActive && (
                    <Badge
                      variant="outline"
                      className="border-fey-gold/50 text-fey-gold text-xs flex-shrink-0"
                    >
                      <Crown className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {sessionCount} {sessionCount === 1 ? "session" : "sessions"}
                  </span>
                  <span className="text-xs">
                    Created {formatDate(campaign.createdAt)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {!isActive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveCampaign(campaign.id)}
                    className="text-muted-foreground hover:text-fey-gold"
                  >
                    Set Active
                  </Button>
                )}
                <Link href="/">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={`Go to ${campaign.name}`}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
