import type { Edition } from "../editions"

/**
 * Class / subclass "special procedurals" — a declarative, edition-aware GRANT
 * system. The deep fix for the per-class wiring churn (cleric domain spells,
 * druid wildshape, ranger companions, …): instead of hand-threading each class
 * quirk into the sheet, declare WHAT a (class, subclass, level) grants and let
 * deriveCharacter() merge it live. DERIVE-LIVE, like getClassResources — nothing
 * is stored, so there's no backfill, no apply/reverse, and grants auto-correct
 * when level or subclass changes.
 *
 * Content is ORIGINAL paraphrase of game mechanics (names + mechanics aren't
 * copyrightable; spell NAMES are SRD). Never paste book prose.
 *
 * v1 implements `spell | feature | proficiency`, proven on the Cleric (all 7
 * domains). The union is designed in full so the next kinds drop in as DATA +
 * one deriver, not a re-architecture:
 *   - resource  → Channel Divinity use-tracking (reuses getClassResources)
 *   - form      → wildshape / alternate forms          (closes b5615fc6)
 *   - companion → familiars / beast companions         (closes b5615fc6)
 *   - choice    → choose-from-a-list (warlock invocations, battlemaster maneuvers)
 */

// A spell granted by a feature — injected into the spellbook as always-prepared.
// Only name + spell level are needed; full details resolve from the codex/Open5e.
export interface GrantedSpellRef {
  name: string
  /** Spell slot level (1–9). */
  spellLevel: number
}

export interface GrantedFeatureData {
  id: string
  name: string
  /** Original paraphrase of the mechanic. */
  description: string
  /**
   * Limited uses, if any — DESCRIPTIVE in v1 (live tracking is the resource-grant
   * follow-up). e.g. "Wisdom modifier per long rest", "1 per short or long rest".
   */
  uses?: string
}

export type ProficiencyKind = "armor" | "weapon" | "tool" | "savingThrow" | "skill"

export interface GrantedProficiency {
  kind: ProficiencyKind
  /** Display value, e.g. "Heavy armor", "Martial weapons". */
  value: string
}

/**
 * A single grant. `level` = the class level at which it's gained. `edition`
 * absent = applies to both rulesets; set it only for an edition-specific grant.
 */
export type Grant =
  | { kind: "spell"; level: number; edition?: Edition; spell: GrantedSpellRef }
  | { kind: "feature"; level: number; edition?: Edition; feature: GrantedFeatureData }
  | { kind: "proficiency"; level: number; edition?: Edition; proficiency: GrantedProficiency }

interface ClassGrantTable {
  /** Grants every subclass of the class gets (none yet for Cleric in v1). */
  base?: Grant[]
  /** subclassId → grants. */
  subclasses: Record<string, Grant[]>
}

// ── Terse constructors (keep the data tables readable) ──────────────────────────

const gSpell = (level: number, name: string, spellLevel: number): Grant => ({
  kind: "spell",
  level,
  spell: { name, spellLevel },
})
const gFeature = (
  level: number,
  id: string,
  name: string,
  description: string,
  uses?: string,
): Grant => ({ kind: "feature", level, feature: { id, name, description, uses } })
const gProf = (level: number, kind: ProficiencyKind, value: string): Grant => ({
  kind: "proficiency",
  level,
  proficiency: { kind, value },
})

// Cleric domain spells follow a fixed cadence: 2 spells at cleric levels 1/3/5/7/9,
// of spell level 1/2/3/4/5 respectively. This helper keeps each domain to one line.
const domainSpells = (
  l1: [string, string],
  l3: [string, string],
  l5: [string, string],
  l7: [string, string],
  l9: [string, string],
): Grant[] => [
  gSpell(1, l1[0], 1), gSpell(1, l1[1], 1),
  gSpell(3, l3[0], 2), gSpell(3, l3[1], 2),
  gSpell(5, l5[0], 3), gSpell(5, l5[1], 3),
  gSpell(7, l7[0], 4), gSpell(7, l7[1], 4),
  gSpell(9, l9[0], 5), gSpell(9, l9[1], 5),
]

// ── The grant tables (2014 ruleset) ─────────────────────────────────────────────
// NOTE: 2024 deltas (Cleric subclass moves to level 3; some revised domain spells)
// are NOT yet populated — the engine is edition-aware (each Grant takes an optional
// `edition`), so 2024 overrides layer in later without touching callers. Until then
// a 2024 cleric gets the 2014 grants. Verify 2024 specifics against the SRD before
// adding them. (TODO: 2024 cleric data.)

