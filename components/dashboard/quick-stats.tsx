"use client"

import type React from "react"
import { useEffect } from "react"

import { Users, Calendar, UserCircle, TrendingUp } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useCampaignCharacters, useCampaignSessions, useCampaignNPCs } from "@/lib/hooks/use-campaign-data"
import { useCharacterStore } from "@/lib/feyforge-character-store"
import { useSessionStore } from "@/lib/session-store"
import { useNPCStore } from "@/lib/npc-store"

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: number | string
  accentColor: string
}

function StatCard({ icon, label, value, accentColor }: StatCardProps) {
  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border hover:border-border/80 transition-colors min-w-0">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <div
            className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0 ${accentColor}`}
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xl sm:text-2xl font-bold text-foreground truncate">{value}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function QuickStats() {
  const { initialize: initChars, isInitialized: charsInit } = useCharacterStore()
  const { initialize: initSessions, isInitialized: sessionsInit } = useSessionStore()
  const { initialize: initNPCs, isInitialized: npcsInit } = useNPCStore()
  
  const characters = useCampaignCharacters()
  const sessions = useCampaignSessions()
  const npcs = useCampaignNPCs()

  useEffect(() => {
    if (!charsInit) initChars()
    if (!sessionsInit) initSessions()
    if (!npcsInit) initNPCs()
  }, [initChars, initSessions, initNPCs, charsInit, sessionsInit, npcsInit])

  // Calculate total party level
  const totalPartyLevel = characters.reduce((sum, char) => sum + char.level, 0)

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 w-full">
      <StatCard
        icon={<Users className="h-4 w-4 sm:h-5 sm:w-5 text-fey-cyan" />}
        label="Characters"
        value={characters.length}
        accentColor="bg-fey-cyan/10"
      />
      <StatCard
        icon={<Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-fey-purple" />}
        label="Sessions"
        value={sessions.length}
        accentColor="bg-fey-purple/10"
      />
      <StatCard
        icon={<UserCircle className="h-4 w-4 sm:h-5 sm:w-5 text-fey-gold" />}
        label="NPCs"
        value={npcs.length}
        accentColor="bg-fey-gold/10"
      />
      <StatCard
        icon={<TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-fey-forest" />}
        label="Party Level"
        value={totalPartyLevel}
        accentColor="bg-fey-forest/10"
      />
    </div>
  )
}
