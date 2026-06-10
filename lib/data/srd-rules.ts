// Curated SRD rules glossary for the Codex "Rules" tab. Hand-authored
// PARAPHRASES of the System Reference Document — SRD 5.1 (2014) and SRD 5.2
// (2024), both CC-BY-4.0 — never PHB prose. Names and mechanics aren't
// copyrightable; the wording here is original and terse for mid-session glance.
//
// Edition-divergent rules (grapple, shove, surprise, exhaustion, inspiration)
// are modeled as TWO entries — one tagged "2014", one "2024" — that swap with
// the Rules tab's edition toggle. Entries tagged "both" render in either mode.
//
// Verify any rule against the SRD before editing — do not edit from memory.
// Exhaustion text mirrors lib/character/exhaustion.ts (the mechanical source).

import type { Edition } from "@/lib/editions"

export type RulesCategory =
  | "Combat"
  | "Movement"
  | "Resting"
  | "Damage & Healing"
  | "Spellcasting"

export const RULES_CATEGORIES: RulesCategory[] = [
  "Combat",
  "Movement",
  "Resting",
  "Damage & Healing",
  "Spellcasting",
]

export interface RulesEntry {
  // Unique within the rules set; delta concepts use an edition suffix
  // (e.g. "grapple-2014" / "grapple-2024") so bookmarks stay unambiguous.
  slug: string
  name: string
  // "both" renders in either edition; otherwise the entry only shows when its
  // edition is the active one in the Rules tab toggle.
  edition: Edition | "both"
  category: RulesCategory
  // Markdown — rendered sanitized via MarkdownRenderer.
  body: string
  // Slugs of related entries, rendered as jump-chips in the detail pane.
  seeAlso?: string[]
}

