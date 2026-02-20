"use client"

import { AppShell } from "@/components/app-shell"
import { CampaignSelector } from "@/components/dashboard/campaign-selector"
import { QuickStats } from "@/components/dashboard/quick-stats"
import { RecentSessions } from "@/components/dashboard/recent-sessions"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { AIAssistantWidget } from "@/components/dashboard/ai-assistant-widget"

export default function DashboardPage() {
  return (
    <AppShell pageTitle="Dashboard">
      {/* Dashboard Content */}
      <div className="p-3 sm:p-4 lg:p-6 w-full max-w-full overflow-x-hidden">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 w-full">
          {/* Mobile Campaign Selector */}
          <div className="lg:hidden">
            <CampaignSelector />
          </div>

          {/* Quick Stats */}
          <section className="w-full">
            <QuickStats />
          </section>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 w-full">
            {/* Recent Sessions - 2/3 width on desktop */}
            <div className="lg:col-span-2 w-full min-w-0">
              <RecentSessions />
            </div>

            {/* Quick Actions + AI Widget - 1/3 width on desktop */}
            <div className="space-y-4 sm:space-y-6 w-full min-w-0">
              <QuickActions />
              <AIAssistantWidget />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
