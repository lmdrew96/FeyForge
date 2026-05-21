"use client"

import { create } from "zustand"
import { toast } from "sonner"
import { getErrorMessage, isAuthError } from "@/lib/errors"
import { type NPC, type NewNPC } from "@/lib/types"
import { convex } from "@/lib/convex"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"

// Re-export NPC type
export type { NPC }

interface NPCStore {
  npcs: NPC[]
  isLoading: boolean
  isInitialized: boolean
  error: string | null

  // Set data from DataLoader
  setNPCs: (npcs: NPC[]) => void

  // Initialize (no-op — DataLoader handles loading)
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

  setNPCs: (npcs) => set({ npcs, isInitialized: true, isLoading: false }),

  initialize: async () => { set({ isInitialized: true }) },

  initializeByCampaign: async (_campaignId: string) => { set({ isInitialized: true }) },

  addNPC: async (npcData) => {
    const tempId = crypto.randomUUID()
    const tempNPC: NPC = {
      ...npcData,
      id: tempId,
      userId: "",
      tags: npcData.tags ?? [],
      faction: npcData.faction ?? null,
      notes: npcData.notes ?? null,
      stats: npcData.stats ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    set((state) => ({ npcs: [...state.npcs, tempNPC] }))
    try {
      await convex.mutation(api.npcs.create, {
        ...npcData,
        campaignId: npcData.campaignId as Id<"campaigns">,
        tags: npcData.tags ?? [],
        faction: npcData.faction ?? undefined,
        notes: npcData.notes ?? undefined,
        stats: npcData.stats ?? undefined,
      })
      return tempNPC
    } catch (error) {
      set((state) => ({ npcs: state.npcs.filter((n) => n.id !== tempId) }))
      const message = getErrorMessage(error, "Failed to create NPC")
      toast.error(message)
      throw error
    }
  },

  updateNPC: async (id, updates) => {
    set((state) => ({
      npcs: state.npcs.map((npc) =>
        npc.id === id ? { ...npc, ...updates, updatedAt: new Date() } : npc
      ),
    }))
    try {
      await convex.mutation(api.npcs.update, {
        id: id as Id<"npcs">,
        ...updates,
        faction: updates.faction ?? undefined,
        notes: updates.notes ?? undefined,
        stats: updates.stats ?? undefined,
      })
    } catch (error) {
      const message = getErrorMessage(error, "Failed to update NPC")
      toast.error(message)
      throw error
    }
  },

  deleteNPC: async (id) => {
    const previousNpcs = get().npcs
    set((state) => ({ npcs: state.npcs.filter((npc) => npc.id !== id), error: null }))
    try {
      await convex.mutation(api.npcs.remove, { id: id as Id<"npcs"> })
    } catch (error) {
      set({ npcs: previousNpcs, error: getErrorMessage(error, "Failed to delete NPC") })
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

  searchNPCs: async (query, _campaignId) => {
    const q = query.toLowerCase()
    return get().npcs.filter(
      (npc) =>
        npc.name.toLowerCase().includes(q) ||
        npc.occupation.toLowerCase().includes(q) ||
        npc.location.toLowerCase().includes(q) ||
        npc.tags.some((tag) => tag.toLowerCase().includes(q))
    )
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
