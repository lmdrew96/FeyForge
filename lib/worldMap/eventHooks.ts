// ── World Events → plot hooks — Tier 1 (pure, client-safe) ───────────────────
// Turns an Azgaar world event (worldMaps.worldEvents[]) into a table-ready DM plot
// seed with NO AI — pure derivation from the event's own data: its type → a narrative
// archetype, plus the realms and settlements its cells touch. This is the always-on
// fallback behind the premium AI flesh-out (Tier 2, app/api/world-map/world-event-hook):
// it works for every event, for free users, when the daily AI quota is spent, and on
// sparse maps that lack scope/place data.
//
// CLIENT-SAFE (no Convex/server imports): runs in the DM world-map panel
// (WorldEventsControl). Structural types — deliberately NOT the Convex Doc — keep it
// unit-testable with plain objects, mirroring lib/worldMap/diplomacy.ts. See
// convex/schema.ts `worldEvents` + lib/worldMap/azgaar-map.ts ZoneInfo/EventPlace.

import type { EventPlace } from "./azgaar-map"

export type EventArchetype =
  | "conflict"
  | "religious"
  | "disaster"
  | "affliction"
  | "flux"
  | "generic"

export type ScopeBand = "Localized" | "Regional" | "Widespread"

// Structural shape of a worldEvents[] element — only the fields the template reads.
export type WorldEventLike = {
  name: string
  type: string
  cellCount?: number
  places?: EventPlace[]
}

export type EventHookTemplate = {
  archetype: EventArchetype
  scope: ScopeBand | null
  realms: string[] // involved realms (unique), from places[].town.realm
  settlements: string[] // affected settlement names (unique)
  hook: string // the derived, table-ready plot seed
}

// Geographic reach band from how many Azgaar cells the zone spans. This is the
// CANONICAL band logic — the map page (eventScope) imports it, so the panel badge and
// the hook prose can never drift. Bands assume Azgaar's default ~10k-cell resolution
// (true of every map we've seen); a high-res import would over-count — retune here.
// Returns null when the count is absent (pre-v0.86 maps) so callers simply omit scope.
export function eventScopeBand(cellCount?: number): ScopeBand | null {
  if (!cellCount || cellCount <= 0) return null
  if (cellCount <= 8) return "Localized"
  if (cellCount <= 40) return "Regional"
  return "Widespread"
}

// Keyword sets for routing a raw Azgaar type/name to a narrative archetype. Matched as
// substrings (lowercased) so "Invasion of the North" and "Rebels" both land on conflict.
const CONFLICT = ["invasion", "rebel", "raid", "pirate", "conquest", "war", "siege"]
const RELIGIOUS = ["proselyt", "crusade", "schism", "heresy", "inquisition"]
const AFFLICTION = ["disease", "epidemic", "plague", "famine", "dearth", "pestilence", "blight"]
const DISASTER = [
  "disaster", "eruption", "volcan", "flood", "tsunami", "earthquake", "quake", "fault",
  "landslide", "avalanche", "wildfire", "drought", "storm", "cataclysm",
]
const FLUX = ["trade", "mine", "migration", "gold rush", "boom", "exodus"]

const hits = (haystack: string, needles: string[]): boolean =>
  needles.some((k) => haystack.includes(k))

// Map an Azgaar event to its narrative archetype. The NAME is more specific than
// Azgaar's coarse `type` bucket, so it's sniffed first — crucially, Azgaar files
// Famine/Dearth under type "Disaster", so a "Great Famine" must read as a slow
// humanitarian affliction, not a geological calamity. Order: affliction-by-name →
// religious → conflict → affliction-by-type → disaster → flux → generic fallback.
export function archetypeFor(type: string, name: string): EventArchetype {
  const t = type.toLowerCase()
  const n = name.toLowerCase()
  if (hits(n, AFFLICTION)) return "affliction"
  if (hits(n, RELIGIOUS) || hits(t, RELIGIOUS)) return "religious"
  if (hits(n, CONFLICT) || hits(t, CONFLICT)) return "conflict"
  if (hits(t, AFFLICTION)) return "affliction"
  if (hits(n, DISASTER) || hits(t, DISASTER)) return "disaster"
  if (hits(n, FLUX) || hits(t, FLUX)) return "flux"
  return "generic"
}

