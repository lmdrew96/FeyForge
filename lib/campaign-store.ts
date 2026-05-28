"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Doc } from "@/convex/_generated/dataModel"

export type Campaign = Doc<"campaigns">

interface CampaignUIState {
  activeCampaignId: string | null
  setActiveCampaign: (id: string) => void
  reset: () => void
}

export const useCampaignStore = create<CampaignUIState>()(
  persist(
    (set) => ({
      activeCampaignId: null,
      setActiveCampaign: (id) => set({ activeCampaignId: id }),
      reset: () => set({ activeCampaignId: null }),
    }),
    {
      name: "feyforge-campaign-store",
      partialize: (state) => ({ activeCampaignId: state.activeCampaignId }),
    },
  ),
)
