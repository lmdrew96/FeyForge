"use client"

import type React from "react"
import { useState } from "react"
import { Sidebar } from "./sidebar"
import { Header } from "./header"
import { CampaignProvider } from "@/components/providers/campaign-provider"

interface AppShellProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
}

export function AppShell({ children, title, subtitle }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <CampaignProvider>
      <div className="min-h-screen max-h-screen bg-background magical-bg parchment-bg overflow-hidden flex">
        <Sidebar collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />
        <div
          className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
            sidebarCollapsed ? "ml-20" : "ml-64"
          } max-md:ml-0`}
        >
          <Header title={title} subtitle={subtitle} />
          <main className="flex-1 p-2 sm:p-3 md:p-4 lg:p-6 xl:p-8 overflow-auto">
            <div className="max-w-full">{children}</div>
          </main>
        </div>
      </div>
    </CampaignProvider>
  )
}
