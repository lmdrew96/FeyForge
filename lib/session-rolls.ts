import type { DiceRollResult } from "./dice-store"

// Shape pushed to convex/sessionRolls.pushRoll (minus sessionId, which the caller
// adds). Pure — no React/Convex deps — so the sheet, the initiative button, and
// any future roll surface map the SAME way.
export interface PushRollPayload {
  rollerName: string
  label?: string
  expression: string
  total: number
  dice: number[]
  dropped?: number[]
  modifier: number
  mode?: "advantage" | "disadvantage"
  isCrit?: boolean
  isD20: boolean
}

// Flatten a DiceRollResult into the feed payload: kept faces across all terms (so
// a nat 20 is visible), the adv/dis discards, and the d20/adv/dis/crit flags the
// feed renders. isD20 reads the FIRST term (the d20 in "1d20+mod") so damage rolls
// (a damage die first) never mis-flair as a nat 20.
export function rollToFeedArgs(
  result: DiceRollResult,
  rollerName: string,
): PushRollPayload {
  const dropped = result.terms.flatMap((t) => t.dropped)
  return {
    rollerName,
    label: result.label,
    expression: result.expression,
    total: result.total,
    dice: result.terms.flatMap((t) => t.rolls),
    dropped: dropped.length ? dropped : undefined,
    modifier: result.modifier,
    mode: result.isAdvantage
      ? "advantage"
      : result.isDisadvantage
        ? "disadvantage"
        : undefined,
    isCrit: result.isCrit,
    isD20: result.terms[0]?.sides === 20,
  }
}
