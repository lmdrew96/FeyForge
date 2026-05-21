"use client"

import { create } from "zustand"
import { getErrorMessage } from "@/lib/errors"
import { type MapLocation, type NewMapLocation } from "@/lib/actions/world"
import { convex } from "@/lib/convex"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"

// Re-export type
export type { MapLocation }

interface WorldStore {
  locations: MapLocation[]
  isLoading: boolean
  isInitialized: boolean
  error: string | null

  // Set data from DataLoader
  setLocations: (locations: MapLocation[]) => void

  // Initialize (no-op — DataLoader handles loading)
  initialize: () => Promise<void>
  initializeByCampaign: (campaignId: string) => Promise<void>

  // Actions (async)
  addLocation: (location: NewMapLocation) => Promise<MapLocation>
  updateLocation: (id: string, updates: Partial<NewMapLocation>) => Promise<void>
  deleteLocation: (id: string) => Promise<void>
  toggleVisited: (id: string) => Promise<void>

  // Reset
  reset: () => void
}

export const useWorldStore = create<WorldStore>((set, get) => ({
  locations: [],
  isLoading: false,
  isInitialized: false,
  error: null,

  setLocations: (locations) => set({ locations, isInitialized: true, isLoading: false }),

  initialize: async () => { set({ isInitialized: true }) },

  initializeByCampaign: async (_campaignId: string) => { set({ isInitialized: true }) },

  addLocation: async (locationData) => {
    const tempId = crypto.randomUUID()
    const tempLocation: MapLocation = {
      ...locationData,
      id: tempId,
      userId: "",
      campaignId: locationData.campaignId ?? null,
      visited: locationData.visited ?? false,
      createdAt: new Date(),
    }
    set((state) => ({ locations: [...state.locations, tempLocation] }))
    try {
      await convex.mutation(api.world.create, {
        ...locationData,
        campaignId: locationData.campaignId ? (locationData.campaignId as Id<"campaigns">) : undefined,
        visited: locationData.visited ?? false,
      })
      return tempLocation
    } catch (error) {
      set((state) => ({ locations: state.locations.filter((l) => l.id !== tempId) }))
      set({ error: getErrorMessage(error, "Failed to create location") })
      throw error
    }
  },

  updateLocation: async (id, updates) => {
    set((state) => ({
      locations: state.locations.map((loc) => (loc.id === id ? { ...loc, ...updates } : loc)),
    }))
    try {
      await convex.mutation(api.world.update, {
        id: id as Id<"mapLocations">,
        ...updates,
        campaignId: updates.campaignId ? (updates.campaignId as Id<"campaigns">) : undefined,
      })
    } catch (error) {
      set({ error: getErrorMessage(error, "Failed to update location") })
      throw error
    }
  },

  deleteLocation: async (id) => {
    const prev = get().locations
    set((state) => ({ locations: state.locations.filter((loc) => loc.id !== id) }))
    try {
      await convex.mutation(api.world.remove, { id: id as Id<"mapLocations"> })
    } catch (error) {
      set({ locations: prev, error: getErrorMessage(error, "Failed to delete location") })
      throw error
    }
  },

  toggleVisited: async (id) => {
    set((state) => ({
      locations: state.locations.map((loc) =>
        loc.id === id ? { ...loc, visited: !loc.visited } : loc
      ),
    }))
    try {
      await convex.mutation(api.world.toggleVisited, { id: id as Id<"mapLocations"> })
    } catch (error) {
      set({ error: getErrorMessage(error, "Failed to toggle visited") })
      throw error
    }
  },

  reset: () =>
    set({
      locations: [],
      isLoading: false,
      isInitialized: false,
      error: null,
    }),
}))
