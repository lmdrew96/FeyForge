"use client"

import { create } from "zustand"
import type { Doc } from "@/convex/_generated/dataModel"

// Campaign type is now the Convex document
export type Campaign = Doc<"campaigns">

interface CampaignUIState {
  activeCampaignId: string | null
  setActiveCampaign: (id: string) => void
  reset: () => void
}

export const useCampaignStore = create<CampaignUIState>((set) => ({
  activeCampaignId: null,
  setActiveCampaign: (id) => set({ activeCampaignId: id }),
  reset: () => set({ activeCampaignId: null }),
}))
