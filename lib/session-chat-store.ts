"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

// Tracks the newest chat message a user has seen per live session, so the chat
// launcher can show an unread indicator. Persisted (localStorage) so a refresh
// mid-session doesn't resurface already-read messages. Keyed by sessionId →
// last-seen createdAt (ms).
interface SessionChatState {
  lastSeen: Record<string, number>
  markSeen: (sessionId: string, ts: number) => void
}

export const useSessionChatStore = create<SessionChatState>()(
  persist(
    (set) => ({
      lastSeen: {},
      markSeen: (sessionId, ts) =>
        set((s) => {
          if (ts <= (s.lastSeen[sessionId] ?? 0)) return s
          return { lastSeen: { ...s.lastSeen, [sessionId]: ts } }
        }),
    }),
    {
      name: "feyforge-session-chat-store",
      partialize: (state) => ({ lastSeen: state.lastSeen }),
    },
  ),
)
