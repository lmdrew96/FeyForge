"use client"

import { AppShell } from "@/components/app-shell"
import { CodexBrowser } from "@/components/codex/codex-browser"

export default function CodexPage() {
  return (
    <AppShell pageTitle="Codex">
      <div className="p-3 sm:p-4 lg:p-6 w-full max-w-full min-w-0">
        <CodexBrowser />
      </div>
    </AppShell>
  )
}
