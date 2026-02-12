"use client"

import { create } from "zustand"
import { toast } from "sonner"
import { getErrorMessage, isAuthError } from "@/lib/errors"
import {
  fetchUserSessions,
  getSessionsByCampaign,
  createSession as createSessionAction,
  updateSession as updateSessionAction,
  deleteSession as deleteSessionAction,
  addSessionNote as addSessionNoteAction,
  fetchUserPlotThreads,
  getPlotThreadsByCampaign,
  createPlotThread as createPlotThreadAction,
  updatePlotThread as updatePlotThreadAction,
  deletePlotThread as deletePlotThreadAction,
  type GameSession,
  type PlotThread,
  type NewGameSession,
  type NewPlotThread,
} from "@/lib/actions/sessions"

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

  // Initialize
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

  initialize: async () => {
    if (get().isInitialized) return

    set({ isLoading: true, error: null })
    try {
      const [sessions, plotThreads] = await Promise.all([
        fetchUserSessions(),
        fetchUserPlotThreads(),
      ])
      set({
        sessions,
        plotThreads,
        isLoading: false,
        isInitialized: true,
      })
    } catch (error) {
      set({
        error: getErrorMessage(error, "Failed to load sessions"),
        isLoading: false,
      })
    }
  },

  initializeByCampaign: async (campaignId: string) => {
    set({ isLoading: true, error: null })
    try {
      const [sessions, plotThreads] = await Promise.all([
        getSessionsByCampaign(campaignId),
        getPlotThreadsByCampaign(campaignId),
      ])
      set({
        sessions,
        plotThreads,
        isLoading: false,
        isInitialized: true,
      })
    } catch (error) {
      set({
        error: getErrorMessage(error, "Failed to load sessions"),
        isLoading: false,
      })
    }
  },

  addSession: async (sessionData) => {
    set({ isLoading: true, error: null })
    try {
      const newSession = await createSessionAction(sessionData)
      set((state) => ({
        sessions: [...state.sessions, newSession],
        isLoading: false,
      }))
      return newSession.id
    } catch (error) {
      set({
        error: getErrorMessage(error, "Failed to create session"),
        isLoading: false,
      })
      throw error
    }
  },

  updateSession: async (id, updates) => {
    set({ isLoading: true, error: null })
    try {
      const updatedSession = await updateSessionAction(id, updates)
      set((state) => ({
        sessions: state.sessions.map((s) => (s.id === id ? updatedSession : s)),
        isLoading: false,
      }))
    } catch (error) {
      set({
        error: getErrorMessage(error, "Failed to update session"),
        isLoading: false,
      })
      throw error
    }
  },

  deleteSession: async (id) => {
    const previousSessions = get().sessions
    const previousCurrentId = get().currentSessionId
    // Optimistically remove
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      currentSessionId: state.currentSessionId === id ? null : state.currentSessionId,
      error: null,
    }))
    try {
      await deleteSessionAction(id)
    } catch (error) {
      // Rollback on failure
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
      await addSessionNoteAction({
        sessionId,
        content: note.content,
        type: note.type,
      })
      // Note: We might need to refresh the session to see the new note
      // For now, the server action handles persistence
    } catch (error) {
      const message = getErrorMessage(error, "Failed to add note")
      if (isAuthError(message)) {
        toast.error("Please log in to add notes")
      } else {
        toast.error(message)
      }
      throw error
    }
  },

  addPlotThread: async (threadData) => {
    set({ isLoading: true, error: null })
    try {
      const newThread = await createPlotThreadAction(threadData)
      set((state) => ({
        plotThreads: [...state.plotThreads, newThread],
        isLoading: false,
      }))
    } catch (error) {
      set({
        error: getErrorMessage(error, "Failed to create plot thread"),
        isLoading: false,
      })
      throw error
    }
  },

  updatePlotThread: async (id, updates) => {
    set({ isLoading: true, error: null })
    try {
      const updatedThread = await updatePlotThreadAction(id, updates)
      set((state) => ({
        plotThreads: state.plotThreads.map((t) => (t.id === id ? updatedThread : t)),
        isLoading: false,
      }))
    } catch (error) {
      set({
        error: getErrorMessage(error, "Failed to update plot thread"),
        isLoading: false,
      })
      throw error
    }
  },

  deletePlotThread: async (id) => {
    const previousThreads = get().plotThreads
    // Optimistically remove
    set((state) => ({
      plotThreads: state.plotThreads.filter((t) => t.id !== id),
      error: null,
    }))
    try {
      await deletePlotThreadAction(id)
    } catch (error) {
      // Rollback on failure
      set({
        plotThreads: previousThreads,
        error: getErrorMessage(error, "Failed to delete plot thread"),
      })
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
