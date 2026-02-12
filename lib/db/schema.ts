import {
  timestamp,
  pgTable,
  text,
  primaryKey,
  integer,
  boolean,
  jsonb,
  real,
} from "drizzle-orm/pg-core"
import type { AdapterAccountType } from "next-auth/adapters"

// ============================================================================
// NextAuth.js Required Tables
// ============================================================================

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  // Custom fields for FeyForge
  displayName: text("display_name"),
  hashedPassword: text("hashed_password"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
})

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  ]
)

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
})

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (verificationToken) => [
    primaryKey({
      columns: [verificationToken.identifier, verificationToken.token],
    }),
  ]
)

// ============================================================================
// FeyForge Application Tables
// ============================================================================

export const campaigns = pgTable("campaigns", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(false),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
})

export const characters = pgTable("characters", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  campaignId: text("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),

  // Basic Info
  name: text("name").notNull(),
  playerName: text("player_name"),
  race: text("race").notNull(),
  subrace: text("subrace"),
  class: text("class").notNull(),
  subclass: text("subclass"),
  level: integer("level").notNull().default(1),
  experiencePoints: integer("experience_points").notNull().default(0),
  background: text("background"),
  alignment: text("alignment"),

  // Physical characteristics
  age: text("age"),
  height: text("height"),
  weight: text("weight"),
  eyes: text("eyes"),
  skin: text("skin"),
  hair: text("hair"),
  size: text("size"),

  // Ability Scores (stored as JSONB for simplicity)
  baseAbilities: jsonb("base_abilities").notNull().$type<{
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  }>(),
  racialBonuses: jsonb("racial_bonuses").$type<Partial<{
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  }>>(),

  // Combat stats (JSONB for nested objects)
  hitPoints: jsonb("hit_points").notNull().$type<{
    current: number;
    max: number;
    temp: number;
  }>(),
  hitDice: jsonb("hit_dice").notNull().$type<Array<{
    diceSize: number;
    total: number;
    used: number;
  }>>(),
  deathSaves: jsonb("death_saves").notNull().$type<{
    successes: number;
    failures: number;
  }>(),
  speed: integer("speed").notNull().default(30),
  inspiration: boolean("inspiration").notNull().default(false),

  // Proficiencies (arrays stored as JSONB)
  savingThrowProficiencies: jsonb("saving_throw_proficiencies").notNull().$type<string[]>().default([]),
  skillProficiencies: jsonb("skill_proficiencies").notNull().$type<string[]>().default([]),
  skillExpertise: jsonb("skill_expertise").notNull().$type<string[]>().default([]),
  armorProficiencies: jsonb("armor_proficiencies").notNull().$type<string[]>().default([]),
  weaponProficiencies: jsonb("weapon_proficiencies").notNull().$type<string[]>().default([]),
  toolProficiencies: jsonb("tool_proficiencies").notNull().$type<string[]>().default([]),
  languages: jsonb("languages").notNull().$type<string[]>().default([]),

  // Currency
  currency: jsonb("currency").notNull().$type<{
    cp: number;
    sp: number;
    ep: number;
    gp: number;
    pp: number;
  }>().default({ cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }),

  // Spellcasting (nullable, complex structure)
  spellcasting: jsonb("spellcasting").$type<{
    ability: string;
    spellSaveDC: number;
    spellAttackBonus: number;
    spellSlots: Record<number, { total: number; used: number }>;
    cantripsKnown: number;
    spellsKnown?: number;
    spellsPrepared?: number;
  }>(),

  // Personality
  personalityTraits: text("personality_traits"),
  ideals: text("ideals"),
  bonds: text("bonds"),
  flaws: text("flaws"),
  backstory: text("backstory"),

  // Image
  imageUrl: text("image_url"),

  // Metadata
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
})

