// Curated 5e feat list for the level-up ASI/feat choice + the sheet's Feats
// section. Descriptions are original one-line summaries of each feat's mechanics
// (game rules aren't copyrightable; the specific PHB wording is — so these are
// paraphrased, not copied). Flavored to the 2024 ruleset (FeyForge's default),
// but the essence applies to 2014 too. open5e was evaluated as a source and
// rejected: only Grappler is clean WotC SRD there; the rest is third-party OGL.
//
// `effects` drives two things: (1) prompting for the decisions a feat requires
// (which ability, which skills, which damage type), and (2) baking the concrete
// bonuses into the character's stored fields — ability score increases, skill/
// save proficiencies, expertise, and Tough's HP. Complex combat riders (Sentinel,
// Sharpshooter's −5/+10, etc.) stay descriptive-only; they don't map to a stored
// field cleanly and would be leaky to auto-apply.
//
// Homebrew feats (kind:"feat") will merge into the same picker later — keep the
// shape minimal so a homebrew row maps cleanly onto FeatData.

import type { Ability, Skill } from "./constants"

export type FeatCategory = "origin" | "general"

// What a feat lets/makes the player decide, and what it grants.
export interface FeatEffects {
  // +1 to an ability chosen from this set. One entry → auto-applied (no prompt);
  // multiple → the player picks one.
  abilityOptions?: Ability[]
  // The chosen ability ALSO grants a saving-throw proficiency (Resilient).
  saveProficiency?: boolean
  // Choose this many skills to gain proficiency in (Skilled = 3, Skill Expert = 1).
  skillChoices?: number
  // Choose this many skills you're proficient in to gain Expertise (Skill Expert = 1).
  expertiseChoices?: number
  // Flat HP per character level (Tough = 2). Auto-applied, scales with level.
  hpPerLevel?: number
  // A required flavor decision recorded in the feat's name (e.g. Elemental Adept's
  // damage type). Numeric-neutral — it doesn't change a stored stat.
  textChoice?: { label: string; options?: string[] }
}

export interface FeatData {
  id: string
  name: string
  category: FeatCategory
  /** Advisory only — shown, not hard-enforced (multiclass/edge cases vary). */
  prerequisite?: string
  description: string
  effects?: FeatEffects
}

