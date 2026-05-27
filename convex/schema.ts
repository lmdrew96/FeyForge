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

  sessionNotes: defineTable({
    sessionId: v.id("partySessions"),
    campaignId: v.id("campaigns"),
    userId: v.string(),
    isDM: v.boolean(),
    content: v.string(),
    updatedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_sessionId_and_userId", ["sessionId", "userId"]),

  partyInventory: defineTable({
    sessionId: v.id("partySessions"),
    campaignId: v.id("campaigns"),
    addedByUserId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    quantity: v.number(),
    assignedToCharacterId: v.optional(v.id("characters")),
    addedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"]),

  partyMembers: defineTable({
    sessionId: v.id("partySessions"),
    campaignId: v.id("campaigns"),
    userId: v.string(),
    characterId: v.id("characters"),
    joinedAt: v.number(),
    conditions: v.array(v.string()),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_sessionId_and_userId", ["sessionId", "userId"])
    .index("by_userId", ["userId"]),

  partySessions: defineTable({
    campaignId: v.id("campaigns"),
    dmUserId: v.string(),
    activeScene: v.string(),
    activeScenePalette: v.optional(v.object({
      bg: v.string(),
      surface: v.string(),
      accent: v.string(),
      highlight: v.string(),
    })),
    sceneTime: v.optional(v.union(v.literal("day"), v.literal("night"))),
    isActive: v.boolean(),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    activeAmbienceTrackId: v.optional(v.id("audioTracks")),
    activeExploreTrackId: v.optional(v.id("audioTracks")),
    // Optional victory slot for transient cues (e.g. short victory music)
    activeVictoryTrackId: v.optional(v.id("audioTracks")),
    activeCombatTrackId: v.optional(v.id("audioTracks")),
    // intensity now represents musicLevel (0-100) — separate from ambience/master volumes
    intensity: v.optional(v.number()),
    // musicIntensity is the new 1–5 integer for the INTENSITY_MIX vertical remix engine
    musicIntensity: v.optional(v.number()),
    // musicMode indicates which music tier should be active on clients
    musicMode: v.optional(v.union(v.literal("explore"), v.literal("combat"), v.literal("off"), v.literal("blend"))),
    ambienceVolume: v.optional(v.number()),
    masterVolume: v.optional(v.number()),
    audioSyncEnabled: v.optional(v.boolean()),
    // Victory cue intent: timestamp clients use to perform a local fade-in/hold/fade-out
    victoryTriggeredAt: v.optional(v.number()),
    // Optional duration in milliseconds that clients should hold the victory cue before returning
    victoryDurationMs: v.optional(v.number()),
    activePresetId: v.optional(v.id("ambiencePresets")),
    activeLayers: v.optional(v.array(v.object({
      layerId: v.id("ambienceLayers"),
      tier: v.union(v.literal("i"), v.literal("ii"), v.literal("iii"), v.literal("off")),
    }))),
    audioPaused: v.optional(v.boolean()),
  })
    .index("by_campaignId_and_isActive", ["campaignId", "isActive"])
    .index("by_dmUserId", ["dmUserId"])
    .index("by_isActive", ["isActive"]),

  campaignScenes: defineTable({
    campaignId: v.id("campaigns"),
    name: v.string(),
    bg: v.string(),
    surface: v.string(),
    accent: v.string(),
    highlight: v.string(),
    createdBy: v.string(),
    createdAt: v.number(),
  }).index("by_campaignId", ["campaignId"]),

  campaignWebNodes: defineTable({
    campaignId: v.id("campaigns"),
    entityType: v.union(
      v.literal("npc"),
      v.literal("location"),
      v.literal("wiki"),
      v.literal("faction"),
      v.literal("plot_hook")
    ),
    entityId: v.optional(v.string()),
    label: v.string(),
    x: v.number(),
    y: v.number(),
    color: v.optional(v.string()),
  }).index("by_campaignId", ["campaignId"]),

  campaignWebEdges: defineTable({
    campaignId: v.id("campaigns"),
    fromNodeId: v.id("campaignWebNodes"),
    toNodeId: v.id("campaignWebNodes"),
    label: v.string(),
  }).index("by_campaignId", ["campaignId"]),

  sessionBroadcasts: defineTable({
    sessionId: v.id("partySessions"),
    campaignId: v.id("campaigns"),
    type: v.union(
      v.literal("npc"),
      v.literal("location"),
      v.literal("scene"),
      v.literal("custom"),
      v.literal("web_node")
    ),
    title: v.string(),
    body: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    isRevealed: v.boolean(),
    revealedAt: v.optional(v.number()),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_campaignId", ["campaignId"]),

  users: defineTable({
    clerkId: v.string(),         // tokenIdentifier (full, with issuer prefix)
    clerkUserId: v.string(),     // subject / bare user_xxx ID for webhook lookups
    isPremium: v.boolean(),
    premiumSince: v.optional(v.number()),
    premiumExpiresAt: v.optional(v.number()),
    role: v.optional(v.union(v.literal("admin"), v.literal("user"))),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_clerkUserId", ["clerkUserId"])
    .index("by_isPremium", ["isPremium"]),

  libraryReviewComments: defineTable({
    userId: v.string(),          // tokenIdentifier (clerkId) of the reviewer
    reviewerName: v.optional(v.string()),
    trackId: v.id("audioTracks"),
    reaction: v.union(v.literal("yes"), v.literal("no"), v.literal("maybe")),
    comment: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_trackId", ["userId", "trackId"])
    .index("by_trackId", ["trackId"]),

  audioTracks: defineTable({
    name: v.string(),
    type: v.union(v.literal("ambience"), v.literal("music"), v.literal("sfx")),
    intensityTier: v.union(v.literal("explore"), v.literal("combat"), v.null()),
    intensityRank: v.optional(v.number()),
    approved: v.optional(v.boolean()),
    // Admin review status — pending → approved or rejected
    status: v.optional(v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"))),
    // Original filename from bulk upload (used as label in review UI)
    originalFilename: v.optional(v.string()),
    approvedAt: v.optional(v.number()),
    approvedBy: v.optional(v.string()),
    // Array of scene tags for multi-scene applicability
    sceneTag: v.optional(v.array(v.string())),
    // Curation tier: "free" = all users, "premium" = Ko-fi subscribers only
    tier: v.optional(v.union(v.literal("free"), v.literal("premium"))),
    r2Key: v.string(),
    r2Url: v.string(),
    duration: v.number(),
    sourceUrl: v.optional(v.string()),
    uploadedBy: v.string(),
    createdAt: v.number(),
  })
    .index("by_type", ["type"])
    .index("by_uploadedBy", ["uploadedBy"])
    .index("by_status", ["status"])
    .index("by_r2Key", ["r2Key"]),

  ambienceLayers: defineTable({
    userId: v.string(),
    campaignId: v.optional(v.id("campaigns")),
    name: v.string(),
    category: v.string(), // "environment" | "weather" | "action" | "creature"
    icon: v.optional(v.string()), // tabler icon slug e.g. "cloud-rain", "wind"
    trackId: v.id("audioTracks"),
    isShared: v.optional(v.boolean()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_campaignId", ["campaignId"]),

  ambiencePresets: defineTable({
    userId: v.string(),
    campaignId: v.optional(v.id("campaigns")),
    sceneName: v.string(),
    variationName: v.string(),
    layers: v.array(v.object({
      layerId: v.id("ambienceLayers"),
      defaultTier: v.optional(v.union(v.literal("i"), v.literal("ii"), v.literal("iii"))),
    })),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_campaignId_and_sceneName", ["campaignId", "sceneName"]),

  campaignSceneAudio: defineTable({
    campaignId: v.id("campaigns"),
    sceneName: v.string(),
    ambienceTrackId: v.optional(v.id("audioTracks")),
    exploreTrackId: v.optional(v.id("audioTracks")),
    combatTrackId: v.optional(v.id("audioTracks")),
  })
    .index("by_campaignId", ["campaignId"])
    .index("by_campaignId_and_sceneName", ["campaignId", "sceneName"]),

  musicSetLibrary: defineTable({
    name: v.string(),
    intensityTier: v.union(v.literal("explore"), v.literal("combat")),
    lowTrackId: v.id("audioTracks"),
    medTrackId: v.id("audioTracks"),
    highTrackId: v.id("audioTracks"),
    sceneTag: v.optional(v.array(v.string())),
    tier: v.optional(v.union(v.literal("free"), v.literal("premium"))),
    approved: v.optional(v.boolean()),
    uploadedBy: v.string(),
    createdAt: v.number(),
  })
    .index("by_intensityTier", ["intensityTier"])
    .index("by_uploadedBy", ["uploadedBy"]),

  sceneMusicSets: defineTable({
    userId: v.string(),
    campaignId: v.id("campaigns"),
    sceneName: v.string(),
    mode: v.union(v.literal("explore"), v.literal("combat"), v.literal("victory")),
    musicSetLibraryId: v.optional(v.id("musicSetLibrary")),
    lowTrackId: v.optional(v.id("audioTracks")),
    medTrackId: v.optional(v.id("audioTracks")),
    highTrackId: v.optional(v.id("audioTracks")),
    createdAt: v.number(),
  })
    .index("by_campaignId_and_sceneName", ["campaignId", "sceneName"])
    .index("by_campaignId_sceneName_and_mode", ["campaignId", "sceneName", "mode"]),

  musicStems: defineTable({
    userId: v.string(),
    // undefined = global (not campaign-scoped); campaignId = campaign-specific
    campaignId: v.optional(v.id("campaigns")),
    sceneName: v.string(),
    mode: v.union(
      v.literal("explore"),
      v.literal("combat"),
      v.literal("victory"),
    ),
    name: v.string(),
    trackId: v.id("audioTracks"),
    intensityMin: v.number(),
    intensityMax: v.number(),
    sortOrder: v.number(),
    createdAt: v.number(),
  })
    .index("by_campaignId_and_sceneName", ["campaignId", "sceneName"])
    .index("by_campaignId_sceneName_and_mode", ["campaignId", "sceneName", "mode"])
    // Used to query global (non-campaign-scoped) stems by scene+mode
    .index("by_sceneName_mode_and_campaignId", ["sceneName", "mode", "campaignId"]),
})
