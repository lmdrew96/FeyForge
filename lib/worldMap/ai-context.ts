// Compact, DM-facing world summary for AI prompts.
//
// The World Map upgrades (realms & faiths, world events, the settlement
// gazetteer) gave the app a lot of structured worldbuilding that the AI surfaces
// never saw. This formatter turns that data into a short context block so the DM
// Assistant (and future AI surfaces) answer FROM the DM's actual world — naming
// their real realms, faiths, towns, and active events instead of inventing new
// ones that contradict the map.
//
// Pure + isomorphic. Everything is optional and capped, so it degrades to "" when
// a campaign has no map and never bloats the prompt when it does. This is DM-only
// context (the Assistant is a DM tool), so DM-secret world events are fair game.

import type { FaithInfo, RealmInfo, ZoneInfo } from "./azgaar-map"

type SettlementLike = {
  name: string
  type?: string
  town?: { population?: number; realm?: string; government?: string } | null
}

const REALM_LIMIT = 8
const FAITH_LIMIT = 6
const SETTLEMENT_LIMIT = 12
const EVENT_LIMIT = 6
const RELATIONS_PER_REALM = 4

const byPopDesc = <T extends { population?: number }>(a: T, b: T): number =>
  (b.population ?? 0) - (a.population ?? 0)

export function formatWorldContext(opts: {
  mapName?: string | null
  realms?: RealmInfo[] | null
  faiths?: FaithInfo[] | null
  worldEvents?: ZoneInfo[] | null
  settlements?: SettlementLike[] | null
}): string {
  const sections: string[] = []

  const realms = (opts.realms ?? []).filter((r) => r.name)
  if (realms.length) {
    const lines = [...realms]
      .sort(byPopDesc)
      .slice(0, REALM_LIMIT)
      .map((r) => {
        const head = r.form ? `${r.name} (${r.form})` : r.name
        const tail: string[] = []
        if (r.capital) tail.push(`capital ${r.capital}`)
        if (r.culture) tail.push(`${r.culture} people`)
        const rel = (r.relations ?? [])
          .filter((x) => x.relation && x.realm)
          .slice(0, RELATIONS_PER_REALM)
          .map((x) => `${x.relation} of ${x.realm}`)
        if (rel.length) tail.push(rel.join(", "))
        return `- ${head}${tail.length ? ` — ${tail.join("; ")}` : ""}`
      })
    sections.push(`Realms & powers:\n${lines.join("\n")}`)
  }

  const faiths = (opts.faiths ?? []).filter((f) => f.name)
  if (faiths.length) {
    const lines = faiths.slice(0, FAITH_LIMIT).map((f) => {
      const tail: string[] = []
      if (f.form) tail.push(f.form)
      if (f.deity) tail.push(`worships ${f.deity}`)
      if (f.type) tail.push(f.type.toLowerCase())
      return `- ${f.name}${tail.length ? ` — ${tail.join("; ")}` : ""}`
    })
    sections.push(`Faiths:\n${lines.join("\n")}`)
  }

  const settlements = (opts.settlements ?? []).filter((s) => s.type === "settlement" && s.name)
  if (settlements.length) {
    const lines = [...settlements]
      .sort((a, b) => (b.town?.population ?? 0) - (a.town?.population ?? 0))
      .slice(0, SETTLEMENT_LIMIT)
      .map((s) => {
        const tail: string[] = []
        if (s.town?.realm) tail.push(s.town.realm)
        if (s.town?.population) tail.push(`pop. ~${s.town.population.toLocaleString()}`)
        return `- ${s.name}${tail.length ? ` (${tail.join(", ")})` : ""}`
      })
    sections.push(`Notable settlements:\n${lines.join("\n")}`)
  }

  const events = (opts.worldEvents ?? []).filter((e) => e.name)
  if (events.length) {
    const lines = events.slice(0, EVENT_LIMIT).map((e) => {
      const near = (e.places ?? [])
        .slice(0, 3)
        .map((p) => p.name)
        .filter(Boolean)
      return `- ${e.name} (${e.type})${near.length ? ` — near ${near.join(", ")}` : ""}`
    })
    sections.push(`Active world events (DM-only plot threads):\n${lines.join("\n")}`)
  }

  if (sections.length === 0) return ""

  const header = opts.mapName
    ? `World map "${opts.mapName}" — the campaign world includes:`
    : "The campaign world includes:"
  return `\n\n${header}\n${sections.join("\n\n")}\n\nGround your answers in this world: name these real realms, faiths, settlements, and events rather than inventing ones that contradict the map, and keep suggestions consistent with the diplomacy and active events above.`
}
