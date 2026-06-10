// Treasure / loot generator — pure functions, no I/O, unit-tested (mirrors
// lib/encounter.ts). Coins + a weighted pick of magic items by rarity, scaled to
// the party's tier of play.
//
// LICENSING NOTE: the CC-BY SRD (5.1 and 5.2) contains a magic-item SUBSET but NO
// random-treasure tables — coin hoards and the d100 item tables are DMG content,
// which is NOT in the SRD. So the coin amounts and rarity weights below are
// FeyForge-ORIGINAL numbers, balanced by tier to feel like a milestone hoard —
// they are not a reproduction of any published table. Magic items come from the
// SRD-document-filtered Open5e pool (see lib/open5e-api getMagicItems), so the
// item NAMES that surface are already SRD-safe; this module never embeds prose.

// The five SRD rarities we generate. Artifacts are intentionally excluded — they're
// unique, setting-defining items, not random-hoard fare.
export type Rarity = "common" | "uncommon" | "rare" | "very rare" | "legendary"

export const RARITIES: Rarity[] = ["common", "uncommon", "rare", "very rare", "legendary"]

// Tier of play, 1–4, derived from average party level. Standard 5e tier structure
// (1–4 / 5–10 / 11–16 / 17–20); the *contents* of each tier are ours.
export type LootTier = 1 | 2 | 3 | 4

export interface CoinHoard {
  cp: number
  sp: number
  gp: number
  pp: number
}

// One magic item drawn into a hoard. `slug` is the Open5e key when sourced from
// the live pool (lets the UI deep-link to the Codex); name + rarity are enough to
// render and save.
export interface MagicItemPick {
  name: string
  rarity: Rarity
  slug?: string
}

// The shape the generator consumes — a normalized, SRD-safe item pool. Items whose
// rarity doesn't map to one of our five buckets are dropped by normalizeRarity.
export interface LootItem {
  name: string
  rarity: string
  slug?: string
}

export interface Hoard {
  tier: LootTier
  coins: CoinHoard
  items: MagicItemPick[]
  /** Total value in gp (coins only; magic items aren't priced). */
  totalGp: number
}

// ── Tier from party level ────────────────────────────────────────────────────

// Average level → tier of play, clamped to 1–4. An empty party defaults to tier 1.
export function partyTier(levels: number[]): LootTier {
  if (levels.length === 0) return 1
  const avg = levels.reduce((s, l) => s + l, 0) / levels.length
  if (avg <= 4) return 1
  if (avg <= 10) return 2
  if (avg <= 16) return 3
  return 4
}

// ── Dice ─────────────────────────────────────────────────────────────────────

type Rng = () => number

// Sum of `count`d`sides`, using the supplied rng (default Math.random). Each die
// is floor(rng()*sides)+1, so a uniform rng gives a uniform 1..sides.
function rollDice(count: number, sides: number, rng: Rng): number {
  let total = 0
  for (let i = 0; i < count; i++) total += Math.floor(rng() * sides) + 1
  return total
}

// ── Coins ────────────────────────────────────────────────────────────────────

// [count, sides, multiplier] — amount = (count d sides) × multiplier.
type CoinDice = [number, number, number]
interface CoinSpec {
  cp?: CoinDice
  sp?: CoinDice
  gp?: CoinDice
  pp?: CoinDice
}

// ORIGINAL coin scaling per tier (see the licensing note above). Roughly an order
// of magnitude per tier, with denomination mix shifting upward (cp/sp give way to
// gp/pp) as the party climbs.
const COIN_BY_TIER: Record<LootTier, CoinSpec> = {
  1: { cp: [3, 6, 100], sp: [2, 6, 100], gp: [2, 8, 10] },
  2: { sp: [2, 6, 100], gp: [4, 8, 10], pp: [2, 6, 10] },
  3: { gp: [2, 6, 1000], pp: [3, 6, 100] },
  4: { gp: [4, 6, 1000], pp: [3, 6, 1000] },
}

const coinAmount = (d: CoinDice | undefined, rng: Rng): number =>
  d ? rollDice(d[0], d[1], rng) * d[2] : 0

export function rollCoins(tier: LootTier, rng: Rng = Math.random): CoinHoard {
  const spec = COIN_BY_TIER[tier]
  return {
    cp: coinAmount(spec.cp, rng),
    sp: coinAmount(spec.sp, rng),
    gp: coinAmount(spec.gp, rng),
    pp: coinAmount(spec.pp, rng),
  }
}

// Total gp value of a coin hoard (10 cp = 1 sp, 10 sp = 1 gp, 1 pp = 10 gp).
export function coinsToGp(c: CoinHoard): number {
  const gp = c.cp / 100 + c.sp / 10 + c.gp + c.pp * 10
  return Math.round(gp * 100) / 100
}

// ── Magic items ──────────────────────────────────────────────────────────────

interface ItemTierSpec {
  // Inclusive item-count range [min, max] for the hoard.
  count: [number, number]
  // Relative weights per rarity (omitted rarities can't roll at this tier).
  weights: Partial<Record<Rarity, number>>
}

