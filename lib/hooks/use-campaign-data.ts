"use client"

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useCampaignStore } from "@/lib/campaign-store"
import { useNPCStore } from "@/lib/npc-store"
import { useSessionStore } from "@/lib/session-store"

export function useActiveCampaignId() {
  return useCampaignStore((s) => s.activeCampaignId)
}

export function useActiveCampaign() {
  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId)
  const campaigns = useQuery(api.campaigns.list) ?? []
  return campaigns.find((c) => c._id === activeCampaignId)
}

// These hooks still use their respective stores — will be migrated per domain
export function useCampaignNPCs() {
  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId)
  const allNPCs = useNPCStore((s) => s.npcs)
  return allNPCs.filter((npc) => npc.campaignId === activeCampaignId)
}

export function useCampaignSessions() {
  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId)
  const allSessions = useSessionStore((s) => s.sessions)
  return allSessions.filter((session) => session.campaignId === activeCampaignId)
}

export function useCampaignPlotThreads() {
  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId)
  const allPlotThreads = useSessionStore((s) => s.plotThreads)
  return allPlotThreads.filter((thread) => thread.campaignId === activeCampaignId)
}
