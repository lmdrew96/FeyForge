import type { Skill, Ability } from "./constants"

// ─── Races ───────────────────────────────────────────────────────────────────

export interface SubraceData {
  id: string
  name: string
  description: string
  abilityBonuses: Partial<Record<Ability, number>>
  traits: string[]
  speed?: number
  // Explicit darkvision range in feet. Optional on curated subraces (derived from
  // trait strings); homebrew sets it directly. See deriveDarkvision.
  darkvision?: number
}

export interface RaceData {
  id: string
  name: string
  description: string
  size: string
  speed: number
  abilityBonuses: Partial<Record<Ability, number>>
  traits: string[]
  languages: string[]
  subraces?: SubraceData[]
  // Explicit darkvision range in feet. Optional on curated races (derived from
  // trait strings); homebrew sets it directly. See deriveDarkvision.
  darkvision?: number
  // True for user-authored homebrew merged into the builder, so the UI can badge it.
  homebrew?: boolean
}

export const RACES: RaceData[] = [
  {
    id: "human",
    name: "Human",
    description: "The most adaptable and ambitious people in the world.",
    size: "Medium",
    speed: 30,
    abilityBonuses: { strength: 1, dexterity: 1, constitution: 1, intelligence: 1, wisdom: 1, charisma: 1 },
    traits: ["Extra Language", "Extra Skill"],
    languages: ["Common", "One of your choice"],
  },
  {
    id: "elf",
    name: "Elf",
    description: "Elves are a magical people of otherworldly grace.",
    size: "Medium",
    speed: 30,
    abilityBonuses: { dexterity: 2 },
    traits: ["Darkvision", "Keen Senses", "Fey Ancestry", "Trance"],
    languages: ["Common", "Elvish"],
    subraces: [
      {
        id: "high-elf",
        name: "High Elf",
        description: "High elves have a keen mind and a mastery of at least the basics of magic.",
        abilityBonuses: { intelligence: 1 },
        traits: ["Elf Weapon Training", "Cantrip", "Extra Language"],
      },
      {
        id: "wood-elf",
        name: "Wood Elf",
        description: "Wood elves have keen senses and intuition, and their fleet feet carry them quickly.",
        abilityBonuses: { wisdom: 1 },
        traits: ["Elf Weapon Training", "Fleet of Foot", "Mask of the Wild"],
        speed: 35,
      },
      {
        id: "dark-elf",
        name: "Dark Elf (Drow)",
        description: "Drow have been cast out from their homeland and now navigate the surface world.",
        abilityBonuses: { charisma: 1 },
        traits: ["Superior Darkvision", "Sunlight Sensitivity", "Drow Magic", "Drow Weapon Training"],
      },
    ],
  },
  {
    id: "dwarf",
    name: "Dwarf",
    description: "Bold and hardy, dwarves are known for their skill in warfare and mastery of stone.",
    size: "Medium",
    speed: 25,
    abilityBonuses: { constitution: 2 },
    traits: ["Darkvision", "Dwarven Resilience", "Dwarven Combat Training", "Stonecunning"],
    languages: ["Common", "Dwarvish"],
    subraces: [
      {
        id: "hill-dwarf",
        name: "Hill Dwarf",
        description: "Hill dwarves are known for their wisdom and toughness.",
        abilityBonuses: { wisdom: 1 },
        traits: ["Dwarven Toughness"],
      },
      {
        id: "mountain-dwarf",
        name: "Mountain Dwarf",
        description: "Mountain dwarves are strong and hardy, accustomed to difficult terrain.",
        abilityBonuses: { strength: 2 },
        traits: ["Dwarven Armor Training"],
      },
    ],
  },
  {
    id: "halfling",
    name: "Halfling",
    description: "The diminutive halflings survive in a world full of larger creatures by avoiding notice.",
    size: "Small",
    speed: 25,
    abilityBonuses: { dexterity: 2 },
    traits: ["Lucky", "Brave", "Halfling Nimbleness"],
    languages: ["Common", "Halfling"],
    subraces: [
      {
        id: "lightfoot",
        name: "Lightfoot",
        description: "Lightfoot halflings can easily hide from notice, even using others as cover.",
        abilityBonuses: { charisma: 1 },
        traits: ["Naturally Stealthy"],
      },
      {
        id: "stout",
        name: "Stout",
        description: "Stout halflings are hardier than average.",
        abilityBonuses: { constitution: 1 },
        traits: ["Stout Resilience"],
      },
    ],
  },
  {
    id: "half-orc",
    name: "Half-Orc",
    description: "Half-orcs' grayish pigmentation and intimidating physiques speak to their orcish heritage.",
    size: "Medium",
    speed: 30,
    abilityBonuses: { strength: 2, constitution: 1 },
    traits: ["Darkvision", "Menacing", "Relentless Endurance", "Savage Attacks"],
    languages: ["Common", "Orc"],
  },
  {
    id: "gnome",
    name: "Gnome",
    description: "A gnome's energy and enthusiasm for living shines through every inch of their tiny body.",
    size: "Small",
    speed: 25,
    abilityBonuses: { intelligence: 2 },
    traits: ["Darkvision", "Gnome Cunning"],
    languages: ["Common", "Gnomish"],
    subraces: [
      {
        id: "rock-gnome",
        name: "Rock Gnome",
        description: "Rock gnomes have an affinity for invention and the history of the technical arts.",
        abilityBonuses: { constitution: 1 },
        traits: ["Artificer's Lore", "Tinker"],
      },
      {
        id: "forest-gnome",
        name: "Forest Gnome",
        description: "Forest gnomes have a knack for illusion and can speak with small animals.",
        abilityBonuses: { dexterity: 1 },
        traits: ["Natural Illusionist", "Speak with Small Beasts"],
      },
    ],
  },
  {
    id: "tiefling",
    name: "Tiefling",
    description: "To be greeted with stares and whispers; to suffer violence and insult on the street.",
    size: "Medium",
    speed: 30,
    abilityBonuses: { intelligence: 1, charisma: 2 },
    traits: ["Darkvision", "Hellish Resistance", "Infernal Legacy"],
    languages: ["Common", "Infernal"],
  },
  {
    id: "dragonborn",
    name: "Dragonborn",
    description: "Born of dragons, dragonborn walk proudly through a world that greets them with fearful incomprehension.",
    size: "Medium",
    speed: 30,
    abilityBonuses: { strength: 2, charisma: 1 },
    traits: ["Draconic Ancestry", "Breath Weapon", "Damage Resistance"],
    languages: ["Common", "Draconic"],
  },
  {
    id: "half-elf",
    name: "Half-Elf",
    description: "Half-elves combine what some say are the best qualities of their elf and human parents.",
    size: "Medium",
    speed: 30,
    abilityBonuses: { charisma: 2 },
    traits: ["Darkvision", "Fey Ancestry", "Skill Versatility"],
    languages: ["Common", "Elvish", "One of your choice"],
  },
]

