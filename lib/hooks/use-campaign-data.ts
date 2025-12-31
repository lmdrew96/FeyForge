"use client"

import { useCampaignStore } from "@/lib/campaign-store"
import { useNPCStore } from "@/lib/npc-store"
import { useSessionStore } from "@/lib/session-store"
import { useCharacterStore } from "@/lib/feyforge-character-store"
import { useWorldStore } from "@/lib/world-store"
import { useCombatStore } from "@/lib/combat-store"

// Hook to get the active campaign ID
export function useActiveCampaignId() {
  return useCampaignStore((s) => s.activeCampaignId)
}

// Hook to get the active campaign
export function useActiveCampaign() {
  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId)
  const campaigns = useCampaignStore((s) => s.campaigns)
  return campaigns.find((c) => c.id === activeCampaignId)
}

// Hook to get NPCs for active campaign only
export function useCampaignNPCs() {
  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId)
  const allNPCs = useNPCStore((s) => s.npcs)

  return allNPCs.filter((npc) => npc.campaignId === activeCampaignId)
}

// Hook to get sessions for active campaign only
export function useCampaignSessions() {
  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId)
  const allSessions = useSessionStore((s) => s.sessions)

  return allSessions.filter((session) => session.campaignId === activeCampaignId)
}

// Hook to get plot threads for active campaign only
export function useCampaignPlotThreads() {
  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId)
  const allPlotThreads = useSessionStore((s) => s.plotThreads)

  return allPlotThreads.filter((thread) => thread.campaignId === activeCampaignId)
}

// Hook to get characters for active campaign only
export function useCampaignCharacters() {
  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId)
  const allCharacters = useCharacterStore((s) => s.characters)

  return allCharacters.filter((char) => char.campaignId === activeCampaignId)
}

// Hook to get map locations for active campaign only
export function useCampaignLocations() {
  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId)
  const allLocations = useWorldStore((s) => s.locations)

  return allLocations.filter((loc) => loc.campaignId === activeCampaignId)
}
