"use client"

import { create } from "zustand"
import { toast } from "sonner"
import { getErrorMessage } from "@/lib/errors"
import {
  type GameSession,
  type PlotThread,
  type NewGameSession,
  type NewPlotThread,
} from "@/lib/actions/sessions"
import { convex } from "@/lib/convex"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"

// Re-export types
export type { GameSession as Session, PlotThread }

// Keep these interfaces for local use
export interface SessionNote {
  id: string
  sessionId: string
  content: string
  timestamp: Date
  type: "narrative" | "combat" | "roleplay" | "loot" | "decision"
}

export interface SessionObjective {
  id: string
  text: string
  completed: boolean
  priority: "primary" | "secondary" | "optional"
}

export interface PlannedEncounter {
  id: string
  name: string
  description?: string
  difficulty: "trivial" | "easy" | "medium" | "hard" | "deadly"
  monsterSlugs: string[]
  status: "planned" | "completed" | "skipped"
  notes?: string
  xpReward?: number
}

interface SessionStore {
  sessions: GameSession[]
  plotThreads: PlotThread[]
  currentSessionId: string | null
  isLoading: boolean
  isInitialized: boolean
  error: string | null

  // Set data from DataLoader
  setSessions: (sessions: GameSession[]) => void
  setPlotThreads: (plotThreads: PlotThread[]) => void

  // Initialize (no-op — DataLoader handles loading)
  initialize: () => Promise<void>
  initializeByCampaign: (campaignId: string) => Promise<void>

  // Session actions (async)
  addSession: (session: NewGameSession) => Promise<string>
  updateSession: (id: string, updates: Partial<NewGameSession>) => Promise<void>
  deleteSession: (id: string) => Promise<void>
  setCurrentSession: (id: string | null) => void
  getCurrentSession: () => GameSession | undefined
  addNoteToSession: (sessionId: string, note: { content: string; type: SessionNote["type"] }) => Promise<void>

  // Plot thread actions (async)
  addPlotThread: (thread: NewPlotThread) => Promise<void>
  updatePlotThread: (id: string, updates: Partial<NewPlotThread>) => Promise<void>
  deletePlotThread: (id: string) => Promise<void>
  getActivePlotThreads: () => PlotThread[]

  // Reset
  reset: () => void
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  plotThreads: [],
  currentSessionId: null,
  isLoading: false,
  isInitialized: false,
  error: null,

  setSessions: (sessions) => set({ sessions, isInitialized: true, isLoading: false }),
  setPlotThreads: (plotThreads) => set({ plotThreads }),

  initialize: async () => { set({ isInitialized: true }) },

  initializeByCampaign: async (_campaignId: string) => { set({ isInitialized: true }) },

