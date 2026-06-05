// Verify lib/character/resources.ts against SRD 5.1 anchors. Run: npx tsx scripts/test-resources.ts
import {
  getClassResources,
  mergeResources,
  clampUsed,
  type ClassResource,
} from "../lib/character/resources"
import type { Ability } from "../lib/character/constants"

let failures = 0
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures++
  console.log(`${ok ? "✓" : "✗"} ${label} — got ${JSON.stringify(actual)}${ok ? "" : `, expected ${JSON.stringify(expected)}`}`)
}

const mods = (charisma = 0): Record<Ability, number> => ({
  strength: 0, dexterity: 0, constitution: 0, intelligence: 0, wisdom: 0, charisma,
})
// First resource of a class at a level (most classes have one); helper for terse checks.
const res = (cls: string, level: number, cha = 0): ClassResource[] =>
  getClassResources(cls, level, mods(cha), "2014")
const find = (cls: string, level: number, key: string, cha = 0) =>
  res(cls, level, cha).find((r) => r.key === key)

// Barbarian Rage by level (SRD 5.1): 2/3/4/5/6 breakpoints, L20 unlimited.
check("rage L1 = 2", find("barbarian", 1, "rage")?.max, 2)
check("rage L3 = 3", find("barbarian", 3, "rage")?.max, 3)
check("rage L6 = 4", find("barbarian", 6, "rage")?.max, 4)
check("rage L11 = 4", find("barbarian", 11, "rage")?.max, 4)
check("rage L12 = 5", find("barbarian", 12, "rage")?.max, 5)
check("rage L16 = 5", find("barbarian", 16, "rage")?.max, 5)
check("rage L17 = 6", find("barbarian", 17, "rage")?.max, 6)
check("rage L18 = 6", find("barbarian", 18, "rage")?.max, 6)
check("rage L20 unlimited", find("barbarian", 20, "rage")?.unlimited, true)
check("rage recharges long rest", find("barbarian", 1, "rage")?.rechargeOn, "longRest")

// Monk Ki = monk level, from L2, short rest.
check("monk L1 = no resources", res("monk", 1).length, 0)
check("ki L2 = 2", find("monk", 2, "ki")?.max, 2)
check("ki L10 = 10", find("monk", 10, "ki")?.max, 10)
check("ki recharges short rest", find("monk", 5, "ki")?.rechargeOn, "shortRest")

// Sorcerer Sorcery Points = sorcerer level, from L2, long rest.
check("sorcerer L1 = no resources", res("sorcerer", 1).length, 0)
check("sorcery points L2 = 2", find("sorcerer", 2, "sorcery-points")?.max, 2)
check("sorcery points L20 = 20", find("sorcerer", 20, "sorcery-points")?.max, 20)

// Fighter: Second Wind (always), Action Surge (L2+, 2 uses at L17).
check("fighter L1 = second wind only", res("fighter", 1).map((r) => r.key), ["second-wind"])
check("second wind = 1", find("fighter", 1, "second-wind")?.max, 1)
check("action surge L2 = 1", find("fighter", 2, "action-surge")?.max, 1)
check("action surge L17 = 2", find("fighter", 17, "action-surge")?.max, 2)

// Bard Bardic Inspiration = max(1, CHA mod); long rest until Font of Inspiration (L5).
check("bardic inspiration = CHA mod", find("bard", 3, "bardic-inspiration", 3)?.max, 3)
check("bardic inspiration min 1", find("bard", 3, "bardic-inspiration", -1)?.max, 1)
check("bardic recharge L4 = long rest", find("bard", 4, "bardic-inspiration", 3)?.rechargeOn, "longRest")
check("bardic recharge L5 = short rest", find("bard", 5, "bardic-inspiration", 3)?.rechargeOn, "shortRest")

// Cleric Channel Divinity: 1 → 2 at L6 → 3 at L18 (none at L1), short rest.
check("cleric L1 = no resources", res("cleric", 1).length, 0)
check("channel divinity L2 = 1", find("cleric", 2, "channel-divinity")?.max, 1)
check("channel divinity L6 = 2", find("cleric", 6, "channel-divinity")?.max, 2)
check("channel divinity L18 = 3", find("cleric", 18, "channel-divinity")?.max, 3)

