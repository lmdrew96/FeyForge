import {
  timestamp,
  pgTable,
  text,
  primaryKey,
  integer,
  boolean,
  jsonb,
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
  name: text("name").notNull(),
  race: text("race").notNull(),
  characterClass: text("character_class").notNull(),
  level: integer("level").default(1),
  data: jsonb("data"), // Full character data as JSON
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
})

export const npcs = pgTable("npcs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  campaignId: text("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  role: text("role"),
  faction: text("faction"),
  location: text("location"),
  importance: text("importance").default("minor"),
  personality: text("personality"),
  goals: text("goals"),
  relationships: text("relationships"),
  notes: text("notes"),
  imageUrl: text("image_url"),
  race: text("race"),
  npcClass: text("npc_class"),
  statBlock: jsonb("stat_block"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
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
  sessionNumber: integer("session_number").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  date: timestamp("date", { mode: "date" }).notNull(),
  xpAwarded: integer("xp_awarded").default(0),
  attendees: jsonb("attendees").$type<string[]>().default([]),
  loot: jsonb("loot").$type<string[]>().default([]),
  highlights: jsonb("highlights").$type<string[]>().default([]),
  dmNotes: text("dm_notes"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
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

// ============================================================================
// Type Exports
// ============================================================================

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Campaign = typeof campaigns.$inferSelect
export type NewCampaign = typeof campaigns.$inferInsert
export type Character = typeof characters.$inferSelect
export type NewCharacter = typeof characters.$inferInsert
export type NPC = typeof npcs.$inferSelect
export type NewNPC = typeof npcs.$inferInsert
export type GameSession = typeof gameSessions.$inferSelect
export type NewGameSession = typeof gameSessions.$inferInsert
export type WikiEntry = typeof wikiEntries.$inferSelect
export type NewWikiEntry = typeof wikiEntries.$inferInsert
export type WorldMap = typeof worldMaps.$inferSelect
export type NewWorldMap = typeof worldMaps.$inferInsert
export type MapPin = typeof mapPins.$inferSelect
export type NewMapPin = typeof mapPins.$inferInsert
