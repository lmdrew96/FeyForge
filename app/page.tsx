"use client"

import { AppShell } from "@/components/layout/app-shell"
import { QuickStats } from "@/components/dashboard/quick-stats"
import { RecentSessions } from "@/components/dashboard/recent-sessions"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { AIAssistantWidget } from "@/components/dashboard/ai-assistant-widget"
import { CampaignSelector } from "@/components/dashboard/campaign-selector"
import { useCampaignStore } from "@/lib/campaign-store"
import { useCampaignCharacters, useCampaignSessions } from "@/lib/hooks/use-campaign-data"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Users, Scroll, Dices, BookOpen, Sparkles } from "lucide-react"

export default function DashboardPage() {
  const campaigns = useCampaignStore((state) => state.campaigns)
  const characters = useCampaignCharacters()
  const sessions = useCampaignSessions()

  const hasData = campaigns.length > 0 || characters.length > 0 || sessions.length > 0

  if (!hasData) {
    return (
      <AppShell title="Welcome to FeyForge" subtitle="Where Campaigns Are Forged">
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
          <div className="fairy-dust" />

          {/* Hero Section */}
          <div className="text-center max-w-2xl mb-12">
            <h1 className="text-4xl md:text-5xl font-bold font-serif text-fey-gradient mb-4">Welcome to FeyForge</h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8">
              Your all-in-one D&D campaign management suite. Create characters, track sessions, and bring your stories
              to life.
            </p>
          </div>

          {/* Quick Start Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl mb-8">
            <Link href="/characters/new" className="group">
              <div className="p-8 rounded-2xl border-2 border-border hover:border-primary transition-all duration-200 hover:shadow-lg hover:shadow-primary/20 bg-card/50 backdrop-blur-sm text-center h-full">
                <Users className="h-16 w-16 mx-auto text-primary mb-4 filter group-hover:drop-shadow-[0_0_15px_rgba(71,209,187,0.5)] transition-all" />
                <h3 className="text-2xl font-semibold font-serif mb-2 text-foreground">Create Character</h3>
                <p className="text-muted-foreground">Build your first hero</p>
              </div>
            </Link>

            <Link href="/campaigns/new" className="group">
              <div className="p-8 rounded-2xl border-2 border-border hover:border-secondary transition-all duration-200 hover:shadow-lg hover:shadow-secondary/20 bg-card/50 backdrop-blur-sm text-center h-full">
                <Scroll className="h-16 w-16 mx-auto text-secondary mb-4 filter group-hover:drop-shadow-[0_0_15px_rgba(147,27,228,0.5)] transition-all" />
                <h3 className="text-2xl font-semibold font-serif mb-2 text-foreground">Start Campaign</h3>
                <p className="text-muted-foreground">Begin your adventure</p>
              </div>
            </Link>
          </div>

          {/* Secondary Actions */}
          <div className="flex flex-wrap justify-center gap-4">
            <Button asChild variant="ghost" size="lg">
              <Link href="/dice">
                <Dices className="h-5 w-5 mr-2" />
                Try Dice Roller
              </Link>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <Link href="/codex">
                <BookOpen className="h-5 w-5 mr-2" />
                Browse Codex
              </Link>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <Link href="/dm-assistant">
                <Sparkles className="h-5 w-5 mr-2" />
                AI Assistant
              </Link>
            </Button>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="The Forge" subtitle="Where Campaigns Are Forged">
      <div className="space-y-6 sm:space-y-8 max-w-full">
        {/* Campaign Selector */}
        <CampaignSelector />

        <div className="border-t" />

        {/* Quick Stats */}
        <QuickStats />

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          {/* Left Column - 2/3 width on large screens */}
          <div className="lg:col-span-2 space-y-3 sm:space-y-4 md:space-y-6 min-w-0">
            <RecentSessions />
          </div>

          {/* Right Column - 1/3 width on large screens */}
          <div className="space-y-3 sm:space-y-4 md:space-y-6 min-w-0">
            <QuickActions />
            <AIAssistantWidget />
          </div>
        </div>
      </div>
    </AppShell>
  )
}
