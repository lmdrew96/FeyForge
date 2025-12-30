import { create } from "zustand"
import { persist } from "zustand/middleware"

// Entry types for the campaign wiki
export type WikiEntryType = "location" | "faction" | "lore" | "item" | "event" | "custom"

export interface WikiEntry {
  id: string
  campaignId: string
  title: string
  type: WikiEntryType
  content: string
  summary?: string
  // Bi-directional linking
  linkedEntryIds: string[] // IDs of entries this entry links TO
  linkedFromIds: string[] // IDs of entries that link TO this entry (auto-populated)
  // Optional metadata
  tags?: string[]
  imageUrl?: string
  isPlayerVisible: boolean // DM can hide entries from players
  createdAt: string
  updatedAt: string
}

interface WikiState {
  entries: WikiEntry[]
  
  // CRUD operations
  addEntry: (entry: Omit<WikiEntry, "id" | "createdAt" | "updatedAt" | "linkedFromIds">) => string
  updateEntry: (id: string, updates: Partial<Omit<WikiEntry, "id" | "createdAt" | "linkedFromIds">>) => void
  deleteEntry: (id: string) => void
  
  // Query operations
  getEntry: (id: string) => WikiEntry | undefined
  getEntriesByCampaign: (campaignId: string) => WikiEntry[]
  getEntriesByType: (campaignId: string, type: WikiEntryType) => WikiEntry[]
  searchEntries: (campaignId: string, query: string) => WikiEntry[]
  
  // Linking operations
  addLink: (fromId: string, toId: string) => void
  removeLink: (fromId: string, toId: string) => void
  getLinkedEntries: (id: string) => WikiEntry[]
  getBacklinks: (id: string) => WikiEntry[]
  
  // Stats
  getEntryCount: (campaignId?: string) => number
}

export const useWikiStore = create<WikiState>()(
  persist(
    (set, get) => ({
      entries: [],

      addEntry: (entryData) => {
        const id = crypto.randomUUID()
        const now = new Date().toISOString()
        
        const newEntry: WikiEntry = {
          ...entryData,
          id,
          linkedFromIds: [],
          createdAt: now,
          updatedAt: now,
        }

        set((state) => {
          // Update linkedFromIds of any entries this new entry links to
          const updatedEntries = state.entries.map((entry) => {
            if (newEntry.linkedEntryIds.includes(entry.id)) {
              return {
                ...entry,
                linkedFromIds: [...entry.linkedFromIds, id],
                updatedAt: now,
              }
            }
            return entry
          })

          return { entries: [...updatedEntries, newEntry] }
        })

        return id
      },

      updateEntry: (id, updates) => {
        const now = new Date().toISOString()
        
        set((state) => {
          const currentEntry = state.entries.find((e) => e.id === id)
          if (!currentEntry) return state

          // Handle linkedEntryIds changes if they're being updated
          let updatedEntries = [...state.entries]
          
          if (updates.linkedEntryIds) {
            const oldLinks = new Set(currentEntry.linkedEntryIds)
            const newLinks = new Set(updates.linkedEntryIds)
            
            // Remove this entry's id from linkedFromIds of entries no longer linked
            const removedLinks = [...oldLinks].filter((linkId) => !newLinks.has(linkId))
            const addedLinks = [...newLinks].filter((linkId) => !oldLinks.has(linkId))
            
            updatedEntries = updatedEntries.map((entry) => {
              if (removedLinks.includes(entry.id)) {
                return {
                  ...entry,
                  linkedFromIds: entry.linkedFromIds.filter((fid) => fid !== id),
                  updatedAt: now,
                }
              }
              if (addedLinks.includes(entry.id)) {
                return {
                  ...entry,
                  linkedFromIds: [...entry.linkedFromIds, id],
                  updatedAt: now,
                }
              }
              return entry
            })
          }

          // Update the target entry
          return {
            entries: updatedEntries.map((entry) =>
              entry.id === id ? { ...entry, ...updates, updatedAt: now } : entry
            ),
          }
        })
      },

      deleteEntry: (id) => {
        const now = new Date().toISOString()
        
        set((state) => {
          const entryToDelete = state.entries.find((e) => e.id === id)
          if (!entryToDelete) return state

          // Remove this entry's id from all linkedFromIds and linkedEntryIds
          const updatedEntries = state.entries
            .filter((entry) => entry.id !== id)
            .map((entry) => ({
              ...entry,
              linkedFromIds: entry.linkedFromIds.filter((fid) => fid !== id),
              linkedEntryIds: entry.linkedEntryIds.filter((lid) => lid !== id),
              updatedAt:
                entry.linkedFromIds.includes(id) || entry.linkedEntryIds.includes(id)
                  ? now
                  : entry.updatedAt,
            }))

          return { entries: updatedEntries }
        })
      },

      getEntry: (id) => {
        return get().entries.find((entry) => entry.id === id)
      },

      getEntriesByCampaign: (campaignId) => {
        return get().entries.filter((entry) => entry.campaignId === campaignId)
      },

      getEntriesByType: (campaignId, type) => {
        return get().entries.filter(
          (entry) => entry.campaignId === campaignId && entry.type === type
        )
      },

      searchEntries: (campaignId, query) => {
        const lowerQuery = query.toLowerCase()
        return get().entries.filter(
          (entry) =>
            entry.campaignId === campaignId &&
            (entry.title.toLowerCase().includes(lowerQuery) ||
              entry.content.toLowerCase().includes(lowerQuery) ||
              entry.summary?.toLowerCase().includes(lowerQuery) ||
              entry.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery)))
        )
      },

      addLink: (fromId, toId) => {
        if (fromId === toId) return // Prevent self-linking
        
        const now = new Date().toISOString()
        
        set((state) => ({
          entries: state.entries.map((entry) => {
            if (entry.id === fromId && !entry.linkedEntryIds.includes(toId)) {
              return {
                ...entry,
                linkedEntryIds: [...entry.linkedEntryIds, toId],
                updatedAt: now,
              }
            }
            if (entry.id === toId && !entry.linkedFromIds.includes(fromId)) {
              return {
                ...entry,
                linkedFromIds: [...entry.linkedFromIds, fromId],
                updatedAt: now,
              }
            }
            return entry
          }),
        }))
      },

      removeLink: (fromId, toId) => {
        const now = new Date().toISOString()
        
        set((state) => ({
          entries: state.entries.map((entry) => {
            if (entry.id === fromId) {
              return {
                ...entry,
                linkedEntryIds: entry.linkedEntryIds.filter((id) => id !== toId),
                updatedAt: now,
              }
            }
            if (entry.id === toId) {
              return {
                ...entry,
                linkedFromIds: entry.linkedFromIds.filter((id) => id !== fromId),
                updatedAt: now,
              }
            }
            return entry
          }),
        }))
      },

      getLinkedEntries: (id) => {
        const entry = get().getEntry(id)
        if (!entry) return []
        return get().entries.filter((e) => entry.linkedEntryIds.includes(e.id))
      },

      getBacklinks: (id) => {
        const entry = get().getEntry(id)
        if (!entry) return []
        return get().entries.filter((e) => entry.linkedFromIds.includes(e.id))
      },

      getEntryCount: (campaignId) => {
        if (campaignId) {
          return get().entries.filter((e) => e.campaignId === campaignId).length
        }
        return get().entries.length
      },
    }),
    {
      name: "feyforge-wiki-storage",
    }
  )
)
