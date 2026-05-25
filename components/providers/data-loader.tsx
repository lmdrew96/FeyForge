"use client"

import { useEffect } from "react"
import { useQuery, useMutation } from "convex/react"
import { useUser } from "@clerk/nextjs"
import { api } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import { useNPCStore } from "@/lib/npc-store"
import { useSessionStore } from "@/lib/session-store"
import { useCombatStore } from "@/lib/combat-store"
import { useDMAssistantStore } from "@/lib/dm-assistant-store"
import { useWorldStore } from "@/lib/world-store"
import type { NPC } from "@/lib/npc-store"
import type { MapLocation } from "@/lib/world-store"
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

function toLocation(doc: Doc<"mapLocations">): MapLocation {
  return {
    id: doc._id as unknown as string,
    userId: doc.userId,
    campaignId: doc.campaignId ? (doc.campaignId as unknown as string) : null,
    name: doc.name,
    type: doc.type,
    description: doc.description,
    notes: doc.notes,
    x: doc.x,
    y: doc.y,
    visited: doc.visited,
    createdAt: new Date(doc._creationTime),
  }
}

// ── DataLoader component ──────────────────────────────────────────────────────

export function DataLoader() {
  const { isSignedIn } = useUser()
  const skip = !isSignedIn ? ("skip" as const) : {}
  const upsertUser = useMutation(api.users.upsertUser)

  useEffect(() => {
    if (isSignedIn) upsertUser()
  }, [isSignedIn, upsertUser])

  const convexNPCs = useQuery(api.npcs.list, skip)
  const convexSessions = useQuery(api.sessions.listSessions, skip)
  const convexPlotThreads = useQuery(api.sessions.listPlotThreads, skip)
  const convexEncounters = useQuery(api.encounters.list, skip)
  const convexConversations = useQuery(api.dmConversations.list, skip)
  const convexLocations = useQuery(api.world.list, skip)

  const setNPCs = useNPCStore((s) => s.setNPCs)
  const setSessions = useSessionStore((s) => s.setSessions)
  const setPlotThreads = useSessionStore((s) => s.setPlotThreads)
  const setSavedEncounters = useCombatStore((s) => s.setSavedEncounters)
  const setConversations = useDMAssistantStore((s) => s.setConversations)
  const setLocations = useWorldStore((s) => s.setLocations)

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

  useEffect(() => {
    if (convexLocations !== undefined) setLocations(convexLocations.map(toLocation))
  }, [convexLocations, setLocations])

  return null
}
