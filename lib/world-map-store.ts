"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface LocationPin {
  id: string
  campaignId: string
  name: string
  description: string
  x: number // percentage position (0-100)
  y: number // percentage position (0-100)
  type: "city" | "town" | "village" | "dungeon" | "landmark" | "poi" | "other"
  notableNPCs: string[] // NPC IDs
  connectedLocations: string[] // Location IDs
  isRevealed: boolean // for fog of war
  notes: string
  createdAt: string
  updatedAt: string
}

export interface MapRoute {
  id: string
  campaignId: string
  name: string
  points: { x: number; y: number }[]
  color: string
  isRevealed: boolean
  createdAt: string
}

export interface WorldMapData {
  id: string
  campaignId: string
  name: string
  imageUrl: string | null
  fogOfWarEnabled: boolean
  fogMask: boolean[][] | null // Grid of revealed areas
  createdAt: string
  updatedAt: string
}

interface WorldMapStore {
  maps: WorldMapData[]
  pins: LocationPin[]
  routes: MapRoute[]
  
  // View state (not persisted)
  zoom: number
  panX: number
  panY: number
  isMeasuring: boolean
  measurePoints: { x: number; y: number }[]
  selectedPinId: string | null
  
  // Map management
  addMap: (map: WorldMapData) => void
  updateMap: (id: string, data: Partial<WorldMapData>) => void
  deleteMap: (id: string) => void
  getMapByCampaign: (campaignId: string) => WorldMapData | undefined
  
  // Pin management
  addPin: (pin: LocationPin) => void
  updatePin: (id: string, data: Partial<LocationPin>) => void
  deletePin: (id: string) => void
  getPinsByCampaign: (campaignId: string) => LocationPin[]
  getPin: (id: string) => LocationPin | undefined
  
  // Route management
  addRoute: (route: MapRoute) => void
  updateRoute: (id: string, data: Partial<MapRoute>) => void
  deleteRoute: (id: string) => void
  getRoutesByCampaign: (campaignId: string) => MapRoute[]
  
  // Fog of War
  toggleFogOfWar: (mapId: string) => void
  revealArea: (mapId: string, x: number, y: number, radius: number) => void
  revealPin: (pinId: string) => void
  hidePin: (pinId: string) => void
  
  // View controls
  setZoom: (zoom: number) => void
  setPan: (x: number, y: number) => void
  resetView: () => void
  
  // Measurement
  toggleMeasuring: () => void
  addMeasurePoint: (point: { x: number; y: number }) => void
  clearMeasurePoints: () => void
  
  // Selection
  selectPin: (id: string | null) => void
}

