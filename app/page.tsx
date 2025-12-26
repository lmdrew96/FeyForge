import { AppShell } from "@/components/layout/app-shell"
import { QuickStats } from "@/components/dashboard/quick-stats"
import { RecentSessions } from "@/components/dashboard/recent-sessions"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { AIAssistantWidget } from "@/components/dashboard/ai-assistant-widget"
import { CampaignSelector } from "@/components/dashboard/campaign-selector"

export default function DashboardPage() {
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
