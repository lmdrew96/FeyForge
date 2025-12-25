"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Character } from "./dnd-data"

interface CharacterStore {
  characters: Character[]
  activeCharacterId: string | null
  addCharacter: (character: Character) => void
  updateCharacter: (id: string, updates: Partial<Character>) => void
  deleteCharacter: (id: string) => void
  setActiveCharacter: (id: string | null) => void
  getActiveCharacter: () => Character | undefined
}

export const useCharacterStore = create<CharacterStore>()(
  persist(
    (set, get) => ({
      characters: [],
      activeCharacterId: null,

      addCharacter: (character) =>
        set((state) => ({
          characters: [...state.characters, character],
        })),

      updateCharacter: (id, updates) =>
        set((state) => ({
          characters: state.characters.map((char) =>
            char.id === id ? { ...char, ...updates, updatedAt: new Date() } : char,
          ),
        })),

      deleteCharacter: (id) =>
        set((state) => ({
          characters: state.characters.filter((char) => char.id !== id),
          activeCharacterId: state.activeCharacterId === id ? null : state.activeCharacterId,
        })),

      setActiveCharacter: (id) => set({ activeCharacterId: id }),

      getActiveCharacter: () => {
        const state = get()
        return state.characters.find((char) => char.id === state.activeCharacterId)
      },
    }),
    {
      name: "dnd-characters",
    },
  ),
)
