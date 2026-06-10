import { dedupeToolProficiencies } from "./character-data"

// Concrete options + resolution for the "language(s) of your choice" grants races
// and backgrounds give. Mirrors tool-choices.ts: a race's language list may carry
// "One of your choice" placeholders, and a background grants a bonus-language COUNT
// (BackgroundData.languages: number). Both resolve into concrete, distinct picks so
// a character never ends up knowing a language literally named "One of your choice".
//
// Druidic and Thieves' Cant are class-secret languages, not free picks, so they're
// excluded here. Language names aren't copyrightable — these are the standard 5e set.

export const STANDARD_LANGUAGES = [
  "Common", "Dwarvish", "Elvish", "Giant", "Gnomish", "Goblin", "Halfling", "Orc",
]

export const EXOTIC_LANGUAGES = [
  "Abyssal", "Celestial", "Deep Speech", "Draconic", "Infernal", "Primordial", "Sylvan", "Undercommon",
]

export const ALL_LANGUAGES = [...STANDARD_LANGUAGES, ...EXOTIC_LANGUAGES]

const CHOICE_RE = /of your choice/i
const COUNT_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4 }

// Split a race's language list into the concrete languages the character knows and
// the number of free-choice slots it grants ("One of your choice" → 1, "Two of your
// choice" → 2). An unrecognized leading count defaults to 1, so a choice is never
// silently dropped.
export function partitionRaceLanguages(raw: string[]): { fixed: string[]; choiceCount: number } {
  const fixed: string[] = []
  let choiceCount = 0
  for (const s of raw) {
    if (!CHOICE_RE.test(s)) {
      fixed.push(s)
      continue
    }
    const firstWord = s.trim().toLowerCase().split(/\s+/)[0]
    choiceCount += COUNT_WORDS[firstWord] ?? 1
  }
  return { fixed, choiceCount }
}

// The concrete picks for `count` choice slots given the player's (possibly partial)
// selection. Any slot left unset — or set to a language already fixed/known or taken
// by a sibling slot — falls back to the first still-unused option, so the result is
// always `count` distinct, concrete languages the character doesn't already have.
export function effectiveLanguagePicks(
  count: number,
  fixed: string[],
  chosen: string[] = [],
): string[] {
  const used = new Set(fixed.map((f) => f.toLowerCase()))
  const out: string[] = []
  for (let slot = 0; slot < count; slot++) {
    let val = chosen[slot]
    if (!val || used.has(val.toLowerCase()) || !ALL_LANGUAGES.includes(val)) {
      val = ALL_LANGUAGES.find((o) => !used.has(o.toLowerCase())) ?? ALL_LANGUAGES[0]
    }
    used.add(val.toLowerCase())
    out.push(val)
  }
  return out
}

// Total free-choice language slots: the race's "of your choice" placeholders plus
// the background's bonus-language count.
export function languageChoiceCount(raceLanguages: string[], backgroundLanguageCount: number): number {
  return partitionRaceLanguages(raceLanguages).choiceCount + Math.max(0, backgroundLanguageCount)
}

// Resolve the final, deduped language list: the race's fixed languages plus the
// player's picks for every choice slot (race placeholders + background count).
// Missing picks default to the first available language, so the result is always
// concrete — never a "One of your choice" placeholder, and the background's bonus
// languages (previously dropped) are honored. Passing [] auto-resolves every slot —
// used by the non-interactive paths (Quick Roll, From Concept).
export function resolveLanguages(
  raceLanguages: string[],
  backgroundLanguageCount: number,
  selections: string[] = [],
): string[] {
  const { fixed, choiceCount } = partitionRaceLanguages(raceLanguages)
  const total = choiceCount + Math.max(0, backgroundLanguageCount)
  const picks = effectiveLanguagePicks(total, fixed, selections)
  // dedupeToolProficiencies is a generic case-insensitive string-list de-duper.
  return dedupeToolProficiencies(fixed, picks)
}
