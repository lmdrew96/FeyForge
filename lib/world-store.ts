"use client"

import { create } from "zustand"
import { getErrorMessage } from "@/lib/errors"
import {
  fetchUserLocations,
  getLocationsByCampaign,
  createLocation as createLocationAction,
  updateLocation as updateLocationAction,
  deleteLocation as deleteLocationAction,
  toggleLocationVisited as toggleLocationVisitedAction,
  type MapLocation,
  type NewMapLocation,
} from "@/lib/actions/world"

// Re-export type
export type { MapLocation }

interface WorldStore {
  locations: MapLocation[]
  isLoading: boolean
  isInitialized: boolean
  error: string | null

  // Initialize
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

  initialize: async () => {
    if (get().isInitialized) return

    set({ isLoading: true, error: null })
    try {
      const locations = await fetchUserLocations()
      set({
        locations,
        isLoading: false,
        isInitialized: true,
      })
    } catch (error) {
      set({
        error: getErrorMessage(error, "Failed to load locations"),
        isLoading: false,
      })
    }
  },

  initializeByCampaign: async (campaignId: string) => {
    set({ isLoading: true, error: null })
    try {
      const locations = await getLocationsByCampaign(campaignId)
      set({
        locations,
        isLoading: false,
        isInitialized: true,
      })
    } catch (error) {
      set({
        error: getErrorMessage(error, "Failed to load locations"),
        isLoading: false,
      })
    }
  },

  addLocation: async (locationData) => {
    set({ isLoading: true, error: null })
    try {
      const newLocation = await createLocationAction(locationData)
      set((state) => ({
        locations: [...state.locations, newLocation],
        isLoading: false,
      }))
      return newLocation
    } catch (error) {
      set({
        error: getErrorMessage(error, "Failed to create location"),
        isLoading: false,
      })
      throw error
    }
  },

  updateLocation: async (id, updates) => {
    set({ isLoading: true, error: null })
    try {
      const updatedLocation = await updateLocationAction(id, updates)
      set((state) => ({
        locations: state.locations.map((loc) => (loc.id === id ? updatedLocation : loc)),
        isLoading: false,
      }))
    } catch (error) {
      set({
        error: getErrorMessage(error, "Failed to update location"),
        isLoading: false,
      })
      throw error
    }
  },

  deleteLocation: async (id) => {
    set({ isLoading: true, error: null })
    try {
      await deleteLocationAction(id)
      set((state) => ({
        locations: state.locations.filter((loc) => loc.id !== id),
        isLoading: false,
      }))
    } catch (error) {
      set({
        error: getErrorMessage(error, "Failed to delete location"),
        isLoading: false,
      })
      throw error
    }
  },

  toggleVisited: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const updatedLocation = await toggleLocationVisitedAction(id)
      set((state) => ({
        locations: state.locations.map((loc) => (loc.id === id ? updatedLocation : loc)),
        isLoading: false,
      }))
    } catch (error) {
      set({
        error: getErrorMessage(error, "Failed to toggle visited"),
        isLoading: false,
      })
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