  addSession: async (sessionData) => {
    const tempId = crypto.randomUUID()
    const tempSession: GameSession = {
      ...sessionData,
      id: tempId,
      userId: "",
      plotThreads: sessionData.plotThreads ?? [],
      highlights: sessionData.highlights ?? [],
      loot: sessionData.loot ?? [],
      npcsEncountered: sessionData.npcsEncountered ?? [],
      locationsVisited: sessionData.locationsVisited ?? [],
      objectives: sessionData.objectives ?? [],
      plannedEncounters: sessionData.plannedEncounters ?? [],
      plannedNPCs: sessionData.plannedNPCs ?? [],
      scheduledDate: sessionData.scheduledDate ?? null,
      duration: sessionData.duration ?? null,
      summary: sessionData.summary ?? null,
      prepNotes: sessionData.prepNotes ?? null,
      playerRecap: sessionData.playerRecap ?? null,
      xpAwarded: sessionData.xpAwarded ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    set((state) => ({ sessions: [...state.sessions, tempSession] }))
    try {
      await convex.mutation(api.sessions.createSession, {
        ...sessionData,
        campaignId: sessionData.campaignId as Id<"campaigns">,
        status: sessionData.status as "planned" | "completed" | "cancelled",
        plotThreads: sessionData.plotThreads ?? [],
        highlights: sessionData.highlights ?? [],
        loot: sessionData.loot ?? [],
        npcsEncountered: sessionData.npcsEncountered ?? [],
        locationsVisited: sessionData.locationsVisited ?? [],
        objectives: sessionData.objectives ?? [],
        plannedEncounters: sessionData.plannedEncounters ?? [],
        plannedNPCs: sessionData.plannedNPCs ?? [],
        date: sessionData.date instanceof Date ? sessionData.date.getTime() : (sessionData.date as unknown as number),
        scheduledDate: sessionData.scheduledDate instanceof Date
          ? sessionData.scheduledDate.getTime()
          : sessionData.scheduledDate ?? undefined,
        duration: sessionData.duration ?? undefined,
        summary: sessionData.summary ?? undefined,
        prepNotes: sessionData.prepNotes ?? undefined,
        playerRecap: sessionData.playerRecap ?? undefined,
        xpAwarded: sessionData.xpAwarded ?? undefined,
      })
      return tempId
    } catch (error) {
      set((state) => ({ sessions: state.sessions.filter((s) => s.id !== tempId) }))
      const message = getErrorMessage(error, "Failed to create session")
      toast.error(message)
      throw error
    }
  },

  updateSession: async (id, updates) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, ...updates, updatedAt: new Date() } : s
      ),
    }))
    try {
      await convex.mutation(api.sessions.updateSession, {
        id: id as Id<"gameSessions">,
        ...updates,
        status: updates.status as "planned" | "completed" | "cancelled" | undefined,
        date: updates.date instanceof Date ? updates.date.getTime() : (updates.date as unknown as number | undefined),
        scheduledDate: updates.scheduledDate instanceof Date
          ? updates.scheduledDate.getTime()
          : updates.scheduledDate ?? undefined,
        duration: updates.duration ?? undefined,
        summary: updates.summary ?? undefined,
        prepNotes: updates.prepNotes ?? undefined,
        playerRecap: updates.playerRecap ?? undefined,
        xpAwarded: updates.xpAwarded ?? undefined,
      })
    } catch (error) {
      const message = getErrorMessage(error, "Failed to update session")
      toast.error(message)
      throw error
    }
  },

  deleteSession: async (id) => {
    const previousSessions = get().sessions
    const previousCurrentId = get().currentSessionId
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      currentSessionId: state.currentSessionId === id ? null : state.currentSessionId,
      error: null,
    }))
    try {
      await convex.mutation(api.sessions.removeSession, { id: id as Id<"gameSessions"> })
    } catch (error) {
      set({
        sessions: previousSessions,
        currentSessionId: previousCurrentId,
        error: getErrorMessage(error, "Failed to delete session"),
      })
      throw error
    }
  },

  setCurrentSession: (id) => set({ currentSessionId: id }),

  getCurrentSession: () => {
    const state = get()
    return state.sessions.find((s) => s.id === state.currentSessionId)
  },

  addNoteToSession: async (sessionId, note) => {
    try {
      await convex.mutation(api.sessions.addNote, {
        sessionId: sessionId as Id<"gameSessions">,
        content: note.content,
        type: note.type,
      })
    } catch (error) {
      const message = getErrorMessage(error, "Failed to add note")
      toast.error(message)
      throw error
    }
  },

  addPlotThread: async (threadData) => {
    const tempThread: PlotThread = {
      ...threadData,
      id: crypto.randomUUID(),
      userId: "",
      relatedNPCs: threadData.relatedNPCs ?? null,
      relatedLocations: threadData.relatedLocations ?? null,
      createdAt: new Date(),
      resolvedAt: null,
    }
    set((state) => ({ plotThreads: [...state.plotThreads, tempThread] }))
    try {
      await convex.mutation(api.sessions.createPlotThread, {
        ...threadData,
        campaignId: threadData.campaignId as Id<"campaigns">,
        relatedNPCs: threadData.relatedNPCs ?? undefined,
        relatedLocations: threadData.relatedLocations ?? undefined,
        resolvedAt: threadData.resolvedAt instanceof Date
          ? threadData.resolvedAt.getTime()
          : threadData.resolvedAt ?? undefined,
      })
    } catch (error) {
      set((state) => ({ plotThreads: state.plotThreads.filter((t) => t.id !== tempThread.id) }))
      const message = getErrorMessage(error, "Failed to create plot thread")
      toast.error(message)
      throw error
    }
  },

  updatePlotThread: async (id, updates) => {
    set((state) => ({
      plotThreads: state.plotThreads.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }))
    try {
      await convex.mutation(api.sessions.updatePlotThread, {
        id: id as Id<"plotThreads">,
        ...updates,
        relatedNPCs: updates.relatedNPCs ?? undefined,
        relatedLocations: updates.relatedLocations ?? undefined,
        resolvedAt: updates.resolvedAt instanceof Date
          ? updates.resolvedAt.getTime()
          : updates.resolvedAt ?? undefined,
      })
    } catch (error) {
      const message = getErrorMessage(error, "Failed to update plot thread")
      toast.error(message)
      throw error
    }
  },

  deletePlotThread: async (id) => {
    const previousThreads = get().plotThreads
    set((state) => ({ plotThreads: state.plotThreads.filter((t) => t.id !== id), error: null }))
    try {
      await convex.mutation(api.sessions.removePlotThread, { id: id as Id<"plotThreads"> })
    } catch (error) {
      set({ plotThreads: previousThreads, error: getErrorMessage(error, "Failed to delete plot thread") })
      throw error
    }
  },

  getActivePlotThreads: () => {
    return get().plotThreads.filter((t) => t.status === "active")
  },

  reset: () =>
    set({
      sessions: [],
      plotThreads: [],
      currentSessionId: null,
      isLoading: false,
      isInitialized: false,
      error: null,
    }),
}))