// Character properties table (normalized for flexibility)
export const characterProperties = pgTable("character_properties", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  characterId: text("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'item', 'spell', 'feature', 'action', 'effect', 'classResource', 'alternateForm', 'companion'
  name: text("name").notNull(),
  description: text("description"),
  source: text("source"),
  active: boolean("active").notNull().default(true),
  equipped: boolean("equipped"),
  tags: jsonb("tags").$type<string[]>().default([]),
  orderIndex: integer("order_index").notNull().default(0),
  data: jsonb("data").notNull(), // Type-specific data stored as JSON
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
})

export const npcs = pgTable("npcs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),

  name: text("name").notNull(),
  race: text("race").notNull(),
  occupation: text("occupation").notNull(),
  age: text("age").notNull(),
  gender: text("gender").notNull(),
  alignment: text("alignment").notNull(),
  appearance: text("appearance").notNull(),
  personality: jsonb("personality").notNull().$type<string[]>(),
  mannerisms: text("mannerisms").notNull(),
  voiceDescription: text("voice_description").notNull(),
  motivation: text("motivation").notNull(),
  secret: text("secret").notNull(),
  backstory: text("backstory").notNull(),
  location: text("location").notNull(),
  faction: text("faction"),
  relationship: text("relationship").notNull(), // 'friendly' | 'neutral' | 'hostile'
  status: text("status").notNull(), // 'alive' | 'dead' | 'unknown'
  tags: jsonb("tags").notNull().$type<string[]>().default([]),
  notes: text("notes"),
  stats: jsonb("stats").$type<{
    cr: string;
    ac: number;
    hp: number;
    abilities: {
      str: number;
      dex: number;
      con: number;
      int: number;
      wis: number;
      cha: number;
    };
  }>(),

  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
})

export const gameSessions = pgTable("game_sessions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),

  number: integer("number").notNull(),
  title: text("title").notNull(),
  date: timestamp("date", { mode: "date" }).notNull(),
  scheduledDate: timestamp("scheduled_date", { mode: "date" }),
  duration: integer("duration"), // minutes
  status: text("status").notNull(), // 'planned' | 'completed' | 'cancelled'
  summary: text("summary"),
  plotThreads: jsonb("plot_threads").notNull().$type<string[]>().default([]),
  highlights: jsonb("highlights").notNull().$type<string[]>().default([]),
  loot: jsonb("loot").notNull().$type<string[]>().default([]),
  npcsEncountered: jsonb("npcs_encountered").notNull().$type<string[]>().default([]),
  locationsVisited: jsonb("locations_visited").notNull().$type<string[]>().default([]),
  prepNotes: text("prep_notes"),
  playerRecap: text("player_recap"),
  objectives: jsonb("objectives").notNull().$type<Array<{
    id: string;
    text: string;
    completed: boolean;
    priority: 'primary' | 'secondary' | 'optional';
  }>>().default([]),
  plannedEncounters: jsonb("planned_encounters").notNull().$type<Array<{
    id: string;
    name: string;
    description?: string;
    difficulty: 'trivial' | 'easy' | 'medium' | 'hard' | 'deadly';
    monsterSlugs: string[];
    status: 'planned' | 'completed' | 'skipped';
    notes?: string;
    xpReward?: number;
  }>>().default([]),
  plannedNPCs: jsonb("planned_npcs").notNull().$type<string[]>().default([]),
  xpAwarded: integer("xp_awarded"),

  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
})

export const sessionNotes = pgTable("session_notes", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  sessionId: text("session_id")
    .notNull()
    .references(() => gameSessions.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  type: text("type").notNull(), // 'narrative' | 'combat' | 'roleplay' | 'loot' | 'decision'
  timestamp: timestamp("timestamp", { mode: "date" }).defaultNow().notNull(),
})

export const plotThreads = pgTable("plot_threads", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),

  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull(), // 'active' | 'resolved' | 'abandoned'
  importance: text("importance").notNull(), // 'major' | 'minor' | 'side'
  relatedNPCs: jsonb("related_npcs").$type<string[]>().default([]),
  relatedLocations: jsonb("related_locations").$type<string[]>().default([]),

  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at", { mode: "date" }),
})

