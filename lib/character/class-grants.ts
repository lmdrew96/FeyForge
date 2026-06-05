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

// Paladin oath spells: 2 always-prepared spells at paladin levels 3/5/9/13/17, of
// spell level 1/2/3/4/5 (half-caster cadence). Oaths are taken at level 3.
const oathSpells = (
  l3: [string, string],
  l5: [string, string],
  l9: [string, string],
  l13: [string, string],
  l17: [string, string],
): Grant[] => [
  gSpell(3, l3[0], 1), gSpell(3, l3[1], 1),
  gSpell(5, l5[0], 2), gSpell(5, l5[1], 2),
  gSpell(9, l9[0], 3), gSpell(9, l9[1], 3),
  gSpell(13, l13[0], 4), gSpell(13, l13[1], 4),
  gSpell(17, l17[0], 5), gSpell(17, l17[1], 5),
]

// Warlock patron expanded spells: 2 spells added to your options at warlock levels
// 1/3/5/7/9, of spell level 1/2/3/4/5 — the same cadence as cleric domain spells.
// Modeled here as always-prepared (like domain/oath spells); they're cast with your
// Pact Magic slots and don't count against your spells-known budget.
const patronSpells = domainSpells

// ── The grant tables (2014 ruleset) ─────────────────────────────────────────────
// NOTE: 2024 deltas (Cleric subclass moves to level 3; some revised domain spells)
// are NOT yet populated — the engine is edition-aware (each Grant takes an optional
// `edition`), so 2024 overrides layer in later without touching callers. Until then
// a 2024 cleric gets the 2014 grants. Verify 2024 specifics against the SRD before
// adding them. (TODO: 2024 cleric data.)

