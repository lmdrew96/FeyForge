/**
 * Battle Master maneuvers — the Fighter subclass's choose-from-a-list feature.
 * Same shape as warlock invocations (a player CHOICE, so stored, not derived):
 * a curated list + a count-limited picker, persisted as `characterProperties`
 * rows (type "maneuver"). Superiority dice (the resource maneuvers spend) live in
 * getClassResources, gated on the Battle Master subclass. 2014 ruleset; original
 * paraphrase of game mechanics.
 */

export interface ManeuverData {
  id: string
  name: string
  description: string
}

// Maneuvers known by fighter level (2014): 3 at L3, 5 at L7, 7 at L10, 9 at L15.
export function maneuversKnown(level: number): number {
  const l = Math.max(1, Math.min(20, Math.round(level)))
  if (l >= 15) return 9
  if (l >= 10) return 7
  if (l >= 7) return 5
  if (l >= 3) return 3
  return 0
}

export interface SuperiorityDice {
  count: number
  dieSize: number
}

// Superiority dice by fighter level (2014): 4 at L3, 5 at L7, 6 at L15; the die
// grows from d8 → d10 at L10 → d12 at L18.
export function superiorityDice(level: number): SuperiorityDice {
  const l = Math.max(1, Math.min(20, Math.round(level)))
  const count = l >= 15 ? 6 : l >= 7 ? 5 : l >= 3 ? 4 : 0
  const dieSize = l >= 18 ? 12 : l >= 10 ? 10 : 8
  return { count, dieSize }
}

export const MANEUVERS: ManeuverData[] = [
  { id: "commanders-strike", name: "Commander's Strike", description: "When you take the Attack action, forgo one attack and use a bonus action to direct an ally; they can immediately use their reaction to make one weapon attack, adding the superiority die to the damage." },
  { id: "disarming-attack", name: "Disarming Attack", description: "On a hit, add the superiority die to the damage and force the target to make a Strength save or drop one item it's holding." },
  { id: "distracting-strike", name: "Distracting Strike", description: "On a hit, add the superiority die to the damage; the next attack against that target by another creature has advantage." },
  { id: "evasive-footwork", name: "Evasive Footwork", description: "When you move, roll the superiority die and add it to your AC until you stop moving." },
  { id: "feinting-attack", name: "Feinting Attack", description: "Use a bonus action to feint against a creature within 5 feet, gaining advantage on your next attack against it this turn; on a hit, add the superiority die to the damage." },
  { id: "goading-attack", name: "Goading Attack", description: "On a hit, add the superiority die to the damage and force a Wisdom save or the target has disadvantage attacking anyone but you until your next turn." },
  { id: "lunging-attack", name: "Lunging Attack", description: "Increase your reach by 5 feet for one attack; on a hit, add the superiority die to the damage." },
  { id: "maneuvering-attack", name: "Maneuvering Attack", description: "On a hit, add the superiority die to the damage and let an ally you can see use its reaction to move up to half its speed without provoking an opportunity attack from the target." },
  { id: "menacing-attack", name: "Menacing Attack", description: "On a hit, add the superiority die to the damage and force a Wisdom save or the target is frightened of you until your next turn." },
  { id: "parry", name: "Parry", description: "As a reaction when hit by a melee attack, reduce the damage by the superiority die roll plus your Dexterity modifier." },
  { id: "precision-attack", name: "Precision Attack", description: "Add the superiority die to a weapon attack roll — you can use it before or after rolling, but before the outcome is known." },
  { id: "pushing-attack", name: "Pushing Attack", description: "On a hit against a Large or smaller creature, add the superiority die to the damage and force a Strength save or push it up to 15 feet away." },
  { id: "rally", name: "Rally", description: "Use a bonus action to grant a chosen ally temporary hit points equal to the superiority die roll plus your Charisma modifier." },
  { id: "riposte", name: "Riposte", description: "As a reaction when a creature misses you with a melee attack, make a melee weapon attack against it, adding the superiority die to the damage." },
  { id: "sweeping-attack", name: "Sweeping Attack", description: "When you hit a creature with a melee weapon attack, choose another creature within 5 feet and in reach; if your roll would hit it, it takes superiority-die damage of the attack's type." },
  { id: "trip-attack", name: "Trip Attack", description: "On a hit against a Large or smaller creature, add the superiority die to the damage and force a Strength save or knock it prone." },
]

export function getManeuverById(id: string): ManeuverData | undefined {
  return MANEUVERS.find((m) => m.id === id)
}
