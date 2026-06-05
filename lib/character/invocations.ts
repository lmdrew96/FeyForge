/**
 * Eldritch Invocations — the Warlock's choose-from-a-list customization. Unlike the
 * automatic class/subclass grants in class-grants.ts (derived live), invocations are
 * PLAYER CHOICES, so they're stored (feat-like): a curated list + a count-limited,
 * prerequisite-aware picker, persisted as `characterProperties` rows (type
 * "invocation"). 2014 ruleset. Content is original paraphrase of game mechanics.
 */

export interface InvocationData {
  id: string
  name: string
  /** Original paraphrase of the mechanic. */
  description: string
  /** Minimum warlock level — HARD-gated in the picker. */
  minLevel?: number
  /** Advisory prerequisite (Pact Boon, a known spell) — shown, not enforced, since
   *  FeyForge doesn't track the Pact Boon choice yet. */
  prerequisite?: string
}

// The Warlock's "Eldritch Invocations Known" by level (2014 PHB), index = level-1.
const KNOWN_BY_LEVEL = [0, 2, 2, 2, 3, 3, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8]

export function invocationsKnown(warlockLevel: number): number {
  const l = Math.max(1, Math.min(20, Math.round(warlockLevel)))
  return KNOWN_BY_LEVEL[l - 1]
}

// Curated subset of the iconic 2014 invocations. Pact/spell prerequisites are
// advisory text; warlock-level prerequisites are hard-gated.
export const INVOCATIONS: InvocationData[] = [
  { id: "agonizing-blast", name: "Agonizing Blast", description: "Add your Charisma modifier to the damage of each beam of your eldritch blast.", prerequisite: "eldritch blast cantrip" },
  { id: "armor-of-shadows", name: "Armor of Shadows", description: "Cast mage armor on yourself at will, without expending a spell slot or material components." },
  { id: "beast-speech", name: "Beast Speech", description: "Cast speak with animals at will." },
  { id: "beguiling-influence", name: "Beguiling Influence", description: "Gain proficiency in the Deception and Persuasion skills." },
  { id: "book-of-ancient-secrets", name: "Book of Ancient Secrets", description: "Inscribe two 1st-level ritual spells in your Book of Shadows and cast them as rituals; you can copy further ritual spells you find.", prerequisite: "Pact of the Tome" },
  { id: "devils-sight", name: "Devil's Sight", description: "See normally in both magical and nonmagical darkness out to 120 feet." },
  { id: "eldritch-sight", name: "Eldritch Sight", description: "Cast detect magic at will, without expending a spell slot." },
  { id: "eldritch-spear", name: "Eldritch Spear", description: "Your eldritch blast gains a range of 300 feet.", prerequisite: "eldritch blast cantrip" },
  { id: "eyes-of-the-rune-keeper", name: "Eyes of the Rune Keeper", description: "You can read all writing." },
  { id: "fiendish-vigor", name: "Fiendish Vigor", description: "Cast false life on yourself at will as a 1st-level spell, without expending a slot." },
  { id: "gaze-of-two-minds", name: "Gaze of Two Minds", description: "Touch a willing humanoid to perceive through its senses until the end of your next turn." },
  { id: "mask-of-many-faces", name: "Mask of Many Faces", description: "Cast disguise self at will, without expending a spell slot." },
  { id: "misty-visions", name: "Misty Visions", description: "Cast silent image at will, without expending a spell slot or material components." },
  { id: "repelling-blast", name: "Repelling Blast", description: "When you hit a creature with eldritch blast, you can push it up to 10 feet away.", prerequisite: "eldritch blast cantrip" },
  { id: "thief-of-five-fates", name: "Thief of Five Fates", description: "Cast bane once using a warlock spell slot; you regain the ability on a long rest." },
  { id: "mire-the-mind", name: "Mire the Mind", description: "Cast slow once using a warlock spell slot; you regain it on a long rest.", minLevel: 5 },
  { id: "one-with-shadows", name: "One with Shadows", description: "In dim light or darkness, use your action to become invisible until you move or take an action or reaction.", minLevel: 5 },
  { id: "sign-of-ill-omen", name: "Sign of Ill Omen", description: "Cast bestow curse once using a warlock spell slot; you regain it on a long rest.", minLevel: 5 },
  { id: "thirsting-blade", name: "Thirsting Blade", description: "You can attack twice, instead of once, whenever you take the Attack action with your pact weapon.", minLevel: 5, prerequisite: "Pact of the Blade" },
  { id: "bewitching-whispers", name: "Bewitching Whispers", description: "Cast compulsion once using a warlock spell slot; you regain it on a long rest.", minLevel: 7 },
  { id: "dreadful-word", name: "Dreadful Word", description: "Cast confusion once using a warlock spell slot; you regain it on a long rest.", minLevel: 7 },
  { id: "sculptor-of-flesh", name: "Sculptor of Flesh", description: "Cast polymorph once using a warlock spell slot; you regain it on a long rest.", minLevel: 7 },
  { id: "ascendant-step", name: "Ascendant Step", description: "Cast levitate on yourself at will, without expending a spell slot.", minLevel: 9 },
  { id: "whispers-of-the-grave", name: "Whispers of the Grave", description: "Cast speak with dead at will.", minLevel: 9 },
  { id: "lifedrinker", name: "Lifedrinker", description: "When you hit with your pact weapon, it deals extra necrotic damage equal to your Charisma modifier (minimum 1).", minLevel: 12, prerequisite: "Pact of the Blade" },
  { id: "master-of-myriad-forms", name: "Master of Myriad Forms", description: "Cast alter self at will, without expending a spell slot.", minLevel: 15 },
  { id: "witch-sight", name: "Witch Sight", description: "See the true form of any shapechanger or creature concealed by illusion or transmutation magic within 30 feet.", minLevel: 15 },
]

export function getInvocationById(id: string): InvocationData | undefined {
  return INVOCATIONS.find((i) => i.id === id)
}
