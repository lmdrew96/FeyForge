"use client"

import { Users, Scroll, Swords, BookOpen } from "lucide-react"
import {
  useCampaignCharacters,
  useCampaignSessions,
  useCampaignNPCs,
  useCampaignEncounters,
} from "@/lib/hooks/use-campaign-data"
import { cn } from "@/lib/utils"

export function QuickStats() {
  const characters = useCampaignCharacters()
  const sessions = useCampaignSessions()
  const npcs = useCampaignNPCs()
  const encounterHistory = useCampaignEncounters()

  const stats = [
    {
      name: "Characters",
      value: characters.length,
      icon: Users,
      colorClass: "text-accent",
    },
    {
      name: "Sessions",
      value: sessions.filter((s) => s.status === "completed").length,
      icon: Scroll,
      colorClass: "text-primary",
    },
    {
      name: "NPCs",
      value: npcs.length,
      icon: BookOpen,
      colorClass: "text-primary",
    },
    {
      name: "Encounters",
      value: encounterHistory?.length ?? 0,
      icon: Swords,
      colorClass: "text-accent",
    },
  ]

  return (
    <div className="grid gap-0 grid-cols-2 lg:grid-cols-4 spacing-section-bottom">
      {stats.map((stat, index) => (
        <div
          key={stat.name}
          className={cn(
            "spacing-compact flex flex-col gap-fluid-sm transition-colors duration-150 hover:bg-accent/30",
            index < stats.length - 1 && "border-r",
            index < 2 && "border-b lg:border-b-0",
          )}
        >
          <div className="flex items-center gap-fluid-md">
            <stat.icon className={cn("icon-lg shrink-0", stat.colorClass)} />
            <p className={cn("text-stat font-bold font-serif", stat.colorClass)}>{stat.value}</p>
          </div>
          <p className="text-label text-muted-foreground">{stat.name}</p>
        </div>
      ))}
    </div>
  )
}
