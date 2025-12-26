"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Users, Scroll, Swords, BookOpen } from "lucide-react"
import { useCharacterStore } from "@/lib/character-store"
import { useSessionStore } from "@/lib/session-store"
import { useNPCStore } from "@/lib/npc-store"
import { useCombatStore } from "@/lib/combat-store"

export function QuickStats() {
  const characters = useCharacterStore((s) => s.characters)
  const sessions = useSessionStore((s) => s.sessions)
  const npcs = useNPCStore((s) => s.npcs)
  const encounterHistory = useCombatStore((s) => s.encounterHistory)

  const stats = [
    {
      name: "Active Characters",
      value: characters.length,
      icon: Users,
      description: "Total created",
      glowColor: "#b7adc7",
    },
    {
      name: "Sessions Played",
      value: sessions.filter((s) => s.status === "completed").length,
      icon: Scroll,
      description: "Completed sessions",
      glowColor: "#347975",
    },
    {
      name: "NPCs Created",
      value: npcs.length,
      icon: BookOpen,
      description: "Across all campaigns",
      glowColor: "#42e2ed",
    },
    {
      name: "Encounters Run",
      value: encounterHistory?.length ?? 0,
      icon: Swords,
      description: "Total combats",
      glowColor: "#a36424",
    },
  ]

  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat, index) => (
        <Card
          key={stat.name}
          className="stagger-item stat-card overflow-hidden border-0 min-w-0"
          style={{
            animationDelay: `${index * 0.1}s`,
            ["--stat-glow-color" as any]: stat.glowColor,
          }}
        >
          <CardContent className="p-3 sm:p-4 md:p-5">
            <div className="flex items-center justify-between gap-2 sm:gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-lavender truncate">{stat.name}</p>
                <p className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold font-serif text-white mt-0.5 sm:mt-1">
                  {stat.value}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">{stat.description}</p>
              </div>
              <div
                className="h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 lg:h-20 lg:w-20 shrink-0 rounded-xl sm:rounded-2xl flex items-center justify-center border shadow-lg backdrop-blur-sm"
                style={{
                  background: `linear-gradient(135deg, ${stat.glowColor}22, ${stat.glowColor}11)`,
                  borderColor: `${stat.glowColor}44`,
                }}
              >
                <stat.icon
                  className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 lg:h-10 lg:w-10"
                  style={{ color: stat.glowColor }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
