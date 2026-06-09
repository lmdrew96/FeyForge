// Dependency-free homebrew-id helpers. Kept in their own leaf module (no character
// data / Convex imports) so they're unit-testable in isolation — lib/homebrew.ts
// pulls heavy `@/`-aliased modules that the test runner can't resolve. Re-exported
// from lib/homebrew.ts for existing callers.

// partitionHomebrew() prefixes homebrew ids ("hb:<convexId>") so they're
// distinguishable from SRD slugs across the builders and pickers.
export const HB_PREFIX = "hb:"

export function isHomebrewId(id: string): boolean {
  return id.startsWith(HB_PREFIX)
}

// Strip the "hb:" prefix off a prefixed HomebrewMonster.id to recover the raw Convex
// Id<"homebrew"> (what an NPC's statblockRef stores). Round-trips with the prefixed
// ids partitionHomebrew() hands out, so callers can match a stored ref against the
// live homebrew list: homebrewMonsters.find(m => rawHomebrewId(m.id) === ref.homebrewId).
export function rawHomebrewId(prefixedId: string): string {
  return prefixedId.startsWith(HB_PREFIX) ? prefixedId.slice(HB_PREFIX.length) : prefixedId
}
