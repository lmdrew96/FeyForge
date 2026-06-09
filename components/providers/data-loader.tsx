"use client"

import { useEffect, useRef } from "react"
import { useQuery, useMutation } from "convex/react"
import { useUser } from "@clerk/nextjs"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { useCampaignStore } from "@/lib/campaign-store"
import { useNPCStore } from "@/lib/npc-store"
import { useSessionStore } from "@/lib/session-store"
import { useCombatStore } from "@/lib/combat-store"
import { useDMAssistantStore } from "@/lib/dm-assistant-store"
import type { NPC } from "@/lib/npc-store"
import type { SavedEncounter, Combatant } from "@/lib/combat-store"
import type { Conversation, Message } from "@/lib/dm-assistant-store"

// ── Transform helpers ─────────────────────────────────────────────────────────

function toNPC(doc: Doc<"npcs">): NPC {
  return {
    id: doc._id as unknown as string,
    userId: doc.userId,
    campaignId: doc.campaignId as unknown as string,
    name: doc.name,
    race: doc.race,
    occupation: doc.occupation,
    age: doc.age,
    gender: doc.gender,
    alignment: doc.alignment,
    appearance: doc.appearance,
    personality: doc.personality,
    mannerisms: doc.mannerisms,
    voiceDescription: doc.voiceDescription,
    motivation: doc.motivation,
    secret: doc.secret,
    backstory: doc.backstory,
    location: doc.location,
    faction: doc.faction ?? null,
    relationship: doc.relationship,
    status: doc.status,
    tags: doc.tags,
    notes: doc.notes ?? null,
    stats: doc.stats ?? null,
    createdAt: new Date(doc._creationTime),
    updatedAt: new Date(doc.updatedAt),
  }
}

function toSession(doc: Doc<"gameSessions">) {
  return {
    id: doc._id as unknown as string,
    userId: doc.userId,
    campaignId: doc.campaignId as unknown as string,
    number: doc.number,
    title: doc.title,
    date: new Date(doc.date),
    scheduledDate: doc.scheduledDate ? new Date(doc.scheduledDate) : null,
    duration: doc.duration ?? null,
    status: doc.status,
    summary: doc.summary ?? null,
    plotThreads: doc.plotThreads,
    highlights: doc.highlights,
    loot: doc.loot,
    npcsEncountered: doc.npcsEncountered,
    locationsVisited: doc.locationsVisited,
    prepNotes: doc.prepNotes ?? null,
    playerRecap: doc.playerRecap ?? null,
    objectives: doc.objectives,
    plannedEncounters: doc.plannedEncounters,
    plannedNPCs: doc.plannedNPCs,
    xpAwarded: doc.xpAwarded ?? null,
    createdAt: new Date(doc._creationTime),
    updatedAt: new Date(doc.updatedAt),
  }
}

function toPlotThread(doc: Doc<"plotThreads">) {
  return {
    id: doc._id as unknown as string,
    userId: doc.userId,
    campaignId: doc.campaignId as unknown as string,
    title: doc.title,
    description: doc.description,
    status: doc.status,
    importance: doc.importance,
    relatedNPCs: doc.relatedNPCs ?? null,
    relatedLocations: doc.relatedLocations ?? null,
    createdAt: new Date(doc._creationTime),
    resolvedAt: doc.resolvedAt ? new Date(doc.resolvedAt) : null,
  }
}

function toEncounter(doc: Doc<"savedEncounters">): SavedEncounter {
  return {
    id: doc._id as unknown as string,
    name: doc.name,
    combatants: doc.combatants as Combatant[],
    round: doc.round,
    createdAt: new Date(doc._creationTime).toISOString(),
  }
}

function toConversation(doc: Doc<"dmConversations">): Conversation {
  return {
    id: doc._id as unknown as string,
    campaignId: doc.campaignId as unknown as string,
    title: doc.title,
    messages: doc.messages as Message[],
    createdAt: new Date(doc._creationTime).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
  }
}

// ── DataLoader component ──────────────────────────────────────────────────────