const uniq = (arr: (string | undefined)[]): string[] => {
  const out: string[] = []
  const local = new Set<string>()
  for (const raw of arr) {
    const s = raw?.trim()
    if (!s || local.has(s)) continue
    local.add(s)
    out.push(s)
  }
  return out
}

// Natural-language list: "Aldermoor", "Aldermoor and Castle Grey", "A, B, and C",
// "A, B, and 4 more". Capped so a continent-spanning event doesn't dump 30 names.
function joinNames(names: string[], max = 3): string {
  if (names.length === 0) return ""
  if (names.length === 1) return names[0]
  if (names.length <= max) {
    if (names.length === 2) return `${names[0]} and ${names[1]}`
    return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`
  }
  return `${names.slice(0, max).join(", ")}, and ${names.length - max} more`
}

const SCOPE_WORD: Record<ScopeBand, string> = {
  Localized: "localized",
  Regional: "regional",
  Widespread: "widespread",
}

function buildHook(
  archetype: EventArchetype,
  name: string,
  scope: ScopeBand | null,
  realms: string[],
  settlements: string[],
): string {
  const where = settlements.length ? joinNames(settlements) : "the surrounding settlements"
  const realmClause =
    realms.length === 1
      ? ` in ${realms[0]}`
      : realms.length > 1
        ? ` across ${joinNames(realms)}`
        : ""
  const reach = scope ? `${SCOPE_WORD[scope]} ` : ""
  switch (archetype) {
    case "conflict":
      return `A ${reach}war stirs${realmClause}, and ${where} lie in its shadow. Soldiers, refugees, and opportunists are already moving — the party can be hired to escort, scout, or sabotage before the front reaches them, and learn who truly profits from the bloodshed.`
    case "religious":
      return `A ${reach}religious fervor sweeps${realmClause}, and ${where} are caught in the tide. Shrines are seized and converts pressed — the party may be asked to protect the faithful, smuggle a dissenter out, or expose the power behind the zeal.`
    case "disaster":
      return `A ${reach}calamity has struck${realmClause}, leaving ${where} reeling. Roads are cut and survivors stranded — the party can mount a rescue, secure dwindling supplies, or uncover why this disaster was no accident of nature.`
    case "affliction":
      return `A ${reach}sickness spreads${realmClause}, and ${where} are falling. Quarantines fray and desperation rises — the party might escort a healer through the cordon, hunt the source, or ration a cure that every faction wants for itself.`
    case "flux":
      return `A ${reach}turn of fortune ripples${realmClause}, and ${where} feel it first. New wealth, ruined trades, and shifting populations breed both opportunity and grudge — the party can broker a deal, guard a caravan, or exploit the chaos before it settles.`
    case "generic":
    default:
      return `${name} unsettles${realmClause || " the region"}, and ${where} are drawn in. The party arrives as the situation tips — and what they choose next decides which way it falls.`
  }
}

// Derive the full Tier-1 template for one world event. Pure: degrades gracefully when
// places (no realms/settlements) or cellCount (no scope) are absent.
export function eventTemplate(event: WorldEventLike): EventHookTemplate {
  const archetype = archetypeFor(event.type, event.name)
  const scope = eventScopeBand(event.cellCount)
  const places = event.places ?? []
  const realms = uniq(places.map((p) => p.town?.realm))
  const settlements = uniq(places.map((p) => p.name))
  return {
    archetype,
    scope,
    realms,
    settlements,
    hook: buildHook(archetype, event.name, scope, realms, settlements),
  }
}
