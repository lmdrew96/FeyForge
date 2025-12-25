export interface Monster {
  name: string
  size: string
  type: string
  alignment: string
  ac: number
  acType?: string
  hp: number
  hitDice: string
  speed: string
  abilities: {
    str: number
    dex: number
    con: number
    int: number
    wis: number
    cha: number
  }
  savingThrows?: string
  skills?: string
  resistances?: string
  immunities?: string
  conditionImmunities?: string
  senses: string
  languages: string
  cr: string
  xp: number
  traits?: { name: string; description: string }[]
  actions: { name: string; description: string }[]
  legendaryActions?: { name: string; description: string }[]
}

export const MONSTERS: Monster[] = [
  // CR 0-1/4
  {
    name: "Commoner",
    size: "Medium",
    type: "Humanoid",
    alignment: "Any Alignment",
    ac: 10,
    hp: 4,
    hitDice: "1d8",
    speed: "30 ft.",
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    senses: "Passive Perception 10",
    languages: "Common",
    cr: "0",
    xp: 10,
    actions: [{ name: "Rake", description: "Melee Attack Roll: +1, reach 5 ft. Hit: 1 Slashing damage." }],
  },
  {
    name: "Goblin",
    size: "Small",
    type: "Humanoid (Goblinoid)",
    alignment: "Neutral Evil",
    ac: 15,
    acType: "leather armor, shield",
    hp: 7,
    hitDice: "2d6",
    speed: "30 ft.",
    abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
    skills: "Stealth +6",
    senses: "Darkvision 60 ft., Passive Perception 9",
    languages: "Common, Goblin",
    cr: "1/4",
    xp: 50,
    traits: [
      {
        name: "Nimble Escape",
        description: "The goblin can take the Disengage or Hide action as a Bonus Action.",
      },
    ],
    actions: [
      { name: "Scimitar", description: "Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Slashing damage." },
      {
        name: "Shortbow",
        description: "Ranged Attack Roll: +4, range 80/320 ft. Hit: 5 (1d6 + 2) Piercing damage.",
      },
    ],
  },
  {
    name: "Skeleton",
    size: "Medium",
    type: "Undead",
    alignment: "Lawful Evil",
    ac: 13,
    acType: "armor scraps",
    hp: 13,
    hitDice: "2d8 + 4",
    speed: "30 ft.",
    abilities: { str: 10, dex: 14, con: 15, int: 6, wis: 8, cha: 5 },
    immunities: "Poison",
    conditionImmunities: "Exhaustion, Poisoned",
    senses: "Darkvision 60 ft., Passive Perception 9",
    languages: "Understands languages it knew in life but can't speak",
    cr: "1/4",
    xp: 50,
    actions: [
      { name: "Shortsword", description: "Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Piercing damage." },
      {
        name: "Shortbow",
        description: "Ranged Attack Roll: +4, range 80/320 ft. Hit: 5 (1d6 + 2) Piercing damage.",
      },
    ],
  },
  {
    name: "Zombie",
    size: "Medium",
    type: "Undead",
    alignment: "Neutral Evil",
    ac: 8,
    hp: 22,
    hitDice: "3d8 + 9",
    speed: "20 ft.",
    abilities: { str: 13, dex: 6, con: 16, int: 3, wis: 6, cha: 5 },
    savingThrows: "Wis +0",
    immunities: "Poison",
    conditionImmunities: "Poisoned",
    senses: "Darkvision 60 ft., Passive Perception 8",
    languages: "Understands languages it knew in life but can't speak",
    cr: "1/4",
    xp: 50,
    traits: [
      {
        name: "Undead Fortitude",
        description:
          "If damage reduces the zombie to 0 HP, it makes a Constitution saving throw with a DC of 5 + the damage taken, unless the damage is radiant or from a critical hit. On a success, the zombie drops to 1 HP instead.",
      },
    ],
    actions: [{ name: "Slam", description: "Melee Attack Roll: +3, reach 5 ft. Hit: 4 (1d6 + 1) Bludgeoning damage." }],
  },

  // CR 1/2 - 1
  {
    name: "Orc",
    size: "Medium",
    type: "Humanoid (Orc)",
    alignment: "Chaotic Evil",
    ac: 13,
    acType: "hide armor",
    hp: 15,
    hitDice: "2d8 + 6",
    speed: "30 ft.",
    abilities: { str: 16, dex: 12, con: 16, int: 7, wis: 11, cha: 10 },
    skills: "Intimidation +2",
    senses: "Darkvision 60 ft., Passive Perception 10",
    languages: "Common, Orc",
    cr: "1/2",
    xp: 100,
    traits: [
      {
        name: "Aggressive",
        description: "As a Bonus Action, the orc can move up to its Speed toward a hostile creature that it can see.",
      },
    ],
    actions: [
      { name: "Greataxe", description: "Melee Attack Roll: +5, reach 5 ft. Hit: 9 (1d12 + 3) Slashing damage." },
      {
        name: "Javelin",
        description:
          "Melee or Ranged Attack Roll: +5, reach 5 ft. or range 30/120 ft. Hit: 6 (1d6 + 3) Piercing damage.",
      },
    ],
  },
  {
    name: "Bugbear",
    size: "Medium",
    type: "Humanoid (Goblinoid)",
    alignment: "Chaotic Evil",
    ac: 16,
    acType: "hide armor, shield",
    hp: 27,
    hitDice: "5d8 + 5",
    speed: "30 ft.",
    abilities: { str: 15, dex: 14, con: 13, int: 8, wis: 11, cha: 9 },
    skills: "Stealth +6, Survival +2",
    senses: "Darkvision 60 ft., Passive Perception 10",
    languages: "Common, Goblin",
    cr: "1",
    xp: 200,
    traits: [
      {
        name: "Surprise Attack",
        description:
          "If the bugbear hits a creature that is Surprised, the target takes an extra 7 (2d6) damage from the attack.",
      },
    ],
    actions: [
      { name: "Morningstar", description: "Melee Attack Roll: +4, reach 5 ft. Hit: 11 (2d8 + 2) Piercing damage." },
      {
        name: "Javelin",
        description:
          "Melee or Ranged Attack Roll: +4, reach 5 ft. or range 30/120 ft. Hit: 9 (2d6 + 2) Piercing damage.",
      },
    ],
  },

  // CR 2-3
  {
    name: "Ogre",
    size: "Large",
    type: "Giant",
    alignment: "Chaotic Evil",
    ac: 11,
    acType: "hide armor",
    hp: 59,
    hitDice: "7d10 + 21",
    speed: "40 ft.",
    abilities: { str: 19, dex: 8, con: 16, int: 5, wis: 7, cha: 7 },
    senses: "Darkvision 60 ft., Passive Perception 8",
    languages: "Common, Giant",
    cr: "2",
    xp: 450,
    actions: [
      { name: "Greatclub", description: "Melee Attack Roll: +6, reach 5 ft. Hit: 13 (2d8 + 4) Bludgeoning damage." },
      {
        name: "Javelin",
        description:
          "Melee or Ranged Attack Roll: +6, reach 5 ft. or range 30/120 ft. Hit: 11 (2d6 + 4) Piercing damage.",
      },
    ],
  },
  {
    name: "Owlbear",
    size: "Large",
    type: "Monstrosity",
    alignment: "Unaligned",
    ac: 13,
    acType: "natural armor",
    hp: 59,
    hitDice: "7d10 + 21",
    speed: "40 ft.",
    abilities: { str: 20, dex: 12, con: 17, int: 3, wis: 12, cha: 7 },
    skills: "Perception +3",
    senses: "Darkvision 60 ft., Passive Perception 13",
    languages: "—",
    cr: "3",
    xp: 700,
    traits: [
      {
        name: "Keen Sight and Smell",
        description: "The owlbear has Advantage on Wisdom (Perception) checks that rely on sight or smell.",
      },
    ],
    actions: [
      {
        name: "Multiattack",
        description: "The owlbear makes two attacks: one with its beak and one with its claws.",
      },
      { name: "Beak", description: "Melee Attack Roll: +7, reach 5 ft. Hit: 10 (1d10 + 5) Piercing damage." },
      { name: "Claws", description: "Melee Attack Roll: +7, reach 5 ft. Hit: 14 (2d8 + 5) Slashing damage." },
    ],
  },
  {
    name: "Mimic",
    size: "Medium",
    type: "Monstrosity",
    alignment: "Neutral",
    ac: 12,
    acType: "natural armor",
    hp: 58,
    hitDice: "9d8 + 18",
    speed: "15 ft.",
    abilities: { str: 17, dex: 12, con: 15, int: 5, wis: 13, cha: 8 },
    skills: "Stealth +5",
    immunities: "Acid",
    conditionImmunities: "Prone",
    senses: "Darkvision 60 ft., Passive Perception 11",
    languages: "—",
    cr: "2",
    xp: 450,
    traits: [
      {
        name: "False Appearance (Object Form Only)",
        description: "While the mimic remains motionless, it is indistinguishable from an ordinary object.",
      },
      {
        name: "Adhesive (Object Form Only)",
        description:
          "The mimic adheres to anything that touches it. A creature adhered to the mimic is also Grappled by it (escape DC 13).",
      },
    ],
    actions: [
      {
        name: "Pseudopod",
        description: "Melee Attack Roll: +5, reach 5 ft. Hit: 7 (1d8 + 3) Bludgeoning damage plus 4 (1d8) Acid damage.",
      },
      {
        name: "Bite",
        description: "Melee Attack Roll: +5, reach 5 ft. Hit: 7 (1d8 + 3) Piercing damage plus 4 (1d8) Acid damage.",
      },
    ],
  },

  // CR 4-6
  {
    name: "Troll",
    size: "Large",
    type: "Giant",
    alignment: "Chaotic Evil",
    ac: 15,
    acType: "natural armor",
    hp: 84,
    hitDice: "8d10 + 40",
    speed: "30 ft.",
    abilities: { str: 18, dex: 13, con: 20, int: 7, wis: 9, cha: 7 },
    skills: "Perception +2",
    senses: "Darkvision 60 ft., Passive Perception 12",
    languages: "Giant",
    cr: "5",
    xp: 1800,
    traits: [
      {
        name: "Regeneration",
        description:
          "The troll regains 10 Hit Points at the start of its turn. If the troll takes Fire or Acid damage, this trait doesn't function at the start of the troll's next turn. The troll dies only if it starts its turn with 0 Hit Points and doesn't regenerate.",
      },
    ],
    actions: [
      { name: "Multiattack", description: "The troll makes three attacks: one with its bite and two with its claws." },
      { name: "Bite", description: "Melee Attack Roll: +7, reach 5 ft. Hit: 7 (1d6 + 4) Piercing damage." },
      { name: "Claw", description: "Melee Attack Roll: +7, reach 5 ft. Hit: 11 (2d6 + 4) Slashing damage." },
    ],
  },
  {
    name: "Young Black Dragon",
    size: "Large",
    type: "Dragon",
    alignment: "Chaotic Evil",
    ac: 18,
    acType: "natural armor",
    hp: 127,
    hitDice: "15d10 + 45",
    speed: "40 ft., fly 80 ft., swim 40 ft.",
    abilities: { str: 19, dex: 14, con: 17, int: 12, wis: 11, cha: 15 },
    savingThrows: "Dex +5, Con +6, Wis +3, Cha +5",
    skills: "Perception +6, Stealth +5",
    immunities: "Acid",
    senses: "Blindsight 30 ft., Darkvision 120 ft., Passive Perception 16",
    languages: "Common, Draconic",
    cr: "7",
    xp: 2900,
    traits: [
      {
        name: "Amphibious",
        description: "The dragon can breathe air and water.",
      },
    ],
    actions: [
      {
        name: "Multiattack",
        description: "The dragon makes three attacks: one with its bite and two with its claws.",
      },
      {
        name: "Bite",
        description: "Melee Attack Roll: +7, reach 10 ft. Hit: 15 (2d10 + 4) Piercing damage plus 4 (1d8) Acid damage.",
      },
      { name: "Claw", description: "Melee Attack Roll: +7, reach 5 ft. Hit: 11 (2d6 + 4) Slashing damage." },
      {
        name: "Acid Breath (Recharge 5-6)",
        description:
          "The dragon exhales acid in a 30-foot line that is 5 feet wide. Each creature in that line makes a DC 14 Dexterity saving throw, taking 49 (11d8) Acid damage on a failed save or half as much on a successful one.",
      },
    ],
  },

  // CR 8+
  {
    name: "Adult Black Dragon",
    size: "Huge",
    type: "Dragon",
    alignment: "Chaotic Evil",
    ac: 19,
    acType: "natural armor",
    hp: 195,
    hitDice: "17d12 + 85",
    speed: "40 ft., fly 80 ft., swim 40 ft.",
    abilities: { str: 23, dex: 14, con: 21, int: 14, wis: 13, cha: 17 },
    savingThrows: "Dex +7, Con +10, Wis +6, Cha +8",
    skills: "Perception +11, Stealth +7",
    immunities: "Acid",
    senses: "Blindsight 60 ft., Darkvision 120 ft., Passive Perception 21",
    languages: "Common, Draconic",
    cr: "14",
    xp: 11500,
    traits: [
      { name: "Amphibious", description: "The dragon can breathe air and water." },
      {
        name: "Legendary Resistance (3/Day)",
        description: "If the dragon fails a saving throw, it can choose to succeed instead.",
      },
    ],
    actions: [
      {
        name: "Multiattack",
        description:
          "The dragon can use its Frightful Presence. It then makes three attacks: one with its bite and two with its claws.",
      },
      {
        name: "Bite",
        description:
          "Melee Attack Roll: +11, reach 10 ft. Hit: 17 (2d10 + 6) Piercing damage plus 4 (1d8) Acid damage.",
      },
      { name: "Claw", description: "Melee Attack Roll: +11, reach 5 ft. Hit: 13 (2d6 + 6) Slashing damage." },
      { name: "Tail", description: "Melee Attack Roll: +11, reach 15 ft. Hit: 15 (2d8 + 6) Bludgeoning damage." },
      {
        name: "Frightful Presence",
        description:
          "Each creature of the dragon's choice that is within 120 feet of the dragon and aware of it must succeed on a DC 16 Wisdom saving throw or become Frightened for 1 minute.",
      },
      {
        name: "Acid Breath (Recharge 5-6)",
        description:
          "The dragon exhales acid in a 60-foot line that is 5 feet wide. Each creature in that line makes a DC 18 Dexterity saving throw, taking 54 (12d8) Acid damage on a failed save or half as much on a successful one.",
      },
    ],
    legendaryActions: [
      { name: "Detect", description: "The dragon makes a Wisdom (Perception) check." },
      { name: "Tail Attack", description: "The dragon makes a tail attack." },
      {
        name: "Wing Attack (Costs 2 Actions)",
        description:
          "The dragon beats its wings. Each creature within 10 feet of the dragon must succeed on a DC 19 Dexterity saving throw or take 13 (2d6 + 6) Bludgeoning damage and be knocked Prone. The dragon can then fly up to half its flying speed.",
      },
    ],
  },
  {
    name: "Beholder",
    size: "Large",
    type: "Aberration",
    alignment: "Lawful Evil",
    ac: 18,
    acType: "natural armor",
    hp: 180,
    hitDice: "19d10 + 76",
    speed: "0 ft., fly 20 ft. (hover)",
    abilities: { str: 10, dex: 14, con: 18, int: 17, wis: 15, cha: 17 },
    savingThrows: "Int +8, Wis +7, Cha +8",
    skills: "Perception +12",
    conditionImmunities: "Prone",
    senses: "Darkvision 120 ft., Passive Perception 22",
    languages: "Deep Speech, Undercommon",
    cr: "13",
    xp: 10000,
    traits: [
      {
        name: "Antimagic Cone",
        description:
          "The beholder's central eye creates an area of antimagic, as in the Antimagic Field spell, in a 150-foot cone. At the start of each of its turns, the beholder decides which way the cone faces and whether the cone is active.",
      },
    ],
    actions: [
      {
        name: "Bite",
        description: "Melee Attack Roll: +5, reach 5 ft. Hit: 14 (4d6) Piercing damage.",
      },
      {
        name: "Eye Rays",
        description:
          "The beholder shoots three of its eye rays at random, choosing one to three targets it can see within 120 feet of it. Each ray has different effects (Charm, Paralyzing, Fear, Slowing, Enervation, Telekinetic, Sleep, Petrification, Disintegration, or Death Ray).",
      },
    ],
    legendaryActions: [{ name: "Eye Ray", description: "The beholder uses one random eye ray." }],
  },
  {
    name: "Lich",
    size: "Medium",
    type: "Undead",
    alignment: "Any Evil Alignment",
    ac: 17,
    acType: "natural armor",
    hp: 135,
    hitDice: "18d8 + 54",
    speed: "30 ft.",
    abilities: { str: 11, dex: 16, con: 16, int: 20, wis: 14, cha: 16 },
    savingThrows: "Con +10, Int +12, Wis +9",
    skills: "Arcana +18, History +12, Insight +9, Perception +9",
    resistances: "Cold, Lightning, Necrotic",
    immunities: "Poison; Bludgeoning, Piercing, Slashing from Nonmagical Attacks",
    conditionImmunities: "Charmed, Exhaustion, Frightened, Paralyzed, Poisoned",
    senses: "Truesight 120 ft., Passive Perception 19",
    languages: "Common plus up to five other languages",
    cr: "21",
    xp: 33000,
    traits: [
      {
        name: "Legendary Resistance (3/Day)",
        description: "If the lich fails a saving throw, it can choose to succeed instead.",
      },
      {
        name: "Rejuvenation",
        description:
          "If it has a phylactery, a destroyed lich gains a new body in 1d10 days, regaining all its Hit Points and becoming active again. The new body appears within 5 feet of the phylactery.",
      },
      {
        name: "Spellcasting",
        description:
          "The lich is an 18th-level spellcaster. Its spellcasting ability is Intelligence (spell save DC 20, +12 to hit with spell attacks). The lich has the following wizard spells prepared and can cast at will: Detect Magic, Invisibility (self only), Mage Hand, Prestidigitation.",
      },
    ],
    actions: [
      {
        name: "Paralyzing Touch",
        description:
          "Melee Spell Attack: +12, reach 5 ft. Hit: 10 (3d6) Cold damage. The target must succeed on a DC 18 Constitution saving throw or be Paralyzed for 1 minute. The target can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success.",
      },
    ],
    legendaryActions: [
      { name: "Cantrip", description: "The lich casts a cantrip." },
      {
        name: "Paralyzing Touch (Costs 2 Actions)",
        description: "The lich uses its Paralyzing Touch.",
      },
      {
        name: "Frightening Gaze (Costs 2 Actions)",
        description:
          "The lich fixes its gaze on one creature it can see within 10 feet of it. The target must succeed on a DC 18 Wisdom saving throw against this magic or become Frightened for 1 minute.",
      },
      {
        name: "Disrupt Life (Costs 3 Actions)",
        description:
          "Each non-undead creature within 20 feet of the lich must make a DC 18 Constitution saving throw against this magic, taking 21 (6d6) Necrotic damage on a failed save, or half as much damage on a successful one.",
      },
    ],
  },
]
