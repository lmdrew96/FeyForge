// Standalone domain types — replaces Drizzle $inferSelect derivations

export interface NPC {
  id: string
  userId: string
  campaignId: string
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
  faction: string | null
  relationship: string
  status: string
  tags: string[]
  notes: string | null
  stats: {
    cr: string
    ac: number
    hp: number
    abilities: { str: number; dex: number; con: number; int: number; wis: number; cha: number }
  } | null
  createdAt: Date
  updatedAt: Date
}

export interface NewNPC {
  campaignId: string
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
  faction?: string | null
  relationship: string
  status: string
  tags?: string[]
  notes?: string | null
  stats?: NPC["stats"] | null
}

export interface GameSession {
  id: string
  userId: string
  campaignId: string
  number: number
  title: string
  date: Date
  scheduledDate: Date | null
  duration: number | null
  status: string
  summary: string | null
  plotThreads: string[]
  highlights: string[]
  loot: string[]
  npcsEncountered: string[]
  locationsVisited: string[]
  prepNotes: string | null
  playerRecap: string | null
  objectives: Array<{
    id: string
    text: string
    completed: boolean
    priority: "primary" | "secondary" | "optional"
  }>
  plannedEncounters: Array<{
    id: string
    name: string
    description?: string
    difficulty: "trivial" | "easy" | "medium" | "hard" | "deadly"
    monsterSlugs: string[]
    status: "planned" | "completed" | "skipped"
    notes?: string
    xpReward?: number
  }>
  plannedNPCs: string[]
  xpAwarded: number | null
  createdAt: Date
  updatedAt: Date
}

export interface NewGameSession {
  campaignId: string
  number: number
  title: string
  date: Date
  status: string
  scheduledDate?: Date | null
  duration?: number | null
  summary?: string | null
  plotThreads?: string[]
  highlights?: string[]
  loot?: string[]
  npcsEncountered?: string[]
  locationsVisited?: string[]
  prepNotes?: string | null
  playerRecap?: string | null
  objectives?: Array<{
    id: string
    text: string
    completed: boolean
    priority: "primary" | "secondary" | "optional"
  }>
  plannedEncounters?: Array<{
    id: string
    name: string
    description?: string
    difficulty: "trivial" | "easy" | "medium" | "hard" | "deadly"
    monsterSlugs: string[]
    status: "planned" | "completed" | "skipped"
    notes?: string
    xpReward?: number
  }>
  plannedNPCs?: string[]
  xpAwarded?: number | null
}

export interface PlotThread {
  id: string
  userId: string
  campaignId: string
  title: string
  description: string
  status: string
  importance: string
  relatedNPCs: string[] | null
  relatedLocations: string[] | null
  createdAt: Date
  resolvedAt: Date | null
}

export interface NewPlotThread {
  campaignId: string
  title: string
  description: string
  status: string
  importance: string
  relatedNPCs?: string[] | null
  relatedLocations?: string[] | null
  resolvedAt?: Date | null
}

export interface MapLocation {
  id: string
  userId: string
  campaignId: string | null
  name: string
  type: string
  description: string
  notes: string
  x: number
  y: number
  visited: boolean
  createdAt: Date
}

export interface NewMapLocation {
  campaignId?: string | null
  name: string
  type: string
  description: string
  notes: string
  x: number
  y: number
  visited?: boolean
}
