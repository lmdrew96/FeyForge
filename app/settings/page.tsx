"use client"

import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

export default function SettingsPage() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  return (
    <AppShell>
      <div className="p-6 max-w-2xl mx-auto space-y-8">
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
        >
          Settings
        </h1>

        {/* Appearance */}
        <section
          className="rounded-lg p-6 space-y-4"
          style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
        >
          <h2
            className="text-sm font-semibold uppercase tracking-wider"
            style={{ color: "var(--scene-text-muted)" }}
          >
            Appearance
          </h2>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--scene-text-primary)" }}>
                Theme
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--scene-text-muted)" }}>
                {mounted ? `Currently: ${resolvedTheme}` : "Detecting system preference…"}
              </p>
            </div>
            <ThemeToggle />
          </div>

          <p className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
            Scene palettes override the app theme during live sessions — the world always looks the way the DM intends.
          </p>
        </section>

        {/* About */}
        <section
          className="rounded-lg p-6 space-y-4"
          style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
        >
          <h2
            className="text-sm font-semibold uppercase tracking-wider"
            style={{ color: "var(--scene-text-muted)" }}
          >
            About
          </h2>

          <div className="flex items-center justify-between">
            <p className="text-sm font-medium" style={{ color: "var(--scene-text-primary)" }}>
              Version
            </p>
            <span className="text-sm font-mono" style={{ color: "var(--scene-text-muted)" }}>
              v{process.env.NEXT_PUBLIC_APP_VERSION}
            </span>
          </div>

          <Link
            href="/acknowledgments"
            className="inline-block text-sm hover:opacity-80 transition-opacity"
            style={{ color: "var(--scene-accent)" }}
          >
            Acknowledgments &amp; credits →
          </Link>
        </section>
      </div>
    </AppShell>
  )
}
