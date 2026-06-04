import { v } from "convex/values"

// ── Homebrew content validators ───────────────────────────────────────────────
// Shared between the schema (convex/schema.ts) and the homebrew mutations
// (convex/homebrew.ts) so a homebrew row's `data` blob is fully typed end to end —
// no v.any(). The `data` union is discriminated by the row's top-level `kind`
// ("race" | "background"); the two member shapes intentionally mirror RaceData /
// BackgroundData in lib/character/character-data.ts so lib/homebrew.ts can convert
// a stored row straight into the shapes the character builder already consumes.

// A partial ability-bonus map (any subset of the six abilities), matching
// RaceData.abilityBonuses (Partial<Record<Ability, number>>).
const partialAbilities = v.object({
  strength: v.optional(v.number()),
  dexterity: v.optional(v.number()),
  constitution: v.optional(v.number()),
  intelligence: v.optional(v.number()),
  wisdom: v.optional(v.number()),
  charisma: v.optional(v.number()),
})

export const homebrewRaceData = v.object({
  description: v.string(),
  size: v.string(),
  speed: v.number(),
  abilityBonuses: partialAbilities,
  traits: v.array(v.string()),
  languages: v.array(v.string()),
  // Explicit sense range in feet (0 = none). Snapshotted onto a character at
  // creation so a homebrew race's darkvision shows on the sheet without the sheet
  // needing to resolve homebrew live. See deriveDarkvision in character-data.ts.
  darkvision: v.optional(v.number()),
  subraces: v.optional(
    v.array(
      v.object({
        name: v.string(),
        description: v.string(),
        abilityBonuses: partialAbilities,
        traits: v.array(v.string()),
        speed: v.optional(v.number()),
        darkvision: v.optional(v.number()),
      }),
    ),
  ),
})

export const homebrewBackgroundData = v.object({
  description: v.string(),
  // Skill keys (e.g. "stealth", "animalHandling") — must be valid Skill values so
  // the merged proficiencies the builder snapshots are understood by the sheet.
  skillProficiencies: v.array(v.string()),
  toolProficiencies: v.array(v.string()),
  // Count of bonus languages granted (matches BackgroundData.languages: number).
  languages: v.number(),
  equipment: v.array(v.string()),
  feature: v.string(),
})

// Mirrors StoredItemData in lib/character/sheet-items.ts — the exact blob the
// inventory's item form (buildData) produces and stores on a characterProperties
// row. A homebrew item is just a reusable StoredItemData + name; adding it to a
// character clones it into a property row (snapshot), same as an SRD item.
// `category` is required and unique to this shape (discriminates the union).
// NOTE (v1 cut): `modifiers` is intentionally omitted — the item form never
// authors them, so weapon magicBonus + armor baseAC cover the mechanical cases
// and magic/gear items are descriptive. Add the Modifier shape here if the form
// later grows modifier authoring.
export const homebrewItemData = v.object({
  category: v.string(), // weapon | armor | gear | magic | consumable | treasure | tool
  quantity: v.optional(v.number()),
  weight: v.optional(v.number()),
  rarity: v.optional(v.string()),
  description: v.optional(v.string()),
  // Weapon
  weaponType: v.optional(v.string()), // simple | martial
  damageDice: v.optional(v.string()),
  damageType: v.optional(v.string()),
  versatileDamage: v.optional(v.string()),
  range: v.optional(v.object({ normal: v.number(), long: v.optional(v.number()) })),
  properties: v.optional(v.array(v.string())),
  melee: v.optional(v.boolean()),
  proficient: v.optional(v.boolean()),
  magicBonus: v.optional(v.number()),
  // Armor
  armorCategory: v.optional(v.string()), // light | medium | heavy | shield
  baseAC: v.optional(v.number()),
  strengthRequirement: v.optional(v.number()),
  stealthDisadvantage: v.optional(v.boolean()),
})

// The stored `data` blob — one of the three shapes, picked by the row's `kind`.
export const homebrewData = v.union(
  homebrewRaceData,
  homebrewBackgroundData,
  homebrewItemData,
)
