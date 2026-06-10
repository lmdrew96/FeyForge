import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"
import { homebrewData } from "./lib/homebrewValidators"

// A persistent NPC's "fights as…" link to a combat stat block (patch: NPCs/DMPCs
// to combat, Part B). Opt-in — most NPCs never fight, so it's optional everywhere.
// SRD points at an open5e monster by name; homebrew points at a homebrew stat block
// by id. Carried onto the live combatant too, so the attack roller resolves a
// disguised NPC ("Lord Vthain") to its real stat block instead of name-matching.
export const statblockRefValidator = v.union(
  v.object({ kind: v.literal("srd"), monsterName: v.string() }),
  v.object({ kind: v.literal("homebrew"), homebrewId: v.id("homebrew") }),
)

export default defineSchema({
  campaigns: defineTable({
    userId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    updatedAt: v.number(),
    // Shareable invite code (e.g. "FEY-7K2Q") players use to join the campaign.
    joinCode: v.optional(v.string()),
    // D&D ruleset edition. Optional for campaigns created before the flag —
    // read through resolveEdition() (lib/editions.ts), which defaults to 2024.
    edition: v.optional(v.union(v.literal("2014"), v.literal("2024"))),
    // Living Diplomacy: does the player-facing "World News" feed exist at all for
    // this campaign. undefined/false = off (the "ignore the whole feature" escape
    // hatch); shifts still log silently, players just never see revealed headlines.
    // Off only suppresses the PLAYER feed read — see convex/diplomacy.ts feed().
    worldNewsEnabled: v.optional(v.boolean()),
  })
    .index("by_userId", ["userId"])
    .index("by_joinCode", ["joinCode"]),

  // Per-campaign role + membership. Replaces faking DM-ness via campaign ownership:
  // a user's role is scoped to each campaign they belong to.
  campaignMembers: defineTable({
    campaignId: v.id("campaigns"),
    userId: v.string(),
    role: v.union(v.literal("dm"), v.literal("player")),
    // The character this member plays in this campaign (players only).
    characterId: v.optional(v.id("characters")),
    joinedAt: v.number(),
  })
    .index("by_campaignId", ["campaignId"])
    .index("by_userId", ["userId"])
    .index("by_campaignId_and_userId", ["campaignId", "userId"]),

  characters: defineTable({
    userId: v.string(),
    campaignId: v.optional(v.id("campaigns")),

    name: v.string(),
    playerName: v.optional(v.string()),
    // DMPC (patch: NPCs/DMPCs to combat, Part A): a full character the DM runs rather
    // than a player — surfaced in the roster tagged "DMPC" and droppable into combat
    // as a PC-type combatant (full sheet, death saves). Just an ownership marker; the
    // character is owned by the DM (userId) like any other.
    dmControlled: v.optional(v.boolean()),
    race: v.string(),
    subrace: v.optional(v.string()),
    characterClass: v.string(),
    subclass: v.optional(v.string()),
    level: v.number(),
    experiencePoints: v.number(),
    background: v.optional(v.string()),
    alignment: v.optional(v.string()),
    // Religion Surfacing (Slice B): the character's faith — NARRATIVE identity, not
    // mechanics (no auto-granted domain spells). Snapshot by NAME so it survives leaving
    // a campaign / a map re-import; deity copied from the world's pantheon when picked
    // from a faith-bearing map, else free-text. See convex/faiths.ts + the Realms & Faiths
    // panel's Followers section.
    faith: v.optional(v.object({ name: v.string(), deity: v.optional(v.string()) })),

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
    // Exhaustion level 0–6. Persistent state (survives combat; long rest −1),
    // unlike in-combat conditions. Effects are edition-dependent at display time.
    exhaustion: v.optional(v.number()),
    speed: v.number(),
    // Darkvision range in feet, snapshotted from the chosen race at creation (0 =
    // none). Optional: characters built before this field fall back to the static
    // race lookup in getDarkvisionRange. Lets a HOMEBREW race's darkvision show on
    // the sheet without the sheet resolving homebrew live. See deriveDarkvision.
    darkvision: v.optional(v.number()),
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

  // User-authored homebrew content (races, backgrounds) that merges into the
  // character builder's pickers alongside the curated SRD set. Owned by its
  // creator (userId) and usable in any character they build; optionally PUBLISHED
  // to one campaign (sharedCampaignId) so that campaign's members see it in their
  // builder too. `data` is the typed race/background payload (see
  // convex/lib/homebrewValidators.ts) — a discriminated union keyed by `kind`,
  // mirroring RaceData / BackgroundData so lib/homebrew.ts can convert a row
  // straight into what the builder consumes. Selection SNAPSHOTS the mechanics
  // onto the character, so editing/deleting a homebrew entry never breaks an
  // already-built character.
  homebrew: defineTable({
    userId: v.string(), // tokenIdentifier of the creator
    kind: v.union(
      v.literal("race"),
      v.literal("background"),
      v.literal("item"),
      v.literal("class"),
      v.literal("monster"),
    ),
    name: v.string(), // display name; also what's stored on characters.race/background
    sharedCampaignId: v.optional(v.id("campaigns")),
    data: homebrewData,
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_sharedCampaignId", ["sharedCampaignId"]),

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
    // Opt-in combat stat block, so a recurring NPC can enter initiative fighting
    // from a real stat block labeled with its own name. See statblockRefValidator.
    statblockRef: v.optional(statblockRefValidator),
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
    // Whether players in the campaign can see this entry. Undefined/false = DM-only.
    // Mirrors the reveal convention used by mapPins and sessionBroadcasts.
    isRevealed: v.optional(v.boolean()),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_campaignId", ["campaignId"]),

  // World map images. A campaign owns at most one active map (campaignId set);
  // presets are global templates (campaignId undefined, source = "preset").
  // Adopting a preset clones its row + locations into the campaign (see
  // worldMap.adoptPreset) so reveal state stays per-campaign.
  worldMaps: defineTable({
    campaignId: v.optional(v.id("campaigns")),
    name: v.string(),
    imageStorageKey: v.string(), // R2 key; public URL = `${NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`
    width: v.number(), // px (Azgaar info.width)
    height: v.number(), // px (Azgaar info.height)
    scaleMilesPerPx: v.optional(v.number()), // for future travel/distance
    source: v.union(
      v.literal("preset"),
      // The premium "vibe" library (scripts/bake-presets.ts → seedPreset). A
      // SEPARATE source value (not just isPremiumPreset:true) so the free
      // starter grid — listPresets filters source==="preset" — can never leak a
      // premium map even if a boolean filter regresses. adoptPreset clones a
      // premium-preset into a campaign as source:"preset" (an adopted map is
      // just a map); entitlement is enforced at adopt time, not by the clone.
      v.literal("premium-preset"),
      v.literal("import"),
      v.literal("upload"),
    ),
    isPremiumPreset: v.optional(v.boolean()),
    // Premium picker vibe tags (set only on source:"premium-preset" rows). The
    // DM filters the library on these 4 axes; ~120 rows total so no index — the
    // query scans by_source "premium-preset" and filters in memory. Literals
    // mirror lib/worldMap/vibe.ts.
    vibeShape: v.optional(
      v.union(
        v.literal("archipelago"),
        v.literal("scattered"),
        v.literal("continents"),
        v.literal("pangaea"),
      ),
    ),
    vibeClimate: v.optional(
      v.union(
        v.literal("frozen"),
        v.literal("temperate"),
        v.literal("arid"),
        v.literal("tropical"),
      ),
    ),
    vibeCivilization: v.optional(
      v.union(v.literal("wild"), v.literal("settled"), v.literal("crowded")),
    ),
    vibeScale: v.optional(v.union(v.literal("region"), v.literal("world"))),
    // Set on preset rows; lets a campaign map remember which preset it came from.
    presetSourceId: v.optional(v.id("worldMaps")),
    createdBy: v.optional(v.string()), // userId of the admin/DM who made it
    // Fog of war (player view only; DM always sees the full map). Both optional ⇒
    // undefined = fog off, so existing campaigns are unaffected until a DM opts in.
    // Auto fog: the map is shrouded for players and each REVEALED pin clears a soft
    // radius (fogRevealRadius, % of the map's shorter side) around it. See
    // app/dm/world-map/fog-overlay.tsx + worldMap.setFogSettings.
    fogEnabled: v.optional(v.boolean()),
    fogRevealRadius: v.optional(v.number()),
    // Manual fog brush (Phase 2): a base64-encoded boolean bitmask over a fixed
    // 64×36 grid marking cells the DM has painted permanently OPEN, decoupled
    // from pins. undefined = nothing painted. Unioned with the per-pin auto
    // clearings in FogOverlay (paint never un-reveals a pin). See
    // app/dm/world-map/fog-mask.ts for the encoding + worldMap.paintFog.
    fogMask: v.optional(v.string()),
    // Named active world events lifted from the Azgaar "zones" (invasions, plagues,
    // eruptions, rebellions…). World-level DM reference — getMap strips this for
    // non-DM members (a brewing invasion is plot, not common knowledge). No
    // per-event reveal yet; the natural future seam is reveal-per-event like pins.
    // Mirrors ZoneInfo in lib/worldMap/azgaar-map.ts.
    worldEvents: v.optional(
      v.array(
        v.object({
          name: v.string(),
          type: v.string(),
          // # of Azgaar cells the zone spans — a relative geographic-reach signal
          // surfaced as a Localized/Regional/Widespread "scope" badge. Optional:
          // pre-v0.86 rows lack it (no badge) until the map is reseeded/reimported.
          cellCount: v.optional(v.number()),
          // Affected settlements — full pin payloads so the DM can "+ add" any to the
          // map (a non-preset town isn't stored anywhere else). Jump-link if already
          // pinned, else a one-click add. town mirrors the mapLocations.town shape.
          places: v.optional(
            v.array(
              v.object({
                name: v.string(),
                x: v.number(),
                y: v.number(),
                drillDownUrl: v.optional(v.string()),
                town: v.optional(
                  v.object({
                    population: v.optional(v.number()),
                    coa: v.optional(v.string()),
                    realm: v.optional(v.string()),
                    government: v.optional(v.string()),
                    culture: v.optional(v.string()),
                    features: v.optional(v.array(v.string())),
                  }),
                ),
              }),
            ),
          ),
          // Cached Tier-2 AI plot hook for this event (DM-only tooling, premium-metered).
          // The Tier-1 template is always derived live in the UI (lib/worldMap/eventHooks.ts);
          // this only persists an AI flesh-out so the DM doesn't re-spend a daily credit to
          // re-read it, and so it survives to the table next session. Written by
          // worldMap.setEventHook (DM-only). A map re-import regenerates worldEvents, so a
          // stale aiHook can't outlive its event.
          aiHook: v.optional(
            v.object({
              hook: v.string(),
              complication: v.string(),
              stakes: v.string(),
              firstScene: v.string(),
              generatedAt: v.number(),
            }),
          ),
        }),
      ),
    ),
    // Travel routes lifted from Azgaar's pack.routes (roads/trails/searoutes). Unlike
    // zones/rivers, routes carry explicit point polylines, so they're drawable +
    // measurable. NOT secret (both DM + players see them), but heavy (~40–65KB), so
    // getMap STRIPS this and the travel overlay lazy-loads it via worldMap.getRoutes.
    // points are 0–100 % (pin space); miles is omitted when the map has no scale.
    // Mirrors RouteInfo in lib/worldMap/azgaar-map.ts.
    routes: v.optional(
      v.array(
        v.object({
          group: v.string(), // roads | trails | searoutes
          points: v.array(v.array(v.number())), // [[x,y], …] normalized 0–100
          miles: v.optional(v.number()),
        }),
      ),
    ),
    // Realms (Azgaar states) + faiths (religions) for the "Realms & Faiths"
    // worldbuilding panel. No geometry — indices already resolved to names at parse
    // time. NOT secret (setting lore, shown to DM + players); served lazily by
    // worldMap.getWorldbuilding (getMap strips them). Mirror RealmInfo / FaithInfo
    // in lib/worldMap/azgaar-map.ts.
    realms: v.optional(
      v.array(
        v.object({
          name: v.string(),
          form: v.optional(v.string()),
          capital: v.optional(v.string()),
          culture: v.optional(v.string()),
          population: v.optional(v.number()),
          coa: v.optional(v.string()),
          color: v.optional(v.string()),
          provinces: v.optional(v.number()),
          campaigns: v.optional(v.array(v.string())),
          relations: v.optional(
            v.array(v.object({ relation: v.string(), realm: v.string() })),
          ),
        }),
      ),
    ),
    faiths: v.optional(
      v.array(
        v.object({
          name: v.string(),
          type: v.optional(v.string()),
          form: v.optional(v.string()),
          deity: v.optional(v.string()),
          color: v.optional(v.string()),
          culture: v.optional(v.string()),
          expansion: v.optional(v.string()),
          origin: v.optional(v.string()),
        }),
      ),
    ),
    // Azgaar GRID heightmap for Phase-2 terrain routing — crossing open water (or
    // trackless land) where no route/searoute is drawn. A regular cols×rows lattice;
    // `heights` is base64 of a byte-per-cell array (≥20 = land), ~13KB for a ~10k-cell
    // grid. Stored as a STRING (not number[]) to dodge Convex's 8192-element array cap.
    // Optional — maps without it route via Phase 1. Heavy-ish + travel-only, so getMap
    // strips it and worldMap.getHeightGrid lazy-loads it (like routes). Mirrors
    // HeightGridData in lib/worldMap/azgaar-map.ts.
    heightGrid: v.optional(
      v.object({ cols: v.number(), rows: v.number(), heights: v.string() }),
    ),
    updatedAt: v.number(),
  })
    .index("by_campaignId", ["campaignId"])
    .index("by_source", ["source"]),

  // Living Diplomacy (thread ① of the Realms/Religions umbrella). A campaign-scoped
  // OVERLAY on the base map's diplomacy (worldMaps.realms[].relations[]). We never bake
  // edits onto the worldMaps doc — a map replace/re-import runs clearCampaignMap
  // (convex/worldMap.ts) which DELETES + re-inserts the row, and the Religion/Military
  // threads both re-import maps; an overlay keyed by realm NAME (Azgaar indices scramble
  // on re-import) survives that and preserves the campaign's political history.
  //
  // One row per UNORDERED realm pair (names stored sorted, realmA <= realmB, so a pair
  // has exactly one row regardless of edit direction). `status` is the current TRUE
  // relation; `log` is the political timeline + per-shift reveal lifecycle. The log is
  // an embedded array because diplomacy is DM-driven + genuinely low-volume (a few realm
  // pairs, a few flips each — far under Convex's 1MB / 8192-element caps) and a single
  // doc gives atomic status+log writes. If it ever grew unbounded, split the log into a
  // child `diplomacyShifts` table keyed by campaignId. See convex/lib/diplomacy.ts.
  diplomacyOverrides: defineTable({
    campaignId: v.id("campaigns"),
    realmA: v.string(), // sorted pair: realmA <= realmB (lexicographic)
    realmB: v.string(),
    status: v.string(), // current TRUE relation; "Neutral" = relationship cleared
    log: v.array(
      v.object({
        changedAt: v.number(),
        from: v.string(),
        to: v.string(),
        dmNote: v.optional(v.string()),
        // Per-shift news lifecycle. pending = just changed, not yet triaged;
        // revealed = surfaced to players; held = saved for a later dramatic reveal;
        // private = the DM dismissed it (never shown). Only "revealed" reaches players.
        reveal: v.union(
          v.literal("pending"),
          v.literal("revealed"),
          v.literal("held"),
          v.literal("private"),
        ),
        headline: v.optional(v.string()), // editable player-facing line, set at reveal
        revealedAt: v.optional(v.number()),
      }),
    ),
    updatedAt: v.number(),
  })
    .index("by_campaignId", ["campaignId"])
    .index("by_campaignId_and_pair", ["campaignId", "realmA", "realmB"]),

  // Pins on a world map. The reveal/fog + drill-down + campaign-web system all
  // hang off these. DM sees all; players see only revealed (see worldMap.listLocations).
  mapLocations: defineTable({
    worldMapId: v.optional(v.id("worldMaps")),
    campaignId: v.optional(v.id("campaigns")),
    type: v.union(
      v.literal("settlement"),
      v.literal("poi"),
      v.literal("natural"),
      v.literal("water"),
      v.literal("region"),
    ),
    name: v.string(),
    x: v.number(), // normalized 0–100
    y: v.number(), // normalized 0–100
    revealed: v.boolean(), // DM-toggleable; drives fog for players
    dmNotes: v.optional(v.string()), // private to DM
    playerNotes: v.optional(v.string()), // shown to players once revealed
    drillDownMapId: v.optional(v.id("worldMaps")), // reserved: full nested map (unused; superseded by drillDownImageKey)
    // Drill-down "launchpad": an R2 image key for a local map (Watabou city/dungeon
    // PNG) shown in a lightbox when the pin is opened. A plain image, not a nested
    // worldMaps row — the spec wants a launchpad, not nested pins, and a nested
    // campaign-scoped map would collide with the one-map-per-campaign invariant.
    // Rides through listLocations to players on revealed pins (not in the dmNotes strip).
    drillDownImageKey: v.optional(v.string()),
    // External Watabou MFCG iframe URL, computed at import time from the burg's
    // Azgaar data (see lib/worldMap/mfcgLink.ts). Settlements only. The detail
    // viewer resolves drillDownImageKey (DM's custom upload) FIRST, then this.
    // Per docs/specs/feyforge-drilldown-spec.md — we frame Watabou's live tool,
    // never host his rendered output.
    drillDownUrl: v.optional(v.string()),
    // POIs only: the game-meaningful Azgaar marker subtype (dungeon/ruin/monster/
    // encounter/tavern/landmark), set at import from the marker type. Drives the
    // SVG pin icon + which in-app action the pin offers. Mirrors PoiKind in
    // lib/worldMap/azgaar-map.ts. Absent on settlements + hand-placed pins.
    poiKind: v.optional(
      v.union(
        v.literal("dungeon"),
        v.literal("ruin"),
        v.literal("monster"),
        v.literal("encounter"),
        v.literal("npc"),
        v.literal("tavern"),
        v.literal("landmark"),
      ),
    ),
    // "npc" pins only: a first-party NPC dealt from the server-only pool at
    // import/adopt (see convex/npcPool.ts). The pin's NAME is the NPC's name; this
    // holds the rest of the bio. SECRET — listLocations strips it for players
    // (they keep the name only). Mirrors PoolNpc minus name.
    npc: v.optional(
      v.object({
        race: v.string(),
        occupation: v.string(),
        alignment: v.string(),
        appearance: v.string(),
        personality: v.array(v.string()),
        mannerisms: v.string(),
        voice: v.string(),
        motivation: v.string(),
        secret: v.string(),
        hook: v.string(),
      }),
    ),
    // Settlements only: the gazetteer block lifted from the Azgaar burg at import
    // (population, coat-of-arms spec, owning realm + government, culture, amenity
    // chips). Display-only and NOT secret — rides to players on revealed pins, like
    // the city link. Mirrors TownMeta in lib/worldMap/azgaar-map.ts.
    town: v.optional(
      v.object({
        population: v.optional(v.number()),
        coa: v.optional(v.string()), // Armoria coat-of-arms JSON; rendered as <img> at view time
        realm: v.optional(v.string()),
        government: v.optional(v.string()),
        culture: v.optional(v.string()),
        features: v.optional(v.array(v.string())),
      }),
    ),
    campaignNodeId: v.optional(v.string()), // React Flow / Story Web node link
    createdBy: v.optional(v.string()),
    // Seed-time importance (capitals > POIs > towns, scaled by population). On
    // preset rows it caps the stored pool at 100 and weights adoptPreset's
    // per-campaign random pin selection. Absent on hand-placed pins.
    prominence: v.optional(v.number()),
  })
    .index("by_worldMap", ["worldMapId"])
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
    // Rich, run-time flavor captured at save (AI-generated or computed). Optional
    // so encounters saved before this field — and bare manual line-ups — stay valid.
    details: v.optional(v.object({
      readAloud: v.optional(v.string()),   // boxed text to read to players
      setup: v.optional(v.string()),       // DM notes & monster tactics
      scaling: v.optional(v.string()),     // how to scale up/down
      treasure: v.optional(v.string()),    // loot / rewards
      difficulty: v.optional(v.string()),  // computed band label (e.g. "Deadly")
    })),
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

  // One continuous markdown notebook per member per campaign — the spine of the
  // Player Campaign Hub. Unlike sessionNotes (keyed per live partySession, so
  // notes strand each new session), this is campaign-scoped and persists across
  // sessions. Private to its author (no cross-member read); membership-gated.
  campaignJournal: defineTable({
    campaignId: v.id("campaigns"),
    userId: v.string(),
    content: v.string(),
    updatedAt: v.number(),
  }).index("by_campaignId_and_userId", ["campaignId", "userId"]),

  // Player Campaign Hub quest log (v1): a member's PERSONAL objective checklist
  // for a campaign — "what are we doing / what's done." Private to its author,
  // membership-gated. (v2 will add DM-shared quests tied to plotThreads with
  // isRevealed gating — separate table/feature.)
  campaignQuests: defineTable({
    campaignId: v.id("campaigns"),
    userId: v.string(),
    text: v.string(),
    done: v.boolean(),
    orderIndex: v.number(),
    updatedAt: v.number(),
  }).index("by_campaignId_and_userId", ["campaignId", "userId"]),

  // DM-authored party objectives for the Campaign Hub (quests v2). Distinct from
  // the personal `campaignQuests` checklist: these are campaign-owned, reveal-gated
  // (players see only isRevealed === true), and managed by the DM. Reads are
  // membership-gated; writes DM-gated (requireDm). Mirrors the wikiEntries /
  // sessionBroadcasts reveal convention (memory/player_dm_pattern).
  campaignSharedQuests: defineTable({
    campaignId: v.id("campaigns"),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("completed")),
    isRevealed: v.boolean(),
    orderIndex: v.number(),
    updatedAt: v.number(),
  }).index("by_campaignId", ["campaignId"]),

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
    // Forward link to the planning/record row in gameSessions. Set only when a
    // live session is launched from a plan (Direction B) or stamped on end for an
    // ad-hoc session's auto-created record (Direction A). Optional — pre-bridge
    // sessions and never-linked ad-hoc sessions leave it unset.
    gameSessionId: v.optional(v.id("gameSessions")),
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
    .index("by_dmUserId", ["dmUserId"]),

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
    // When an `npc` broadcast originates from a real roster NPC, the source record
    // id — so the Campaign Hub's "People I've met" can dedup by identity (surviving
    // a DM rename) and hydrate richer, player-safe detail. Optional: ad-hoc reveals
    // (a hand-typed title) carry no id and behave as before.
    npcId: v.optional(v.id("npcs")),
    isRevealed: v.boolean(),
    revealedAt: v.optional(v.number()),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_campaignId", ["campaignId"]),

  // Live captions: finalized speech-to-text lines from the DM, streamed to
  // players during a live session (AssemblyAI v3). Append-only + high-churn, so
  // it gets its own table (per the Convex high-churn guideline) rather than
  // living on partySessions. Rows persist after the session ends, which leaves
  // the door open to feeding the transcript into session logs later.
  liveCaptions: defineTable({
    sessionId: v.id("partySessions"),
    campaignId: v.id("campaigns"),
    text: v.string(),
    createdAt: v.number(),
    // A session has at most ONE partial row (the in-progress turn), patched live
    // and throttled, then deleted when the turn finalizes into a real (false) row.
    // Streaming partials is what makes captions appear continuously instead of
    // arriving in a wall after each speech pause.
    isPartial: v.optional(v.boolean()),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_sessionId_and_isPartial", ["sessionId", "isPartial"]),

  users: defineTable({
    clerkId: v.string(),         // tokenIdentifier (full, with issuer prefix)
    clerkUserId: v.string(),     // subject / bare user_xxx ID for webhook lookups
    isPremium: v.boolean(),
    premiumSince: v.optional(v.number()),
    premiumExpiresAt: v.optional(v.number()),
    role: v.optional(v.union(v.literal("admin"), v.literal("user"))),
    // The campaign this user is currently working in. Server-side source of
    // truth so the active campaign follows the DM/player across devices.
    activeCampaignId: v.optional(v.id("campaigns")),
    // IANA tz used for the AI daily-quota reset boundary (e.g. "America/New_York").
    // Unset ⇒ DEFAULT_AI_TIMEZONE. Plumbed for a future Settings picker; nothing
    // sets it yet, so the reset defaults to the app tz.
    timezone: v.optional(v.string()),
    // ── Social profile (Friends system) ──────────────────────────────────────
    // The identity layer everything social renders off. Populated by upsertUser
    // from the Clerk session (passed client-side from useUser() — the Convex JWT
    // template can't be assumed to carry name/picture claims). Optional because
    // rows created before this field exist until their owner's next sign-in
    // backfills them. The userId key everywhere is clerkId (tokenIdentifier).
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    // Discord-style per-user code for privacy-preserving friend discovery (no open
    // username search → no enumeration/harassment vector). Minted once by
    // upsertUser, unique across users (see by_friendCode). Format: "FEY-XXXXXX".
    friendCode: v.optional(v.string()),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_clerkUserId", ["clerkUserId"])
    .index("by_isPremium", ["isPremium"])
    .index("by_friendCode", ["friendCode"]),

  // ── Friend graph (Friends system) ───────────────────────────────────────────
  // One row per relationship between two users, keyed by clerkId (tokenIdentifier)
  // strings to match campaignMembers. A request is DIRECTIONAL (requester →
  // addressee); the accepted state IS the friendship. Blocking lives here too
  // (requesterId = the blocker). There is at most one row per unordered pair —
  // sendRequest checks BOTH (A→B) and (B→A) before inserting. "My friends" = rows
  // where I'm requester OR addressee AND status = accepted (hence both indexes).
  friendships: defineTable({
    requesterId: v.string(),
    addresseeId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("blocked"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_requester", ["requesterId"])
    .index("by_addressee", ["addresseeId"])
    .index("by_requester_and_addressee", ["requesterId", "addresseeId"]),

  // ── Notifications spine (Friends system) ─────────────────────────────────────
  // One table every social action writes to (friend request, friend accepted,
  // campaign invite — and future presence/session pings), so the reactive bell in
  // the app shell is built once instead of retrofitted per feature. User-scoped
  // (userId = recipient's clerkId); unread = readAt undefined (by_userId_and_readAt
  // counts the badge without a table scan). Payload is a flat optional-field object
  // (display text is computed client-side from type + payload). See convex/lib/notify.ts.
  notifications: defineTable({
    userId: v.string(),
    type: v.string(), // "friend_request" | "friend_accepted" | "campaign_invite"
    payload: v.object({
      fromUserId: v.optional(v.string()),
      fromName: v.optional(v.string()),
      fromAvatarUrl: v.optional(v.string()),
      friendshipId: v.optional(v.id("friendships")),
      campaignId: v.optional(v.id("campaigns")),
      campaignName: v.optional(v.string()),
    }),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_readAt", ["userId", "readAt"]),

  // ── Presence (Friends system) ────────────────────────────────────────────────
  // High-churn "who's online" heartbeat — one row per user, upserted ~every 25s by
  // the client while the app is open + visible. Kept OFF the users doc per the
  // Convex high-churn guideline (frequent writes shouldn't contend with reads of
  // the stable profile). "Online" is computed CLIENT-SIDE from lastSeenAt (now -
  // lastSeenAt < threshold) rather than a stored boolean, so a user who simply
  // stops heartbeating reads as offline with no server-side expiry job needed.
  // Presence is only ever surfaced to the user's accepted friends.
  presence: defineTable({
    userId: v.string(),
    lastSeenAt: v.number(),
  }).index("by_userId", ["userId"]),

  // Per-user daily AI generation counter (durable quota — the in-memory
  // lib/rate-limit is only a per-process anti-burst guard). One row per
  // (user, day); `day` is YYYY-MM-DD in the user's tz so the reset is humane,
  // not UTC-midnight mid-session. consume()/refund()/getUsage in convex/aiUsage.ts.
  aiUsage: defineTable({
    clerkId: v.string(), // tokenIdentifier — matches users.getMe's lookup key
    day: v.string(), // "YYYY-MM-DD" in the user's tz
    count: v.number(),
  }).index("by_clerkId_and_day", ["clerkId", "day"]),

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

  // v3 instrument-variant model: one row per (scene, mode, instrument, intensity).
  // Uniqueness enforced in mutations on (campaignId, sceneName, mode, instrument, intensity)
  // so a campaign can override a global default for the same slot.
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
    instrument: v.string(),
    intensity: v.number(),
    trackId: v.id("audioTracks"),
    sortOrder: v.number(),
    createdAt: v.number(),
  })
    .index("by_campaignId_and_sceneName", ["campaignId", "sceneName"])
    .index("by_campaignId_sceneName_and_mode", ["campaignId", "sceneName", "mode"])
    // Used to query global (non-campaign-scoped) stems by scene+mode
    .index("by_sceneName_mode_and_campaignId", ["sceneName", "mode", "campaignId"])
    // Used by getInstrumentVariants to fetch all variants of one instrument
    .index("by_scene_mode_instrument", ["sceneName", "mode", "instrument"])
    // Used by the admin review card to show a track's assigned variant slots
    .index("by_trackId", ["trackId"]),

  // Live combat / initiative tracker, scoped to a live party session. The DM owns
  // all writes; players subscribe read-only and see a filtered view (own HP exact,
  // monster HP as a health band). One active row per session at a time.
  liveCombat: defineTable({
    sessionId: v.id("partySessions"),
    campaignId: v.id("campaigns"),
    dmUserId: v.string(),
    isActive: v.boolean(),
    round: v.number(),
    // Index into combatants[] (initiative order) whose turn it currently is.
    activeIndex: v.number(),
    combatants: v.array(
      v.object({
        id: v.string(), // client-generated stable id
        name: v.string(),
        type: v.union(v.literal("pc"), v.literal("npc"), v.literal("monster")),
        initiative: v.number(),
        initiativeBonus: v.number(), // tiebreaker (usually Dex mod)
        // True while a PC's player hasn't rolled initiative yet (combat start no
        // longer pre-rolls for the party). Cleared by setMyInitiative/setInitiative.
        awaitingRoll: v.optional(v.boolean()),
        armorClass: v.number(),
        hitPoints: v.object({
          current: v.number(),
          max: v.number(),
          temp: v.number(),
        }),
        conditions: v.array(v.string()),
        deathSaves: v.optional(
          v.object({ successes: v.number(), failures: v.number() })
        ),
        // Exhaustion level 0–6 — a level track, not a toggle condition. For PCs it
        // snapshots the character's level at add time and writes back through.
        exhaustion: v.optional(v.number()),
        // For PCs: links to the character + owning user so players see their own
        // exact HP and the row can mirror the live character sheet.
        characterId: v.optional(v.id("characters")),
        userId: v.optional(v.string()),
        // DM-controlled character (DMPC): mechanically a PC (death saves, sheet
        // write-through) but labeled distinctly so the table knows who runs it.
        isDmpc: v.optional(v.boolean()),
        // For NPC combatants entered from a persistent NPC's stat block: the attack
        // roller resolves THIS ref instead of the display name (an NPC labeled "Lord
        // Vthain" still rolls as its "Archmage" stat block). See statblockRefValidator.
        statblockRef: v.optional(statblockRefValidator),
      })
    ),
    startedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_sessionId_and_isActive", ["sessionId", "isActive"]),

  // Live shared roll feed — every roll a player (or the DM) makes from their sheet,
  // or via the in-combat "Roll initiative" button, surfaced to the whole table in
  // real time. Append-only + high-churn, so it gets its OWN table (per the Convex
  // high-churn guideline) like liveCaptions, rather than living on partySessions.
  // Reads (listRecent) + writes (pushRoll) are membership-gated. Rows persist after
  // the session ends, leaving the door open to a post-session roll log.
  sessionRolls: defineTable({
    sessionId: v.id("partySessions"),
    campaignId: v.id("campaigns"),
    userId: v.string(), // roller's clerkId (tokenIdentifier)
    rollerName: v.string(), // character name (display-name fallback)
    label: v.optional(v.string()), // "Initiative", "Attack: Longsword", "DEX Save"…
    expression: v.string(), // normalized dice expression, e.g. "1d20+5"
    total: v.number(),
    // Kept dice faces, flattened across terms, so the feed can show the actual faces
    // (a visible nat 20). dropped = the advantage/disadvantage discards.
    dice: v.array(v.number()),
    dropped: v.optional(v.array(v.number())),
    modifier: v.number(),
    mode: v.optional(v.union(v.literal("advantage"), v.literal("disadvantage"))),
    isCrit: v.optional(v.boolean()),
    // First term is a d20 → drives nat-20 / nat-1 highlighting in the feed.
    isD20: v.boolean(),
    createdAt: v.number(),
  }).index("by_sessionId", ["sessionId"]),
})
