"use client"

import { Users, ScrollText, Sparkles } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useCharactersStore } from "@/lib/characters-store"
import { useSessionsStore } from "@/lib/sessions-store"
import { useCampaignsStore } from "@/lib/campaigns-store"

interface StatItemProps {
  icon: React.ReactNode
  label: string
  value: number | string
  accentColor: string
}

function StatItem({ icon, label, value, accentColor }: StatItemProps) {
  return (
    <div className="flex items-center gap-3 p-3 sm:p-4 rounded-lg bg-muted/30 border border-border">
      <div
        className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center shrink-0 ${accentColor}`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-2xl sm:text-3xl font-bold text-foreground">{value}</p>
        <p className="text-xs sm:text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

export function AccountStats() {
  const { characters } = useCharactersStore()
  const { sessions } = useSessionsStore()
  const { campaigns } = useCampaignsStore()

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <Sparkles className="h-5 w-5 text-fey-purple" />
          Stats Overview
        </CardTitle>
        <CardDescription>Your journey at a glance</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <StatItem
            icon={<Users className="h-5 w-5 sm:h-6 sm:w-6 text-fey-cyan" />}
            label="Characters Created"
            value={characters.length}
            accentColor="bg-fey-cyan/10"
          />
          <StatItem
            icon={<ScrollText className="h-5 w-5 sm:h-6 sm:w-6 text-fey-purple" />}
            label="Sessions Logged"
            value={sessions.length}
            accentColor="bg-fey-purple/10"
          />
          <StatItem
            icon={<Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-fey-gold" />}
            label="Campaigns"
            value={campaigns.length}
            accentColor="bg-fey-gold/10"
          />
        </div>
      </CardContent>
    </Card>
  )
}
