"use client"

import { create } from "zustand"
import {
  fetchUserCampaigns,
  createCampaign as createCampaignAction,
  updateCampaign as updateCampaignAction,
  deleteCampaign as deleteCampaignAction,
  type Campaign,
} from "@/lib/actions/campaigns"

// Re-export Campaign type for convenience
export type { Campaign }

interface CampaignState {
  campaigns: Campaign[]
  activeCampaignId: string | null
  isLoading: boolean
  isInitialized: boolean
  error: string | null

  // Initialize from database
  initialize: () => Promise<void>

  // Actions (now async, hitting the database)
  createCampaign: (campaign: Omit<Campaign, "id" | "userId" | "createdAt" | "updatedAt">) => Promise<string>
  updateCampaign: (id: string, updates: Partial<Campaign>) => Promise<void>
  deleteCampaign: (id: string) => Promise<void>
  setActiveCampaign: (id: string) => void
  getActiveCampaign: () => Campaign | undefined

  // Reset store (for logout)
  reset: () => void
}

export const useCampaignStore = create<CampaignState>((set, get) => ({
  campaigns: [],
  activeCampaignId: null,
  isLoading: false,
  isInitialized: false,
  error: null,

  initialize: async () => {
    if (get().isInitialized) return

    set({ isLoading: true, error: null })
    try {
      const campaigns = await fetchUserCampaigns()
      set({
        campaigns,
        isLoading: false,
        isInitialized: true,
        activeCampaignId: campaigns[0]?.id || null,
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to load campaigns",
        isLoading: false,
      })
    }
  },

  createCampaign: async (campaignData) => {
    set({ isLoading: true, error: null })
    try {
      const newCampaign = await createCampaignAction(campaignData)
      set((state) => ({
        campaigns: [...state.campaigns, newCampaign],
        activeCampaignId: state.campaigns.length === 0 ? newCampaign.id : state.activeCampaignId,
        isLoading: false,
      }))
      return newCampaign.id
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to create campaign",
        isLoading: false,
      })
      throw error
    }
  },

  updateCampaign: async (id, updates) => {
    set({ isLoading: true, error: null })
    try {
      const updatedCampaign = await updateCampaignAction(id, updates)
      set((state) => ({
        campaigns: state.campaigns.map((c) => (c.id === id ? updatedCampaign : c)),
        isLoading: false,
      }))
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to update campaign",
        isLoading: false,
      })
      throw error
    }
  },

  deleteCampaign: async (id) => {
    set({ isLoading: true, error: null })
    try {
      await deleteCampaignAction(id)
      set((state) => {
        const remaining = state.campaigns.filter((c) => c.id !== id)
        return {
          campaigns: remaining,
          activeCampaignId:
            state.activeCampaignId === id ? remaining[0]?.id ?? null : state.activeCampaignId,
          isLoading: false,
        }
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to delete campaign",
        isLoading: false,
      })
      throw error
    }
  },

  setActiveCampaign: (id) => set({ activeCampaignId: id }),

  getActiveCampaign: () => {
    const state = get()
    return state.campaigns.find((c) => c.id === state.activeCampaignId)
  },

  reset: () =>
    set({
      campaigns: [],
      activeCampaignId: null,
      isLoading: false,
      isInitialized: false,
      error: null,
    }),
}))
