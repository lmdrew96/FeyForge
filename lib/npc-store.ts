"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface NPC {
  id: string
  name: string
  race: string
  occupation: string
  age: string
  gender: string
  alignment: string
  appearance: string
  personality: string[]
  mannerisms: string
  voiceDescription: string
  motivation: string
  secret: string
  backstory: string
  location: string
  faction?: string
  relationship: "friendly" | "neutral" | "hostile"
  status: "alive" | "dead" | "unknown"
  tags: string[]
  notes?: string
  stats?: {
    cr: string
    ac: number
    hp: number
    abilities: {
      str: number
      dex: number
      con: number
      int: number
      wis: number
      cha: number
    }
  }
  createdAt: Date
  updatedAt: Date
}

interface NPCStore {
  npcs: NPC[]
  addNPC: (npc: NPC) => void
  updateNPC: (id: string, updates: Partial<NPC>) => void
  deleteNPC: (id: string) => void
  getNPCsByTag: (tag: string) => NPC[]
  getNPCsByLocation: (location: string) => NPC[]
  searchNPCs: (query: string) => NPC[]
}

export const useNPCStore = create<NPCStore>()(
  persist(
    (set, get) => ({
      npcs: [],

      addNPC: (npc) =>
        set((state) => ({
          npcs: [...state.npcs, npc],
        })),

      updateNPC: (id, updates) =>
        set((state) => ({
          npcs: state.npcs.map((npc) => (npc.id === id ? { ...npc, ...updates, updatedAt: new Date() } : npc)),
        })),

      deleteNPC: (id) =>
        set((state) => ({
          npcs: state.npcs.filter((npc) => npc.id !== id),
        })),

      getNPCsByTag: (tag) => {
        return get().npcs.filter((npc) => npc.tags.includes(tag))
      },

      getNPCsByLocation: (location) => {
        return get().npcs.filter((npc) => npc.location.toLowerCase().includes(location.toLowerCase()))
      },

      searchNPCs: (query) => {
        const q = query.toLowerCase()
        return get().npcs.filter(
          (npc) =>
            npc.name.toLowerCase().includes(q) ||
            npc.occupation.toLowerCase().includes(q) ||
            npc.location.toLowerCase().includes(q) ||
            npc.tags.some((tag) => tag.toLowerCase().includes(q)),
        )
      },
    }),
    {
      name: "dnd-npcs",
    },
  ),
)

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
