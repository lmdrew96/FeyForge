import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface MapLocation {
  id: string
  campaignId?: string
  name: string
  type: "city" | "town" | "village" | "dungeon" | "landmark" | "wilderness" | "poi"
  description: string
  notes: string
  x: number // percentage position
  y: number // percentage position
  visited: boolean
  createdAt: string
}

interface WorldStore {
  locations: MapLocation[]
  addLocation: (location: Omit<MapLocation, "id" | "createdAt">) => void
  updateLocation: (id: string, updates: Partial<MapLocation>) => void
  deleteLocation: (id: string) => void
  toggleVisited: (id: string) => void
}

export const useWorldStore = create<WorldStore>()(
  persist(
    (set) => ({
      locations: [
        {
          id: "1",
          name: "Neverwinter",
          type: "city",
          description: "A bustling port city on the Sword Coast, known as the Jewel of the North.",
          notes: "Party started their adventure here. Met the mysterious wizard Elminster at the Moonstone Mask inn.",
          x: 25,
          y: 30,
          visited: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: "2",
          name: "Thundertree",
          type: "village",
          description:
            "An abandoned village overrun by undead and plant creatures. A young green dragon has taken residence in the old tower.",
          notes: "Dragon named Venomfang. Druid Reidoth lives nearby.",
          x: 35,
          y: 25,
          visited: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: "3",
          name: "Wave Echo Cave",
          type: "dungeon",
          description: "The legendary Lost Mine of Phandelver, containing the magical Forge of Spells.",
          notes: "Black Spider is searching for this location. Contains powerful magic items.",
          x: 45,
          y: 40,
          visited: false,
          createdAt: new Date().toISOString(),
        },
        {
          id: "4",
          name: "Mount Hotenow",
          type: "landmark",
          description:
            "An active volcano that devastated Neverwinter decades ago. Fire cultists are rumored to worship here.",
          notes: "Possible fire cult activity. Source of the cataclysm.",
          x: 20,
          y: 20,
          visited: false,
          createdAt: new Date().toISOString(),
        },
      ],
      addLocation: (location) =>
        set((state) => ({
          locations: [
            ...state.locations,
            {
              ...location,
              id: Date.now().toString(),
              createdAt: new Date().toISOString(),
            },
          ],
        })),
      updateLocation: (id, updates) =>
        set((state) => ({
          locations: state.locations.map((loc) => (loc.id === id ? { ...loc, ...updates } : loc)),
        })),
      deleteLocation: (id) =>
        set((state) => ({
          locations: state.locations.filter((loc) => loc.id !== id),
        })),
      toggleVisited: (id) =>
        set((state) => ({
          locations: state.locations.map((loc) => (loc.id === id ? { ...loc, visited: !loc.visited } : loc)),
        })),
    }),
    { name: "arcane-codex-world" },
  ),
)
