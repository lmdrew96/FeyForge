"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { AppShell } from "@/components/app-shell"
import { useCampaignStore } from "@/lib/campaign-store"
import { useActiveCampaign } from "@/lib/hooks/use-campaign-data"
import {
  Sparkles,
  UserSquare2,
  Swords,
  BookMarked,
  Plus,
  ChevronDown,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function DashboardPage() {
  const campaigns = useQuery(api.campaigns.list)
  const active = useActiveCampaign()
  const activeId = useCampaignStore((s) => s.activeCampaignId)
  const setActiveCampaign = useCampaignStore((s) => s.setActiveCampaign)

  // Auto-pick a campaign when none is active, or when the stored active id
  // points to a campaign that no longer exists (e.g. deleted on another device).
  useEffect(() => {
    if (!campaigns || campaigns.length === 0) return
    const stillExists = activeId && campaigns.some((c) => c._id === activeId)
    if (!stillExists) setActiveCampaign(campaigns[0]._id)
  }, [campaigns, activeId, setActiveCampaign])

  return (
    <AppShell>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1
            className="text-3xl font-bold mb-2"
            style={{ fontFamily: "var(--font-display)", color: "var(--scene-accent)" }}
          >
            Welcome to FeyForge
          </h1>
          <p style={{ color: "var(--scene-text-muted)" }}>
            Your campaign awaits. The DM sets the scene — the table comes alive.
          </p>
        </div>

        {/* Active campaign surface */}
        <div className="mb-6">
          {campaigns === undefined && (
            <div
              className="rounded-xl h-24 animate-pulse"
              style={{
                background: "var(--scene-surface)",
                border: "1px solid var(--scene-border)",
              }}
            />
          )}

          {campaigns && campaigns.length === 0 && (
            <div
              className="rounded-xl p-5 flex items-center gap-4"
              style={{
                background: "var(--scene-surface)",
                border: "1px dashed var(--scene-border)",
              }}
            >
              <BookMarked
                className="h-6 w-6 shrink-0"
                style={{ color: "var(--scene-text-muted)" }}
              />
              <div className="flex-1 min-w-0">
                <div
                  className="font-semibold"
                  style={{ color: "var(--scene-text-primary)" }}
                >
                  Start your first campaign
                </div>
                <div
                  className="text-sm"
                  style={{ color: "var(--scene-text-muted)" }}
                >
                  Spin up a campaign to organize NPCs, sessions, and world details.
                </div>
              </div>
              <Link
                href="/campaigns"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80 shrink-0"
                style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
              >
                <Plus className="h-4 w-4" />
                New Campaign
              </Link>
            </div>
          )}

          {campaigns && campaigns.length > 0 && (
            <div
              className="rounded-xl p-5 flex items-center gap-4"
              style={{
                background: "color-mix(in srgb, var(--scene-accent) 6%, var(--scene-surface))",
                border: "1px solid color-mix(in srgb, var(--scene-accent) 20%, var(--scene-border))",
              }}
            >
              <BookMarked
                className="h-6 w-6 shrink-0"
                style={{ color: "var(--scene-accent)" }}
              />
              <div className="flex-1 min-w-0">
                <div
                  className="text-xs uppercase tracking-widest mb-0.5"
                  style={{ color: "var(--scene-text-muted)" }}
                >
                  Active campaign
                </div>
                <div
                  className="font-semibold truncate"
                  style={{
                    fontFamily: "var(--font-cinzel)",
                    color: "var(--scene-text-primary)",
                  }}
                >
                  {active?.name ?? "—"}
                </div>
                {active?.description && (
                  <div
                    className="text-sm truncate"
                    style={{ color: "var(--scene-text-muted)" }}
                  >
                    {active.description}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {campaigns.length > 1 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-opacity hover:opacity-80"
                        style={{
                          background: "var(--scene-surface)",
                          color: "var(--scene-text-primary)",
                          border: "1px solid var(--scene-border)",
                        }}
                      >
                        Switch
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-56">
                      {campaigns.map((c) => (
                        <DropdownMenuItem
                          key={c._id}
                          onSelect={() => setActiveCampaign(c._id)}
                          className="cursor-pointer"
                        >
                          <span className="flex-1 truncate">{c.name}</span>
                          {c._id === activeId && (
                            <span className="text-xs" style={{ color: "var(--scene-accent)" }}>
                              ✓
                            </span>
                          )}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/campaigns" className="cursor-pointer">
                          Manage campaigns…
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <Link
                  href="/campaigns"
                  className="text-sm px-3 py-1.5 rounded-md transition-opacity hover:opacity-80"
                  style={{
                    background: "var(--scene-surface)",
                    color: "var(--scene-text-primary)",
                    border: "1px solid var(--scene-border)",
                  }}
                >
                  Manage
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              href: "/session",
              icon: Sparkles,
              label: "Live Session",
              desc: "Join or start a session",
            },
            {
              href: "/characters",
              icon: UserSquare2,
              label: "Characters",
              desc: "Your roster",
            },
            {
              href: "/dm",
              icon: Swords,
              label: "DM Tools",
              desc: "Conductor's panel",
            },
          ].map(({ href, icon: Icon, label, desc }) => (
            <Link
              key={href}
              href={href}
              className="rounded-lg p-5 flex flex-col gap-3 hover:opacity-90 transition-opacity"
              style={{
                background: "var(--scene-surface)",
                border: "1px solid var(--scene-border)",
              }}
            >
              <Icon className="w-6 h-6" style={{ color: "var(--scene-accent)" }} />
              <div>
                <div
                  className="font-semibold"
                  style={{ color: "var(--scene-text-primary)" }}
                >
                  {label}
                </div>
                <div className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
                  {desc}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