export const SRD_RULES: RulesEntry[] = [
  // ── Combat ────────────────────────────────────────────────────────────────
  {
    slug: "the-turn",
    name: "The Turn",
    edition: "both",
    category: "Combat",
    body: [
      "On your turn you can **move** up to your Speed and take **one action**. You decide whether to move first, act first, or break your movement around your action.",
      "",
      "You can also take **one bonus action** (only if something grants you one) and **interact with one object or feature** of the environment for free — draw a sword, open a door, pull a lever. A second interaction costs your action.",
      "",
      "You can give up moving, your action, or your bonus action to do less. Anything beyond your turn (like an opportunity attack) uses a **reaction**.",
    ].join("\n"),
    seeAlso: ["bonus-actions", "reactions", "opportunity-attacks", "movement-speed"],
  },
  {
    slug: "action-attack",
    name: "Attack (Action)",
    edition: "both",
    category: "Combat",
    body: [
      "Make one melee or ranged attack. Features like Extra Attack let you make more than one attack with this single action.",
      "",
      "**Roll to hit:** d20 + ability modifier + proficiency bonus (if proficient) versus the target's Armor Class. On a hit, roll the weapon's damage. A natural 20 is a **critical hit** — roll the damage dice twice.",
    ].join("\n"),
    seeAlso: ["opportunity-attacks", "advantage-disadvantage", "cover"],
  },
  {
    slug: "action-dash",
    name: "Dash (Action)",
    edition: "both",
    category: "Combat",
    body: "Gain extra movement equal to your Speed for this turn (after modifiers). Moving 30 ft normally and taking the Dash action lets a 30-ft creature cover 60 ft.",
    seeAlso: ["movement-speed", "difficult-terrain"],
  },
  {
    slug: "action-disengage",
    name: "Disengage (Action)",
    edition: "both",
    category: "Combat",
    body: "Your movement doesn't provoke opportunity attacks for the rest of the turn. Use it to back out of melee safely.",
    seeAlso: ["opportunity-attacks", "movement-speed"],
  },
  {
    slug: "action-dodge",
    name: "Dodge (Action)",
    edition: "both",
    category: "Combat",
    body: [
      "Until the start of your next turn, attack rolls against you have **disadvantage** (if you can see the attacker) and you make **Dexterity saving throws with advantage**.",
      "",
      "You lose this benefit if you're incapacitated or your Speed drops to 0.",
    ].join("\n"),
    seeAlso: ["advantage-disadvantage"],
  },
  {
    slug: "action-help",
    name: "Help (Action)",
    edition: "both",
    category: "Combat",
    body: [
      "Either aid an ally with a task — they gain **advantage** on their next ability check for it — or help with an attack: the next attack roll against a creature within 5 ft of you gains **advantage** if it happens before your next turn.",
    ].join("\n"),
    seeAlso: ["advantage-disadvantage"],
  },
  {
    slug: "action-hide",
    name: "Hide (Action)",
    edition: "both",
    category: "Combat",
    body: [
      "Make a **Dexterity (Stealth)** check while you're out of any enemy's clear sight. If you beat a creature's passive Perception, you're hidden from it — attacks you make against it have advantage, and it can't easily target you.",
      "",
      "You stop being hidden the moment a creature sees you, you make noise, or you attack.",
    ].join("\n"),
    seeAlso: ["advantage-disadvantage"],
  },
  {
    slug: "action-ready",
    name: "Ready (Action)",
    edition: "both",
    category: "Combat",
    body: [
      "Prepare a response to a trigger you describe (\"when the goblin steps onto the bridge\"). Choose the action now; when the trigger occurs before your next turn, you use your **reaction** to take it.",
      "",
      "Readying a spell requires casting it now and holding it with concentration until released — if your concentration breaks, the spell is lost.",
    ].join("\n"),
    seeAlso: ["reactions", "concentration"],
  },
  {
    slug: "action-search",
    name: "Search (Action)",
    edition: "both",
    category: "Combat",
    body: "Devote your attention to finding something — make a Wisdom (Perception) or Intelligence (Investigation) check, as the situation demands, to spot a hidden creature, a clue, or a concealed object.",
    seeAlso: ["action-hide"],
  },
  {
    slug: "action-use-object",
    name: "Use an Object / Utilize (Action)",
    edition: "both",
    category: "Combat",
    body: [
      "Interact with a second object on your turn (the first is free), or use an object that needs an action — drink a potion, yank a stuck lever, light a torch from a flame.",
      "",
      "*The 2024 rules call this the **Utilize** action; the effect is the same.*",
    ].join("\n"),
    seeAlso: ["the-turn"],
  },
  {
    slug: "actions-2024",
    name: "New 2024 Actions: Influence, Study, Magic",
    edition: "2024",
    category: "Combat",
    body: [
      "The 2024 rules formalize three actions that 2014 handled informally:",
      "",
      "- **Influence** — attempt to sway a creature with a Charisma (or sometimes other) check: persuade, deceive, intimidate, or perform.",
      "- **Study** — make an Intelligence check to recall or work out lore (Arcana, History, Nature, Religion, Investigation).",
      "- **Magic** — cast a spell, use a magic item, or use a magical feature that calls for the Magic action.",
    ].join("\n"),
    seeAlso: ["action-search"],
  },
  {
    slug: "bonus-actions",
    name: "Bonus Actions",
    edition: "both",
    category: "Combat",
    body: [
      "A bonus action is a quick extra action you can take **only when a feature, spell, or ability specifically grants one** — two-weapon fighting, a rogue's Cunning Action, casting a bonus-action spell.",
      "",
      "You get at most **one** bonus action per turn, and you choose when to take it. If you have nothing that grants a bonus action, you have none.",
    ].join("\n"),
    seeAlso: ["the-turn", "reactions"],
  },
  {
    slug: "reactions",
    name: "Reactions",
    edition: "both",
    category: "Combat",
    body: [
      "A reaction is an instant response triggered by something, usable even when it isn't your turn. The most common is the **opportunity attack**.",
      "",
      "You get **one reaction** per round; once you use it, you have none until the start of your next turn. A reaction triggered on another creature's turn interrupts it as specified.",
    ].join("\n"),
    seeAlso: ["opportunity-attacks", "action-ready"],
  },
  {
    slug: "opportunity-attacks",
    name: "Opportunity Attacks",
    edition: "both",
    category: "Combat",
    body: [
      "When a creature you can see leaves your reach on its own movement, you can use your **reaction** to make one melee attack against it.",
      "",
      "You **don't** provoke an opportunity attack when you Disengage, when you're moved against your will (pushed, teleported), or when the creature leaps away with a feature that says so.",
    ].join("\n"),
    seeAlso: ["reactions", "action-disengage"],
  },
  {
    slug: "cover",
    name: "Cover",
    edition: "both",
    category: "Combat",
    body: [
      "Obstacles between an attacker and a target grant cover:",
      "",
      "- **Half cover** (+2 to AC and Dexterity saves) — a low wall, furniture, another creature.",
      "- **Three-quarters cover** (+5 to AC and Dexterity saves) — an arrow slit, a tree trunk, a portcullis.",
      "- **Total cover** — can't be targeted directly at all.",
      "",
      "A target only benefits from the most protective cover available; cover doesn't stack.",
    ].join("\n"),
    seeAlso: ["action-attack"],
  },
  {
    slug: "grapple-2014",
    name: "Grapple",
    edition: "2014",
    category: "Combat",
    body: [
      "Replace one attack of your Attack action with a grapple (you need a free hand). Make a **Strength (Athletics) check contested by the target's Strength (Athletics) or Dexterity (Acrobatics)** — their choice.",
      "",
      "On a success the target gains the **Grappled** condition (Speed 0). The target can escape by spending its action to win the same contest. Moving while grappling someone costs you half your Speed per foot, unless the target is two or more sizes smaller.",
      "",
      "*Differs by edition — switch the toggle to compare the 2024 version.*",
    ].join("\n"),
    seeAlso: ["grapple-2024", "shove-2014"],
  },
  {
    slug: "grapple-2024",
    name: "Grapple",
    edition: "2024",
    category: "Combat",
    body: [
      "Grapple is an option of the **Unarmed Strike** (no contested check). The target must succeed on a **Strength or Dexterity saving throw** (its choice) against a DC of **8 + your Strength modifier + your proficiency bonus**, or gain the **Grappled** condition (Speed 0).",
      "",
      "The target can escape by using its action to make a Strength (Athletics) or Dexterity (Acrobatics) check against that same DC. A grappling creature can drag the target along at the cost of extra movement.",
      "",
      "*Differs by edition — switch the toggle to compare the 2014 version.*",
    ].join("\n"),
    seeAlso: ["grapple-2014", "shove-2024"],
  },
  {
    slug: "shove-2014",
    name: "Shove",
    edition: "2014",
    category: "Combat",
    body: [
      "Replace one attack of your Attack action with a shove. Make a **Strength (Athletics) check contested by the target's Strength (Athletics) or Dexterity (Acrobatics)**.",
      "",
      "On a success you either **push the target 5 feet** away or **knock it prone** (your choice). The target must be no more than one size larger than you.",
      "",
      "*Differs by edition — switch the toggle to compare the 2024 version.*",
    ].join("\n"),
    seeAlso: ["shove-2024", "grapple-2014", "prone"],
  },
  {
    slug: "shove-2024",
    name: "Shove",
    edition: "2024",
    category: "Combat",
    body: [
      "Shove is an option of the **Unarmed Strike**. The target must succeed on a **Strength or Dexterity saving throw** (its choice) against **8 + your Strength modifier + your proficiency bonus**, or you **push it 5 feet** away or **knock it prone** (your choice). The target must be no more than one size larger than you.",
      "",
      "*Differs by edition — switch the toggle to compare the 2014 version.*",
    ].join("\n"),
    seeAlso: ["shove-2014", "grapple-2024", "prone"],
  },
  {
    slug: "prone",
    name: "Prone & Standing Up",
    edition: "both",
    category: "Combat",
    body: [
      "While **prone**, your only movement option is to crawl (or to stand up), you have disadvantage on attack rolls, and you can't take reactions to attack normally. Melee attacks against you have **advantage**; ranged attacks against you have **disadvantage**.",
      "",
      "You can **drop prone** for free. **Standing up** costs **half your Speed** — if your Speed is 0, you can't stand.",
    ].join("\n"),
    seeAlso: ["shove-2014", "advantage-disadvantage", "movement-speed"],
  },
  {
    slug: "initiative",
    name: "Initiative",
    edition: "both",
    category: "Combat",
    body: [
      "At the start of combat everyone rolls **a Dexterity check (d20 + Dex modifier)**. The order from highest to lowest is the **initiative order**; ties are broken however the table prefers (often by Dexterity score, with the GM deciding between monsters).",
      "",
      "Each round, every combatant takes a turn in that order, then the round repeats until combat ends.",
    ].join("\n"),
    seeAlso: ["the-turn", "surprise-2014"],
  },
  {
    slug: "surprise-2014",
    name: "Surprise",
    edition: "2014",
    category: "Combat",
    body: [
      "Before initiative, the GM compares each ambusher's **Dexterity (Stealth)** to each opponent's **passive Perception**. A creature that notices no threat is **surprised**.",
      "",
      "A surprised creature **can't move or act on its first turn** of combat and **can't take a reaction** until that turn ends. Surprise is per-creature — some combatants may be surprised while others aren't.",
      "",
      "*Differs by edition — switch the toggle to compare the 2024 version.*",
    ].join("\n"),
    seeAlso: ["surprise-2024", "initiative", "action-hide"],
  },
  {
    slug: "surprise-2024",
    name: "Surprise",
    edition: "2024",
    category: "Combat",
    body: [
      "The 2024 rules drop the \"lose your first turn\" model. Instead, a creature that's caught off guard rolls its **initiative with disadvantage**.",
      "",
      "It still gets a full first turn — it's just more likely to act late in the order.",
      "",
      "*Differs by edition — switch the toggle to compare the 2014 version.*",
    ].join("\n"),
    seeAlso: ["surprise-2014", "initiative", "advantage-disadvantage"],
  },
  {
    slug: "weapon-mastery",
    name: "Weapon Mastery",
    edition: "2024",
    category: "Combat",
    body: [
      "New in 2024: every weapon has a **mastery property** that unlocks an extra effect when you attack with it — but only if a class feature grants you mastery of that weapon, and only for a limited number of weapon kinds.",
      "",
      "The properties are **Cleave, Graze, Nick, Push, Sap, Slow, Topple,** and **Vex** — e.g. *Topple* lets a hit force a Constitution save or knock the target prone; *Vex* gives advantage on your next attack after a hit.",
      "",
      "*2024 only — no equivalent exists in the 2014 rules.*",
    ].join("\n"),
    seeAlso: ["action-attack", "prone"],
  },
  {
    slug: "mounted-combat",
    name: "Mounted Combat",
    edition: "both",
    category: "Combat",
    body: [
      "You can mount or dismount a willing creature at least one size larger by spending **half your Speed**. A mount can be **controlled** (it acts on your initiative and has limited actions: Dash, Disengage, Dodge) or act **independently** on its own initiative.",
      "",
      "If an effect moves your mount against its will while you're on it, or the mount is knocked prone, you must make a **DC 10 Dexterity save** or fall off (landing prone).",
    ].join("\n"),
    seeAlso: ["movement-speed", "prone"],
  },
  {
    slug: "underwater-combat",
    name: "Underwater Combat",
    edition: "both",
    category: "Combat",
    body: [
      "Without a swim speed, attackers underwater have **disadvantage** on melee attacks using a weapon that isn't a dagger, javelin, shortsword, spear, or trident.",
      "",
      "**Ranged weapon** attacks miss beyond their normal range, and even within it have disadvantage unless the weapon is a crossbow, net, or thrown like a javelin or trident. Creatures and objects fully submerged have **resistance to fire damage**.",
    ].join("\n"),
    seeAlso: ["special-movement", "resistance-vulnerability"],
  },

  // ── Movement ────────────────────────────────────────────────────────────────
  {
    slug: "movement-speed",
    name: "Movement & Speed",
    edition: "both",
    category: "Movement",
    body: [
      "On your turn you can move a distance up to your **Speed**. You can break it up — move, act, then move again — and move through an **ally's** space freely. You can move through a **hostile** creature's space only if it's at least two sizes larger or smaller than you, and its space counts as difficult terrain.",
      "",
      "You can't end your movement in another creature's space.",
    ].join("\n"),
    seeAlso: ["difficult-terrain", "action-dash", "the-turn"],
  },
  {
    slug: "difficult-terrain",
    name: "Difficult Terrain",
    edition: "both",
    category: "Movement",
    body: [
      "Rubble, deep snow, thick undergrowth, a creature's space, and similar obstacles are **difficult terrain**. Every foot of movement there costs **1 extra foot** — moving 5 ft uses 10 ft of your Speed.",
      "",
      "Difficult terrain doesn't stack with itself: terrain is either difficult or it isn't, no matter how many features overlap.",
    ].join("\n"),
    seeAlso: ["movement-speed", "action-dash"],
  },
  {
    slug: "special-movement",
    name: "Climbing, Swimming & Crawling",
    edition: "both",
    category: "Movement",
    body: [
      "Climbing, swimming, and crawling each cost **1 extra foot of movement per foot** (2 feet of Speed per foot), unless you have a climb or swim speed. Difficult conditions can make the cost higher still.",
      "",
      "The GM may call for a **Strength (Athletics)** check to climb a slick or awkward surface, or to swim in rough water.",
    ].join("\n"),
    seeAlso: ["difficult-terrain", "jumping"],
  },
  {
    slug: "jumping",
    name: "Jumping",
    edition: "both",
    category: "Movement",
    body: [
      "**Long jump:** with at least 10 ft of running start, you clear a number of feet up to your **Strength score** (half that from a standing start).",
      "",
      "**High jump:** with a running start, you leap **3 + your Strength modifier** feet up (half from standing). You can extend your reach by half your height at the apex. Every foot jumped counts against your movement for the turn.",
    ].join("\n"),
    seeAlso: ["special-movement", "movement-speed"],
  },

  // ── Resting ─────────────────────────────────────────────────────────────────
  {
    slug: "short-rest",
    name: "Short Rest",
    edition: "both",
    category: "Resting",
    body: [
      "A short rest is **at least 1 hour** of light activity — eating, tending wounds, resting. During it you can spend any number of your **Hit Dice**: roll each die, add your Constitution modifier, and regain that many hit points.",
      "",
      "Many features (Warlock spell slots, Battle Master dice, Channel Divinity, Action Surge, and more) recharge on a short rest.",
    ].join("\n"),
    seeAlso: ["long-rest"],
  },
  {
    slug: "long-rest",
    name: "Long Rest",
    edition: "both",
    category: "Resting",
    body: [
      "A long rest is **at least 8 hours**, mostly sleeping or in light activity (no more than 1 hour of walking, watch-keeping, eating, etc.). Strenuous activity — a fight, a forced march, casting a spell — interrupts it.",
      "",
      "At the end you regain **all lost hit points** and **half your total Hit Dice** (minimum 1). You can benefit from only **one long rest per 24 hours**, and you must have at least 1 hit point to start one.",
      "",
      "*The 2024 rules let you regain spent Hit Dice and allow up to 2 hours of light activity, but the core effect is the same.*",
    ].join("\n"),
    seeAlso: ["short-rest", "exhaustion-2024"],
  },

  // ── Damage & Healing ─────────────────────────────────────────────────────────
  {
    slug: "death-saves",
    name: "Death Saving Throws",
    edition: "both",
    category: "Damage & Healing",
    body: [
      "At 0 hit points and unconscious, you make a **death saving throw** at the start of each of your turns: roll a d20 (no modifiers).",
      "",
      "- **10 or higher** = a success; **9 or lower** = a failure.",
      "- **Three successes** = you stabilize (still at 0 HP). **Three failures** = you die.",
      "- A **natural 1** counts as **two failures**; a **natural 20** means you regain **1 hit point** and revive immediately.",
      "",
      "Taking any damage while at 0 HP is an automatic failure (two if it's a critical hit).",
    ].join("\n"),
    seeAlso: ["stabilizing", "instant-death"],
  },
  {
    slug: "stabilizing",
    name: "Stabilizing a Creature",
    edition: "both",
    category: "Damage & Healing",
    body: [
      "You can stabilize a dying creature without magic by taking an action to administer first aid and succeeding on a **DC 10 Wisdom (Medicine)** check. A **stable** creature stops making death saves but stays unconscious at 0 HP.",
      "",
      "A stable creature regains **1 hit point after 1d4 hours**. Any healing also stabilizes it and brings it back to consciousness.",
    ].join("\n"),
    seeAlso: ["death-saves"],
  },
  {
    slug: "instant-death",
    name: "Dropping to 0 HP & Instant Death",
    edition: "both",
    category: "Damage & Healing",
    body: [
      "When damage reduces you to 0 hit points, you normally fall unconscious and start making death saves. If there's **leftover damage** after reaching 0, and that leftover **equals or exceeds your hit point maximum**, you die instantly.",
      "",
      "Example: a 12-HP creature at 6 HP takes 20 damage — 6 brings it to 0, the remaining 14 exceeds its 12 maximum, so it dies outright.",
    ].join("\n"),
    seeAlso: ["death-saves", "temp-hp"],
  },
  {
    slug: "temp-hp",
    name: "Temporary Hit Points",
    edition: "both",
    category: "Damage & Healing",
    body: [
      "Temporary hit points are a buffer that **absorbs damage before your real hit points**. They're **not** real HP, can't be healed, and don't stack — gaining more replaces the old amount (keep the higher); you choose which to keep when they're equal.",
      "",
      "They last until used up or until you finish a long rest, and going to 0 temp HP has no special effect — the overflow hits your normal hit points.",
    ].join("\n"),
    seeAlso: ["instant-death"],
  },
  {
    slug: "resistance-vulnerability",
    name: "Resistance & Vulnerability",
    edition: "both",
    category: "Damage & Healing",
    body: [
      "**Resistance** to a damage type means you take **half** that damage (round down). **Vulnerability** means you take **double**.",
      "",
      "Resistance and vulnerability each apply **only once**, no matter how many sources grant them — two sources of fire resistance still only halve the damage. Apply all other modifiers first, then resistance/vulnerability, then halve or double.",
    ].join("\n"),
    seeAlso: ["temp-hp"],
  },
  {
    slug: "exhaustion-2014",
    name: "Exhaustion",
    edition: "2014",
    category: "Damage & Healing",
    body: [
      "Exhaustion is measured in **six cumulative levels** — a creature suffers its current level's effect **and every lower level's**:",
      "",
      "1. Disadvantage on ability checks",
      "2. Speed halved",
      "3. Disadvantage on attack rolls and saving throws",
      "4. Hit point maximum halved",
      "5. Speed reduced to 0",
      "6. **Death**",
      "",
      "Finishing a **long rest** removes one level, provided you've also had food and drink.",
      "",
      "*Differs by edition — switch the toggle to compare the 2024 version.*",
    ].join("\n"),
    seeAlso: ["exhaustion-2024", "long-rest"],
  },
  {
    slug: "exhaustion-2024",
    name: "Exhaustion",
    edition: "2024",
    category: "Damage & Healing",
    body: [
      "Exhaustion has **6 levels**, but each level applies the same scaling penalty rather than a unique effect:",
      "",
      "- A **−2 × your exhaustion level** penalty to **every d20 Test** (attack rolls, ability checks, and saving throws).",
      "- A **−5 ft × your exhaustion level** penalty to your Speed.",
      "- At **level 6**, you die.",
      "",
      "Finishing a **long rest** removes one level. So at level 3 you'd have −6 to all d20 Tests and −15 ft Speed.",
      "",
      "*Differs by edition — switch the toggle to compare the 2014 version.*",
    ].join("\n"),
    seeAlso: ["exhaustion-2014", "long-rest"],
  },

  // ── Spellcasting ─────────────────────────────────────────────────────────────
  {
    slug: "casting-a-spell",
    name: "Casting a Spell",
    edition: "both",
    category: "Spellcasting",
    body: [
      "Each spell lists its **casting time** (usually an action, sometimes a bonus action or reaction), **range**, **components**, and **duration**.",
      "",
      "**Components:** *Verbal* (V) — you must speak; *Somatic* (S) — a free hand to gesture; *Material* (M) — the listed items or a component pouch / focus. A spell consumes a material component only if it says so.",
      "",
      "Casting a spell with a **bonus action** on your turn limits you to casting only cantrips with your action that same turn.",
    ].join("\n"),
    seeAlso: ["concentration", "bonus-actions"],
  },
  {
    slug: "concentration",
    name: "Concentration",
    edition: "both",
    category: "Spellcasting",
    body: [
      "Some spells require **concentration** to keep them going. You can concentrate on **only one** spell at a time — casting a second concentration spell ends the first.",
      "",
      "Your concentration breaks if you: cast another concentration spell, are **incapacitated** or killed, or **fail a Constitution saving throw** when you take damage. That save's DC is **10 or half the damage taken, whichever is higher** (a separate save for each source of damage).",
    ].join("\n"),
    seeAlso: ["casting-a-spell", "action-ready"],
  },
  {
    slug: "advantage-disadvantage",
    name: "Advantage & Disadvantage",
    edition: "both",
    category: "Combat",
    body: [
      "With **advantage**, roll **two d20s and take the higher**. With **disadvantage**, roll two and take the **lower**.",
      "",
      "They don't stack: no matter how many sources apply, you have advantage or disadvantage, never \"double\" either. If you have **both** advantage and disadvantage on the same roll, they cancel and you roll a single d20 — even if one side has several sources and the other has just one.",
    ].join("\n"),
    seeAlso: ["action-help", "action-dodge"],
  },
  {
    slug: "inspiration-2014",
    name: "Inspiration",
    edition: "2014",
    category: "Combat",
    body: [
      "The GM can award **Inspiration** for playing your character's traits, ideals, bonds, or flaws well. You either have it or you don't — it doesn't stack.",
      "",
      "Spend Inspiration to gain **advantage on one attack roll, ability check, or saving throw**. You can also give yours to another player who you feel earned it.",
      "",
      "*Differs by edition — switch the toggle to compare the 2024 version.*",
    ].join("\n"),
    seeAlso: ["inspiration-2024", "advantage-disadvantage"],
  },
  {
    slug: "inspiration-2024",
    name: "Heroic Inspiration",
    edition: "2024",
    category: "Combat",
    body: [
      "The 2024 rules rename this **Heroic Inspiration** and change what it does: when you have it, you can expend it to **reroll any d20 immediately after rolling**, and you must use the new roll.",
      "",
      "You still can't hold more than one at a time. Many 2024 backgrounds and features hand it out more freely than 2014's GM-only award.",
      "",
      "*Differs by edition — switch the toggle to compare the 2014 version.*",
    ].join("\n"),
    seeAlso: ["inspiration-2014", "advantage-disadvantage"],
  },
]
