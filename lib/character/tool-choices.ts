import { dedupeToolProficiencies } from "./character-data"

// Concrete options for the "one type of <category>" tool-proficiency choices some
// classes and backgrounds grant. Tool names + game categories aren't copyrightable
// — these are the standard 5e sets.

export const GAMING_SETS = [
  "Dice set", "Dragonchess set", "Playing card set", "Three-Dragon Ante set",
]

export const ARTISANS_TOOLS = [
  "Alchemist's supplies", "Brewer's supplies", "Calligrapher's supplies", "Carpenter's tools",
  "Cartographer's tools", "Cobbler's tools", "Cook's utensils", "Glassblower's tools",
  "Jeweler's tools", "Leatherworker's tools", "Mason's tools", "Painter's supplies",
  "Potter's tools", "Smith's tools", "Tinker's tools", "Weaver's tools", "Woodcarver's tools",
]

export const MUSICAL_INSTRUMENTS = [
  "Bagpipes", "Drum", "Dulcimer", "Flute", "Horn", "Lute", "Lyre", "Pan flute", "Shawm", "Viol",
]

// Non-choice tools that round out the free-text autocomplete on the edit page.
const OTHER_TOOLS = [
  "Disguise kit", "Forgery kit", "Herbalism kit", "Navigator's tools",
  "Poisoner's kit", "Thieves' tools", "Vehicles (land)", "Vehicles (water)",
]

// Flat list for free-text tool autocompletion (edit-page datalist).
export const COMMON_TOOLS = [
  ...ARTISANS_TOOLS, ...OTHER_TOOLS, ...GAMING_SETS, ...MUSICAL_INSTRUMENTS,
]

// A tool-proficiency entry that requires the player to pick concrete tool(s),
// e.g. "One type of gaming set" or "Three musical instruments of your choice".
export interface ToolChoice {
  id: string        // stable key (index-based) for React + the selection map
  label: string     // human label for the picker, e.g. "Gaming set"
  source: string    // the original placeholder string
  count: number     // how many distinct tools to pick (1, or 3 for the Bard)
  options: string[] // concrete tools to choose from
}

const CHOICE_RE = /one type of|of your choice/i

// Split raw tool-proficiency strings into the fixed ones (kept verbatim) and the
// choices the player must resolve. An unrecognized "choice" phrasing falls back to
// fixed so nothing is ever silently dropped.
export function partitionToolProficiencies(
  raw: string[],
): { fixed: string[]; choices: ToolChoice[] } {
  const fixed: string[] = []
  const choices: ToolChoice[] = []

  raw.forEach((s, i) => {
    if (!CHOICE_RE.test(s)) {
      fixed.push(s)
      return
    }
    const lower = s.toLowerCase()
    const artisan = lower.includes("artisan")
    const instrument = lower.includes("instrument")
    const gaming = lower.includes("gaming")
    const three = lower.includes("three")

    let label: string
    let options: string[]
    let count = 1

    if (gaming) {
      label = "Gaming set"
      options = GAMING_SETS
    } else if (artisan && instrument) {
      label = "Artisan's tools or instrument"
      options = [...ARTISANS_TOOLS, ...MUSICAL_INSTRUMENTS]
    } else if (artisan) {
      label = "Artisan's tools"
      options = ARTISANS_TOOLS
    } else if (instrument) {
      label = three ? "Musical instruments" : "Musical instrument"
      options = MUSICAL_INSTRUMENTS
      count = three ? 3 : 1
    } else {
      // Unknown choice phrasing — keep it so it can still be resolved by hand.
      fixed.push(s)
      return
    }

    choices.push({ id: `tool-choice-${i}`, label, source: s, count, options })
  })

  return { fixed, choices }
}

// The concrete picks for a single choice given the player's (possibly partial)
// selection. Any slot left unset falls back to the first still-unused option, so
// the result is always `count` distinct, concrete tools — never a placeholder.
export function effectivePicks(choice: ToolChoice, chosen: string[] = []): string[] {
  const used = new Set<string>()
  const out: string[] = []
  for (let slot = 0; slot < choice.count; slot++) {
    let val = chosen[slot]
    if (!val || used.has(val) || !choice.options.includes(val)) {
      val = choice.options.find((o) => !used.has(o)) ?? choice.options[0]
    }
    used.add(val)
    out.push(val)
  }
  return out
}

// Resolve the final, deduped tool list from the raw grants plus the player's
// selections (keyed by ToolChoice.id). Missing selections default to the first
// available option, so the result is always concrete. Passing `{}` auto-resolves
// every choice — used by the non-interactive paths (Quick Roll, From Concept).
export function resolveToolProficiencies(
  raw: string[],
  selections: Record<string, string[]> = {},
): string[] {
  const { fixed, choices } = partitionToolProficiencies(raw)
  const picks = choices.flatMap((c) => effectivePicks(c, selections[c.id]))
  return dedupeToolProficiencies(fixed, picks)
}

// Convenience for the non-interactive creation paths (no picker UI).
export function autoResolveToolProficiencies(raw: string[]): string[] {
  return resolveToolProficiencies(raw, {})
}
