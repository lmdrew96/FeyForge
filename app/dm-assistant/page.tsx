"use client"

import { AppShell } from "@/components/app-shell"
import { DMAssistant } from "@/components/dm-assistant/dm-assistant"

export default function DMAssistantPage() {
  return (
    <AppShell pageTitle="DM Assistant">
      {/* Full height container - subtracting header height */}
      <div className="h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] lg:h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden">
        <DMAssistant />
      </div>
    </AppShell>
  )
}
