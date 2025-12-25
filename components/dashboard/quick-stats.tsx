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
      iconColor: "text-magic-cyan",
      bgGradient: "from-magic-cyan/25 to-teal/10",
    },
    {
      name: "Sessions Played",
      value: sessions.filter((s) => s.status === "completed").length,
      icon: Scroll,
      description: "Completed sessions",
      iconColor: "text-copper-bright",
      bgGradient: "from-copper/25 to-copper-bright/10",
    },
    {
      name: "NPCs Created",
      value: npcs.length,
      icon: BookOpen,
      description: "Across all campaigns",
      iconColor: "text-deep-indigo-light",
      bgGradient: "from-deep-indigo/25 to-deep-indigo-light/10",
    },
    {
      name: "Encounters Run",
      value: encounterHistory?.length ?? 0,
      icon: Swords,
      description: "Total combats",
      iconColor: "text-teal-light",
      bgGradient: "from-teal/25 to-forest-green/10",
    },
  ]

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat, index) => (
        <Card
          key={stat.name}
          className="stagger-item bg-card stat-card-glow overflow-hidden border-0 min-w-0"
          style={{ animationDelay: `${index * 0.1}s` }}
        >
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs md:text-sm font-medium text-muted-foreground truncate">{stat.name}</p>
                <p className="text-2xl md:text-4xl font-bold font-serif text-gold-gradient mt-1">{stat.value}</p>
                <p className="text-xs text-lavender mt-1 md:mt-2 truncate">{stat.description}</p>
              </div>
              <div
                className={`h-12 w-12 md:h-16 md:w-16 shrink-0 rounded-[1.25rem] md:rounded-[1.5rem] bg-gradient-to-br ${stat.bgGradient} flex items-center justify-center border border-white/10 shadow-lg`}
              >
                <stat.icon className={`h-6 w-6 md:h-8 md:w-8 ${stat.iconColor}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