// The concrete grants resolved from a feat + the player's choices. Stored on the
// feat property's `data.applied` so removal can reverse exactly what was added.
export interface AppliedGrants {
  ability?: Ability
  saveProficiency?: Ability
  skillProficiencies?: Skill[]
  skillExpertise?: Skill[]
  hp?: number
  text?: string
}

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
      "Learn two cantrips and one 1st-level spell from a chosen class's list. Cast the spell once per Long Rest for free (or with slots if you have them). Add the chosen spells via the Spellbook section.",
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
    description:
      "Gain proficiency in three skills or tools of your choice. (Tools can be added on the sheet directly.)",
    effects: { skillChoices: 3 },
  },
  {
    id: "tavern-brawler",
    name: "Tavern Brawler",
    category: "origin",
    description:
      "Reroll 1s on Unarmed Strike / improvised-weapon damage, deal extra damage, and shove as part of an Unarmed Strike.",
    effects: { abilityOptions: ["strength", "constitution"] },
  },
  {
    id: "tough",
    name: "Tough",
    category: "origin",
    description:
      "Your Hit Point maximum increases by twice your character level, and by 2 more each time you level up.",
    effects: { hpPerLevel: 2 },
  },

  // ── General feats (normally level 4+) ─────────────────────────────────────
  {
    id: "actor",
    name: "Actor",
    category: "general",
    description:
      "Advantage on Deception/Performance checks to pass as someone else, and you can mimic the speech or sounds of others.",
    effects: { abilityOptions: ["charisma"] },
  },
  {
    id: "athlete",
    name: "Athlete",
    category: "general",
    description:
      "Stand from prone cheaply, climb at full speed, and make running jumps after moving only 5 feet.",
    effects: { abilityOptions: ["strength", "dexterity"] },
  },
  {
    id: "charger",
    name: "Charger",
    category: "general",
    description: "After you Dash, make a bonus melee attack or shove with extra force.",
    effects: { abilityOptions: ["strength", "dexterity"] },
  },
  {
    id: "chef",
    name: "Chef",
    category: "general",
    description:
      "Cook food on a rest that restores extra Hit Points, plus treats that grant Temporary Hit Points.",
    effects: { abilityOptions: ["constitution", "wisdom"] },
  },
  {
    id: "crossbow-expert",
    name: "Crossbow Expert",
    category: "general",
    description:
      "Ignore the Loading property, attack in melee without Disadvantage, and fire a hand crossbow as a bonus attack.",
    effects: { abilityOptions: ["dexterity"] },
  },
  {
    id: "defensive-duelist",
    name: "Defensive Duelist",
    category: "general",
    prerequisite: "Dexterity 13+",
    description:
      "While wielding a Finesse weapon, use your Reaction to add your proficiency bonus to AC against one melee attack.",
    effects: { abilityOptions: ["dexterity"] },
  },
  {
    id: "dual-wielder",
    name: "Dual Wielder",
    category: "general",
    description:
      "Improved two-weapon fighting, add your ability modifier to the off-hand attack, and draw/stow two weapons at once.",
    effects: { abilityOptions: ["strength", "dexterity"] },
  },
  {
    id: "durable",
    name: "Durable",
    category: "general",
    description:
      "When you roll Hit Dice to regain Hit Points, treat low rolls as your Constitution modifier (minimum), recovering more reliably.",
    effects: { abilityOptions: ["constitution"] },
  },
  {
    id: "elemental-adept",
    name: "Elemental Adept",
    category: "general",
    prerequisite: "Spellcasting or Pact Magic",
    description:
      "Spells of a chosen damage type ignore Resistance, and you treat 1s on their damage dice as 2s.",
    effects: {
      abilityOptions: ["intelligence", "wisdom", "charisma"],
      textChoice: { label: "Damage type", options: ["Acid", "Cold", "Fire", "Lightning", "Thunder"] },
    },
  },
  {
    id: "fey-touched",
    name: "Fey Touched",
    category: "general",
    description:
      "Learn Misty Step and one 1st-level Divination or Enchantment spell; cast each once per Long Rest for free. Add them via the Spellbook section.",
    effects: { abilityOptions: ["intelligence", "wisdom", "charisma"] },
  },
  {
    id: "grappler",
    name: "Grappler",
    category: "general",
    description:
      "Advantage on attacks against creatures you have Grappled, and you can grapple as part of your Attack.",
    effects: { abilityOptions: ["strength", "dexterity"] },
  },
  {
    id: "great-weapon-master",
    name: "Great Weapon Master",
    category: "general",
    description:
      "Scoring a crit or downing a creature with a melee weapon grants a bonus attack; heavy weapons can trade accuracy for extra damage.",
    effects: { abilityOptions: ["strength"] },
  },
  {
    id: "heavy-armor-master",
    name: "Heavy Armor Master",
    category: "general",
    prerequisite: "Heavy armor proficiency",
    description:
      "While wearing heavy armor, reduce nonmagical bludgeoning, piercing, and slashing damage you take by your proficiency bonus.",
    effects: { abilityOptions: ["strength"] },
  },
  {
    id: "inspiring-leader",
    name: "Inspiring Leader",
    category: "general",
    description:
      "Spend 10 minutes to give allies Temporary Hit Points equal to your level + your Charisma modifier.",
    effects: { abilityOptions: ["wisdom", "charisma"] },
  },
  {
    id: "mage-slayer",
    name: "Mage Slayer",
    category: "general",
    description:
      "Pressure nearby spellcasters: punish them when they cast near you and make their Concentration saves harder.",
    effects: { abilityOptions: ["strength", "dexterity", "constitution"] },
  },
  {
    id: "observant",
    name: "Observant",
    category: "general",
    description:
      "Read lips, gain a bonus to passive Perception and Investigation, and Search as a Bonus Action.",
    effects: { abilityOptions: ["intelligence", "wisdom"] },
  },
  {
    id: "resilient",
    name: "Resilient",
    category: "general",
    description: "+1 to one ability, and gain saving-throw proficiency in that same ability.",
    effects: {
      abilityOptions: ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"],
      saveProficiency: true,
    },
  },
  {
    id: "sentinel",
    name: "Sentinel",
    category: "general",
    description:
      "Opportunity attacks reduce a target's Speed to 0, and you can strike foes that attack your nearby allies.",
    effects: { abilityOptions: ["strength", "dexterity"] },
  },
  {
    id: "shadow-touched",
    name: "Shadow Touched",
    category: "general",
    description:
      "Learn Invisibility and one 1st-level Illusion or Necromancy spell; cast each once per Long Rest for free. Add them via the Spellbook section.",
    effects: { abilityOptions: ["intelligence", "wisdom", "charisma"] },
  },
  {
    id: "sharpshooter",
    name: "Sharpshooter",
    category: "general",
    description:
      "Ignore long-range Disadvantage and cover, and ranged weapon attacks can trade accuracy for extra damage.",
    effects: { abilityOptions: ["dexterity"] },
  },
  {
    id: "shield-master",
    name: "Shield Master",
    category: "general",
    description:
      "While wielding a Shield: shove as a Bonus Action, add the Shield's AC to Dexterity saves against single-target effects, and better avoid area effects.",
    effects: { abilityOptions: ["strength"] },
  },
  {
    id: "skill-expert",
    name: "Skill Expert",
    category: "general",
    description:
      "+1 to one ability, gain proficiency in one skill, and Expertise (double proficiency) in one skill you're proficient with.",
    effects: {
      abilityOptions: ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"],
      skillChoices: 1,
      expertiseChoices: 1,
    },
  },
  {
    id: "speedy",
    name: "Speedy",
    category: "general",
    prerequisite: "Dexterity or Constitution 13+",
    description:
      "Speed +10 ft, Dash over Difficult Terrain, and avoid Opportunity Attacks from foes you've made a melee attack against this turn.",
    effects: { abilityOptions: ["dexterity", "constitution"] },
  },
  {
    id: "spell-sniper",
    name: "Spell Sniper",
    category: "general",
    prerequisite: "Spellcasting or Pact Magic",
    description:
      "Double the range of your attack-roll spells, ignore half/three-quarters cover, and learn one attack cantrip.",
    effects: { abilityOptions: ["intelligence", "wisdom", "charisma"] },
  },
  {
    id: "war-caster",
    name: "War Caster",
    category: "general",
    prerequisite: "Spellcasting or Pact Magic",
    description:
      "Advantage on Concentration saves, cast with weapon/shield in hand, and cast a spell as an Opportunity Attack.",
    effects: { abilityOptions: ["intelligence", "wisdom", "charisma"] },
  },
]

