// Watabou Medieval Fantasy City Generator (MFCG) drill-down link builder.
//
// Per docs/specs/feyforge-drilldown-spec.md: settlement pins drill down into
// MFCG embedded via <iframe> pointing at Watabou's LIVE site (not by hosting his
// output — license-sensitive). This builds the per-settlement URL from the
// Azgaar burg data at IMPORT time; the result is stored on mapLocations.drillDownUrl
// so we never recompute it at render.
//
// Only the `size` heuristic is uncertain — Azgaar has changed population→size
// mapping across versions. Verify once against a live "See in City Generator"
// link (see the spec's ⚠️ note) and adjust SIZE_FROM_POP if it's off.

/** Burg fields we rely on (a subset of Azgaar's pack.burgs[n]). */
export interface AzgaarBurg {
  i: number
  name: string
  population: number // in THOUSANDS (e.g. 5.782 = 5,782 people)
  capital?: number // 1 | 0
  port?: number | null // truthy (cell id) = has port
  citadel?: number // 1 | 0
  plaza?: number // 1 | 0  (market)
  walls?: number // 1 | 0
  shanty?: number // 1 | 0  (shantytown)
  temple?: number // 1 | 0
  MFCG?: number | null // custom MFCG seed (overrides computed seed)
  link?: string | null // custom full MFCG URL (overrides everything)
}

const MFCG_BASE = "https://watabou.github.io/city-generator/"

// MFCG's coarse size knob, derived from Azgaar's population point. Clamped 2–60.
// ⚠️ The one fuzzy param — confirm against a live link before locking (spec note).
const SIZE_FROM_POP = (populationThousands: number): number =>
  Math.max(2, Math.min(60, Math.round(populationThousands)))

/**
 * Build the MFCG drill-down URL for a settlement burg.
 * Precedence: explicit link  >  custom MFCG seed  >  computed seed (mapSeed+burgId).
 */
export function buildMfcgUrl(burg: AzgaarBurg, mapSeed: string): string {
  // 1. DM/Azgaar-customized full link wins outright.
  if (burg.link) return burg.link

  // 2. Seed: custom MFCG seed if present, else Azgaar's formula `${mapSeed}${burgId}`.
  //    (FMG source: const s = seed + "" + id)
  const seed = burg.MFCG != null ? String(burg.MFCG) : `${mapSeed}${burg.i}`

  // 3. Population: Azgaar stores thousands; MFCG wants the real head count.
  const population = Math.round(burg.population * 1000)

  const params = new URLSearchParams({
    name: burg.name,
    population: String(population),
    size: String(SIZE_FROM_POP(burg.population)),
    seed,
    citadel: burg.citadel ? "1" : "0",
    walls: burg.walls ? "1" : "0",
    plaza: burg.plaza ? "1" : "0",
    temple: burg.temple ? "1" : "0",
    shantytown: burg.shanty ? "1" : "0",
    coast: "0", // set per terrain if we ever track it
    port: burg.port ? "1" : "0",
  })

  return `${MFCG_BASE}?${params.toString()}`
}