const CLASS_GRANTS: Record<string, ClassGrantTable> = {
  cleric: {
    subclasses: {
      life: [
        gProf(1, "armor", "Heavy armor"),
        gFeature(1, "cleric-life-disciple", "Disciple of Life", "Your healing spells of 1st level or higher restore additional hit points equal to 2 + the spell's level."),
        gFeature(2, "cleric-life-preserve", "Channel Divinity: Preserve Life", "Restore hit points equal to five times your cleric level, divided among creatures within 30 feet; can't raise any creature above half its hit point maximum.", "1 per short or long rest"),
        gFeature(6, "cleric-life-blessed", "Blessed Healer", "When you cast a healing spell on another creature, you also regain hit points equal to 2 + the spell's level."),
        gFeature(8, "cleric-life-strike", "Divine Strike", "Once per turn, deal an extra 1d8 radiant damage on a weapon hit (2d8 at 14th level)."),
        gFeature(17, "cleric-life-supreme", "Supreme Healing", "When you would roll dice to restore hit points with a spell, use the highest possible value for each die instead."),
        ...domainSpells(
          ["bless", "cure wounds"],
          ["lesser restoration", "spiritual weapon"],
          ["beacon of hope", "revivify"],
          ["death ward", "guardian of faith"],
          ["mass cure wounds", "raise dead"],
        ),
      ],
      light: [
        gFeature(1, "cleric-light-cantrip", "Bonus Cantrip", "You learn the Light cantrip if you don't already know it."),
        gFeature(1, "cleric-light-flare", "Warding Flare", "As a reaction when a creature within 30 feet you can see attacks you, impose disadvantage on that attack roll.", "Wisdom modifier per long rest (min 1)"),
        gFeature(2, "cleric-light-radiance", "Channel Divinity: Radiance of the Dawn", "Dispel magical darkness within 30 feet and deal 2d10 + your cleric level radiant damage to hostile creatures there (half on a Constitution save).", "1 per short or long rest"),
        gFeature(6, "cleric-light-improved", "Improved Flare", "You can use Warding Flare when another creature within 30 feet of you is attacked, not just yourself."),
        gFeature(8, "cleric-light-potent", "Potent Spellcasting", "Add your Wisdom modifier to the damage you deal with any cleric cantrip."),
        ...domainSpells(
          ["burning hands", "faerie fire"],
          ["flaming sphere", "scorching ray"],
          ["daylight", "fireball"],
          ["guardian of faith", "wall of fire"],
          ["flame strike", "scrying"],
        ),
      ],
      war: [
        gProf(1, "armor", "Heavy armor"),
        gProf(1, "weapon", "Martial weapons"),
        gFeature(1, "cleric-war-priest", "War Priest", "When you take the Attack action, you can make one weapon attack as a bonus action.", "Wisdom modifier per long rest (min 1)"),
        gFeature(2, "cleric-war-guided", "Channel Divinity: Guided Strike", "When you or a creature within 30 feet makes an attack roll, add +10 to it.", "1 per short or long rest"),
        gFeature(6, "cleric-war-blessing", "Channel Divinity: War God's Blessing", "As a reaction, grant a creature within 30 feet a +10 bonus to an attack roll.", "1 per short or long rest"),
        gFeature(8, "cleric-war-strike", "Divine Strike", "Once per turn, deal an extra 1d8 damage of your weapon's type on a hit (2d8 at 14th level)."),
        ...domainSpells(
          ["divine favor", "shield of faith"],
          ["magic weapon", "spiritual weapon"],
          ["crusader's mantle", "spirit guardians"],
          ["freedom of movement", "stoneskin"],
          ["flame strike", "hold monster"],
        ),
      ],
      trickery: [
        gFeature(1, "cleric-trickery-blessing", "Blessing of the Trickster", "As an action, give a willing creature advantage on Dexterity (Stealth) checks for 1 hour."),
        gFeature(2, "cleric-trickery-duplicity", "Channel Divinity: Invoke Duplicity", "Create an illusory duplicate of yourself for up to 1 minute; cast spells from its space and gain advantage on attacks when you and it flank a target.", "1 per short or long rest"),
        gFeature(6, "cleric-trickery-cloak", "Channel Divinity: Cloak of Shadows", "Become invisible until the end of your next turn.", "1 per short or long rest"),
        gFeature(8, "cleric-trickery-strike", "Divine Strike", "Once per turn, deal an extra 1d8 poison damage on a weapon hit (2d8 at 14th level)."),
        ...domainSpells(
          ["charm person", "disguise self"],
          ["mirror image", "pass without trace"],
          ["blink", "dispel magic"],
          ["dimension door", "polymorph"],
          ["dominate person", "modify memory"],
        ),
      ],
      knowledge: [
        gFeature(1, "cleric-knowledge-blessings", "Blessings of Knowledge", "Learn two languages, and gain proficiency (with doubled proficiency bonus) in two of Arcana, History, Nature, or Religion."),
        gFeature(2, "cleric-knowledge-ages", "Channel Divinity: Knowledge of the Ages", "Gain proficiency with one skill or tool of your choice for 10 minutes.", "1 per short or long rest"),
        gFeature(6, "cleric-knowledge-thoughts", "Channel Divinity: Read Thoughts", "Read the surface thoughts of a creature within 60 feet and optionally cast suggestion on it without expending a slot.", "1 per short or long rest"),
        gFeature(8, "cleric-knowledge-potent", "Potent Spellcasting", "Add your Wisdom modifier to the damage you deal with any cleric cantrip."),
        ...domainSpells(
          ["command", "identify"],
          ["augury", "suggestion"],
          ["nondetection", "speak with dead"],
          ["arcane eye", "confusion"],
          ["legend lore", "scrying"],
        ),
      ],
      nature: [
        gProf(1, "armor", "Heavy armor"),
        gFeature(1, "cleric-nature-acolyte", "Acolyte of Nature", "Learn one druid cantrip, and gain proficiency in one of Animal Handling, Nature, or Survival."),
        gFeature(2, "cleric-nature-charm", "Channel Divinity: Charm Animals and Plants", "Charm beasts and plant creatures within 30 feet for 1 minute (Wisdom save negates).", "1 per short or long rest"),
        gFeature(6, "cleric-nature-dampen", "Dampen Elements", "As a reaction, grant a creature within 30 feet resistance to acid, cold, fire, lightning, or thunder damage."),
        gFeature(8, "cleric-nature-strike", "Divine Strike", "Once per turn, deal an extra 1d8 cold, fire, or lightning damage on a weapon hit (2d8 at 14th level)."),
        ...domainSpells(
          ["animal friendship", "speak with animals"],
          ["barkskin", "spike growth"],
          ["plant growth", "wind wall"],
          ["dominate beast", "grasping vine"],
          ["insect plague", "tree stride"],
        ),
      ],
      tempest: [
        gProf(1, "armor", "Heavy armor"),
        gProf(1, "weapon", "Martial weapons"),
        gFeature(1, "cleric-tempest-wrath", "Wrath of the Storm", "As a reaction when a creature within 5 feet hits you, deal 2d8 lightning or thunder damage (half on a Dexterity save).", "Wisdom modifier per long rest (min 1)"),
        gFeature(2, "cleric-tempest-destructive", "Channel Divinity: Destructive Wrath", "When you deal lightning or thunder damage, deal maximum damage instead of rolling.", "1 per short or long rest"),
        gFeature(6, "cleric-tempest-thunderbolt", "Thunderbolt Strike", "When you deal lightning damage to a Large or smaller creature, you can push it up to 10 feet away."),
        gFeature(8, "cleric-tempest-strike", "Divine Strike", "Once per turn, deal an extra 1d8 thunder damage on a weapon hit (2d8 at 14th level)."),
        ...domainSpells(
          ["fog cloud", "thunderwave"],
          ["gust of wind", "shatter"],
          ["call lightning", "sleet storm"],
          ["control water", "ice storm"],
          ["destructive wave", "insect plague"],
        ),
      ],
    },
  },
}