// ─── Classes ─────────────────────────────────────────────────────────────────

export interface SubclassData {
  id: string
  name: string
  description: string
}

export interface ClassData {
  id: string
  name: string
  description: string
  hitDie: number
  savingThrows: Ability[]
  armorProficiencies: string[]
  weaponProficiencies: string[]
  toolProficiencies: string[]
  skillChoices: { count: number; options: Skill[] }
  spellcasting?: { ability: Ability; type: "prepared" | "known" | "slots" }
  primaryAbility: Ability
  flavorText: string
  // Homebrew classes may define subclasses (curated SRD classes don't here — the
  // manual builder has no subclass picker for them). When present, the builder
  // shows a subclass picker, mirroring race → subrace.
  subclasses?: SubclassData[]
  // True for user-authored homebrew merged into the builder, so the UI can badge it.
  homebrew?: boolean
}

export const CLASSES: ClassData[] = [
  {
    id: "barbarian",
    name: "Barbarian",
    description: "A fierce warrior of primitive background who can enter a battle rage.",
    hitDie: 12,
    savingThrows: ["strength", "constitution"],
    armorProficiencies: ["Light armor", "Medium armor", "Shields"],
    weaponProficiencies: ["Simple weapons", "Martial weapons"],
    toolProficiencies: [],
    skillChoices: {
      count: 2,
      options: ["animalHandling", "athletics", "intimidation", "nature", "perception", "survival"],
    },
    primaryAbility: "strength",
    flavorText: "Rage burns bright in your veins. You are the storm.",
  },
  {
    id: "bard",
    name: "Bard",
    description: "An inspiring magician whose power echoes the music of creation.",
    hitDie: 8,
    savingThrows: ["dexterity", "charisma"],
    armorProficiencies: ["Light armor"],
    weaponProficiencies: ["Simple weapons", "Hand crossbows", "Longswords", "Rapiers", "Shortswords"],
    toolProficiencies: ["Three musical instruments of your choice"],
    skillChoices: {
      count: 3,
      options: ["acrobatics", "animalHandling", "arcana", "athletics", "deception", "history", "insight", "intimidation", "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleightOfHand", "stealth", "survival"],
    },
    spellcasting: { ability: "charisma", type: "known" },
    primaryAbility: "charisma",
    flavorText: "Every story is a spell. Every song, a sword.",
  },
  {
    id: "cleric",
    name: "Cleric",
    description: "A priestly champion who wields divine magic in service of a higher power.",
    hitDie: 8,
    savingThrows: ["wisdom", "charisma"],
    armorProficiencies: ["Light armor", "Medium armor", "Shields"],
    weaponProficiencies: ["Simple weapons"],
    toolProficiencies: [],
    skillChoices: {
      count: 2,
      options: ["history", "insight", "medicine", "persuasion", "religion"],
    },
    spellcasting: { ability: "wisdom", type: "prepared" },
    primaryAbility: "wisdom",
    flavorText: "The gods do not grant power to the worthy. They grant it to the willing.",
  },
  {
    id: "druid",
    name: "Druid",
    description: "A priest of the Old Faith, wielding the powers of nature and adopting animal forms.",
    hitDie: 8,
    savingThrows: ["intelligence", "wisdom"],
    armorProficiencies: ["Light armor", "Medium armor", "Shields (non-metal)"],
    weaponProficiencies: ["Clubs", "Daggers", "Javelins", "Maces", "Quarterstaffs", "Scimitars", "Sickles", "Slings", "Spears"],
    toolProficiencies: ["Herbalism kit"],
    skillChoices: {
      count: 2,
      options: ["arcana", "animalHandling", "insight", "medicine", "nature", "perception", "religion", "survival"],
    },
    spellcasting: { ability: "wisdom", type: "prepared" },
    primaryAbility: "wisdom",
    flavorText: "The world breathes. You breathe with it.",
  },
  {
    id: "fighter",
    name: "Fighter",
    description: "A master of martial combat, skilled with a variety of weapons and armor.",
    hitDie: 10,
    savingThrows: ["strength", "constitution"],
    armorProficiencies: ["All armor", "Shields"],
    weaponProficiencies: ["Simple weapons", "Martial weapons"],
    toolProficiencies: [],
    skillChoices: {
      count: 2,
      options: ["acrobatics", "animalHandling", "athletics", "history", "insight", "intimidation", "perception", "survival"],
    },
    primaryAbility: "strength",
    flavorText: "Steel and will. The rest is commentary.",
  },
  {
    id: "monk",
    name: "Monk",
    description: "A master of martial arts, harnessing the power of the body in pursuit of physical and spiritual perfection.",
    hitDie: 8,
    savingThrows: ["strength", "dexterity"],
    armorProficiencies: [],
    weaponProficiencies: ["Simple weapons", "Shortswords"],
    toolProficiencies: ["One type of artisan's tools or musical instrument"],
    skillChoices: {
      count: 2,
      options: ["acrobatics", "athletics", "history", "insight", "religion", "stealth"],
    },
    primaryAbility: "dexterity",
    flavorText: "Ki flows where will commands. Breath is the bridge.",
  },
  {
    id: "paladin",
    name: "Paladin",
    description: "A holy warrior bound to a sacred oath.",
    hitDie: 10,
    savingThrows: ["wisdom", "charisma"],
    armorProficiencies: ["All armor", "Shields"],
    weaponProficiencies: ["Simple weapons", "Martial weapons"],
    toolProficiencies: [],
    skillChoices: {
      count: 2,
      options: ["athletics", "insight", "intimidation", "medicine", "persuasion", "religion"],
    },
    spellcasting: { ability: "charisma", type: "prepared" },
    primaryAbility: "strength",
    flavorText: "The oath is not a cage. It is the key.",
  },
  {
    id: "ranger",
    name: "Ranger",
    description: "A warrior of the wilds who uses martial prowess and nature magic to combat threats.",
    hitDie: 10,
    savingThrows: ["strength", "dexterity"],
    armorProficiencies: ["Light armor", "Medium armor", "Shields"],
    weaponProficiencies: ["Simple weapons", "Martial weapons"],
    toolProficiencies: [],
    skillChoices: {
      count: 3,
      options: ["animalHandling", "athletics", "insight", "investigation", "nature", "perception", "stealth", "survival"],
    },
    spellcasting: { ability: "wisdom", type: "known" },
    primaryAbility: "dexterity",
    flavorText: "The wilderness has no mercy. Neither do you.",
  },
  {
    id: "rogue",
    name: "Rogue",
    description: "A scoundrel who uses stealth and trickery to overcome obstacles and enemies.",
    hitDie: 8,
    savingThrows: ["dexterity", "intelligence"],
    armorProficiencies: ["Light armor"],
    weaponProficiencies: ["Simple weapons", "Hand crossbows", "Longswords", "Rapiers", "Shortswords"],
    toolProficiencies: ["Thieves' tools"],
    skillChoices: {
      count: 4,
      options: ["acrobatics", "athletics", "deception", "insight", "intimidation", "investigation", "perception", "performance", "persuasion", "sleightOfHand", "stealth"],
    },
    primaryAbility: "dexterity",
    flavorText: "They'll never see you coming. They rarely see you leave.",
  },
  {
    id: "sorcerer",
    name: "Sorcerer",
    description: "A spellcaster who draws on inherent magic from a gift or bloodline.",
    hitDie: 6,
    savingThrows: ["constitution", "charisma"],
    armorProficiencies: [],
    weaponProficiencies: ["Daggers", "Darts", "Slings", "Quarterstaffs", "Light crossbows"],
    toolProficiencies: [],
    skillChoices: {
      count: 2,
      options: ["arcana", "deception", "insight", "intimidation", "persuasion", "religion"],
    },
    spellcasting: { ability: "charisma", type: "known" },
    primaryAbility: "charisma",
    flavorText: "Magic isn't something you learn. It's something you are.",
  },
  {
    id: "warlock",
    name: "Warlock",
    description: "A wielder of magic derived from a bargain with an extraplanar entity.",
    hitDie: 8,
    savingThrows: ["wisdom", "charisma"],
    armorProficiencies: ["Light armor"],
    weaponProficiencies: ["Simple weapons"],
    toolProficiencies: [],
    skillChoices: {
      count: 2,
      options: ["arcana", "deception", "history", "intimidation", "investigation", "nature", "religion"],
    },
    spellcasting: { ability: "charisma", type: "known" },
    primaryAbility: "charisma",
    flavorText: "The pact was not made lightly. Neither will it be broken.",
  },
  {
    id: "wizard",
    name: "Wizard",
    description: "A scholarly magic-user capable of manipulating the structures of reality.",
    hitDie: 6,
    savingThrows: ["intelligence", "wisdom"],
    armorProficiencies: [],
    weaponProficiencies: ["Daggers", "Darts", "Slings", "Quarterstaffs", "Light crossbows"],
    toolProficiencies: [],
    skillChoices: {
      count: 2,
      options: ["arcana", "history", "insight", "investigation", "medicine", "religion"],
    },
    spellcasting: { ability: "intelligence", type: "prepared" },
    primaryAbility: "intelligence",
    flavorText: "To name a thing is to know it. To know it is to command it.",
  },
]

