"use client"

import { AppShell } from "@/components/app-shell"
import Link from "next/link"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useCampaignStore } from "@/lib/campaign-store"
import { Users, Map, Bot, ScrollText, Globe, Swords, Network, Music } from "lucide-react"

type Tool = { href: string; icon: React.ElementType; label: string; desc: string }

const DM_TOOLS: Tool[] = [
  { href: "/dm/npcs", icon: Users, label: "NPCs", desc: "Manage your NPC roster" },
  { href: "/sessions", icon: ScrollText, label: "Sessions", desc: "Session logs, plot threads, and XP" },
  { href: "/dm/encounters", icon: Swords, label: "Encounters", desc: "CR → XP difficulty calculator" },
  { href: "/dm/campaign-web", icon: Network, label: "Story Web", desc: "Map NPC, location, and faction ties" },
  { href: "/dm/scenes", icon: Map, label: "Scenes", desc: "Preview and switch scenes" },
  { href: "/dm/library", icon: Music, label: "Audio Library", desc: "Curate scene music and ambience" },
  { href: "/dm/assistant", icon: Bot, label: "AI Assistant", desc: "Claude-powered DM help" },
  { href: "/dm/wiki", icon: ScrollText, label: "Campaign Wiki", desc: "World lore and notes" },
  { href: "/dm/world-map", icon: Globe, label: "World Map", desc: "Locations and regions" },
]

// Players see only the shared surfaces the DM reveals to them.
const PLAYER_TOOLS: Tool[] = [
  { href: "/dm/wiki", icon: ScrollText, label: "Campaign Wiki", desc: "Lore your DM has shared" },
  { href: "/dm/world-map", icon: Globe, label: "World Map", desc: "Places your party has discovered" },
]

export default function DMPage() {
  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId)
  const role = useQuery(
    api.campaignMembers.getMyRole,
    activeCampaignId ? { campaignId: activeCampaignId as Id<"campaigns"> } : "skip",
  )
  const isPlayer = role === "player"
  const tools = isPlayer ? PLAYER_TOOLS : DM_TOOLS

  return (
    <AppShell>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1
            className="text-2xl font-bold mb-2"
            style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
          >
            {isPlayer ? "Campaign" : "DM Tools"}
          </h1>
          <p style={{ color: "var(--scene-text-muted)" }}>
            {isPlayer ? "What your DM has shared with the party." : "The conductor’s panel."}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {tools.map(({ href, icon: Icon, label, desc }) => (
            <Link
              key={href}
              href={href}
              className="rounded-lg p-5 flex items-start gap-4 hover:opacity-90 transition-opacity"
              style={{
                background: "var(--scene-surface)",
                border: "1px solid var(--scene-border)",
              }}
            >
              <Icon className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "var(--scene-accent)" }} />
              <div>
                <div className="font-medium" style={{ color: "var(--scene-text-primary)" }}>
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
