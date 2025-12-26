"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { useNPCStore } from "./npc-store"
import { useSessionStore } from "./session-store"
import { useCharacterStore } from "./character-store"
import { useWorldStore } from "./world-store"
import { useCombatStore } from "./combat-store"

export interface Campaign {
  id: string
  name: string
  description: string
  role: "DM" | "Player"
  playerCount: number
  createdAt: Date
  updatedAt: Date
}

interface CampaignState {
  campaigns: Campaign[]
  activeCampaignId: string | null

  // Actions
  createCampaign: (campaign: Omit<Campaign, "id" | "createdAt" | "updatedAt">) => string
  updateCampaign: (id: string, updates: Partial<Campaign>) => void
  deleteCampaign: (id: string) => void
  setActiveCampaign: (id: string) => void
  getActiveCampaign: () => Campaign | undefined
}

export const useCampaignStore = create<CampaignState>()(
  persist(
    (set, get) => ({
      campaigns: [],
      activeCampaignId: null,

      createCampaign: (campaignData) => {
        const id = crypto.randomUUID()
        const newCampaign: Campaign = {
          ...campaignData,
          id,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        set((state) => ({
          campaigns: [...state.campaigns, newCampaign],
          // Auto-activate if this is the first campaign
          activeCampaignId: state.campaigns.length === 0 ? id : state.activeCampaignId,
        }))
        return id
      },

      updateCampaign: (id, updates) =>
        set((state) => ({
          campaigns: state.campaigns.map((c) =>
            c.id === id ? { ...c, ...updates, updatedAt: new Date() } : c
          ),
        })),

      deleteCampaign: (id) =>
        set((state) => {
          const remaining = state.campaigns.filter((c) => c.id !== id)
          return {
            campaigns: remaining,
            // Switch to another campaign if deleting the active one
            activeCampaignId:
              state.activeCampaignId === id
                ? remaining[0]?.id ?? null
                : state.activeCampaignId,
          }
        }),

      setActiveCampaign: (id) => set({ activeCampaignId: id }),

      getActiveCampaign: () => {
        const state = get()
        return state.campaigns.find((c) => c.id === state.activeCampaignId)
      },
    }),
    {
      name: "dnd-campaigns",
    }
  )
)

// Migration flag to track if migration has run
let migrationRun = false

// Migration function to handle existing data without campaignId
export function migrateExistingData() {
  // Only run once per session
  if (migrationRun) return
  migrationRun = true

  const campaignStore = useCampaignStore.getState()
  const npcStore = useNPCStore.getState()
  const sessionStore = useSessionStore.getState()
  const characterStore = useCharacterStore.getState()
  const worldStore = useWorldStore.getState()
  const combatStore = useCombatStore.getState()

  // Check if migration is needed (any entity without campaignId)
  const hasOrphanedNPCs = npcStore.npcs.some((n) => !n.campaignId)
  const hasOrphanedSessions = sessionStore.sessions.some((s) => !s.campaignId)
  const hasOrphanedPlotThreads = sessionStore.plotThreads.some((t) => !t.campaignId)
  const hasOrphanedCharacters = characterStore.characters.some((c) => !c.campaignId)
  const hasOrphanedLocations = worldStore.locations.some((l) => !l.campaignId)
  const hasOrphanedEncounters = combatStore.encounterHistory.some((e) => !e.campaignId)

  const hasOrphanedData =
    hasOrphanedNPCs ||
    hasOrphanedSessions ||
    hasOrphanedPlotThreads ||
    hasOrphanedCharacters ||
    hasOrphanedLocations ||
    hasOrphanedEncounters

  if (!hasOrphanedData) return // No migration needed

  // Create or find default campaign
  let defaultCampaignId = campaignStore.campaigns.find((c) => c.name === "Default Campaign")?.id

  if (!defaultCampaignId) {
    defaultCampaignId = campaignStore.createCampaign({
      name: "Default Campaign",
      description: "Your existing data has been migrated here",
      role: "DM",
      playerCount: 4,
    })
  }

  // Migrate NPCs
  if (hasOrphanedNPCs) {
    npcStore.npcs
      .filter((n) => !n.campaignId)
      .forEach((n) => npcStore.updateNPC(n.id, { campaignId: defaultCampaignId }))
  }

  // Migrate Sessions
  if (hasOrphanedSessions) {
    sessionStore.sessions
      .filter((s) => !s.campaignId)
      .forEach((s) => sessionStore.updateSession(s.id, { campaignId: defaultCampaignId }))
  }

  // Migrate Plot Threads
  if (hasOrphanedPlotThreads) {
    sessionStore.plotThreads
      .filter((t) => !t.campaignId)
      .forEach((t) => sessionStore.updatePlotThread(t.id, { campaignId: defaultCampaignId }))
  }

  // Migrate Characters
  if (hasOrphanedCharacters) {
    characterStore.characters
      .filter((c) => !c.campaignId)
      .forEach((c) => characterStore.updateCharacter(c.id, { campaignId: defaultCampaignId }))
  }

  // Migrate World Locations - need to update store directly since updateLocation doesn't support campaignId
  if (hasOrphanedLocations) {
    worldStore.locations
      .filter((l) => !l.campaignId)
      .forEach((l) => worldStore.updateLocation(l.id, { campaignId: defaultCampaignId }))
  }

  console.log("[FeyForge] Migration complete: Existing data migrated to Default Campaign")
}