export const wikiEntries = pgTable("wiki_entries", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'location' | 'faction' | 'lore' | 'quest'
  name: text("name").notNull(),
  description: text("description"),
  content: text("content"),
  imageUrl: text("image_url"),
  // Type-specific data stored as JSON
  metadata: jsonb("metadata"),
  // Bi-directional linking
  linkedEntries: jsonb("linked_entries").$type<{ type: string; id: string }[]>().default([]),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
})

export const worldMaps = pgTable("world_maps", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  imageUrl: text("image_url"),
  fogOfWarEnabled: boolean("fog_of_war_enabled").default(false),
  fogMask: jsonb("fog_mask"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
})

export const mapPins = pgTable("map_pins", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  mapId: text("map_id").references(() => worldMaps.id, { onDelete: "cascade" }),
  wikiEntryId: text("wiki_entry_id").references(() => wikiEntries.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
  x: integer("x").notNull(),
  y: integer("y").notNull(),
  type: text("type").default("landmark"),
  isRevealed: boolean("is_revealed").default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
})

export const mapLocations = pgTable("map_locations", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  campaignId: text("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }),

  name: text("name").notNull(),
  type: text("type").notNull(), // 'city' | 'town' | 'village' | 'dungeon' | 'landmark' | 'wilderness' | 'poi'
  description: text("description").notNull(),
  notes: text("notes").notNull(),
  x: real("x").notNull(), // percentage position
  y: real("y").notNull(), // percentage position
  visited: boolean("visited").notNull().default(false),

  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
})

export const savedEncounters = pgTable("saved_encounters", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  campaignId: text("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  combatants: jsonb("combatants").notNull().$type<Array<{
    id: string;
    name: string;
    type: "pc" | "npc" | "monster";
    initiative: number;
    initiativeBonus: number;
    armorClass: number;
    hitPoints: { current: number; max: number; temp: number };
    conditions: string[];
    deathSaves?: { successes: number; failures: number };
    notes: string;
    isActive: boolean;
    characterId?: string;
  }>>(),
  round: integer("round").notNull().default(1),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
})

export const dmConversations = pgTable("dm_conversations", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  messages: jsonb("messages").notNull().$type<Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: string;
  }>>().default([]),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
})

// ============================================================================
// Type Exports
// ============================================================================

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Campaign = typeof campaigns.$inferSelect
export type NewCampaign = typeof campaigns.$inferInsert
export type Character = typeof characters.$inferSelect
export type NewCharacter = typeof characters.$inferInsert
export type CharacterPropertyType = typeof characterProperties.$inferSelect
export type NewCharacterPropertyType = typeof characterProperties.$inferInsert
export type NPC = typeof npcs.$inferSelect
export type NewNPC = typeof npcs.$inferInsert
export type GameSession = typeof gameSessions.$inferSelect
export type NewGameSession = typeof gameSessions.$inferInsert
export type SessionNote = typeof sessionNotes.$inferSelect
export type NewSessionNote = typeof sessionNotes.$inferInsert
export type PlotThread = typeof plotThreads.$inferSelect
export type NewPlotThread = typeof plotThreads.$inferInsert
export type WikiEntry = typeof wikiEntries.$inferSelect
export type NewWikiEntry = typeof wikiEntries.$inferInsert
export type WorldMap = typeof worldMaps.$inferSelect
export type NewWorldMap = typeof worldMaps.$inferInsert
export type MapPin = typeof mapPins.$inferSelect
export type NewMapPin = typeof mapPins.$inferInsert
export type MapLocation = typeof mapLocations.$inferSelect
export type NewMapLocation = typeof mapLocations.$inferInsert
export type SavedEncounter = typeof savedEncounters.$inferSelect
export type NewSavedEncounter = typeof savedEncounters.$inferInsert
export type DMConversation = typeof dmConversations.$inferSelect
export type NewDMConversation = typeof dmConversations.$inferInsert
