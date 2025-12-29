"use client"

import { AppShell } from "@/components/app-shell"
import { AccountProfile } from "@/components/account/account-profile"
import { ActiveCampaigns } from "@/components/account/active-campaigns"
import { AccountStats } from "@/components/account/account-stats"
import { AccountQuickLinks } from "@/components/account/account-quick-links"
import { AccountDangerZone } from "@/components/account/account-danger-zone"

export default function AccountPage() {
  return (
    <AppShell pageTitle="Account">
      <div className="p-3 sm:p-4 lg:p-6 w-full max-w-full overflow-x-hidden">
        <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 w-full">
          {/* Profile Section */}
          <AccountProfile />

          {/* Stats Overview */}
          <AccountStats />

          {/* Active Campaigns */}
          <ActiveCampaigns />

          {/* Quick Links */}
          <AccountQuickLinks />

          {/* Danger Zone */}
          <AccountDangerZone />
        </div>
      </div>
    </AppShell>
  )
}
