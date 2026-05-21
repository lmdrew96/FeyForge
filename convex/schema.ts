import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  campaigns: defineTable({
    userId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  characters: defineTable({
    userId: v.string(),
    campaignId: v.optional(v.id("campaigns")),

    name: v.string(),
    playerName: v.optional(v.string()),
    race: v.string(),
    subrace: v.optional(v.string()),
    characterClass: v.string(),
    subclass: v.optional(v.string()),
    level: v.number(),
    experiencePoints: v.number(),
    background: v.optional(v.string()),
    alignment: v.optional(v.string()),

    age: v.optional(v.string()),
    height: v.optional(v.string()),
    weight: v.optional(v.string()),
    eyes: v.optional(v.string()),
    skin: v.optional(v.string()),
    hair: v.optional(v.string()),
    size: v.optional(v.string()),

    baseAbilities: v.object({
      strength: v.number(),
      dexterity: v.number(),
      constitution: v.number(),
      intelligence: v.number(),
      wisdom: v.number(),
      charisma: v.number(),
    }),
    racialBonuses: v.optional(v.object({
      strength: v.optional(v.number()),
      dexterity: v.optional(v.number()),
      constitution: v.optional(v.number()),
      intelligence: v.optional(v.number()),
      wisdom: v.optional(v.number()),
      charisma: v.optional(v.number()),
    })),

    hitPoints: v.object({
      current: v.number(),
      max: v.number(),
      temp: v.number(),
    }),
    hitDice: v.array(v.object({
      diceSize: v.number(),
      total: v.number(),
      used: v.number(),
    })),
    deathSaves: v.object({
      successes: v.number(),
      failures: v.number(),
    }),
    speed: v.number(),
    inspiration: v.boolean(),

    savingThrowProficiencies: v.array(v.string()),
    skillProficiencies: v.array(v.string()),
    skillExpertise: v.array(v.string()),
    armorProficiencies: v.array(v.string()),
    weaponProficiencies: v.array(v.string()),
    toolProficiencies: v.array(v.string()),
    languages: v.array(v.string()),

    currency: v.object({
      cp: v.number(),
      sp: v.number(),
      ep: v.number(),
      gp: v.number(),
      pp: v.number(),
    }),

    // spellSlots stored as array (Convex doesn't support numeric object keys)
    spellcasting: v.optional(v.object({
      ability: v.string(),
      spellSaveDC: v.number(),
      spellAttackBonus: v.number(),
      spellSlots: v.array(v.object({
        level: v.number(),
        total: v.number(),
        used: v.number(),
      })),
      cantripsKnown: v.number(),
      spellsKnown: v.optional(v.number()),
      spellsPrepared: v.optional(v.number()),
    })),

    personalityTraits: v.optional(v.string()),
    ideals: v.optional(v.string()),
    bonds: v.optional(v.string()),
    flaws: v.optional(v.string()),
    backstory: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_campaignId", ["campaignId"]),

  characterProperties: defineTable({
    characterId: v.id("characters"),
    type: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    source: v.optional(v.string()),
    active: v.boolean(),
    equipped: v.optional(v.boolean()),
    tags: v.optional(v.array(v.string())),
    orderIndex: v.number(),
    data: v.any(),
  }).index("by_characterId", ["characterId"]),

  npcs: defineTable({
    userId: v.string(),
    campaignId: v.id("campaigns"),
    name: v.string(),
    race: v.string(),
    occupation: v.string(),
    age: v.string(),
    gender: v.string(),
    alignment: v.string(),
    appearance: v.string(),
    personality: v.array(v.string()),
    mannerisms: v.string(),
    voiceDescription: v.string(),
    motivation: v.string(),
    secret: v.string(),
    backstory: v.string(),
    location: v.string(),
    faction: v.optional(v.string()),
    relationship: v.string(),
    status: v.string(),
    tags: v.array(v.string()),
    notes: v.optional(v.string()),
    stats: v.optional(v.object({
      cr: v.string(),
      ac: v.number(),
      hp: v.number(),
      abilities: v.object({
        str: v.number(),
        dex: v.number(),
        con: v.number(),
        int: v.number(),
        wis: v.number(),
        cha: v.number(),
      }),
    })),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_campaignId", ["campaignId"]),

  gameSessions: defineTable({
    userId: v.string(),
    campaignId: v.id("campaigns"),
    number: v.number(),
    title: v.string(),
    date: v.number(),
    scheduledDate: v.optional(v.number()),
    duration: v.optional(v.number()),
    status: v.union(
      v.literal("planned"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    summary: v.optional(v.string()),
    plotThreads: v.array(v.string()),
    highlights: v.array(v.string()),
    loot: v.array(v.string()),
    npcsEncountered: v.array(v.string()),
    locationsVisited: v.array(v.string()),
    prepNotes: v.optional(v.string()),
    playerRecap: v.optional(v.string()),
    objectives: v.array(v.object({
      id: v.string(),
      text: v.string(),
      completed: v.boolean(),
      priority: v.union(
        v.literal("primary"),
        v.literal("secondary"),
        v.literal("optional")
      ),
    })),
    plannedEncounters: v.array(v.object({
      id: v.string(),
      name: v.string(),
      description: v.optional(v.string()),
      difficulty: v.union(
        v.literal("trivial"),
        v.literal("easy"),
        v.literal("medium"),
        v.literal("hard"),
        v.literal("deadly")
      ),
      monsterSlugs: v.array(v.string()),
      status: v.union(
        v.literal("planned"),
        v.literal("completed"),
        v.literal("skipped")
      ),
      notes: v.optional(v.string()),
      xpReward: v.optional(v.number()),
    })),
    plannedNPCs: v.array(v.string()),
    xpAwarded: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_campaignId", ["campaignId"]),

  // Renamed from sessionNotes to avoid collision with future partySessionNotes
  gameSessionNotes: defineTable({
    sessionId: v.id("gameSessions"),
    content: v.string(),
    type: v.string(),
    timestamp: v.number(),
  }).index("by_sessionId", ["sessionId"]),

  plotThreads: defineTable({
    userId: v.string(),
    campaignId: v.id("campaigns"),
    title: v.string(),
    description: v.string(),
    status: v.string(),
    importance: v.string(),
    relatedNPCs: v.optional(v.array(v.string())),
    relatedLocations: v.optional(v.array(v.string())),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_campaignId", ["campaignId"]),

  wikiEntries: defineTable({
    userId: v.string(),
    campaignId: v.id("campaigns"),
    type: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    content: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    metadata: v.optional(v.any()),
    linkedEntries: v.optional(v.array(v.object({
      type: v.string(),
      id: v.string(),
    }))),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_campaignId", ["campaignId"]),

  worldMaps: defineTable({
    userId: v.string(),
    campaignId: v.id("campaigns"),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    fogOfWarEnabled: v.optional(v.boolean()),
    fogMask: v.optional(v.any()),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_campaignId", ["campaignId"]),

  mapPins: defineTable({
    userId: v.string(),
    campaignId: v.id("campaigns"),
    mapId: v.optional(v.id("worldMaps")),
    wikiEntryId: v.optional(v.id("wikiEntries")),
    name: v.string(),
    description: v.optional(v.string()),
    x: v.number(),
    y: v.number(),
    type: v.optional(v.string()),
    isRevealed: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  })
    .index("by_campaignId", ["campaignId"])
    .index("by_mapId", ["mapId"]),

  mapLocations: defineTable({
    userId: v.string(),
    campaignId: v.optional(v.id("campaigns")),
    name: v.string(),
    type: v.string(),
    description: v.string(),
    notes: v.string(),
    x: v.number(),
    y: v.number(),
    visited: v.boolean(),
  })
    .index("by_userId", ["userId"])
    .index("by_campaignId", ["campaignId"]),

  savedEncounters: defineTable({
    userId: v.string(),
    campaignId: v.optional(v.id("campaigns")),
    name: v.string(),
    combatants: v.array(v.object({
      id: v.string(),
      name: v.string(),
      type: v.union(
        v.literal("pc"),
        v.literal("npc"),
        v.literal("monster")
      ),
      initiative: v.number(),
      initiativeBonus: v.number(),
      armorClass: v.number(),
      hitPoints: v.object({
        current: v.number(),
        max: v.number(),
        temp: v.number(),
      }),
      conditions: v.array(v.string()),
      deathSaves: v.optional(v.object({
        successes: v.number(),
        failures: v.number(),
      })),
      notes: v.string(),
      isActive: v.boolean(),
      characterId: v.optional(v.string()),
    })),
    round: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_campaignId", ["campaignId"]),

  dmConversations: defineTable({
    userId: v.string(),
    campaignId: v.id("campaigns"),
    title: v.string(),
    messages: v.array(v.object({
      id: v.string(),
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
      timestamp: v.string(),
    })),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_campaignId", ["campaignId"]),

  partySessions: defineTable({
    campaignId: v.id("campaigns"),
    dmUserId: v.string(),
    activeScene: v.string(),
    isActive: v.boolean(),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
  })
    .index("by_campaignId_and_isActive", ["campaignId", "isActive"])
    .index("by_dmUserId", ["dmUserId"])
    .index("by_isActive", ["isActive"]),

  sessionBroadcasts: defineTable({
    sessionId: v.id("partySessions"),
    campaignId: v.id("campaigns"),
    type: v.union(
      v.literal("npc"),
      v.literal("location"),
      v.literal("scene"),
      v.literal("custom")
    ),
    title: v.string(),
    body: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    isRevealed: v.boolean(),
    revealedAt: v.optional(v.number()),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_campaignId", ["campaignId"]),
})
