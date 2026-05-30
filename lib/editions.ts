// D&D 5e ruleset edition. Stamped per-campaign so edition-divergent rules
// (encounter difficulty math, exhaustion, grapple/shove, surprise, etc.) can
// branch on it. Default is the 2024 ruleset ("5.5e"), the current edition.
//
// This is the single source of truth for the edition flag — schema validators,
// Convex mutations, and UI all key off these. Verify any specific rule against
// the SRD 5.2 "Converting to SRD 5.2.1" guide before branching on it.

export type Edition = "2014" | "2024"

export const EDITIONS: Edition[] = ["2024", "2014"]

export const DEFAULT_EDITION: Edition = "2024"

export const EDITION_LABELS: Record<Edition, string> = {
  "2014": "2014 (5e)",
  "2024": "2024 (5.5e)",
}

export const EDITION_DESCRIPTIONS: Record<Edition, string> = {
  "2014": "Original 5th Edition (Player's Handbook 2014).",
  "2024": "Revised 5th Edition (Player's Handbook 2024).",
}

// Existing campaigns predate the flag — treat a missing edition as the default.
export const resolveEdition = (edition: string | undefined): Edition =>
  edition === "2014" || edition === "2024" ? edition : DEFAULT_EDITION
