export interface Condition {
  name: string
  description: string
  effects: string[]
}

export const CONDITIONS: Condition[] = [
  {
    name: "Blinded",
    description: "A blinded creature can't see and automatically fails any ability check that requires sight.",
    effects: [
      "A blinded creature can't see",
      "Automatically fails ability checks requiring sight",
      "Attack rolls against the creature have Advantage",
      "The creature's attack rolls have Disadvantage",
    ],
  },
  {
    name: "Charmed",
    description:
      "A charmed creature can't attack the charmer or target the charmer with harmful abilities or magical effects.",
    effects: [
      "Can't attack the charmer",
      "Can't target the charmer with harmful abilities or magical effects",
      "The charmer has Advantage on ability checks to interact socially with the creature",
    ],
  },
  {
    name: "Deafened",
    description: "A deafened creature can't hear and automatically fails any ability check that requires hearing.",
    effects: ["Can't hear", "Automatically fails ability checks requiring hearing"],
  },
  {
    name: "Exhaustion",
    description:
      "Some special abilities and environmental hazards, such as starvation and the long-term effects of freezing or scorching temperatures, can lead to exhaustion.",
    effects: [
      "Level 1: Disadvantage on ability checks",
      "Level 2: Speed halved",
      "Level 3: Disadvantage on attack rolls and saving throws",
      "Level 4: Hit point maximum halved",
      "Level 5: Speed reduced to 0",
      "Level 6: Death",
    ],
  },
  {
    name: "Frightened",
    description:
      "A frightened creature has Disadvantage on ability checks and attack rolls while the source of its fear is within line of sight.",
    effects: [
      "Disadvantage on ability checks while source of fear is visible",
      "Disadvantage on attack rolls while source of fear is visible",
      "Can't willingly move closer to the source of its fear",
    ],
  },
  {
    name: "Grappled",
    description: "A grappled creature's Speed becomes 0, and it can't benefit from any bonus to its Speed.",
    effects: [
      "Speed becomes 0",
      "Can't benefit from any bonus to Speed",
      "The condition ends if the grappler is Incapacitated",
      "The condition ends if the grappled creature is removed from the grappler's reach",
    ],
  },
  {
    name: "Incapacitated",
    description: "An incapacitated creature can't take actions or reactions.",
    effects: ["Can't take actions", "Can't take reactions"],
  },
  {
    name: "Invisible",
    description:
      "An invisible creature is impossible to see without the aid of magic or a special sense. The creature's location can be detected by noise or tracks.",
    effects: [
      "Impossible to see without magic or special sense",
      "Considered Heavily Obscured for hiding purposes",
      "Attack rolls against the creature have Disadvantage",
      "The creature's attack rolls have Advantage",
    ],
  },
  {
    name: "Paralyzed",
    description: "A paralyzed creature is Incapacitated and can't move or speak.",
    effects: [
      "Incapacitated (can't take actions or reactions)",
      "Can't move or speak",
      "Automatically fails Strength and Dexterity saving throws",
      "Attack rolls against the creature have Advantage",
      "Any attack that hits is a critical hit if the attacker is within 5 feet",
    ],
  },
  {
    name: "Petrified",
    description:
      "A petrified creature is transformed, along with any nonmagical object it is wearing or carrying, into a solid inanimate substance (usually stone).",
    effects: [
      "Transformed into solid inanimate substance",
      "Weight increases by a factor of ten",
      "Ceases aging",
      "Incapacitated, can't move or speak, unaware of surroundings",
      "Attack rolls against the creature have Advantage",
      "Automatically fails Strength and Dexterity saving throws",
      "Resistance to all damage",
      "Immune to poison and disease (existing poison/disease suspended)",
    ],
  },
  {
    name: "Poisoned",
    description: "A poisoned creature has Disadvantage on attack rolls and ability checks.",
    effects: ["Disadvantage on attack rolls", "Disadvantage on ability checks"],
  },
  {
    name: "Prone",
    description:
      "A prone creature's only movement option is to crawl, unless it stands up and thereby ends the condition.",
    effects: [
      "Only movement option is to crawl",
      "Disadvantage on attack rolls",
      "Attack rolls have Advantage if attacker is within 5 feet",
      "Attack rolls have Disadvantage if attacker is more than 5 feet away",
    ],
  },
  {
    name: "Restrained",
    description: "A restrained creature's Speed becomes 0, and it can't benefit from any bonus to its Speed.",
    effects: [
      "Speed becomes 0",
      "Can't benefit from any bonus to Speed",
      "Attack rolls against the creature have Advantage",
      "The creature's attack rolls have Disadvantage",
      "Disadvantage on Dexterity saving throws",
    ],
  },
  {
    name: "Stunned",
    description: "A stunned creature is Incapacitated, can't move, and can speak only falteringly.",
    effects: [
      "Incapacitated (can't take actions or reactions)",
      "Can't move",
      "Can speak only falteringly",
      "Automatically fails Strength and Dexterity saving throws",
      "Attack rolls against the creature have Advantage",
    ],
  },
  {
    name: "Unconscious",
    description:
      "An unconscious creature is Incapacitated, can't move or speak, and is unaware of its surroundings. The creature drops whatever it's holding and falls Prone.",
    effects: [
      "Incapacitated (can't take actions or reactions)",
      "Can't move or speak",
      "Unaware of surroundings",
      "Drops whatever it's holding",
      "Falls Prone",
      "Automatically fails Strength and Dexterity saving throws",
      "Attack rolls against the creature have Advantage",
      "Any attack that hits is a critical hit if the attacker is within 5 feet",
    ],
  },
]