// Paladin: Lay on Hands = 5×level (long rest); Channel Divinity from L3 (1 use).
check("lay on hands L1 = 5", find("paladin", 1, "lay-on-hands")?.max, 5)
check("lay on hands L8 = 40", find("paladin", 8, "lay-on-hands")?.max, 40)
check("paladin L1 = lay on hands only", res("paladin", 1).map((r) => r.key), ["lay-on-hands"])
check("paladin L3 adds channel divinity", find("paladin", 3, "channel-divinity")?.max, 1)

// Pool resources (spent in bulk) get the "spend N" control; counts don't.
check("lay on hands is a pool", find("paladin", 1, "lay-on-hands")?.pool, true)
check("sorcery points is a pool", find("sorcerer", 2, "sorcery-points")?.pool, true)
check("rage is not a pool", find("barbarian", 1, "rage")?.pool, undefined)
check("ki is not a pool", find("monk", 2, "ki")?.pool, undefined)

// ─── 2024 (PHB) edition deltas — verified vs the 2024 PHB ─────────────────────
const find24 = (cls: string, level: number, key: string, cha = 0) =>
  getClassResources(cls, level, mods(cha), "2024").find((r) => r.key === key)

// Fighter Second Wind: 2 → 3 at L4 → 4 at L10 (2014 was a flat 1).
check("2024 second wind L1 = 2", find24("fighter", 1, "second-wind")?.max, 2)
check("2024 second wind L4 = 3", find24("fighter", 4, "second-wind")?.max, 3)
check("2024 second wind L10 = 4", find24("fighter", 10, "second-wind")?.max, 4)
check("2024 action surge L17 = 2 (unchanged)", find24("fighter", 17, "action-surge")?.max, 2)

// Cleric Channel Divinity: 2 → 3 at L6 → 4 at L18 (2014 was 1/2/3).
check("2024 cleric CD L2 = 2", find24("cleric", 2, "channel-divinity")?.max, 2)
check("2024 cleric CD L6 = 3", find24("cleric", 6, "channel-divinity")?.max, 3)
check("2024 cleric CD L18 = 4", find24("cleric", 18, "channel-divinity")?.max, 4)

// Paladin Channel Divinity: 2 at L3 → 3 at L11 (2014 was a flat 1).
check("2024 paladin CD L3 = 2", find24("paladin", 3, "channel-divinity")?.max, 2)
check("2024 paladin CD L11 = 3", find24("paladin", 11, "channel-divinity")?.max, 3)

// Monk Ki → "Focus Points" (same key + count = monk level).
check("2024 monk label = Focus Points", find24("monk", 5, "ki")?.name, "Focus Points")
check("2024 monk key still 'ki'", find24("monk", 5, "ki")?.key, "ki")
check("2024 focus points L10 = 10", find24("monk", 10, "ki")?.max, 10)

// Barbarian Rage: same counts, but L20 is capped (NOT unlimited) in 2024.
check("2024 rage L17 = 6", find24("barbarian", 17, "rage")?.max, 6)
check("2024 rage L20 not unlimited", find24("barbarian", 20, "rage")?.unlimited, false)

// Edition-stable resources are unchanged in 2024.
check("2024 sorcery points L20 = 20 (unchanged)", find24("sorcerer", 20, "sorcery-points")?.max, 20)
check("2024 lay on hands L8 = 40 (unchanged)", find24("paladin", 8, "lay-on-hands")?.max, 40)
check("2024 bardic inspiration = CHA (unchanged)", find24("bard", 3, "bardic-inspiration", 3)?.max, 3)

// Non-resource classes return [].
check("wizard = no resources", res("wizard", 20).length, 0)
check("rogue = no resources", res("rogue", 20).length, 0)
check("homebrew id = no resources", res("hb:custom", 20).length, 0)

// clampUsed + mergeResources: a stored spend above the live max clamps down.
const rageL1: ClassResource = { key: "rage", name: "Rage", max: 2, rechargeOn: "longRest" }
check("clampUsed over max", clampUsed(5, rageL1), 2)
check("clampUsed unlimited keeps value", clampUsed(9, { ...rageL1, unlimited: true }), 9)
const merged = mergeResources(res("barbarian", 1), [
  { _id: "row1", name: "Rage", data: { key: "rage", used: 5 } },
])
check("merge clamps used to max", merged[0]?.used, 2)
check("merge carries row id", merged[0]?.rowId, "row1")
check("merge no row → used 0", mergeResources(res("monk", 5), [])[0]?.used, 0)

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
