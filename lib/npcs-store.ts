import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface NPC {
  id: string
  campaignId: string
  name: string
  role: string
  faction?: string
  location?: string
  importance: "minor" | "major" | "key"
  race?: string
  class?: string
  personality: string
  goals?: string
  relationships?: string
  imageUrl?: string
  createdAt: string
  updatedAt: string
}

interface NPCsStore {
  npcs: NPC[]
  addNPC: (npc: NPC) => void
  updateNPC: (id: string, data: Partial<NPC>) => void
  deleteNPC: (id: string) => void
  getNPC: (id: string) => NPC | undefined
  getNPCsByCampaign: (campaignId: string) => NPC[]
  getNPCCount: (campaignId: string) => number
}

const sampleNPCs: NPC[] = [
  {
    id: "npc-1",
    campaignId: "campaign-1",
    name: "Eldrin the Wanderer",
    role: "Quest Giver",
    faction: "Independent",
    location: "The Wandering Willow Tavern",
    importance: "key",
    race: "Half-Elf",
    class: "Wizard",
    personality: "Mysterious and cryptic, speaks in riddles. Has a gentle demeanor but hides great power.",
    goals: "Seeks to restore balance between the Material Plane and the Feywild.",
    relationships:
      "Former apprentice of Titania's court mage. Has history with the corruption spreading through the Feywild.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "npc-2",
    campaignId: "campaign-1",
    name: "Willowmere",
    role: "Ally",
    faction: "Court of Stars",
    location: "Whisperwind Grove",
    importance: "major",
    race: "Dryad",
    personality: "Ancient and wise, speaks slowly with the patience of centuries. Deeply connected to the forest.",
    goals: "Protect the grove and cleanse the corruption that threatens her home.",
    relationships: "Elder of the dryad council. Grateful to the party for saving her people.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "npc-3",
    campaignId: "campaign-1",
    name: "Puck",
    role: "Trickster Guide",
    faction: "Summer Court",
    location: "Roaming the Feywild",
    importance: "major",
    race: "Pixie",
    personality: "Mischievous and playful, but surprisingly helpful when it suits him.",
    goals: "Unknown. Seems to be testing the party for some greater purpose.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

export const useNPCsStore = create<NPCsStore>()(
  persist(
    (set, get) => ({
      npcs: sampleNPCs,
      addNPC: (npc) =>
        set((state) => ({
          npcs: [...state.npcs, npc],
        })),
      updateNPC: (id, data) =>
        set((state) => ({
          npcs: state.npcs.map((n) => (n.id === id ? { ...n, ...data, updatedAt: new Date().toISOString() } : n)),
        })),
      deleteNPC: (id) =>
        set((state) => ({
          npcs: state.npcs.filter((n) => n.id !== id),
        })),
      getNPC: (id) => get().npcs.find((n) => n.id === id),
      getNPCsByCampaign: (campaignId) => get().npcs.filter((n) => n.campaignId === campaignId),
      getNPCCount: (campaignId) => get().npcs.filter((n) => n.campaignId === campaignId).length,
    }),
    {
      name: "feyforge-npcs",
    },
  ),
)
