import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface Session {
  id: string
  campaignId: string
  sessionNumber: number
  title: string
  date: string
  summary: string
  attendees: string[] // character IDs
  xpAwarded: number
  loot: string[]
  highlights: string[]
  dmNotes: string
  createdAt: string
  updatedAt: string
}

interface SessionsStore {
  sessions: Session[]
  addSession: (session: Session) => void
  updateSession: (id: string, data: Partial<Session>) => void
  deleteSession: (id: string) => void
  getSession: (id: string) => Session | undefined
  getSessionsByCampaign: (campaignId: string) => Session[]
  getRecentSessions: (campaignId: string, limit?: number) => Session[]
}

const sampleSessions: Session[] = [
  {
    id: "session-5",
    campaignId: "campaign-1",
    sessionNumber: 5,
    title: "The Archfey's Bargain",
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    summary: "The party struck a dangerous deal with the Archfey Titania to gain passage through the Moonlit Maze.",
    attendees: ["demo-1"],
    xpAwarded: 450,
    loot: ["Moonstone Amulet", "50 GP"],
    highlights: ["Lyralei convinced the sprite guards to stand down", "Discovered the location of the Shadow Gate"],
    dmNotes: "Party is now indebted to Titania. This will come back later.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "session-4",
    campaignId: "campaign-1",
    sessionNumber: 4,
    title: "Whispers in the Grove",
    date: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
    summary: "Explored the corrupted Whisperwind Grove and defeated a band of redcaps terrorizing the dryads.",
    attendees: ["demo-1"],
    xpAwarded: 600,
    loot: ["Cloak of Elvenkind", "Redcap's Iron Boots", "75 GP"],
    highlights: ["Epic battle at the Heart Tree", "Rescued the dryad elder Willowmere"],
    dmNotes: "The corruption source is still unknown. Plant seeds for next arc.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "session-3",
    campaignId: "campaign-1",
    sessionNumber: 3,
    title: "The Fey Crossing",
    date: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString(),
    summary: "The party found the hidden fey crossing and entered the Feywild for the first time.",
    attendees: ["demo-1"],
    xpAwarded: 300,
    loot: ["Feywild Map Fragment", "25 GP"],
    highlights: ["First encounter with pixies", "Time dilation effect discovered"],
    dmNotes: "Remember: time flows differently. 1 day in Feywild = 1 week material plane.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "session-2",
    campaignId: "campaign-1",
    sessionNumber: 2,
    title: "Shadows Over Millbrook",
    date: new Date(Date.now() - 23 * 24 * 60 * 60 * 1000).toISOString(),
    summary: "Investigated strange disappearances in Millbrook village. Tracked the culprit to an abandoned mill.",
    attendees: ["demo-1"],
    xpAwarded: 350,
    loot: ["Silver Dagger", "Mysterious Journal", "40 GP"],
    highlights: ["Solved the mystery of the missing children", "First hints of Feywild connection"],
    dmNotes: "The journal contains clues about the fey crossing location.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "session-1",
    campaignId: "campaign-1",
    sessionNumber: 1,
    title: "A Call to Adventure",
    date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    summary:
      "The heroes met in the Wandering Willow tavern and accepted their first quest from the mysterious stranger.",
    attendees: ["demo-1"],
    xpAwarded: 200,
    loot: ["Adventuring Gear", "10 GP each"],
    highlights: ["Party formation", "Met the quest giver Eldrin"],
    dmNotes: "Great session 0. Players are engaged with the Feywild theme.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

export const useSessionsStore = create<SessionsStore>()(
  persist(
    (set, get) => ({
      sessions: sampleSessions,
      addSession: (session) =>
        set((state) => ({
          sessions: [...state.sessions, session],
        })),
      updateSession: (id, data) =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, ...data, updatedAt: new Date().toISOString() } : s,
          ),
        })),
      deleteSession: (id) =>
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id),
        })),
      getSession: (id) => get().sessions.find((s) => s.id === id),
      getSessionsByCampaign: (campaignId) =>
        get()
          .sessions.filter((s) => s.campaignId === campaignId)
          .sort((a, b) => b.sessionNumber - a.sessionNumber),
      getRecentSessions: (campaignId, limit = 5) =>
        get()
          .sessions.filter((s) => s.campaignId === campaignId)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, limit),
    }),
    {
      name: "feyforge-sessions",
    },
  ),
)
