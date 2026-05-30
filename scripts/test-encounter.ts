// Ad-hoc verification of lib/encounter.ts against worked SRD examples.
// Run: npx tsx scripts/test-encounter.ts
import { computeEncounter, crToXp, encounterMultiplier2014 } from "../lib/encounter"

let failures = 0
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures++
  console.log(`${ok ? "✓" : "✗"} ${label} — got ${JSON.stringify(actual)}${ok ? "" : `, expected ${JSON.stringify(expected)}`}`)
}

// CR key lookups
check("crToXp string 1/4", crToXp("1/4"), 50)
check("crToXp numeric fallback 0.25", crToXp(undefined, 0.25), 50)
check("crToXp CR 5", crToXp("5"), 1800)
check("crToXp CR 0", crToXp("0"), 10)

// Multiplier ladder + party-size stepping
check("mult 1 monster / 4 party", encounterMultiplier2014(1, 4), 1)
check("mult 1 monster / 2 party (step up)", encounterMultiplier2014(1, 2), 1.5)
check("mult 4 monsters / 4 party", encounterMultiplier2014(4, 4), 2)
check("mult 4 monsters / 6 party (step down)", encounterMultiplier2014(4, 6), 1.5)

// Advisor's worked examples
// 1) 2014, 2 PCs @ L5, one CR5 → ×1.5 step-up → 2700 adjusted → Deadly (2200)
const c1 = computeEncounter([5, 5], [{ challengeRating: "5", quantity: 1 }], "2014")
check("2014 2xL5 vs CR5 — adjustedXp", c1.adjustedXp, 2700)
check("2014 2xL5 vs CR5 — difficulty", c1.difficulty, "Deadly")

// 2) 2014, 4 PCs @ L1, 4× CR1/4 → ×2 → 400 → Deadly (400)
const c2 = computeEncounter([1, 1, 1, 1], [{ challengeRating: "1/4", quantity: 4 }], "2014")
check("2014 4xL1 vs 4×CR1/4 — adjustedXp", c2.adjustedXp, 400)
check("2014 4xL1 vs 4×CR1/4 — difficulty", c2.difficulty, "Deadly")

// 3) 2024 boundary, 4 PCs @ L1, 4× CR1/4 = 200 raw, Low budget = 200 → exactly Low
const c3 = computeEncounter([1, 1, 1, 1], [{ challengeRating: "1/4", quantity: 4 }], "2024")
check("2024 4xL1 vs 4×CR1/4 — monsterXpTotal", c3.monsterXpTotal, 200)
check("2024 4xL1 vs 4×CR1/4 — difficulty (>= boundary)", c3.difficulty, "Low")

// 2024 worked example from search: 5 PCs @ L3 moderate = 225×5 = 1125
const c4 = computeEncounter([3, 3, 3, 3, 3], [{ challengeRating: "3", quantity: 1 }, { challengeRating: "2", quantity: 1 }], "2024")
check("2024 5xL3 moderate budget", c4.bands[1].partyBudget, 1125)

// Empty party → Trivial, no crash
const c5 = computeEncounter([], [{ challengeRating: "5", quantity: 1 }], "2024")
check("empty party — difficulty", c5.difficulty, "Trivial")

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