export function DataLoader() {
  const { isSignedIn, user } = useUser()
  const skip = !isSignedIn ? ("skip" as const) : {}
  const upsertUser = useMutation(api.users.upsertUser)

  // Pass the social profile from the Clerk client object (guaranteed-present,
  // unlike the JWT name/picture claims). fullName → username → first name as the
  // display-name fallback chain; upsertUser keeps the user row in sync.
  const displayName =
    user?.fullName ?? user?.username ?? user?.firstName ?? undefined
  const avatarUrl = user?.imageUrl ?? undefined
  useEffect(() => {
    if (isSignedIn) upsertUser({ displayName, avatarUrl })
  }, [isSignedIn, upsertUser, displayName, avatarUrl])

  // Presence heartbeat: mark the user online every ~25s while the app is open and
  // the tab is visible (so a backgrounded tab ages out to offline). "Online" is
  // derived client-side from this timestamp — see the friends list.
  const heartbeat = useMutation(api.presence.heartbeat)
  useEffect(() => {
    if (!isSignedIn) return
    const beat = () => {
      if (!document.hidden) void heartbeat()
    }
    beat()
    const id = setInterval(beat, 25_000)
    document.addEventListener("visibilitychange", beat)
    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", beat)
    }
  }, [isSignedIn, heartbeat])

  // ── Active campaign: server is the cross-device source of truth ──────────────
  const me = useQuery(api.users.getMe, skip)
  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId)
  const setActiveCampaign = useCampaignStore((s) => s.setActiveCampaign)
  const persistActiveCampaign = useMutation(api.users.setActiveCampaign)
  const hydratedRef = useRef(false)
  // The value we know the server holds (hydrated from it or last pushed to it).
  // Guards write-through so adopting the server value never bounces back as a
  // spurious push — the failure mode when two devices diverge.
  const syncedRef = useRef<string | null>(null)

  useEffect(() => {
    if (me === undefined) return
    const serverVal = me?.activeCampaignId ?? null

    if (!hydratedRef.current) {
      hydratedRef.current = true
      if (serverVal) {
        // Server wins on load: a campaign picked on another device shows up here.
        syncedRef.current = serverVal
        if (serverVal !== activeCampaignId) setActiveCampaign(serverVal)
      } else if (activeCampaignId) {
        // No server value yet — migrate this device's local selection up.
        syncedRef.current = activeCampaignId
        persistActiveCampaign({ campaignId: activeCampaignId as Id<"campaigns"> }).catch(() => {})
      }
      return
    }

    // After hydration, push genuine local selection changes to the server.
    if (activeCampaignId && activeCampaignId !== syncedRef.current && activeCampaignId !== serverVal) {
      syncedRef.current = activeCampaignId
      persistActiveCampaign({ campaignId: activeCampaignId as Id<"campaigns"> }).catch(() => {})
    }
  }, [me, activeCampaignId, setActiveCampaign, persistActiveCampaign])

  const convexNPCs = useQuery(api.npcs.list, skip)
  const convexSessions = useQuery(api.sessions.listSessions, skip)
  const convexPlotThreads = useQuery(api.sessions.listPlotThreads, skip)
  const convexEncounters = useQuery(api.encounters.list, skip)
  const convexConversations = useQuery(api.dmConversations.list, skip)

  const setNPCs = useNPCStore((s) => s.setNPCs)
  const setSessions = useSessionStore((s) => s.setSessions)
  const setPlotThreads = useSessionStore((s) => s.setPlotThreads)
  const setSavedEncounters = useCombatStore((s) => s.setSavedEncounters)
  const setConversations = useDMAssistantStore((s) => s.setConversations)

  useEffect(() => {
    if (convexNPCs !== undefined) setNPCs(convexNPCs.map(toNPC))
  }, [convexNPCs, setNPCs])

  useEffect(() => {
    if (convexSessions !== undefined) setSessions(convexSessions.map(toSession))
  }, [convexSessions, setSessions])

  useEffect(() => {
    if (convexPlotThreads !== undefined) setPlotThreads(convexPlotThreads.map(toPlotThread))
  }, [convexPlotThreads, setPlotThreads])

  useEffect(() => {
    if (convexEncounters !== undefined) setSavedEncounters(convexEncounters.map(toEncounter))
  }, [convexEncounters, setSavedEncounters])

  useEffect(() => {
    if (convexConversations !== undefined) setConversations(convexConversations.map(toConversation))
  }, [convexConversations, setConversations])

  return null
}