const CLASS_GRANTS: Record<string, ClassGrantTable> = {
  cleric: {
    // Base cleric features shared by every domain. Turn Undead is a Channel
    // Divinity option (it spends the shared pool, like the domain options);
    // Destroy Undead is a passive upgrade to it. CD options follow the canonical
    // "Channel Divinity: X" naming so deriveCharacter can route them to the pool.
    base: [
      gFeature(2, "cleric-turn-undead", "Channel Divinity: Turn Undead", "As an action, present your holy symbol — each undead within 30 feet that can see or hear you must make a Wisdom saving throw or be turned for 1 minute, forced to move away from you and unable to take reactions."),
      gFeature(5, "cleric-destroy-undead", "Destroy Undead", "When an undead fails its saving throw against your Turn Undead, it is instantly destroyed if its challenge rating is at or below your Destroy Undead threshold, which rises as you gain cleric levels."),
    ],
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
  paladin: {
    // Oaths are taken at level 3. Oath spells are always prepared; the two Channel
    // Divinity options per oath ride the shared Channel Divinity pool (named
    // "Channel Divinity: X" so deriveCharacter routes them there, like the cleric).
    subclasses: {
      devotion: [
        gFeature(3, "paladin-devotion-sacred-weapon", "Channel Divinity: Sacred Weapon", "For 1 minute, add your Charisma modifier to attack rolls with a weapon you imbue, which also sheds bright light."),
        gFeature(3, "paladin-devotion-turn-unholy", "Channel Divinity: Turn the Unholy", "Each fiend or undead within 30 feet that can see or hear you must make a Wisdom save or be turned for 1 minute."),
        gFeature(7, "paladin-devotion-aura", "Aura of Devotion", "You and friendly creatures within 10 feet can't be charmed while you're conscious (range grows to 30 feet at 18th level)."),
        gFeature(15, "paladin-devotion-purity", "Purity of Spirit", "You are always under the effects of a protection from evil and good spell."),
        gFeature(20, "paladin-devotion-nimbus", "Holy Nimbus", "As an action, emit an aura of sunlight that burns fiends and undead and aids your saves against their spells. Once per long rest."),
        ...oathSpells(
          ["protection from evil and good", "sanctuary"],
          ["lesser restoration", "zone of truth"],
          ["beacon of hope", "dispel magic"],
          ["freedom of movement", "guardian of faith"],
          ["commune", "flame strike"],
        ),
      ],
      ancients: [
        gFeature(3, "paladin-ancients-natures-wrath", "Channel Divinity: Nature's Wrath", "Spectral vines restrain a creature within 10 feet until it escapes with a Strength or Dexterity save."),
        gFeature(3, "paladin-ancients-turn-faithless", "Channel Divinity: Turn the Faithless", "Each fey or fiend within 30 feet that can see or hear you must make a Wisdom save or be turned for 1 minute."),
        gFeature(7, "paladin-ancients-aura", "Aura of Warding", "You and friendly creatures within 10 feet have resistance to damage from spells (range grows to 30 feet at 18th level)."),
        gFeature(15, "paladin-ancients-sentinel", "Undying Sentinel", "When you drop to 0 hit points and don't die outright, you can drop to 1 instead. Once per long rest."),
        gFeature(20, "paladin-ancients-elder", "Elder Champion", "As an action, transform to regain hit points each turn, cast paladin spells faster, and weaken enemies' saves against your magic. Once per long rest."),
        ...oathSpells(
          ["ensnaring strike", "speak with animals"],
          ["moonbeam", "misty step"],
          ["plant growth", "protection from energy"],
          ["ice storm", "stoneskin"],
          ["commune with nature", "tree stride"],
        ),
      ],
      vengeance: [
        gFeature(3, "paladin-vengeance-abjure", "Channel Divinity: Abjure Enemy", "A creature within 60 feet must make a Wisdom save or be frightened and slowed for 1 minute."),
        gFeature(3, "paladin-vengeance-vow", "Channel Divinity: Vow of Enmity", "As a bonus action, gain advantage on attack rolls against one creature you can see within 10 feet for 1 minute."),
        gFeature(7, "paladin-vengeance-avenger", "Relentless Avenger", "When you hit a creature with an opportunity attack, you can move up to half your speed without provoking attacks."),
        gFeature(15, "paladin-vengeance-soul", "Soul of Vengeance", "When a creature under your Vow of Enmity makes an attack, you can use your reaction to make a melee attack against it."),
        gFeature(20, "paladin-vengeance-angel", "Avenging Angel", "As an action, gain flight and a frightful aura for 1 hour. Once per long rest."),
        ...oathSpells(
          ["bane", "hunter's mark"],
          ["hold person", "misty step"],
          ["haste", "protection from energy"],
          ["banishment", "dimension door"],
          ["hold monster", "scrying"],
        ),
      ],
    },
  },
  warlock: {
    // Patrons grant expanded spells (always-prepared, cast with Pact Magic slots)
    // plus signature features at warlock levels 1/6/10/14. Limited-use features note
    // their cadence in `uses` (descriptive — Pact lacks a tracked pool today).
    subclasses: {
      fiend: [
        gFeature(1, "warlock-fiend-blessing", "Dark One's Blessing", "When you reduce a hostile creature to 0 hit points, you gain temporary hit points equal to your Charisma modifier + your warlock level (minimum 1)."),
        gFeature(6, "warlock-fiend-luck", "Dark One's Own Luck", "Add a d10 to one ability check or saving throw, after you roll but before the outcome is revealed.", "1 per short or long rest"),
        gFeature(10, "warlock-fiend-resilience", "Fiendish Resilience", "After a short or long rest, choose one damage type to gain resistance to until you pick another; it doesn't apply to damage from magical or silvered weapons."),
        gFeature(14, "warlock-fiend-hurl", "Hurl Through Hell", "When you hit a creature with an attack, you can banish it through the Lower Planes; at the end of your next turn it returns and, unless it's a fiend, takes 10d10 psychic damage.", "1 per long rest"),
        ...patronSpells(
          ["burning hands", "command"],
          ["blindness/deafness", "scorching ray"],
          ["fireball", "stinking cloud"],
          ["fire shield", "wall of fire"],
          ["flame strike", "hallow"],
        ),
      ],
      archfey: [
        gFeature(1, "warlock-archfey-presence", "Fey Presence", "As an action, force each creature in a 10-foot cube around you to make a Wisdom save or be charmed or frightened (your choice) until the end of your next turn.", "1 per short or long rest"),
        gFeature(6, "warlock-archfey-escape", "Misty Escape", "As a reaction when you take damage, turn invisible and teleport up to 60 feet; you stay invisible until the end of your next turn or until you attack or cast a spell.", "1 per short or long rest"),
        gFeature(10, "warlock-archfey-defenses", "Beguiling Defenses", "You can't be charmed, and when a creature tries to charm you, you can turn the effect back on it (Wisdom save or charmed for 1 minute, taking psychic damage each turn)."),
        gFeature(14, "warlock-archfey-delirium", "Dark Delirium", "As an action, plunge a creature within 60 feet into an illusory realm (Wisdom save); for up to 1 minute it's charmed or frightened and perceives nothing but the illusion.", "1 per short or long rest"),
        ...patronSpells(
          ["faerie fire", "sleep"],
          ["calm emotions", "phantasmal force"],
          ["blink", "plant growth"],
          ["dominate beast", "greater invisibility"],
          ["dominate person", "seeming"],
        ),
      ],
      "great-old-one": [
        gFeature(1, "warlock-goo-mind", "Awakened Mind", "You can telepathically speak to any creature you can see within 30 feet, in any language it understands."),
        gFeature(6, "warlock-goo-ward", "Entropic Ward", "As a reaction when a creature attacks you, impose disadvantage on the roll; if it misses, your next attack against it before the end of your next turn has advantage.", "1 per short or long rest"),
        gFeature(10, "warlock-goo-shield", "Thought Shield", "Your thoughts can't be read unless you allow it, you have resistance to psychic damage, and a creature that deals psychic damage to you takes the same amount."),
        gFeature(14, "warlock-goo-thrall", "Create Thrall", "You can touch an incapacitated humanoid to charm it indefinitely; it serves as your thrall, and you can communicate telepathically with it across any distance on the same plane."),
        ...patronSpells(
          ["dissonant whispers", "tasha's hideous laughter"],
          ["detect thoughts", "phantasmal force"],
          ["clairvoyance", "sending"],
          ["dominate beast", "evard's black tentacles"],
          ["dominate person", "telekinesis"],
        ),
      ],
    },
  },
  // ── Passive-feature subclasses (signature features; descriptive) ──────────────
  barbarian: {
    subclasses: {
      berserker: [
        gFeature(3, "barb-berserker-frenzy", "Frenzy", "While raging, you can make a single melee weapon attack as a bonus action on each of your turns. When your rage ends, you suffer one level of exhaustion."),
        gFeature(6, "barb-berserker-mindless", "Mindless Rage", "You can't be charmed or frightened while raging; a charm or fright already on you is suspended for the duration."),
        gFeature(10, "barb-berserker-intimidating", "Intimidating Presence", "Use your action to frighten a creature within 30 feet with a Wisdom save against your save DC."),
        gFeature(14, "barb-berserker-retaliation", "Retaliation", "When you take damage from a creature within 5 feet, use your reaction to make a melee weapon attack against it."),
      ],
      "totem-warrior": [
        gFeature(3, "barb-totem-seeker", "Spirit Seeker", "You can cast the beast sense and speak with animals spells as rituals."),
        gFeature(3, "barb-totem-spirit", "Totem Spirit", "Choose a totem. Bear: resistance to all damage except psychic while raging. Eagle: enemies have disadvantage on opportunity attacks against you, and you can Dash as a bonus action. Wolf: allies have advantage on melee attacks against enemies within 5 feet of you."),
        gFeature(6, "barb-totem-aspect", "Aspect of the Beast", "Gain a beast aspect — Bear (carrying capacity), Eagle (keen sight), or Wolf (tracking and stealth for your pack)."),
        gFeature(14, "barb-totem-attunement", "Totemic Attunement", "Gain a powerful totem benefit, such as forcing nearby enemies to attack you (Bear)."),
      ],
    },
  },
  bard: {
    subclasses: {
      lore: [
        gFeature(3, "bard-lore-prof", "Bonus Proficiencies", "Gain proficiency with three skills of your choice."),
        gFeature(3, "bard-lore-cutting", "Cutting Words", "When a creature within 60 feet makes an attack, ability check, or damage roll, use your reaction to expend a Bardic Inspiration die and subtract it from the roll."),
        gFeature(6, "bard-lore-secrets", "Additional Magical Secrets", "Learn two spells of your choice from any class; they count as bard spells for you."),
        gFeature(14, "bard-lore-peerless", "Peerless Skill", "When you make an ability check, you can expend a Bardic Inspiration die and add it to the roll."),
      ],
      valor: [
        gFeature(3, "bard-valor-prof", "Bonus Proficiencies", "Gain proficiency with medium armor, shields, and martial weapons."),
        gFeature(3, "bard-valor-inspiration", "Combat Inspiration", "A creature holding your Bardic Inspiration die can add it to a weapon's damage roll, or to its AC against one attack."),
        gFeature(6, "bard-valor-extra-attack", "Extra Attack", "You can attack twice, instead of once, whenever you take the Attack action on your turn."),
        gFeature(14, "bard-valor-battle-magic", "Battle Magic", "When you use your action to cast a bard spell, you can make one weapon attack as a bonus action."),
      ],
    },
  },
  druid: {
    subclasses: {
      land: [
        gFeature(2, "druid-land-recovery", "Natural Recovery", "On a short rest, recover expended spell slots with a combined level up to half your druid level (no slot of 6th level or higher)."),
        gFeature(3, "druid-land-spells", "Circle Spells", "Your bond with the land grants additional always-prepared spells, chosen by terrain (arctic, coast, desert, forest, grassland, mountain, swamp, or Underdark)."),
        gFeature(6, "druid-land-stride", "Land's Stride", "Moving through nonmagical difficult terrain costs no extra movement, and you have advantage on saves against plants that magically impede movement."),
        gFeature(10, "druid-land-ward", "Nature's Ward", "You can't be charmed or frightened by elementals or fey, and you're immune to poison and disease."),
      ],
      moon: [
        gFeature(2, "druid-moon-combat", "Combat Wild Shape", "You can Wild Shape as a bonus action, and while transformed you can spend a spell slot as a bonus action to regain 1d8 hit points per level of the slot."),
        gFeature(2, "druid-moon-forms", "Circle Forms", "You can Wild Shape into beasts of a higher challenge rating (reflected in the Wild Shape CR limit)."),
        gFeature(6, "druid-moon-primal", "Primal Strike", "Your attacks in beast form count as magical for overcoming resistance and immunity to nonmagical damage."),
        gFeature(10, "druid-moon-elemental", "Elemental Wild Shape", "You can expend two uses of Wild Shape at once to transform into an air, earth, fire, or water elemental."),
      ],
    },
  },
  fighter: {
    subclasses: {
      champion: [
        gFeature(3, "fighter-champion-crit", "Improved Critical", "Your weapon attacks score a critical hit on a roll of 19 or 20."),
        gFeature(7, "fighter-champion-athlete", "Remarkable Athlete", "Add half your proficiency bonus to Strength, Dexterity, and Constitution checks that don't already use it, and your running long jump distance increases."),
        gFeature(10, "fighter-champion-style", "Additional Fighting Style", "Choose a second Fighting Style option."),
        gFeature(15, "fighter-champion-superior", "Superior Critical", "Your weapon attacks score a critical hit on a roll of 18-20."),
      ],
      "battle-master": [
        gFeature(7, "fighter-bm-know-enemy", "Know Your Enemy", "Spend 1 minute observing a creature to learn how its capabilities compare to yours (such as Strength, Dexterity, AC, and current hit points)."),
        gFeature(15, "fighter-bm-relentless", "Relentless", "When you roll initiative and have no superiority dice, you regain one."),
      ],
      "eldritch-knight": [
        gFeature(3, "fighter-ek-bond", "Weapon Bond", "Bond with up to two weapons; you can't be disarmed of a bonded weapon, and you can summon it to your hand as a bonus action if it's on the same plane."),
        gFeature(7, "fighter-ek-war-magic", "War Magic", "When you use your action to cast a cantrip, you can make one weapon attack as a bonus action."),
        gFeature(10, "fighter-ek-strike", "Eldritch Strike", "When you hit a creature with a weapon attack, it has disadvantage on the next saving throw it makes against a spell you cast before the end of your next turn."),
        gFeature(18, "fighter-ek-improved-war", "Improved War Magic", "When you use your action to cast a spell, you can make one weapon attack as a bonus action."),
      ],
    },
  },
  monk: {
    subclasses: {
      "open-hand": [
        gFeature(3, "monk-openhand-technique", "Open Hand Technique", "When you hit with a Flurry of Blows attack, you can impose one effect: knock the target prone, push it 15 feet, or deny it reactions until the end of your next turn."),
        gFeature(6, "monk-openhand-wholeness", "Wholeness of Body", "As an action, regain hit points equal to three times your monk level. Once per long rest."),
        gFeature(11, "monk-openhand-tranquility", "Tranquility", "At the end of a long rest, gain the effect of a sanctuary spell until your next long rest begins (it ends early if you attack or cast a harmful spell)."),
        gFeature(17, "monk-openhand-quivering", "Quivering Palm", "Spend 3 ki when you hit a creature to set up lethal vibrations; later, end them to force a Constitution save or reduce the creature to 0 hit points."),
      ],
      shadow: [
        gFeature(3, "monk-shadow-arts", "Shadow Arts", "Spend 2 ki to cast darkness, darkvision, pass without trace, or silence; you also know the minor illusion cantrip."),
        gFeature(6, "monk-shadow-step", "Shadow Step", "When you're in dim light or darkness, teleport up to 60 feet to an unoccupied space you can see that's also in dim light or darkness, gaining advantage on your next melee attack."),
        gFeature(11, "monk-shadow-cloak", "Cloak of Shadows", "In dim light or darkness, become invisible until you make an attack, cast a spell, or step into bright light."),
        gFeature(17, "monk-shadow-opportunist", "Opportunist", "When a creature within 5 feet is hit by another creature's attack, use your reaction to make a melee attack against it."),
      ],
      "four-elements": [
        gFeature(3, "monk-elements-disciple", "Disciple of the Elements", "Learn elemental disciplines that let you spend ki to create magical effects, such as casting burning hands or shoving a creature with elemental force; you learn more as you level."),
      ],
    },
  },
  ranger: {
    subclasses: {
      hunter: [
        gFeature(3, "ranger-hunter-prey", "Hunter's Prey", "Choose Colossus Slayer (an extra 1d8 against a damaged target, once per turn), Giant Killer (a reaction attack against Large-or-bigger attackers), or Horde Breaker (an extra attack against a second nearby creature)."),
        gFeature(7, "ranger-hunter-defense", "Defensive Tactics", "Choose Escape the Horde, Multiattack Defense, or Steel Will to shore up a weakness."),
        gFeature(11, "ranger-hunter-multiattack", "Multiattack", "Choose Volley (attack many creatures in an area) or Whirlwind Attack (strike every creature around you)."),
        gFeature(15, "ranger-hunter-defense2", "Superior Hunter's Defense", "Choose a powerful defensive option such as Evasion, Stand Against the Tide, or Uncanny Dodge."),
      ],
      "beast-master": [
        gFeature(3, "ranger-beast-companion", "Ranger's Companion", "Gain a beast companion that fights alongside you and obeys your commands — track it in the Companions section."),
        gFeature(7, "ranger-beast-training", "Exceptional Training", "Your companion can Dash, Disengage, Dodge, or Help as a bonus action, and its attacks count as magical."),
        gFeature(11, "ranger-beast-fury", "Bestial Fury", "Your companion can make two attacks when you command it to take the Attack action."),
        gFeature(15, "ranger-beast-share", "Share Spells", "When you cast a spell targeting yourself, you can also affect your companion if it's within 30 feet."),
      ],
    },
  },
  rogue: {
    subclasses: {
      thief: [
        gFeature(3, "rogue-thief-fast-hands", "Fast Hands", "Use your Cunning Action bonus action to make a Sleight of Hand check, use thieves' tools to disarm a trap or pick a lock, or take the Use an Object action."),
        gFeature(3, "rogue-thief-second-story", "Second-Story Work", "Climbing costs no extra movement, and your running jump distance increases by your Dexterity modifier (in feet)."),
        gFeature(9, "rogue-thief-supreme-sneak", "Supreme Sneak", "You have advantage on Stealth checks if you move no more than half your speed on the same turn."),
        gFeature(13, "rogue-thief-umd", "Use Magic Device", "You ignore all class, race, and level requirements on the use of magic items."),
      ],
      assassin: [
        gFeature(3, "rogue-assassin-prof", "Bonus Proficiencies", "Gain proficiency with the disguise kit and the poisoner's kit."),
        gFeature(3, "rogue-assassin-assassinate", "Assassinate", "You have advantage on attacks against any creature that hasn't taken a turn yet in combat, and any hit against a surprised creature is a critical hit."),
        gFeature(9, "rogue-assassin-infiltration", "Infiltration Expertise", "Spend time and money to establish a convincing false identity, complete with documentation and acquaintances."),
        gFeature(17, "rogue-assassin-death-strike", "Death Strike", "When you hit a surprised creature, it must make a Constitution save or take double damage from the attack."),
      ],
      "arcane-trickster": [
        gFeature(3, "rogue-at-mage-hand", "Mage Hand Legerdemain", "Your spectral hand is invisible and can stow or retrieve objects, pick locks, and disarm traps at a distance."),
        gFeature(9, "rogue-at-ambush", "Magical Ambush", "If you're hidden from a creature when you cast a spell on it, it has disadvantage on any save it makes against the spell this turn."),
        gFeature(13, "rogue-at-versatile", "Versatile Trickster", "Use your mage hand to distract a creature, gaining advantage on attack rolls against it until the end of your turn."),
        gFeature(17, "rogue-at-spell-thief", "Spell Thief", "When a creature casts a spell that targets you, use your reaction to attempt to steal knowledge of that spell."),
      ],
    },
  },
  sorcerer: {
    subclasses: {
      "draconic-bloodline": [
        gFeature(1, "sorc-draconic-ancestor", "Dragon Ancestor", "Choose a dragon type; you can speak Draconic and double your proficiency bonus on Charisma checks when interacting with dragons."),
        gFeature(1, "sorc-draconic-resilience", "Draconic Resilience", "Your hit point maximum increases by 1 per sorcerer level, and while you aren't wearing armor your AC equals 13 + your Dexterity modifier."),
        gFeature(6, "sorc-draconic-affinity", "Elemental Affinity", "When you cast a spell dealing your ancestry's damage type, add your Charisma modifier to one damage roll; you can also spend 1 sorcery point for an hour of resistance to that type."),
        gFeature(14, "sorc-draconic-wings", "Dragon Wings", "Sprout draconic wings as a bonus action, gaining a flying speed equal to your current speed."),
      ],
      "wild-magic": [
        gFeature(1, "sorc-wild-surge", "Wild Magic Surge", "Your untamed magic can surge; after you cast a sorcerer spell of 1st level or higher, the DM may have you roll on the Wild Magic Surge table."),
        gFeature(1, "sorc-wild-tides", "Tides of Chaos", "Gain advantage on one attack roll, ability check, or saving throw; you regain its use after the DM has you roll on the surge table."),
        gFeature(6, "sorc-wild-bend-luck", "Bend Luck", "When another creature you can see makes an attack, check, or save, spend 2 sorcery points to add or subtract 1d4 from the roll."),
        gFeature(14, "sorc-wild-controlled", "Controlled Chaos", "When you roll on the Wild Magic Surge table, you can roll twice and use either result."),
      ],
    },
  },
  wizard: {
    subclasses: {
      evocation: [
        gFeature(2, "wiz-evocation-savant", "Evocation Savant", "Halve the time and gold needed to copy evocation spells into your spellbook."),
        gFeature(2, "wiz-evocation-sculpt", "Sculpt Spells", "When you cast an evocation spell affecting others you can see, choose creatures equal to 1 + the spell's level to automatically succeed their saves and take no damage."),
        gFeature(6, "wiz-evocation-potent", "Potent Cantrip", "Your damaging cantrips affect creatures that succeed on their saving throw, dealing half damage instead of none."),
        gFeature(10, "wiz-evocation-empowered", "Empowered Evocation", "Add your Intelligence modifier to one damage roll of any wizard evocation spell you cast."),
      ],
      abjuration: [
        gFeature(2, "wiz-abjuration-savant", "Abjuration Savant", "Halve the time and gold needed to copy abjuration spells into your spellbook."),
        gFeature(2, "wiz-abjuration-ward", "Arcane Ward", "Casting an abjuration spell of 1st level or higher creates a magical ward that absorbs damage; casting more abjuration spells recharges it."),
        gFeature(6, "wiz-abjuration-projected", "Projected Ward", "When a creature you can see within 30 feet takes damage, use your reaction to absorb it with your Arcane Ward instead."),
        gFeature(14, "wiz-abjuration-resistance", "Spell Resistance", "You have advantage on saving throws against spells, and resistance to the damage they deal."),
      ],
      conjuration: [
        gFeature(2, "wiz-conjuration-savant", "Conjuration Savant", "Halve the time and gold needed to copy conjuration spells into your spellbook."),
        gFeature(2, "wiz-conjuration-minor", "Minor Conjuration", "Conjure an inanimate object up to 3 feet on a side that lasts up to 1 hour."),
        gFeature(6, "wiz-conjuration-benign", "Benign Transposition", "Teleport up to 30 feet, or swap places with a willing creature you can see within range."),
        gFeature(10, "wiz-conjuration-focused", "Focused Conjuration", "Your concentration on a conjuration spell can't be broken as a result of taking damage."),
      ],
      divination: [
        gFeature(2, "wiz-divination-savant", "Divination Savant", "Halve the time and gold needed to copy divination spells into your spellbook."),
        gFeature(2, "wiz-divination-portent", "Portent", "After a long rest, roll two d20s and record them; you can replace any attack roll, save, or ability check — yours or one you can see — with a foretold roll."),
        gFeature(6, "wiz-divination-expert", "Expert Divination", "Casting a divination spell of 2nd level or higher refunds a spell slot of a lower level."),
        gFeature(14, "wiz-divination-portent2", "Greater Portent", "You roll three d20s for your Portent feature instead of two."),
      ],
      enchantment: [
        gFeature(2, "wiz-enchantment-savant", "Enchantment Savant", "Halve the time and gold needed to copy enchantment spells into your spellbook."),
        gFeature(2, "wiz-enchantment-gaze", "Hypnotic Gaze", "As an action, charm a creature within 5 feet (Wisdom save) so it's incapacitated and dazed while you maintain the gaze each turn."),
        gFeature(6, "wiz-enchantment-instinctive", "Instinctive Charm", "When a creature within 30 feet attacks you, use your reaction to redirect the attack to another creature (Wisdom save)."),
        gFeature(10, "wiz-enchantment-split", "Split Enchantment", "When you cast a single-target enchantment spell, you can have it target a second creature."),
      ],
      illusion: [
        gFeature(2, "wiz-illusion-savant", "Illusion Savant", "Halve the time and gold needed to copy illusion spells into your spellbook."),
        gFeature(2, "wiz-illusion-minor", "Improved Minor Illusion", "You know the minor illusion cantrip and can create both a sound and an image with a single casting of it."),
        gFeature(6, "wiz-illusion-malleable", "Malleable Illusions", "Use an action to change the nature of an illusion spell you cast that has a duration and that you can see."),
        gFeature(10, "wiz-illusion-self", "Illusory Self", "When a creature hits you with an attack, use your reaction to interpose an illusory duplicate and cause the attack to miss."),
      ],
      necromancy: [
        gFeature(2, "wiz-necromancy-savant", "Necromancy Savant", "Halve the time and gold needed to copy necromancy spells into your spellbook."),
        gFeature(2, "wiz-necromancy-harvest", "Grim Harvest", "When you kill a creature with a spell, regain hit points equal to twice the spell's level (three times for a necromancy spell)."),
        gFeature(6, "wiz-necromancy-thralls", "Undead Thralls", "Learn the animate dead spell; undead you create with it are tougher and hit harder, and you can animate one additional creature."),
        gFeature(10, "wiz-necromancy-inured", "Inured to Undeath", "You're resistant to necrotic damage, and your hit point maximum can't be reduced."),
      ],
      transmutation: [
        gFeature(2, "wiz-transmutation-savant", "Transmutation Savant", "Halve the time and gold needed to copy transmutation spells into your spellbook."),
        gFeature(2, "wiz-transmutation-minor", "Minor Alchemy", "Temporarily transform one nonmagical material into another similar one (such as wood into stone) for up to 1 hour."),
        gFeature(6, "wiz-transmutation-stone", "Transmuter's Stone", "Create a stone that grants whoever carries it a benefit: darkvision, +10 feet of speed, proficiency in Constitution saves, or resistance to a damage type."),
        gFeature(10, "wiz-transmutation-shape", "Shapechanger", "Learn the polymorph spell; you can cast it on yourself without a slot to become a beast of challenge rating 1 or lower, once per short rest."),
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