// ── Engine ──────────────────────────────────────────────────────────────────────

/** All grants active for a character at this level, in this edition. */
export function getGrantsAtLevel(
  classId: string,
  subclassId: string | undefined,
  level: number,
  edition: Edition,
): Grant[] {
  const table = CLASS_GRANTS[classId.toLowerCase()]
  if (!table) return []
  const all = [
    ...(table.base ?? []),
    ...(subclassId ? table.subclasses[subclassId] ?? [] : []),
  ]
  return all.filter(
    (g) => g.level <= level && (g.edition === undefined || g.edition === edition),
  )
}

/** Always-prepared spells granted by class/subclass (e.g. cleric domain spells). */
export function getGrantedSpells(
  classId: string,
  subclassId: string | undefined,
  level: number,
  edition: Edition,
): GrantedSpellRef[] {
  return getGrantsAtLevel(classId, subclassId, level, edition).flatMap((g) =>
    g.kind === "spell" ? [g.spell] : [],
  )
}

/** Passive class/subclass features, each tagged with the level it's gained. */
export function getGrantedFeatures(
  classId: string,
  subclassId: string | undefined,
  level: number,
  edition: Edition,
): (GrantedFeatureData & { level: number })[] {
  return getGrantsAtLevel(classId, subclassId, level, edition).flatMap((g) =>
    g.kind === "feature" ? [{ ...g.feature, level: g.level }] : [],
  )
}

/** Bonus proficiencies granted by class/subclass. */
export function getGrantedProficiencies(
  classId: string,
  subclassId: string | undefined,
  level: number,
  edition: Edition,
): GrantedProficiency[] {
  return getGrantsAtLevel(classId, subclassId, level, edition).flatMap((g) =>
    g.kind === "proficiency" ? [g.proficiency] : [],
  )
}
