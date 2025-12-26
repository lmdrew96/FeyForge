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
      color: "#931BE4",
    },
    {
      name: "Sessions",
      value: sessions.filter((s) => s.status === "completed").length,
      icon: Scroll,
      color: "#47D1BB",
    },
    {
      name: "NPCs",
      value: npcs.length,
      icon: BookOpen,
      color: "#95B851",
    },
    {
      name: "Encounters",
      value: encounterHistory?.length ?? 0,
      icon: Swords,
      color: "#521BC0",
    },
  ]

  return (
    <div className="grid gap-0 grid-cols-2 lg:grid-cols-4 pb-6">
      {stats.map((stat, index) => (
        <div
          key={stat.name}
          className={cn(
            "p-4 sm:p-6 flex flex-col gap-2 transition-colors duration-150 hover:bg-accent/30",
            index < stats.length - 1 && "border-r",
            index < 2 && "border-b lg:border-b-0",
          )}
        >
          <div className="flex items-center gap-3">
            <stat.icon className="h-6 w-6 sm:h-8 sm:w-8" style={{ color: stat.color }} />
            <p className="text-2xl sm:text-3xl font-bold font-serif" style={{ color: stat.color }}>
              {stat.value}
            </p>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">{stat.name}</p>
        </div>
      ))}
    </div>
  )
}