// ORIGINAL item-count + rarity weighting per tier: more items and rarer ones the
// higher the party climbs. Tier 1 can come up empty (a pile of coins, no item).
const ITEM_BY_TIER: Record<LootTier, ItemTierSpec> = {
  1: { count: [0, 2], weights: { common: 6, uncommon: 3, rare: 1 } },
  2: { count: [1, 3], weights: { common: 2, uncommon: 5, rare: 2, "very rare": 1 } },
  3: { count: [1, 4], weights: { uncommon: 2, rare: 4, "very rare": 3, legendary: 1 } },
  4: { count: [2, 5], weights: { rare: 2, "very rare": 4, legendary: 3 } },
}

// Map an arbitrary Open5e rarity string onto one of our five buckets, or null if it
// isn't one we generate (e.g. "Artifact", "Varies", "Unknown", "").
export function normalizeRarity(raw: string): Rarity | null {
  const r = raw.trim().toLowerCase()
  return (RARITIES as string[]).includes(r) ? (r as Rarity) : null
}

// Weighted random rarity pick, honoring only rarities that actually have items in
// the pool — so a tier that wants "legendary" but whose pool has none falls back to
// the rest of its weights instead of yielding an empty slot. Returns null only when
// the pool is empty for every weighted rarity.
function pickRarity(
  weights: Partial<Record<Rarity, number>>,
  available: Set<Rarity>,
  rng: Rng,
): Rarity | null {
  const entries = (Object.entries(weights) as [Rarity, number][]).filter(
    ([rarity, w]) => w > 0 && available.has(rarity),
  )
  if (entries.length === 0) return null
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let roll = rng() * total
  for (const [rarity, w] of entries) {
    roll -= w
    if (roll < 0) return rarity
  }
  return entries[entries.length - 1][0]
}

// Draw the hoard's magic items: roll a count, then for each slot pick a rarity by
// the tier's weights and a random unused item of that rarity. Items don't repeat
// within a hoard; the draw stops early if the pool runs dry.
export function rollMagicItems(
  tier: LootTier,
  pool: LootItem[],
  rng: Rng = Math.random,
): MagicItemPick[] {
  const spec = ITEM_BY_TIER[tier]
  const [min, max] = spec.count
  const count = min + Math.floor(rng() * (max - min + 1))
  if (count === 0) return []

  // Bucket the pool by normalized rarity once.
  const byRarity = new Map<Rarity, LootItem[]>()
  for (const it of pool) {
    const r = normalizeRarity(it.rarity)
    if (!r) continue
    const list = byRarity.get(r)
    if (list) list.push(it)
    else byRarity.set(r, [it])
  }

  const picks: MagicItemPick[] = []
  const usedNames = new Set<string>()
  for (let i = 0; i < count; i++) {
    const available = new Set<Rarity>(
      [...byRarity.entries()].filter(([, list]) => list.length > 0).map(([r]) => r),
    )
    const rarity = pickRarity(spec.weights, available, rng)
    if (!rarity) break // pool exhausted for every weighted rarity
    const list = byRarity.get(rarity)!
    const idx = Math.floor(rng() * list.length)
    const [item] = list.splice(idx, 1) // remove so it can't repeat in this hoard
    if (usedNames.has(item.name.toLowerCase())) {
      i-- // duplicate name (different slug) — try again without consuming a slot
      continue
    }
    usedNames.add(item.name.toLowerCase())
    picks.push({ name: item.name, rarity, slug: item.slug })
  }
  return picks
}

// ── Generate + format ────────────────────────────────────────────────────────

export function generateHoard(opts: {
  tier: LootTier
  pool: LootItem[]
  rng?: Rng
}): Hoard {
  const rng = opts.rng ?? Math.random
  const coins = rollCoins(opts.tier, rng)
  const items = rollMagicItems(opts.tier, opts.pool, rng)
  return { tier: opts.tier, coins, items, totalGp: coinsToGp(coins) }
}

const fmtNum = (n: number): string => n.toLocaleString("en-US")

const RARITY_LABEL: Record<Rarity, string> = {
  common: "common",
  uncommon: "uncommon",
  rare: "rare",
  "very rare": "very rare",
  legendary: "legendary",
}

// The coin line, largest denomination first, omitting empty ones. "—" if penniless.
export function formatCoins(c: CoinHoard): string {
  const parts: string[] = []
  if (c.pp) parts.push(`${fmtNum(c.pp)} pp`)
  if (c.gp) parts.push(`${fmtNum(c.gp)} gp`)
  if (c.sp) parts.push(`${fmtNum(c.sp)} sp`)
  if (c.cp) parts.push(`${fmtNum(c.cp)} cp`)
  return parts.length ? parts.join(", ") : "—"
}

// Render a hoard as the markdown stored in details.treasure / shown to the DM.
export function formatHoard(hoard: Hoard): string {
  const lines: string[] = []
  const coinLine = formatCoins(hoard.coins)
  const valueTail = hoard.totalGp > 0 ? ` _(≈ ${fmtNum(Math.round(hoard.totalGp))} gp)_` : ""
  lines.push(`**Coins:** ${coinLine}${valueTail}`)
  if (hoard.items.length > 0) {
    lines.push("")
    lines.push("**Magic items:**")
    for (const it of hoard.items) {
      lines.push(`- ${it.name} _(${RARITY_LABEL[it.rarity]})_`)
    }
  }
  return lines.join("\n")
}
