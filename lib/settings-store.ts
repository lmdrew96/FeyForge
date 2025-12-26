"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

interface SettingsStore {
  // Dice settings
  diceSound: boolean
  diceAnimation: boolean

  // Actions
  setDiceSound: (enabled: boolean) => void
  setDiceAnimation: (enabled: boolean) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      diceSound: true,
      diceAnimation: true,

      setDiceSound: (enabled) => set({ diceSound: enabled }),
      setDiceAnimation: (enabled) => set({ diceAnimation: enabled }),
    }),
    {
      name: "feyforge-settings",
    }
  )
)