export function getFeatById(id: string): FeatData | undefined {
  return FEATS.find((f) => f.id === id)
}

// ── Feat effects: choice detection + apply/reverse ──────────────────────────

// Does this feat require the player to make a decision before it can be applied?
// A single ability option (auto +1) or a flat HP bump needs no prompt.
export function featNeedsChoices(effects?: FeatEffects): boolean {
  if (!effects) return false
  return (
    (effects.abilityOptions?.length ?? 0) > 1 ||
    (effects.skillChoices ?? 0) > 0 ||
    (effects.expertiseChoices ?? 0) > 0 ||
    !!effects.textChoice
  )
}

// Resolve a no-choice feat's grants (single-ability +1, Tough HP). Choice feats
// are resolved in the picker UI instead.
export function autoResolve(feat: FeatData, level: number): AppliedGrants {
  const e = feat.effects
  const g: AppliedGrants = {}
  if (e?.abilityOptions?.length === 1) g.ability = e.abilityOptions[0]
  if (e?.hpPerLevel) g.hp = e.hpPerLevel * level
  return g
}

// The character fields the grant helpers read/write — a structural subset of the
// Convex character doc, so this module stays decoupled from generated types.
export interface GrantTarget {
  baseAbilities: Record<Ability, number>
  savingThrowProficiencies: string[]
  skillProficiencies: string[]
  skillExpertise: string[]
  hitPoints: { current: number; max: number; temp: number }
}