// ─── Backgrounds ──────────────────────────────────────────────────────────────

export interface BackgroundData {
  id: string
  name: string
  description: string
  skillProficiencies: Skill[]
  toolProficiencies: string[]
  languages: number
  equipment: string[]
  feature: string
  personalityTraits: string[]
  ideals: string[]
  bonds: string[]
  flaws: string[]
  // True for user-authored homebrew merged into the builder, so the UI can badge it.
  homebrew?: boolean
}

export const BACKGROUNDS: BackgroundData[] = [
  {
    id: "acolyte",
    name: "Acolyte",
    description: "You have spent your life in the service of a temple.",
    skillProficiencies: ["insight", "religion"],
    toolProficiencies: [],
    languages: 2,
    equipment: ["Holy symbol", "Prayer book", "5 sticks of incense", "Vestments", "Common clothes", "15 gp"],
    feature: "Shelter of the Faithful",
    personalityTraits: [
      "I idolize a particular hero of my faith and constantly refer to that person's deeds.",
      "I can find common ground between the fiercest enemies, empathizing with them and always seeking peace.",
    ],
    ideals: ["Faith. I trust that my deity will guide my actions.", "Tradition. The ancient traditions must be preserved."],
    bonds: ["I owe my life to the priest who took me in when I was orphaned.", "Everything I do is for the common people."],
    flaws: ["I judge others harshly, and myself even more severely.", "I put too much trust in those who wield power."],
  },
  {
    id: "criminal",
    name: "Criminal",
    description: "You are an experienced criminal with a history of breaking the law.",
    skillProficiencies: ["deception", "stealth"],
    toolProficiencies: ["One type of gaming set", "Thieves' tools"],
    languages: 0,
    equipment: ["Crowbar", "Dark common clothes with hood", "15 gp"],
    feature: "Criminal Contact",
    personalityTraits: [
      "I always have a plan for what to do when things go wrong.",
      "I am always calm, no matter what the situation.",
    ],
    ideals: ["Honor. I don't steal from others in the trade.", "Freedom. Chains are meant to be broken."],
    bonds: ["I'm trying to pay off an old debt I owe to a generous benefactor.", "My ill-gotten gains go to support my family."],
    flaws: ["When I see something valuable, I can't think of anything but how to steal it.", "I turn tail and run when things look bad."],
  },
  {
    id: "folk-hero",
    name: "Folk Hero",
    description: "You come from a humble social rank but are destined for so much more.",
    skillProficiencies: ["animalHandling", "survival"],
    toolProficiencies: ["One type of artisan's tools", "Vehicles (land)"],
    languages: 0,
    equipment: ["Artisan's tools", "Shovel", "Iron pot", "Common clothes", "10 gp"],
    feature: "Rustic Hospitality",
    personalityTraits: [
      "I judge people by their actions, not their words.",
      "If someone is in trouble, I'm always ready to lend help.",
    ],
    ideals: ["Respect. People deserve to be treated with dignity.", "Sincerity. There's no good in pretending to be something I'm not."],
    bonds: ["I have a family, but I have no idea where they are.", "I worked the land, I love the land, and I will protect the land."],
    flaws: ["The tyrant who rules my land will stop at nothing to see me killed.", "I'm convinced of the significance of my destiny."],
  },
  {
    id: "noble",
    name: "Noble",
    description: "You understand wealth, power, and privilege.",
    skillProficiencies: ["history", "persuasion"],
    toolProficiencies: ["One type of gaming set"],
    languages: 1,
    equipment: ["Fine clothes", "Signet ring", "Scroll of pedigree", "Purse with 25 gp"],
    feature: "Position of Privilege",
    personalityTraits: [
      "My eloquent flattery makes everyone I talk to feel like the most wonderful and important person in the world.",
      "The common folk love me for my kindness and generosity.",
    ],
    ideals: ["Responsibility. It is my duty to respect the authority of those above me.", "Power. If I can attain more power, no one will tell me what to do."],
    bonds: ["I will face any challenge to win the approval of my family.", "My loyalty to my sovereign is unwavering."],
    flaws: ["I secretly believe that everyone is beneath me.", "I hide a truly scandalous secret that could ruin my family forever."],
  },
  {
    id: "sage",
    name: "Sage",
    description: "You spent years learning the lore of the multiverse.",
    skillProficiencies: ["arcana", "history"],
    toolProficiencies: [],
    languages: 2,
    equipment: ["Bottle of black ink", "Quill", "Small knife", "Letter from dead colleague", "Common clothes", "10 gp"],
    feature: "Researcher",
    personalityTraits: [
      "I use polysyllabic words that convey the impression of great erudition.",
      "I've read every book in the world's greatest libraries — or I like to boast that I have.",
    ],
    ideals: ["Knowledge. The path to power and self-improvement is through knowledge.", "Logic. Emotions must not cloud our logical thinking."],
    bonds: ["I have an ancient text that holds terrible secrets that must not fall into the wrong hands.", "My life's work is a series of tomes related to a specific field of lore."],
    flaws: ["I am easily distracted by the promise of information.", "Most people scream and run when they see a demon. I stop and take notes."],
  },
  {
    id: "soldier",
    name: "Soldier",
    description: "War has been your life for as long as you care to remember.",
    skillProficiencies: ["athletics", "intimidation"],
    toolProficiencies: ["One type of gaming set", "Vehicles (land)"],
    languages: 0,
    equipment: ["Insignia of rank", "Trophy from fallen enemy", "Gaming set", "Common clothes", "10 gp"],
    feature: "Military Rank",
    personalityTraits: [
      "I'm always polite and respectful.",
      "I'm haunted by memories of war. I wake from nightmares.",
    ],
    ideals: ["Greater Good. Our lot is to lay down our lives in defense of others.", "Responsibility. I do what I must and obey just authority."],
    bonds: ["I would still lay down my life for the people I served with.", "Someone saved my life on the battlefield. To this day, I will never leave a friend behind."],
    flaws: ["The monstrous enemy we faced in battle still leaves me quivering with fear.", "I have little respect for anyone who is not a proven warrior."],
  },
  {
    id: "outlander",
    name: "Outlander",
    description: "You grew up in the wilds, far from civilization and the comforts of town and technology.",
    skillProficiencies: ["athletics", "survival"],
    toolProficiencies: ["One type of musical instrument"],
    languages: 1,
    equipment: ["Staff", "Hunting trap", "Trophy from an animal", "Traveler's clothes", "10 gp"],
    feature: "Wanderer",
    personalityTraits: [
      "I'm driven by a wanderlust that led me away from home.",
      "I watch over my friends as if they were a litter of newborn pups.",
    ],
    ideals: ["Change. Life is like the seasons, in constant change, and we must change with it.", "Nature. The natural world is more important than all the constructs of civilization."],
    bonds: ["My family, clan, or tribe is the most important thing in my life.", "An injury to the unspoiled wilderness is an injury to me."],
    flaws: ["I am too enamored of ale, wine, and other intoxicants.", "There's no room for caution in a life lived to the fullest."],
  },
  {
    id: "charlatan",
    name: "Charlatan",
    description: "You have always had a way with people. You know what makes them tick.",
    skillProficiencies: ["deception", "sleightOfHand"],
    toolProficiencies: ["Disguise kit", "Forgery kit"],
    languages: 0,
    equipment: ["Fine clothes", "Disguise kit", "Tools of the con", "15 gp"],
    feature: "False Identity",
    personalityTraits: [
      "I fall in and out of love easily, and am always pursuing someone.",
      "I have a joke for every occasion, especially occasions where humor is inappropriate.",
    ],
    ideals: ["Creativity. I never run the same con twice.", "Independence. I am a free spirit — no one tells me what to do."],
    bonds: ["I fleeced the wrong person and must work to ensure that this individual never crosses paths with me or those I care about.", "I owe everything to my mentor — a horrible person who taught me how to do terrible things."],
    flaws: ["I can't resist a pretty face.", "I'm convinced that no one could ever fool me the way I fool others."],
  },
]

