import { describe, expect, it } from "vitest"
import {
  partyTier,
  rollCoins,
  coinsToGp,
  normalizeRarity,
  rollMagicItems,
  generateHoard,
  formatCoins,
  formatHoard,
  type LootItem,
} from "./loot"

// Deterministic rng for reproducible rolls (mulberry32). Seeded per-test so the
// same seed always produces the same hoard.
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// rng that always returns 0 → every die lands on its minimum face (1).
const zero = () => 0
// rng just under 1 → every die lands on its maximum face.
const nearOne = () => 0.999999

const POOL: LootItem[] = [
  { name: "Potion of Healing", rarity: "Common", slug: "potion-of-healing" },
  { name: "Bag of Holding", rarity: "Uncommon", slug: "bag-of-holding" },
  { name: "Cloak of Protection", rarity: "Uncommon", slug: "cloak-of-protection" },
  { name: "Flame Tongue", rarity: "Rare", slug: "flame-tongue" },
  { name: "Staff of Power", rarity: "Very Rare", slug: "staff-of-power" },
  { name: "Vorpal Sword", rarity: "Legendary", slug: "vorpal-sword" },
  { name: "The One Ring", rarity: "Artifact", slug: "the-one-ring" }, // excluded
]

describe("partyTier", () => {
  it("maps average level to a tier, clamped 1–4", () => {
    expect(partyTier([])).toBe(1)
    expect(partyTier([1, 2, 3, 4])).toBe(1) // avg 2.5
    expect(partyTier([4, 4, 4, 4])).toBe(1) // boundary: 4 → tier 1
    expect(partyTier([5, 5])).toBe(2)
    expect(partyTier([10, 10])).toBe(2) // boundary: 10 → tier 2
    expect(partyTier([11, 11])).toBe(3)
    expect(partyTier([16, 16])).toBe(3) // boundary: 16 → tier 3
    expect(partyTier([17, 20])).toBe(4)
  })
})

describe("rollCoins", () => {
  it("min roll (rng→0) gives each die its minimum", () => {
    // Tier 1: cp 3d6×100, sp 2d6×100, gp 2d8×10. All ones → 3×100, 2×100, 2×10.
    expect(rollCoins(1, zero)).toEqual({ cp: 300, sp: 200, gp: 20, pp: 0 })
  })

  it("max roll (rng→~1) gives each die its maximum", () => {
    // Tier 1 maxes: cp 18×100, sp 12×100, gp 16×10.
    expect(rollCoins(1, nearOne)).toEqual({ cp: 1800, sp: 1200, gp: 160, pp: 0 })
  })

  it("higher tiers introduce pp and drop cp", () => {
    const t4 = rollCoins(4, zero)
    expect(t4.cp).toBe(0)
    expect(t4.sp).toBe(0)
    expect(t4.pp).toBeGreaterThan(0)
    expect(t4.gp).toBeGreaterThan(0)
  })
})

describe("coinsToGp", () => {
  it("converts denominations to a gp total", () => {
    expect(coinsToGp({ cp: 100, sp: 10, gp: 5, pp: 2 })).toBe(27) // 1 + 1 + 5 + 20
    expect(coinsToGp({ cp: 0, sp: 0, gp: 0, pp: 0 })).toBe(0)
  })
})

describe("normalizeRarity", () => {
  it("maps the five SRD rarities case-insensitively", () => {
    expect(normalizeRarity("Common")).toBe("common")
    expect(normalizeRarity("VERY RARE")).toBe("very rare")
    expect(normalizeRarity("legendary")).toBe("legendary")
  })

  it("rejects artifacts and junk", () => {
    expect(normalizeRarity("Artifact")).toBeNull()
    expect(normalizeRarity("Varies")).toBeNull()
    expect(normalizeRarity("")).toBeNull()
  })
})

describe("rollMagicItems", () => {
  it("returns no items from an empty pool", () => {
    expect(rollMagicItems(3, [], seeded(1))).toEqual([])
  })

  it("never picks an artifact or repeats an item", () => {
    for (let s = 0; s < 25; s++) {
      const picks = rollMagicItems(4, POOL, seeded(s))
      const names = picks.map((p) => p.name)
      expect(names).not.toContain("The One Ring")
      expect(new Set(names).size).toBe(names.length) // no repeats
      for (const p of picks) {
        expect(["common", "uncommon", "rare", "very rare", "legendary"]).toContain(p.rarity)
        // the pick's declared rarity matches the pool entry it came from
        const src = POOL.find((x) => x.name === p.name)!
        expect(normalizeRarity(src.rarity)).toBe(p.rarity)
      }
    }
  })

  it("respects the tier item-count range", () => {
    for (let s = 0; s < 25; s++) {
      // Tier 1 allows 0–2; the pool has items of every rarity so count isn't pool-limited.
      const n = rollMagicItems(1, POOL, seeded(s)).length
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThanOrEqual(2)
    }
  })

  it("is deterministic for a given seed", () => {
    expect(rollMagicItems(3, POOL, seeded(42))).toEqual(rollMagicItems(3, POOL, seeded(42)))
  })
})

describe("generateHoard", () => {
  it("produces coins, items, and a gp total", () => {
    const h = generateHoard({ tier: 2, pool: POOL, rng: seeded(7) })
    expect(h.tier).toBe(2)
    expect(h.totalGp).toBe(coinsToGp(h.coins))
    expect(Array.isArray(h.items)).toBe(true)
  })
})

describe("formatting", () => {
  it("formatCoins lists largest denomination first, omitting zeros", () => {
    expect(formatCoins({ cp: 0, sp: 50, gp: 120, pp: 3 })).toBe("3 pp, 120 gp, 50 sp")
    expect(formatCoins({ cp: 0, sp: 0, gp: 0, pp: 0 })).toBe("—")
  })

  it("formatCoins adds thousands separators", () => {
    expect(formatCoins({ cp: 0, sp: 0, gp: 14000, pp: 0 })).toBe("14,000 gp")
  })

  it("formatHoard renders coins + a magic-item list", () => {
    const md = formatHoard({
      tier: 3,
      coins: { cp: 0, sp: 0, gp: 5000, pp: 100 },
      items: [
        { name: "Flame Tongue", rarity: "rare" },
        { name: "Staff of Power", rarity: "very rare" },
      ],
      totalGp: 6000,
    })
    expect(md).toContain("**Coins:** 100 pp, 5,000 gp")
    expect(md).toContain("≈ 6,000 gp")
    expect(md).toContain("- Flame Tongue _(rare)_")
    expect(md).toContain("- Staff of Power _(very rare)_")
  })

  it("formatHoard omits the item section when there are none", () => {
    const md = formatHoard({ tier: 1, coins: { cp: 300, sp: 0, gp: 0, pp: 0 }, items: [], totalGp: 3 })
    expect(md).toContain("**Coins:** 300 cp")
    expect(md).not.toContain("Magic items")
  })
})
