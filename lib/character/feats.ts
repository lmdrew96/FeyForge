// Curated 5e feat list for the level-up ASI/feat choice + the sheet's Feats
// section. Descriptions are original one-line summaries of each feat's mechanics
// (game rules aren't copyrightable; the specific PHB wording is — so these are
// paraphrased, not copied). Flavored to the 2024 ruleset (FeyForge's default),
// but the essence applies to 2014 too. open5e was evaluated as a source and
// rejected: only Grappler is clean WotC SRD there; the rest is third-party OGL.
//
// Homebrew feats (kind:"feat") will merge into the same picker later — keep the
// shape minimal so a homebrew row maps cleanly onto FeatData.

export type FeatCategory = "origin" | "general"

export interface FeatData {
  id: string
  name: string
  category: FeatCategory
  /** Advisory only — shown, not hard-enforced (multiclass/edge cases vary). */
  prerequisite?: string
  description: string
}

// Origin feats are normally taken at level 1; general feats normally need level
// 4+ (the ASI levels). The picker offers all of them — a player can take any
// feat at an ASI level, and the standalone "Add feat" covers level-1 origins
// (e.g. a 2024 background's origin feat or a variant-human pick).
export const FEATS: FeatData[] = [
  // ── Origin feats ──────────────────────────────────────────────────────────
  {
    id: "alert",
    name: "Alert",
    category: "origin",
    description:
      "Add your proficiency bonus to Initiative, and you can swap your Initiative with a willing ally (neither of you Incapacitated).",
  },
  {
    id: "crafter",
    name: "Crafter",
    category: "origin",
    description:
      "Gain proficiency with three Artisan's Tools, buy nonmagical gear at a discount, and craft mundane items faster.",
  },
  {
    id: "healer",
    name: "Healer",
    category: "origin",
    description:
      "As an action, use a Healer's Kit to restore Hit Points (dice based on the target's level) and stabilize a dying creature.",
  },
  {
    id: "lucky",
    name: "Lucky",
    category: "origin",
    description:
      "Gain Luck Points equal to your proficiency bonus. Spend one to gain Advantage on a d20 Test or impose Disadvantage on an attack against you. Regain on a Long Rest.",
  },
  {
    id: "magic-initiate",
    name: "Magic Initiate",
    category: "origin",
    description:
      "Learn two cantrips and one 1st-level spell from a chosen class's list. Cast the spell once per Long Rest for free (or with slots if you have them).",
  },
  {
    id: "musician",
    name: "Musician",
    category: "origin",
    description:
      "Gain proficiency with three Musical Instruments. After a rest, grant Heroic Inspiration to allies (up to your proficiency bonus).",
  },
  {
    id: "savage-attacker",
    name: "Savage Attacker",
    category: "origin",
    description:
      "Once per turn when you hit with a weapon, reroll the weapon's damage dice and use either total.",
  },
  {
    id: "skilled",
    name: "Skilled",
    category: "origin",
    description: "Gain proficiency in any combination of three skills or tools of your choice.",
  },
  {
    id: "tavern-brawler",
    name: "Tavern Brawler",
    category: "origin",
    description:
      "Reroll 1s on Unarmed Strike / improvised-weapon damage, deal extra damage, and shove as part of an Unarmed Strike. +1 Strength or Constitution.",
  },
  {
    id: "tough",
    name: "Tough",
    category: "origin",
    description:
      "Your Hit Point maximum increases by twice your character level, and by 2 more each time you level up.",
  },

  // ── General feats (normally level 4+) ─────────────────────────────────────
  {
    id: "actor",
    name: "Actor",
    category: "general",
    description:
      "+1 Charisma. Advantage on Deception/Performance checks to pass as someone else, and you can mimic the speech or sounds of others.",
  },
  {
    id: "athlete",
    name: "Athlete",
    category: "general",
    description:
      "+1 Strength or Dexterity. Stand from prone cheaply, climb at full speed, and make running jumps after moving only 5 feet.",
  },
  {
    id: "charger",
    name: "Charger",
    category: "general",
    description:
      "+1 Strength or Dexterity. After you Dash, make a bonus melee attack or shove with extra force.",
  },
  {
    id: "chef",
    name: "Chef",
    category: "general",
    description:
      "+1 Constitution or Wisdom. Cook food on a rest that restores extra Hit Points, plus treats that grant Temporary Hit Points.",
  },
  {
    id: "crossbow-expert",
    name: "Crossbow Expert",
    category: "general",
    description:
      "+1 Dexterity. Ignore the Loading property, attack in melee without Disadvantage, and fire a hand crossbow as a bonus attack.",
  },
  {
    id: "defensive-duelist",
    name: "Defensive Duelist",
    category: "general",
    prerequisite: "Dexterity 13+",
    description:
      "+1 Dexterity. While wielding a Finesse weapon, use your Reaction to add your proficiency bonus to AC against one melee attack.",
  },
  {
    id: "dual-wielder",
    name: "Dual Wielder",
    category: "general",
    description:
      "+1 Strength or Dexterity. Improved two-weapon fighting, add your ability modifier to the off-hand attack, and draw/stow two weapons at once.",
  },
  {
    id: "durable",
    name: "Durable",
    category: "general",
    description:
      "+1 Constitution. When you roll Hit Dice to regain Hit Points, treat low rolls as your Constitution modifier (minimum), recovering more reliably.",
  },
  {
    id: "elemental-adept",
    name: "Elemental Adept",
    category: "general",
    prerequisite: "Spellcasting or Pact Magic",
    description:
      "+1 Int/Wis/Cha. Spells of a chosen damage type ignore Resistance, and you treat 1s on their damage dice as 2s.",
  },
  {
    id: "fey-touched",
    name: "Fey Touched",
    category: "general",
    description:
      "+1 Int/Wis/Cha. Learn Misty Step and one 1st-level Divination or Enchantment spell; cast each once per Long Rest for free.",
  },
  {
    id: "grappler",
    name: "Grappler",
    category: "general",
    description:
      "+1 Strength or Dexterity. Advantage on attacks against creatures you have Grappled, and you can grapple as part of your Attack.",
  },
  {
    id: "great-weapon-master",
    name: "Great Weapon Master",
    category: "general",
    description:
      "+1 Strength. Scoring a crit or downing a creature with a melee weapon grants a bonus attack; heavy weapons can trade accuracy for extra damage.",
  },
  {
    id: "heavy-armor-master",
    name: "Heavy Armor Master",
    category: "general",
    prerequisite: "Heavy armor proficiency",
    description:
      "+1 Strength. While wearing heavy armor, reduce nonmagical bludgeoning, piercing, and slashing damage you take by your proficiency bonus.",
  },
  {
    id: "inspiring-leader",
    name: "Inspiring Leader",
    category: "general",
    description:
      "+1 Wisdom or Charisma. Spend 10 minutes to give allies Temporary Hit Points equal to your level + your Charisma modifier.",
  },
  {
    id: "mage-slayer",
    name: "Mage Slayer",
    category: "general",
    description:
      "+1 Str/Dex/Con. Pressure nearby spellcasters: punish them when they cast near you and make their Concentration saves harder.",
  },
  {
    id: "observant",
    name: "Observant",
    category: "general",
    description:
      "+1 Intelligence or Wisdom. Read lips, gain a bonus to passive Perception and Investigation, and Search as a Bonus Action.",
  },
  {
    id: "resilient",
    name: "Resilient",
    category: "general",
    description:
      "+1 to one ability of your choice, and gain saving-throw proficiency in that same ability.",
  },
  {
    id: "sentinel",
    name: "Sentinel",
    category: "general",
    description:
      "+1 Strength or Dexterity. Opportunity attacks reduce a target's Speed to 0, and you can strike foes that attack your nearby allies.",
  },
  {
    id: "shadow-touched",
    name: "Shadow Touched",
    category: "general",
    description:
      "+1 Int/Wis/Cha. Learn Invisibility and one 1st-level Illusion or Necromancy spell; cast each once per Long Rest for free.",
  },
  {
    id: "sharpshooter",
    name: "Sharpshooter",
    category: "general",
    description:
      "+1 Dexterity. Ignore long-range Disadvantage and cover, and ranged weapon attacks can trade accuracy for extra damage.",
  },
  {
    id: "shield-master",
    name: "Shield Master",
    category: "general",
    description:
      "While wielding a Shield: shove as a Bonus Action, add the Shield's AC to Dexterity saves against single-target effects, and better avoid area effects.",
  },
  {
    id: "skill-expert",
    name: "Skill Expert",
    category: "general",
    description:
      "+1 to one ability. Gain proficiency in one skill, and Expertise (double proficiency) in one skill you're proficient with.",
  },
  {
    id: "speedy",
    name: "Speedy",
    category: "general",
    prerequisite: "Dexterity or Constitution 13+",
    description:
      "+1 Dexterity or Constitution. Speed +10 ft, Dash over Difficult Terrain, and avoid Opportunity Attacks from foes you've made a melee attack against this turn.",
  },
  {
    id: "spell-sniper",
    name: "Spell Sniper",
    category: "general",
    prerequisite: "Spellcasting or Pact Magic",
    description:
      "+1 Int/Wis/Cha. Double the range of your attack-roll spells, ignore half/three-quarters cover, and learn one attack cantrip.",
  },
  {
    id: "war-caster",
    name: "War Caster",
    category: "general",
    prerequisite: "Spellcasting or Pact Magic",
    description:
      "+1 Int/Wis/Cha. Advantage on Concentration saves, cast with weapon/shield in hand, and cast a spell as an Opportunity Attack.",
  },
]

export function getFeatById(id: string): FeatData | undefined {
  return FEATS.find((f) => f.id === id)
}
