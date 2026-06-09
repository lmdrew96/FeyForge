// ── Living Diplomacy — pure shared logic ─────────────────────────────────────
// Campaign diplomacy overrides merged onto a map's base realm relations. This module
// is CLIENT-SAFE (no Convex/server imports): the merge runs server-side in
// worldMap.getWorldbuilding + diplomacy.feed, while the constants + headline helper run
// in the Realms & Faiths panel. Overrides are keyed by realm NAME (Azgaar indices
// scramble on re-import). See convex/schema.ts `diplomacyOverrides` + convex/diplomacy.ts.

import type { RealmInfo } from "./azgaar-map"

// The relationship statuses the DM editor offers — the SYMMETRIC set only (v1). Azgaar's
// asymmetric Vassal/Suzerain are deferred to v2; base data carrying them still displays
// read-only. Ordered alliance → enmity (matches the panel's REL_ORDER).
export const DIPLOMACY_STATUSES = ["Ally", "Friendly", "Rival", "Enemy"] as const
export type DiplomacyStatus = (typeof DIPLOMACY_STATUSES)[number]

// Sentinel status meaning "no relationship" — clears any base/override relation between
// the pair on both cards.
export const NEUTRAL = "Neutral"

export type RevealState = "pending" | "revealed" | "held" | "private"

export type DiplomacyShift = {
  changedAt: number
  from: string
  to: string
  dmNote?: string
  reveal: RevealState
  headline?: string
  revealedAt?: number
}

// Structural shape of a `diplomacyOverrides` row — deliberately NOT the Convex `Doc`
// type, so this module stays client-safe and unit-testable with plain objects.
export type DiplomacyOverride = {
  realmA: string
  realmB: string
  status: string
  log: DiplomacyShift[]
}

export type DiplomacyRole = "dm" | "player"

// Order an unordered realm pair so it maps to exactly one override row (realmA <= realmB).
export function pairKey(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a]
}

// localStorage key for a player's last-seen World News timestamp (per campaign). Shared
// by the in-session Realms-button unread badge + the Campaign Hub News tab, so viewing
// news in either surface clears the badge in the other.
export function worldNewsSeenKey(campaignId: string): string {
  return `feyforge:worldnews-seen:${campaignId}`
}

// The viewer-effective status for a pair:
//   DM     → the true current status.
//   player → the `to` of the most recent REVEALED shift (the last thing the party was
//            told); null when nothing's been revealed, so the base relation shows through.
export function effectiveStatus(o: DiplomacyOverride, role: DiplomacyRole): string | null {
  if (role === "dm") return o.status
  for (let i = o.log.length - 1; i >= 0; i--) {
    if (o.log[i].reveal === "revealed") return o.log[i].to
  }
  return null
}

// Merge campaign diplomacy overrides onto the base map realms, from `role`'s viewpoint.
// Pure: returns a new realms array (inputs untouched). An override upserts the relation
// SYMMETRICALLY on both realms' cards, or removes it when the effective status is Neutral;
// a pair with no base relation can introduce a brand-new one. Relations to realms not
// present in `realms` are dropped (e.g. a realm a later re-import removed) so a card never
// references a vanished realm.
export function mergeDiplomacy<T extends Pick<RealmInfo, "name" | "relations">>(
  realms: T[],
  overrides: DiplomacyOverride[],
  role: DiplomacyRole,
): T[] {
  if (overrides.length === 0) return realms
  const known = new Set(realms.map((r) => r.name))
  const REMOVE = "__remove__" // Map sentinel: clear this relation (≠ any real status)

  // realmName → (otherRealmName → status | REMOVE)
  const applied = new Map<string, Map<string, string>>()
  const put = (self: string, other: string, val: string) => {
    if (!known.has(self) || !known.has(other)) return
    let m = applied.get(self)
    if (!m) {
      m = new Map()
      applied.set(self, m)
    }
    m.set(other, val)
  }
  for (const o of overrides) {
    const eff = effectiveStatus(o, role)
    if (eff === null) continue // player + nothing revealed → leave base untouched
    const val = eff === NEUTRAL ? REMOVE : eff
    put(o.realmA, o.realmB, val)
    put(o.realmB, o.realmA, val)
  }
  if (applied.size === 0) return realms

  return realms.map((r) => {
    const m = applied.get(r.name)
    if (!m) return r
    const base = r.relations ?? []
    const next = base.filter((rel) => !m.has(rel.realm)) // drop any overridden/removed
    for (const [other, val] of m) {
      if (val === REMOVE) continue
      next.push({ relation: val, realm: other })
    }
    return { ...r, relations: next.length ? next : undefined }
  })
}

// Prefilled, editable player-facing headline for a shift. The DM rewrites it at reveal
// time — this is the seam the AI-hooks thread (③) plugs into. Tone-matched: a warm→cold
// flip "shatters," a cold→warm flip "makes peace," otherwise a per-status line.
export function autoHeadline(realmA: string, realmB: string, to: string, from?: string): string {
  const warm = (s?: string) => s === "Ally" || s === "Friendly"
  const cold = (s?: string) => s === "Enemy" || s === "Rival"
  if (warm(from) && cold(to)) return `The ${realmA}–${realmB} alliance has shattered.`
  if (cold(from) && warm(to)) return `${realmA} and ${realmB} have made peace.`
  switch (to) {
    case "Ally":
      return `${realmA} and ${realmB} have forged an alliance.`
    case "Friendly":
      return `Relations warm between ${realmA} and ${realmB}.`
    case "Rival":
      return `A rivalry stirs between ${realmA} and ${realmB}.`
    case "Enemy":
      return `${realmA} and ${realmB} stand on the brink of war.`
    case NEUTRAL:
      return `${realmA} and ${realmB} have parted ways.`
    default:
      return `Something shifts between ${realmA} and ${realmB}.`
  }
}
