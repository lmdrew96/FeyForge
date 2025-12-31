"use client"

import { create } from "zustand"
import {
  fetchUserNPCs,
  getNPCsByCampaign,
  createNPC as createNPCAction,
  updateNPC as updateNPCAction,
  deleteNPC as deleteNPCAction,
  searchNPCs as searchNPCsAction,
  type NPC,
  type NewNPC,
} from "@/lib/actions/npcs"

// Re-export NPC type
export type { NPC }

interface NPCStore {
  npcs: NPC[]
  isLoading: boolean
  isInitialized: boolean
  error: string | null

  // Initialize from database
  initialize: () => Promise<void>
  initializeByCampaign: (campaignId: string) => Promise<void>

  // Actions (async)
  addNPC: (npc: NewNPC) => Promise<NPC>
  updateNPC: (id: string, updates: Partial<NewNPC>) => Promise<void>
  deleteNPC: (id: string) => Promise<void>

  // Local filters (operate on loaded data)
  getNPCsByTag: (tag: string) => NPC[]
  getNPCsByLocation: (location: string) => NPC[]
  searchNPCsLocal: (query: string) => NPC[]

  // Server search
  searchNPCs: (query: string, campaignId?: string) => Promise<NPC[]>

  // Reset
  reset: () => void
}

export const useNPCStore = create<NPCStore>((set, get) => ({
  npcs: [],
  isLoading: false,
  isInitialized: false,
  error: null,

  initialize: async () => {
    if (get().isInitialized) return

    set({ isLoading: true, error: null })
    try {
      const npcs = await fetchUserNPCs()
      set({
        npcs,
        isLoading: false,
        isInitialized: true,
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to load NPCs",
        isLoading: false,
      })
    }
  },

  initializeByCampaign: async (campaignId: string) => {
    set({ isLoading: true, error: null })
    try {
      const npcs = await getNPCsByCampaign(campaignId)
      set({
        npcs,
        isLoading: false,
        isInitialized: true,
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to load NPCs",
        isLoading: false,
      })
    }
  },

  addNPC: async (npcData) => {
    set({ isLoading: true, error: null })
    try {
      const newNPC = await createNPCAction(npcData)
      set((state) => ({
        npcs: [...state.npcs, newNPC],
        isLoading: false,
      }))
      return newNPC
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to create NPC",
        isLoading: false,
      })
      throw error
    }
  },

  updateNPC: async (id, updates) => {
    set({ isLoading: true, error: null })
    try {
      const updatedNPC = await updateNPCAction(id, updates)
      set((state) => ({
        npcs: state.npcs.map((npc) => (npc.id === id ? updatedNPC : npc)),
        isLoading: false,
      }))
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to update NPC",
        isLoading: false,
      })
      throw error
    }
  },

  deleteNPC: async (id) => {
    set({ isLoading: true, error: null })
    try {
      await deleteNPCAction(id)
      set((state) => ({
        npcs: state.npcs.filter((npc) => npc.id !== id),
        isLoading: false,
      }))
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to delete NPC",
        isLoading: false,
      })
      throw error
    }
  },

  getNPCsByTag: (tag) => {
    return get().npcs.filter((npc) => npc.tags.includes(tag))
  },

  getNPCsByLocation: (location) => {
    return get().npcs.filter((npc) => npc.location.toLowerCase().includes(location.toLowerCase()))
  },

  searchNPCsLocal: (query) => {
    const q = query.toLowerCase()
    return get().npcs.filter(
      (npc) =>
        npc.name.toLowerCase().includes(q) ||
        npc.occupation.toLowerCase().includes(q) ||
        npc.location.toLowerCase().includes(q) ||
        npc.tags.some((tag) => tag.toLowerCase().includes(q))
    )
  },

  searchNPCs: async (query, campaignId) => {
    try {
      return await searchNPCsAction(query, campaignId)
    } catch (error) {
      console.error("Search failed:", error)
      return []
    }
  },

  reset: () =>
    set({
      npcs: [],
      isLoading: false,
      isInitialized: false,
      error: null,
    }),
}))

export const npcRaces = [
  "Human",
  "Elf",
  "Dwarf",
  "Halfling",
  "Gnome",
  "Half-Elf",
  "Half-Orc",
  "Tiefling",
  "Dragonborn",
  "Orc",
  "Goblin",
  "Kobold",
]

export const npcOccupations = [
  "Merchant",
  "Innkeeper",
  "Guard",
  "Scholar",
  "Blacksmith",
  "Priest",
  "Farmer",
  "Noble",
  "Thief",
  "Beggar",
  "Sailor",
  "Soldier",
  "Bard",
  "Healer",
  "Hunter",
  "Mage",
  "Assassin",
  "Spy",
]

export const personalityTraits = [
  "Friendly",
  "Suspicious",
  "Greedy",
  "Honest",
  "Cowardly",
  "Brave",
  "Curious",
  "Secretive",
  "Loud",
  "Quiet",
  "Arrogant",
  "Humble",
  "Cruel",
  "Kind",
  "Paranoid",
  "Trusting",
]
