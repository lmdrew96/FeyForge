"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

// Onboarding hand-off state. Persisted (localStorage) so it survives the full
// "invited player with no character" round-trip: the join page stashes the invite
// code here before sending the newcomer to character creation, and the creation
// flow reads it back to return them to the join page — no "come back to this link"
// burden on the newest user. Mirrors lib/campaign-store's persist pattern.
interface OnboardingState {
  // The invite code a player is mid-join on, stashed while they create a character.
  pendingJoinCode: string | null
  setPendingJoinCode: (code: string) => void
  clearPendingJoinCode: () => void
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      pendingJoinCode: null,
      // Normalize to uppercase to match the join page (codes are case-insensitive).
      setPendingJoinCode: (code) => set({ pendingJoinCode: code.trim().toUpperCase() }),
      clearPendingJoinCode: () => set({ pendingJoinCode: null }),
    }),
    {
      name: "feyforge-onboarding-store",
      partialize: (state) => ({ pendingJoinCode: state.pendingJoinCode }),
    },
  ),
)