type GrantPatch = Partial<
  Pick<GrantTarget, "baseAbilities" | "savingThrowProficiencies" | "skillProficiencies" | "skillExpertise" | "hitPoints">
>

// Build the character-doc patch that ADDS a feat's resolved grants. Pure — caller
// passes the result to the update mutation. Skips proficiencies already present.
export function applyGrants(char: GrantTarget, g: AppliedGrants): GrantPatch {
  const patch: GrantPatch = {}
  if (g.ability) {
    patch.baseAbilities = { ...char.baseAbilities, [g.ability]: char.baseAbilities[g.ability] + 1 }
  }
  if (g.saveProficiency && !char.savingThrowProficiencies.includes(g.saveProficiency)) {
    patch.savingThrowProficiencies = [...char.savingThrowProficiencies, g.saveProficiency]
  }
  if (g.skillProficiencies?.length) {
    const add = g.skillProficiencies.filter((s) => !char.skillProficiencies.includes(s))
    if (add.length) patch.skillProficiencies = [...char.skillProficiencies, ...add]
  }
  if (g.skillExpertise?.length) {
    const add = g.skillExpertise.filter((s) => !char.skillExpertise.includes(s))
    if (add.length) patch.skillExpertise = [...char.skillExpertise, ...add]
  }
  if (g.hp) {
    patch.hitPoints = { ...char.hitPoints, max: char.hitPoints.max + g.hp, current: char.hitPoints.current + g.hp }
  }
  return patch
}

// Build the character-doc patch that REMOVES a feat's grants (reverse of apply).
export function reverseGrants(char: GrantTarget, g: AppliedGrants): GrantPatch {
  const patch: GrantPatch = {}
  if (g.ability) {
    patch.baseAbilities = { ...char.baseAbilities, [g.ability]: Math.max(1, char.baseAbilities[g.ability] - 1) }
  }
  if (g.saveProficiency) {
    patch.savingThrowProficiencies = char.savingThrowProficiencies.filter((a) => a !== g.saveProficiency)
  }
  if (g.skillProficiencies?.length) {
    const remove = g.skillProficiencies as string[]
    patch.skillProficiencies = char.skillProficiencies.filter((s) => !remove.includes(s))
  }
  if (g.skillExpertise?.length) {
    const remove = g.skillExpertise as string[]
    patch.skillExpertise = char.skillExpertise.filter((s) => !remove.includes(s))
  }
  if (g.hp) {
    const max = Math.max(1, char.hitPoints.max - g.hp)
    patch.hitPoints = { ...char.hitPoints, max, current: Math.max(0, Math.min(char.hitPoints.current, max)) }
  }
  return patch
}

// One-line summary of what a feat's choices granted, for the Feats list.
export function appliedSummary(g: AppliedGrants): string {
  const parts: string[] = []
  if (g.ability) parts.push(`+1 ${g.ability.slice(0, 3).toUpperCase()}`)
  if (g.saveProficiency) parts.push(`${g.saveProficiency.slice(0, 3).toUpperCase()} save prof`)
  if (g.skillProficiencies?.length) parts.push(`prof: ${g.skillProficiencies.join(", ")}`)
  if (g.skillExpertise?.length) parts.push(`expertise: ${g.skillExpertise.join(", ")}`)
  if (g.hp) parts.push(`+${g.hp} HP`)
  return parts.join(" · ")
}
