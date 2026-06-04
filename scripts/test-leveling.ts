// Verify lib/character/leveling.ts against SRD anchors. Run: npx tsx scripts/test-leveling.ts
import {
  getCasterType,
  getSpellSlotsForClassLevel,
  getPactSlots,
  getSpellLimits,
  hpGainForLevel,
  avgHitDieRoll,
  recomputeSpellcasting,
  type RecomputedSpellcasting,
} from "../lib/character/leveling"

let failures = 0
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures++
  console.log(`${ok ? "✓" : "✗"} ${label} — got ${JSON.stringify(actual)}${ok ? "" : `, expected ${JSON.stringify(expected)}`}`)
}

// Caster classification
check("wizard = full", getCasterType("wizard"), "full")
check("paladin = half", getCasterType("paladin"), "half")
check("warlock = pact", getCasterType("warlock"), "pact")
check("fighter = none", getCasterType("Fighter"), "none")

// Full caster anchor: wizard L5 = 4/3/2 (edition-agnostic)
check("full L5 slots", getSpellSlotsForClassLevel("wizard", 5, "2014"), [
  { level: 1, total: 4 },
  { level: 2, total: 3 },
  { level: 3, total: 2 },
])

// Half caster, 2014: paladin L1 none, L2 first slot
check("paladin L1 (2014) = no slots", getSpellSlotsForClassLevel("paladin", 1, "2014"), [])
check("paladin L2 (2014) = 2 first-level", getSpellSlotsForClassLevel("paladin", 2, "2014"), [{ level: 1, total: 2 }])
check("ranger L5 (2014) = 4/2", getSpellSlotsForClassLevel("ranger", 5, "2014"), [
  { level: 1, total: 4 },
  { level: 2, total: 2 },
])

// Half caster, 2024: spellcasting at L1 (two 1st-level slots); L2+ identical to 2014.
check("paladin L1 (2024) = 2 first-level", getSpellSlotsForClassLevel("paladin", 1, "2024"), [{ level: 1, total: 2 }])
check("ranger L1 (2024) = 2 first-level", getSpellSlotsForClassLevel("ranger", 1, "2024"), [{ level: 1, total: 2 }])
check(
  "paladin L5 (2024) == 2014",
  getSpellSlotsForClassLevel("paladin", 5, "2024"),
  getSpellSlotsForClassLevel("paladin", 5, "2014"),
)

// Warlock Pact Magic: unchanged across editions (L5 = two 3rd-level slots)
check("warlock pact L5 = 2 @ 3rd", getPactSlots(5), [{ level: 3, total: 2, used: 0 }])
check("warlock pact L11 = 3 @ 5th", getPactSlots(11), [{ level: 5, total: 3, used: 0 }])

// Spell-limit guidance: 2024 collapses everyone to fixed "Prepared" counts.
const half2024 = getSpellLimits("paladin", 9, 3, "2024")
check("paladin L9 (2024) prepared = 9", half2024?.leveled, 9)
check("paladin L9 (2024) label", half2024?.leveledLabel, "Prepared")
check("ranger L9 (2024) prepared = 9", getSpellLimits("ranger", 9, 3, "2024")?.leveled, 9)
check("warlock L11 (2024) prepared = 11", getSpellLimits("warlock", 11, 3, "2024")?.leveled, 11)
check("wizard L1 (2024) prepared = 4", getSpellLimits("wizard", 1, 3, "2024")?.leveled, 4)
// 2014 keeps the known/formula split.
check("ranger L5 (2014) known = 4", getSpellLimits("ranger", 5, 3, "2014")?.leveled, 4)
check("ranger L5 (2014) label", getSpellLimits("ranger", 5, 3, "2014")?.leveledLabel, "Spells known")
check("warlock L11 (2014) known = 11", getSpellLimits("warlock", 11, 3, "2014")?.leveled, 11)

// HP gain: average and floor
check("avg d10", avgHitDieRoll(10), 6)
check("hp gain d8 +2 avg", hpGainForLevel(8, 2), 7) // 5 + 2
check("hp gain floored at 1 (neg CON)", hpGainForLevel(6, -3), 1) // 4-3=1
check("hp gain neg CON below floor", hpGainForLevel(6, -5), 1) // 4-5=-1 → 1
check("hp gain rolled", hpGainForLevel(10, 3, 9), 12) // 9 + 3

// DC/attack rescale across the 4→5 proficiency boundary (prof 2→3)
const wiz: RecomputedSpellcasting = {
  ability: "intelligence",
  spellSaveDC: 13, // 8+2+3 at L4 (prof 2, int mod 3)
  spellAttackBonus: 5,
  spellSlots: [{ level: 1, total: 4, used: 1 }, { level: 2, total: 3, used: 0 }],
  cantripsKnown: 4,
}
const wiz5 = recomputeSpellcasting(wiz, "wizard", 5, 3, "2024")
check("wizard L5 DC bumps to 14", wiz5.spellSaveDC, 14) // 8+3+3
check("wizard L5 attack bumps to 6", wiz5.spellAttackBonus, 6) // 3+3
check("wizard L5 adds 3rd-level slot", wiz5.spellSlots.find((s) => s.level === 3)?.total, 2)
check("wizard L5 preserves used (clamped)", wiz5.spellSlots.find((s) => s.level === 1)?.used, 1)

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
