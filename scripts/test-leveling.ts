// Verify lib/character/leveling.ts against SRD anchors. Run: npx tsx scripts/test-leveling.ts
import {
  getCasterType,
  getSpellSlotsForClassLevel,
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

// Full caster anchor: wizard L5 = 4/3/2
check("full L5 slots", getSpellSlotsForClassLevel("wizard", 5), [
  { level: 1, total: 4 },
  { level: 2, total: 3 },
  { level: 3, total: 2 },
])

// Half caster: paladin L1 none, L2 first slot
check("paladin L1 = no slots", getSpellSlotsForClassLevel("paladin", 1), [])
check("paladin L2 = 2 first-level", getSpellSlotsForClassLevel("paladin", 2), [{ level: 1, total: 2 }])
check("ranger L5 = 4/2", getSpellSlotsForClassLevel("ranger", 5), [
  { level: 1, total: 4 },
  { level: 2, total: 2 },
])

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
const wiz5 = recomputeSpellcasting(wiz, "wizard", 5, 3)
check("wizard L5 DC bumps to 14", wiz5.spellSaveDC, 14) // 8+3+3
check("wizard L5 attack bumps to 6", wiz5.spellAttackBonus, 6) // 3+3
check("wizard L5 adds 3rd-level slot", wiz5.spellSlots.find((s) => s.level === 3)?.total, 2)
check("wizard L5 preserves used (clamped)", wiz5.spellSlots.find((s) => s.level === 1)?.used, 1)

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
