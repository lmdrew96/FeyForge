import { create } from "zustand"
import { persist } from "zustand/middleware"

export type CodexCategory = "spells" | "monsters" | "magicitems" | "equipment" | "conditions" | "rules"

export interface BookmarkedEntry {
  id: string
  category: CodexCategory
  name: string
  slug: string
  addedAt: string
}

interface CodexStore {
  bookmarks: BookmarkedEntry[]
  activeCategory: CodexCategory
  searchQuery: string
  
  // Bookmark actions
  addBookmark: (entry: Omit<BookmarkedEntry, "addedAt">) => void
  removeBookmark: (id: string) => void
  isBookmarked: (id: string) => boolean
  getBookmarksByCategory: (category: CodexCategory) => BookmarkedEntry[]
  
  // Navigation
  setActiveCategory: (category: CodexCategory) => void
  setSearchQuery: (query: string) => void
  clearSearch: () => void
}

export const useCodexStore = create<CodexStore>()(
  persist(
    (set, get) => ({
      bookmarks: [],
      activeCategory: "spells",
      searchQuery: "",

      addBookmark: (entry) =>
        set((state) => {
          // Prevent duplicates
          if (state.bookmarks.some((b) => b.id === entry.id)) {
            return state
          }
          return {
            bookmarks: [
              ...state.bookmarks,
              {
                ...entry,
                addedAt: new Date().toISOString(),
              },
            ],
          }
        }),

      removeBookmark: (id) =>
        set((state) => ({
          bookmarks: state.bookmarks.filter((b) => b.id !== id),
        })),

      isBookmarked: (id) => get().bookmarks.some((b) => b.id === id),

      getBookmarksByCategory: (category) =>
        get().bookmarks.filter((b) => b.category === category),

      setActiveCategory: (category) => set({ activeCategory: category }),

      setSearchQuery: (query) => set({ searchQuery: query }),

      clearSearch: () => set({ searchQuery: "" }),
    }),
    {
      name: "feyforge-codex-storage",
    }
  )
)

// Open5e API types
export interface Open5eSpell {
  slug: string
  name: string
  desc: string
  higher_level?: string
  page?: string
  range: string
  components: string
  material?: string
  ritual: string
  duration: string
  concentration: string
  casting_time: string
  level: string
  level_int: number
  school: string
  dnd_class: string
  archetype?: string
  circles?: string
  document__slug: string
  document__title: string
}

export interface Open5eMonster {
  slug: string
  name: string
  size: string
  type: string
  subtype?: string
  group?: string
  alignment: string
  armor_class: number
  armor_desc?: string
  hit_points: number
  hit_dice: string
  speed: Record<string, number>
  strength: number
  dexterity: number
  constitution: number
  intelligence: number
  wisdom: number
  charisma: number
  strength_save?: number
  dexterity_save?: number
  constitution_save?: number
  intelligence_save?: number
  wisdom_save?: number
  charisma_save?: number
  perception?: number
  damage_vulnerabilities: string
  damage_resistances: string
  damage_immunities: string
  condition_immunities: string
  senses: string
  languages: string
  challenge_rating: string
  cr: number
  actions?: { name: string; desc: string }[]
  bonus_actions?: { name: string; desc: string }[]
  reactions?: { name: string; desc: string }[]
  legendary_desc?: string
  legendary_actions?: { name: string; desc: string }[]
  special_abilities?: { name: string; desc: string }[]
  document__slug: string
  document__title: string
}

export interface Open5eMagicItem {
  slug: string
  name: string
  type: string
  desc: string
  rarity: string
  requires_attunement: string
  document__slug: string
  document__title: string
}

export interface Open5eCondition {
  slug: string
  name: string
  desc: string
  document__slug: string
  document__title: string
}

export interface Open5eApiResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}
