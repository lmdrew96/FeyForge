"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { AppShell } from "@/components/app-shell"
import { useCampaignStore } from "@/lib/campaign-store"
import { JoinCodeField } from "@/components/join-code-field"
import {
  Sparkles,
  UserSquare2,
  Swords,
  BookMarked,
  Plus,
  ChevronDown,
  Ticket,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function DashboardPage() {
  // Membership-based: includes campaigns the user joined as a PLAYER, not just
  // ones they own/DM. Using the owned-only campaigns.list here was the bug that
  // clobbered a player-campaign selection on landing (it looked "deleted").
  const campaigns = useQuery(api.campaignMembers.listMyCampaigns)
  const activeId = useCampaignStore((s) => s.activeCampaignId)
  const setActiveCampaign = useCampaignStore((s) => s.setActiveCampaign)
  const active = campaigns?.find((c) => c.campaignId === activeId) ?? null

  // Auto-pick a campaign only when none is active, or the stored active id points
  // to a campaign the user no longer belongs to (e.g. removed on another device).
  // A valid player-campaign selection is now honored. Default prefers a DM campaign.
  useEffect(() => {
    if (!campaigns || campaigns.length === 0) return
    const stillMember = activeId && campaigns.some((c) => c.campaignId === activeId)
    if (!stillMember) {
      const fallback = campaigns.find((c) => c.role === "dm") ?? campaigns[0]
      setActiveCampaign(fallback.campaignId)
    }
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
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Path 1 — you're the DM: start a campaign */}
              <div
                className="rounded-xl p-5 flex flex-col"
                style={{
                  background: "var(--scene-surface)",
                  border: "1px dashed var(--scene-border)",
                }}
              >
                <BookMarked className="h-6 w-6 mb-3" style={{ color: "var(--scene-text-muted)" }} />
                <div className="font-semibold" style={{ color: "var(--scene-text-primary)" }}>
                  Start a campaign
                </div>
                <div className="text-sm mb-4 flex-1" style={{ color: "var(--scene-text-muted)" }}>
                  You&apos;re the DM — spin up a world to organize NPCs, sessions, and maps.
                </div>
                <Link
                  href="/campaigns"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80"
                  style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
                >
                  <Plus className="h-4 w-4" />
                  New Campaign
                </Link>
              </div>

              {/* Path 2 — you were invited: join with a code */}
              <div
                className="rounded-xl p-5 flex flex-col"
                style={{
                  background: "var(--scene-surface)",
                  border: "1px dashed var(--scene-border)",
                }}
              >
                <Ticket className="h-6 w-6 mb-3" style={{ color: "var(--scene-text-muted)" }} />
                <div className="font-semibold" style={{ color: "var(--scene-text-primary)" }}>
                  Join a campaign
                </div>
                <div className="text-sm mb-4 flex-1" style={{ color: "var(--scene-text-muted)" }}>
                  You have an invite — enter the code your DM shared to join the party.
                </div>
                <JoinCodeField />
              </div>
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
                {active?.role && (
                  <div
                    className="text-sm"
                    style={{ color: "var(--scene-text-muted)" }}
                  >
                    {active.role === "dm" ? "You're the DM" : "You're a player"}
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
                          key={c.campaignId}
                          onSelect={() => setActiveCampaign(c.campaignId)}
                          className="cursor-pointer"
                        >
                          <span className="flex-1 truncate">{c.name}</span>
                          {c.campaignId === activeId && (
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
