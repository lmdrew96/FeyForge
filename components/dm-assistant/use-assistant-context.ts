"use client"

import { useMemo } from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { formatWorldContext, formatSessionState } from "@/lib/worldMap/ai-context"
import { useCampaignStore } from "@/lib/campaign-store"

// ---------------------------------------------------------------------------
// Shared DM Assistant context resolver.
//
// Both the full /dm/assistant page and the floating widget feed the model the
// SAME grounding: the active campaign + its world (realms/faiths/settlements/
// events) + the live session NOW (active scene, live combat, party roster). This
// hook centralizes those reads + the prompt assembly so the two entry points can't
// drift. All reads are membership-gated server-side and skip until there's an
// active campaign / live session, so it's cheap when nothing is running.
// ---------------------------------------------------------------------------

const buildContext = (
  campaign: {
    name: string
    description?: string
    edition?: string
  } | null,
  worldContext = "",
  sessionContext = "",
): string => {
  // Both world + session blocks already lead with their own blank-line separator
  // (or are ""), so they concatenate cleanly onto the campaign header.
  if (!campaign) return (worldContext + sessionContext).trim()
  const lines = [`Campaign: ${campaign.name}`]
  if (campaign.edition) lines.push(`D&D edition: ${campaign.edition}`)
  if (campaign.description) lines.push(`Description: ${campaign.description}`)
  return lines.join("\n") + worldContext + sessionContext
}

export interface DMAssistantContext {
  activeCampaignId: string | null
  activeCampaign: { _id: string; name: string; description?: string; edition?: string } | null
  campaignContext: string
}

export function useDMAssistantContext(): DMAssistantContext {
  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId)
  const campaigns = useQuery(api.campaigns.list)
  const activeCampaign = useMemo(
    () => campaigns?.find((c) => c._id === activeCampaignId) ?? null,
    [campaigns, activeCampaignId],
  )

  const campaignArg = activeCampaignId
    ? { campaignId: activeCampaignId as Id<"campaigns"> }
    : "skip"

  // World context: the map's realms/faiths/events/settlements so answers stay
  // consistent with the DM's actual world (see lib/worldMap/ai-context).
  const worldMap = useQuery(api.worldMap.getMap, campaignArg)
  const worldLocations = useQuery(api.worldMap.listLocations, campaignArg)
  const worldbuilding = useQuery(api.worldMap.getWorldbuilding, campaignArg)
  const worldContext = useMemo(
    () =>
      formatWorldContext({
        mapName: worldMap?.name,
        realms: worldbuilding?.realms,
        faiths: worldbuilding?.faiths,
        worldEvents: worldMap?.worldEvents,
        settlements: worldLocations,
      }),
    [worldMap, worldbuilding, worldLocations],
  )

  // Live session awareness: when a session is running, also feed the assistant the
  // NOW — active scene, the live fight (whose turn/round/HP/conditions), the party
  // roster. The DM here is a member, so getCombat returns exact HP. Session-scoped
  // reads skip until a session exists.
  const activeSession = useQuery(api.liveSessions.getActiveSession, campaignArg)
  const sessionArg = activeSession?._id ? { sessionId: activeSession._id } : "skip"
  const liveCombat = useQuery(api.liveCombat.getCombat, sessionArg)
  const partyMembers = useQuery(api.liveSessions.getPartyMembers, sessionArg)
  const sessionContext = useMemo(
    () =>
      formatSessionState({
        sceneName: activeSession?.activeScene,
        sceneTime: activeSession?.sceneTime ?? null,
        combat: liveCombat
          ? { round: liveCombat.round, combatants: liveCombat.combatants }
          : null,
        party: (partyMembers ?? []).map((m) => ({
          name: m.character?.name ?? "Unknown",
          characterClass: m.character?.characterClass,
          subclass: m.character?.subclass,
          level: m.character?.level,
          hitPoints: m.character?.hitPoints,
          conditions: m.conditions,
        })),
      }),
    [activeSession, liveCombat, partyMembers],
  )

  const campaignContext = useMemo(
    () => buildContext(activeCampaign, worldContext, sessionContext),
    [activeCampaign, worldContext, sessionContext],
  )

  return { activeCampaignId, activeCampaign, campaignContext }
}
