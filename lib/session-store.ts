"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface PlotThread {
  id: string
  campaignId: string
  title: string
  description: string
  status: "active" | "resolved" | "abandoned"
  importance: "major" | "minor" | "side"
  relatedNPCs?: string[]
  relatedLocations?: string[]
  createdAt: Date
  resolvedAt?: Date
}

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
  monsterSlugs: string[] // Open5e monster slugs
  status: "planned" | "completed" | "skipped"
  notes?: string
  xpReward?: number
}

export interface Session {
  id: string
  campaignId: string
  number: number
  title: string
  date: Date
  scheduledDate?: Date
  duration?: number // in minutes
  status: "planned" | "completed" | "cancelled"
  summary?: string
  notes: SessionNote[]
  plotThreads: string[] // IDs
  highlights: string[]
  loot: string[]
  npcsEncountered: string[]
  locationsVisited: string[]
  prepNotes?: string
  playerRecap?: string
  objectives: SessionObjective[]
  plannedEncounters: PlannedEncounter[]
  plannedNPCs: string[] // NPC IDs from NPC store
  xpAwarded?: number
  createdAt: Date
  updatedAt: Date
}

interface SessionStore {
  sessions: Session[]
  plotThreads: PlotThread[]
  currentSessionId: string | null

  // Session actions
  addSession: (session: Omit<Session, "id" | "createdAt" | "updatedAt">) => string
  updateSession: (id: string, updates: Partial<Session>) => void
  deleteSession: (id: string) => void
  setCurrentSession: (id: string | null) => void
  getCurrentSession: () => Session | undefined
  addNoteToSession: (sessionId: string, note: Omit<SessionNote, "id" | "sessionId" | "timestamp">) => void

  // Plot thread actions
  addPlotThread: (thread: Omit<PlotThread, "id" | "createdAt">) => void
  updatePlotThread: (id: string, updates: Partial<PlotThread>) => void
  deletePlotThread: (id: string) => void
  getActivePlotThreads: () => PlotThread[]
}

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      sessions: [],
      plotThreads: [],
      currentSessionId: null,

      addSession: (session) => {
        const id = crypto.randomUUID()
        const newSession: Session = {
          ...session,
          id,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        set((state) => ({
          sessions: [...state.sessions, newSession],
        }))
        return id
      },

      updateSession: (id, updates) =>
        set((state) => ({
          sessions: state.sessions.map((s) => (s.id === id ? { ...s, ...updates, updatedAt: new Date() } : s)),
        })),

      deleteSession: (id) =>
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id),
          currentSessionId: state.currentSessionId === id ? null : state.currentSessionId,
        })),

      setCurrentSession: (id) => set({ currentSessionId: id }),

      getCurrentSession: () => {
        const state = get()
        return state.sessions.find((s) => s.id === state.currentSessionId)
      },

      addNoteToSession: (sessionId, note) =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  notes: [...s.notes, { ...note, id: crypto.randomUUID(), sessionId, timestamp: new Date() }],
                  updatedAt: new Date(),
                }
              : s,
          ),
        })),

      addPlotThread: (thread) =>
        set((state) => ({
          plotThreads: [...state.plotThreads, { ...thread, id: crypto.randomUUID(), createdAt: new Date() }],
        })),

      updatePlotThread: (id, updates) =>
        set((state) => ({
          plotThreads: state.plotThreads.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        })),

      deletePlotThread: (id) =>
        set((state) => ({
          plotThreads: state.plotThreads.filter((t) => t.id !== id),
        })),

      getActivePlotThreads: () => {
        return get().plotThreads.filter((t) => t.status === "active")
      },
    }),
    {
      name: "dnd-sessions",
    },
  ),
)