// Sample data
const samplePins: LocationPin[] = [
  {
    id: "pin-1",
    campaignId: "campaign-1",
    name: "Eldergrove",
    description: "An ancient forest where the boundary between the Material Plane and the Feywild grows thin. Pixies and sprites are commonly seen here.",
    x: 35,
    y: 42,
    type: "landmark",
    notableNPCs: [],
    connectedLocations: ["pin-2"],
    isRevealed: true,
    notes: "The Heart Tree is located at the center.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "pin-2",
    campaignId: "campaign-1",
    name: "Millbrook Village",
    description: "A quiet farming village on the edge of Eldergrove. Recently plagued by strange disappearances.",
    x: 55,
    y: 38,
    type: "village",
    notableNPCs: [],
    connectedLocations: ["pin-1", "pin-3"],
    isRevealed: true,
    notes: "The party first met here in Session 1.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "pin-3",
    campaignId: "campaign-1",
    name: "Thornhaven",
    description: "A fortified town known for its skilled craftsmen and the famous Wandering Willow tavern.",
    x: 70,
    y: 55,
    type: "town",
    notableNPCs: [],
    connectedLocations: ["pin-2"],
    isRevealed: true,
    notes: "Major trading hub for the region.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "pin-4",
    campaignId: "campaign-1",
    name: "The Shadow Gate",
    description: "A mysterious portal said to lead directly to the Shadowfell. Its location was recently discovered.",
    x: 25,
    y: 65,
    type: "dungeon",
    notableNPCs: [],
    connectedLocations: [],
    isRevealed: false,
    notes: "Discovered in Session 5 but not yet explored.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

const sampleMap: WorldMapData = {
  id: "map-1",
  campaignId: "campaign-1",
  name: "The Verdant Realm",
  imageUrl: null, // No custom image uploaded yet
  fogOfWarEnabled: true,
  fogMask: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

export const useWorldMapStore = create<WorldMapStore>()(
  persist(
    (set, get) => ({
      maps: [sampleMap],
      pins: samplePins,
      routes: [],
      
      // View state (defaults)
      zoom: 1,
      panX: 0,
      panY: 0,
      isMeasuring: false,
      measurePoints: [],
      selectedPinId: null,
      
      // Map management
      addMap: (map) =>
        set((state) => ({
          maps: [...state.maps, map],
        })),
      
      updateMap: (id, data) =>
        set((state) => ({
          maps: state.maps.map((m) =>
            m.id === id ? { ...m, ...data, updatedAt: new Date().toISOString() } : m,
          ),
        })),
      
      deleteMap: (id) =>
        set((state) => ({
          maps: state.maps.filter((m) => m.id !== id),
          pins: state.pins.filter((p) => p.campaignId !== id),
          routes: state.routes.filter((r) => r.campaignId !== id),
        })),
      
      getMapByCampaign: (campaignId) =>
        get().maps.find((m) => m.campaignId === campaignId),
      
      // Pin management
      addPin: (pin) =>
        set((state) => ({
          pins: [...state.pins, pin],
        })),
      
      updatePin: (id, data) =>
        set((state) => ({
          pins: state.pins.map((p) =>
            p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p,
          ),
        })),
      
      deletePin: (id) =>
        set((state) => ({
          pins: state.pins.filter((p) => p.id !== id),
          selectedPinId: state.selectedPinId === id ? null : state.selectedPinId,
        })),
      
      getPinsByCampaign: (campaignId) =>
        get().pins.filter((p) => p.campaignId === campaignId),
      
      getPin: (id) => get().pins.find((p) => p.id === id),
      
      // Route management
      addRoute: (route) =>
        set((state) => ({
          routes: [...state.routes, route],
        })),
      
      updateRoute: (id, data) =>
        set((state) => ({
          routes: state.routes.map((r) =>
            r.id === id ? { ...r, ...data } : r,
          ),
        })),
      
      deleteRoute: (id) =>
        set((state) => ({
          routes: state.routes.filter((r) => r.id !== id),
        })),
      
      getRoutesByCampaign: (campaignId) =>
        get().routes.filter((r) => r.campaignId === campaignId),
      
      // Fog of War
      toggleFogOfWar: (mapId) =>
        set((state) => ({
          maps: state.maps.map((m) =>
            m.id === mapId
              ? { ...m, fogOfWarEnabled: !m.fogOfWarEnabled, updatedAt: new Date().toISOString() }
              : m,
          ),
        })),
      
      revealArea: (mapId, x, y, radius) => {
        // Fog mask uses a 100x100 grid (each cell represents 1% of the map)
        const GRID_SIZE = 100
        
        set((state) => ({
          maps: state.maps.map((m) => {
            if (m.id !== mapId) return m
            
            // Initialize fog mask if it doesn't exist (all hidden by default)
            let fogMask = m.fogMask
            if (!fogMask) {
              fogMask = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(false))
            } else {
              // Clone to avoid mutation
              fogMask = fogMask.map(row => [...row])
            }
            
            // Reveal cells within the radius (using circular reveal)
            // x, y, and radius are in percentage coordinates (0-100)
            const centerX = Math.round(x)
            const centerY = Math.round(y)
            const radiusCells = Math.round(radius)
            
            for (let i = 0; i < GRID_SIZE; i++) {
              for (let j = 0; j < GRID_SIZE; j++) {
                const distance = Math.sqrt(
                  Math.pow(i - centerX, 2) + Math.pow(j - centerY, 2)
                )
                if (distance <= radiusCells) {
                  fogMask[j][i] = true // [row][col] = [y][x]
                }
              }
            }
            
            return {
              ...m,
              fogMask,
              updatedAt: new Date().toISOString(),
            }
          }),
        }))
      },
      
      revealPin: (pinId) =>
        set((state) => ({
          pins: state.pins.map((p) =>
            p.id === pinId ? { ...p, isRevealed: true, updatedAt: new Date().toISOString() } : p,
          ),
        })),
      
      hidePin: (pinId) =>
        set((state) => ({
          pins: state.pins.map((p) =>
            p.id === pinId ? { ...p, isRevealed: false, updatedAt: new Date().toISOString() } : p,
          ),
        })),
      
      // View controls
      setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(4, zoom)) }),
      
      setPan: (x, y) => set({ panX: x, panY: y }),
      
      resetView: () => set({ zoom: 1, panX: 0, panY: 0 }),
      
      // Measurement
      toggleMeasuring: () =>
        set((state) => ({
          isMeasuring: !state.isMeasuring,
          measurePoints: [],
        })),
      
      addMeasurePoint: (point) =>
        set((state) => ({
          measurePoints: [...state.measurePoints, point],
        })),
      
      clearMeasurePoints: () => set({ measurePoints: [] }),
      
      // Selection
      selectPin: (id) => set({ selectedPinId: id }),
    }),
    {
      name: "feyforge-world-map",
      partialize: (state) => ({
        maps: state.maps,
        pins: state.pins,
        routes: state.routes,
      }),
    },
  ),
)