// ─── Name Lists ───────────────────────────────────────────────────────────────

const NAMES: Record<string, { first: string[]; last?: string[] }> = {
  human: {
    first: ["Aldric", "Brennan", "Calder", "Darian", "Edwyn", "Farell", "Gavin", "Hadwin", "Idris", "Jareth", "Kael", "Lorn", "Maren", "Nolan", "Oswyn", "Pell", "Quinn", "Rowan", "Soren", "Theron", "Uric", "Varen", "Wren", "Xander", "Yael", "Zane", "Anya", "Brynn", "Cass", "Dara", "Elena", "Faye", "Gwen", "Hana", "Isla", "Jana", "Kira", "Lyra", "Mira", "Nora", "Orla", "Petra", "Rena", "Sable", "Tara"],
    last: ["Ashford", "Blackwood", "Coldwater", "Dunmore", "Everly", "Fairfax", "Grimstone", "Halloway", "Ironside", "Jameson", "Kettrick", "Larkspur", "Moorfield", "Nighthollow", "Oakhurst", "Pembrook", "Quicksilver", "Ravenswood", "Stormgate", "Thornwick", "Underhill", "Vane", "Westerbrook", "Yarrow"],
  },
  elf: {
    first: ["Aelindra", "Berrian", "Caladrel", "Dayereth", "Eiravel", "Felosial", "Galinndan", "Hadarai", "Immeral", "Jelenneth", "Kethryllia", "Laucian", "Mindartis", "Naeris", "Ordalf", "Paelias", "Quarion", "Riardon", "Soveliss", "Tanyl", "Ula", "Varis", "Xanaphia", "Yalanue", "Zylvara", "Adran", "Aelar", "Aramil", "Arannis", "Aust", "Beiro", "Birel", "Carric", "Enialis", "Erdan", "Erevan", "Fivin", "Gennal", "Heian", "Himo"],
    last: ["Amakiir", "Amastacia", "Galanodel", "Holimion", "Ilphelkiir", "Liadon", "Meliamne", "Naïlo", "Siannodel", "Xiloscient"],
  },
  dwarf: {
    first: ["Adrik", "Alberich", "Baern", "Barendd", "Brottor", "Bruenor", "Dain", "Darrak", "Delg", "Eberk", "Einkil", "Fargrim", "Flint", "Gardain", "Harbek", "Kildrak", "Morgran", "Orsik", "Oskar", "Rurik", "Taklinn", "Thoradin", "Thorin", "Tordek", "Traubon", "Travok", "Ulfgar", "Veit", "Vondal", "Amber", "Artin", "Audhild", "Bardryn", "Dagnal", "Diesa", "Eldeth", "Falkrunn", "Finellen", "Gunnloda", "Gurdis"],
    last: ["Balderk", "Dankil", "Gorunn", "Holderhek", "Loderr", "Lutgehr", "Rumnaheim", "Strakeln", "Torunn", "Ungart"],
  },
  halfling: {
    first: ["Alton", "Ander", "Cade", "Corrin", "Eldon", "Errich", "Finnan", "Garret", "Lindal", "Lyle", "Merric", "Milo", "Osborn", "Perrin", "Reed", "Roscoe", "Wellby", "Andry", "Bree", "Callie", "Cora", "Euphemia", "Jillian", "Kithri", "Lavinia", "Lidda", "Merla", "Nedda", "Paela", "Portia", "Seraphina", "Shaena", "Trym", "Vani", "Verna"],
    last: ["Brushgather", "Goodbarrel", "Greenbottle", "High-hill", "Hilltopple", "Leagallow", "Tealeaf", "Thorngage", "Tosscobble", "Underbough"],
  },
  "half-orc": {
    first: ["Dench", "Feng", "Gell", "Henk", "Holg", "Imsh", "Keth", "Krusk", "Mhurren", "Ront", "Shump", "Thokk", "Arha", "Baggi", "Engong", "Kansif", "Myev", "Neega", "Ovak", "Ownka", "Shautha", "Sutha", "Vola", "Volen", "Yevelda"],
  },
  gnome: {
    first: ["Alston", "Alvyn", "Boddynock", "Brocc", "Burgell", "Dimble", "Eldon", "Erky", "Fonkin", "Frug", "Gerbo", "Gimble", "Glim", "Jebeddo", "Kellen", "Namfoodle", "Orryn", "Roondar", "Seebo", "Sindri", "Warryn", "Wrenn", "Zook", "Bimpnottin", "Breena", "Caramip", "Carlin", "Donella", "Duvamil", "Ella", "Ellyjobell", "Ellywick", "Lilli", "Loopmottin", "Lorilla", "Mardnab", "Nissa"],
    last: ["Beren", "Daergel", "Folkor", "Garrick", "Nackle", "Murnig", "Ningel", "Raulnor", "Scheppen", "Timbers", "Turen"],
  },
  tiefling: {
    first: ["Akmenos", "Amnon", "Barakas", "Damakos", "Ekemon", "Iados", "Kairon", "Leucis", "Melech", "Mordai", "Morthos", "Pelaios", "Skamos", "Therai", "Akta", "Anise", "Bryseis", "Criella", "Damaia", "Ea", "Kallista", "Lerissa", "Makaria", "Nemeia", "Orianna", "Phelaia", "Rieta"],
    last: ["Art", "Carrion", "Chant", "Creed", "Despair", "Excellence", "Fear", "Glory", "Hope", "Ideal", "Music", "Nowhere", "Open", "Poetry", "Quest", "Random", "Reverence", "Sorrow", "Temerity", "Torment", "Weary"],
  },
  dragonborn: {
    first: ["Arjhan", "Balasar", "Bharash", "Donaar", "Ghesh", "Heskan", "Kriv", "Medrash", "Mehen", "Nadarr", "Pandjed", "Patrin", "Rhogar", "Shamash", "Shedinn", "Tarhun", "Torinn", "Akra", "Biri", "Daar", "Farideh", "Harann", "Havilar", "Jheri", "Kava", "Korinn", "Mishann", "Nala", "Perra", "Raiann", "Sora", "Surina", "Thava", "Uadjit"],
    last: ["Clethtinthiallor", "Daardendrian", "Delmirev", "Drachedandion", "Fenkenkabradon", "Kepeshkmolik", "Kerrhylon", "Kimbatuul", "Linxakasendalor", "Myastan", "Nemmonis", "Norixius", "Ophinshtalajiir", "Prexijandilin", "Shestendeliath", "Turnuroth", "Verthisathurgiesh", "Yarjerit"],
  },
  "half-elf": {
    first: ["Aelindra", "Brennan", "Caladrel", "Darian", "Elena", "Farell", "Gavin", "Hadarai", "Idris", "Jelenneth", "Kael", "Laucian", "Maren", "Naeris", "Oswyn", "Paelias", "Quinn", "Riardon", "Soren", "Tanyl", "Ula", "Varis", "Wren", "Xanaphia", "Yalanue", "Zane"],
    last: ["Ashford", "Amakiir", "Blackwood", "Galanodel", "Coldwater", "Holimion", "Dunmore", "Naïlo", "Everly", "Siannodel"],
  },
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

export function getRaceById(id: string): RaceData | undefined {
  return RACES.find((r) => r.id === id)
}

/**
 * Resolve a character's darkvision range (in feet) from its stored race +
 * subrace names. "Superior Darkvision" → 120 ft, plain "Darkvision" → 60 ft,
 * otherwise 0 (no darkvision). Matches by name (case-insensitive) since that's
 * what the character doc stores. Returns 0 for unknown/homebrew lineages —
 * those can record senses via Custom Properties instead.
 */
export function getDarkvisionRange(raceName: string, subraceName?: string): number {
  const race = RACES.find((r) => r.name.toLowerCase() === raceName.toLowerCase())
  if (!race) return 0
  const subrace = subraceName
    ? race.subraces?.find((s) => s.name.toLowerCase() === subraceName.toLowerCase())
    : undefined
  const traits = [...race.traits, ...(subrace?.traits ?? [])].map((t) => t.toLowerCase())
  if (traits.some((t) => t.includes("superior darkvision"))) return 120
  if (traits.some((t) => t.includes("darkvision"))) return 60
  return 0
}

/**
 * Compute a race's darkvision range (feet) from the selected RaceData/SubraceData
 * objects — used at character creation to SNAPSHOT darkvision onto the character.
 * An explicit `darkvision` field wins (homebrew sets it directly); otherwise it's
 * derived from trait strings exactly like getDarkvisionRange. Works for curated
 * AND homebrew races since the builder holds the full data object either way.
 */
export function deriveDarkvision(race: RaceData, subrace?: SubraceData): number {
  if (subrace?.darkvision !== undefined) return subrace.darkvision
  if (race.darkvision !== undefined) return race.darkvision
  const traits = [...race.traits, ...(subrace?.traits ?? [])].map((t) => t.toLowerCase())
  if (traits.some((t) => t.includes("superior darkvision"))) return 120
  if (traits.some((t) => t.includes("darkvision"))) return 60
  return 0
}

export function getClassById(id: string): ClassData | undefined {
  return CLASSES.find((c) => c.id === id)
}

export function getBackgroundById(id: string): BackgroundData | undefined {
  return BACKGROUNDS.find((b) => b.id === id)
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function generateName(raceId: string): string {
  const pool = NAMES[raceId] ?? NAMES["human"]
  const first = pick(pool.first)
  const last = pool.last ? pick(pool.last) : ""
  return last ? `${first} ${last}` : first
}

/** Roll 4d6, drop the lowest */
function roll4d6DropLowest(): number {
  const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1)
  rolls.sort((a, b) => a - b)
  return rolls[1] + rolls[2] + rolls[3]
}

export interface QuickRollResult {
  name: string
  race: RaceData
  subrace?: SubraceData
  characterClass: ClassData
  subclass?: SubclassData
  background: BackgroundData
  baseAbilities: {
    strength: number
    dexterity: number
    constitution: number
    intelligence: number
    wisdom: number
    charisma: number
  }
  racialBonuses: Partial<Record<Ability, number>>
  skillProficiencies: Skill[]
}

export function quickRollCharacter(): QuickRollResult {
  const race = pick(RACES)
  const subrace = race.subraces ? pick(race.subraces) : undefined
  const characterClass = pick(CLASSES)
  const background = pick(BACKGROUNDS)
  const name = generateName(race.id)

  const rolled = Array.from({ length: 6 }, roll4d6DropLowest)
  rolled.sort((a, b) => b - a)

  const abilityKeys: (keyof QuickRollResult["baseAbilities"])[] = [
    "strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma",
  ]

  const primaryIdx = abilityKeys.indexOf(characterClass.primaryAbility as keyof QuickRollResult["baseAbilities"])
  const sorted = [...rolled]
  const highest = sorted.splice(0, 1)[0]
  const assigned: number[] = new Array(6).fill(0)
  assigned[primaryIdx] = highest
  let j = 0
  for (let i = 0; i < 6; i++) {
    if (i !== primaryIdx) assigned[i] = sorted[j++]
  }

  const baseAbilities = {
    strength: assigned[0],
    dexterity: assigned[1],
    constitution: assigned[2],
    intelligence: assigned[3],
    wisdom: assigned[4],
    charisma: assigned[5],
  }

  const racialBonuses: Partial<Record<Ability, number>> = {
    ...race.abilityBonuses,
    ...(subrace?.abilityBonuses ?? {}),
  }

  const bgSkills = background.skillProficiencies
  const classOpts = characterClass.skillChoices.options
  const classCount = characterClass.skillChoices.count
  const shuffled = [...classOpts].sort(() => Math.random() - 0.5)
  const classSkills = shuffled.slice(0, classCount)
  const skillProficiencies = [...new Set([...bgSkills, ...classSkills])] as Skill[]

  return { name, race, subrace, characterClass, background, baseAbilities, racialBonuses, skillProficiencies }
}
