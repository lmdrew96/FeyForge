import { AppShell } from "@/components/layout/app-shell"
import { QuickStats } from "@/components/dashboard/quick-stats"
import { RecentSessions } from "@/components/dashboard/recent-sessions"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { AIAssistantWidget } from "@/components/dashboard/ai-assistant-widget"
import { CampaignSelector } from "@/components/dashboard/campaign-selector"

export default function DashboardPage() {
  return (
    <AppShell title="The Forge" subtitle="Where Campaigns Are Forged">
      <div className="space-y-4 md:space-y-6 max-w-full overflow-hidden">
        {/* Campaign Selector */}
        <CampaignSelector />

        <div className="magical-divider" />

        {/* Quick Stats */}
        <QuickStats />

        {/* Main Grid - Responsive stacking */}
        <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-3">
          {/* Left Column - 2/3 width on large screens */}
          <div className="lg:col-span-2 space-y-4 md:space-y-6 min-w-0">
            <RecentSessions />
          </div>

          {/* Right Column - 1/3 width on large screens */}
          <div className="space-y-4 md:space-y-6 min-w-0">
            <QuickActions />
            <AIAssistantWidget />
          </div>
        </div>
      </div>
    </AppShell>
  )
}
