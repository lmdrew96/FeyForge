# FeyForge — Settlement Drill-Down (Watabou MFCG) Spec

_Addendum to the world-map spec. For Cody. Phase 2 feature._

## Decision (locked)

Settlement pins drill down into **Watabou's Medieval Fantasy City Generator (MFCG)**, embedded **in-app via `<iframe>`** pointing at MFCG's live site — NOT by hosting/rendering Watabou's output ourselves.

**Why iframe, not host:** Watabou's license permits using generated maps inside your own original work, but the author has explicitly objected to redistributing/serving the generated maps *as the deliverable* (informal license, forum-stated, no formal LICENSE file). Framing his live tool = we send the user to his generator (his domain, his servers, his rendering), visually contained in our UI. That respects the license AND gives the seamless in-app feel. Hosting his rendered SVG/PNG on our R2 would land on the side he objects to — do NOT do that without explicit written permission from him.

**Verified 2026-06-01:** `watabou.github.io/city-generator` sends NO `X-Frame-Options` and NO CSP `frame-ancestors` (GitHub Pages default), on both root and seeded URLs — so framing is technically allowed today.

⚠️ **Framing permission is not contractual.** GitHub Pages headers can change anytime. Build the fallback (below) so a header change degrades the feature instead of breaking it.

## Scope

- **Settlements only.** MFCG is cities/towns. `poi`-type pins (dungeons, ruins, caves) have NO MFCG auto-link — Azgaar doesn't wire them, and MFCG doesn't make them. Don't render a "view city map" affordance on POI pins; show a "no map yet" state or hide drill-down. Dungeon-generator integration is a separate future slice.

## Schema delta

`mapLocations` already has `drillDownMapId` (points at a hosted `worldMaps` row — for user-uploaded local maps). The MFCG iframe is a different drill-down kind: an external URL, not a hosted asset. Add a parallel field rather than overloading:

```ts
// mapLocations table — ADD:
drillDownUrl: v.optional(v.string()),   // external MFCG iframe URL (settlements)
// drillDownMapId stays as-is for user-uploaded/hosted local maps
```

Resolution order at click time: if `drillDownMapId` set → render hosted map (a DM's custom override); else if `drillDownUrl` set → iframe MFCG; else (POI / no map) → empty state.

Store `drillDownUrl` at import time (computed once) so we're not rebuilding it on every render.

## The link builder

Grounded in the real preset `.map` data (verified fields: `name`, `population`, `capital`, `port`, `citadel`, `plaza`, `walls`, `shanty`, `temple`, `type`; plus optional `MFCG` and `link`, which are `null` on fresh presets).

```ts
// lib/worldMap/mfcgLink.ts

/** Burg fields we rely on (subset of Azgaar's pack.burgs[n]). */
interface AzgaarBurg {
  i: number;
  name: string;
  population: number;   // in THOUSANDS (e.g. 5.782 = 5,782 people)
  capital?: number;     // 1 | 0
  port?: number | null; // truthy (cell id) = has port
  citadel?: number;     // 1 | 0
  plaza?: number;       // 1 | 0  (market)
  walls?: number;       // 1 | 0
  shanty?: number;      // 1 | 0  (shantytown)
  temple?: number;      // 1 | 0
  MFCG?: number | null; // custom MFCG seed (overrides computed seed)
  link?: string | null; // custom full MFCG URL (overrides everything)
}

const MFCG_BASE = "https://watabou.github.io/city-generator/";

/**
 * Build the MFCG drill-down URL for a settlement burg.
 * Precedence: explicit link  >  custom MFCG seed  >  computed seed (mapSeed+burgId).
 */
export function buildMfcgUrl(burg: AzgaarBurg, mapSeed: string): string {
  // 1. DM/Azgaar-customized full link wins outright.
  if (burg.link) return burg.link;

  // 2. Seed: custom MFCG seed if present, else Azgaar's formula `${mapSeed}${burgId}`.
  //    (FMG source: const s = seed + "" + id)
  const seed = burg.MFCG != null ? String(burg.MFCG) : `${mapSeed}${burg.i}`;

  // 3. Population: Azgaar stores thousands; MFCG wants the real count.
  const population = Math.round(burg.population * 1000);

  // 4. size: MFCG's coarse size knob. Azgaar derives it from the population point.
  //    ⚠️ VERIFY scaling against one live click (see note) — this is the one fuzzy param.
  const size = Math.max(2, Math.min(60, Math.round(burg.population)));

  const params = new URLSearchParams({
    name: burg.name,
    population: String(population),
    size: String(size),
    seed,
    citadel: burg.citadel ? "1" : "0",
    walls: burg.walls ? "1" : "0",
    plaza: burg.plaza ? "1" : "0",
    temple: burg.temple ? "1" : "0",
    shantytown: burg.shanty ? "1" : "0",
    coast: "0",                       // set per terrain if you track it
    port: burg.port ? "1" : "0",
  });

  return `${MFCG_BASE}?${params.toString()}`;
}
```

⚠️ **One thing to verify before shipping (30 seconds):** the `size`/`population` param scaling. Load one of our presets in Azgaar, click a city, and copy its "See in City Generator by Watabou" link. Compare its `size=` / `population=` against what `buildMfcgUrl` produces for that same burg. The seed and feature flags are certain; only the size-scale heuristic is worth confirming, because Azgaar has changed how it maps population→size across versions (older builds passed `population/1000` as `size`, which produced wildly overcrowded cities — that's the bug to avoid). Adjust the `size` line to match the live link, then it's locked.

## Render + fallback

```tsx
// On settlement pin click — modal/panel with the iframe.
<iframe
  src={location.drillDownUrl}
  title={`${location.name} — city map`}
  className="h-full w-full border-0"
  loading="lazy"
  onError={() => setFrameFailed(true)}
/>
// Fallback: if frameFailed (or a load-timeout fires), swap to:
//   <a href={location.drillDownUrl} target="_blank" rel="noopener">Open city map ↗</a>
// This covers the case where Watabou ever adds a framing CSP.
```

Add a load-timeout (e.g. 8s with no `load` event → treat as failed) since a CSP block may not always fire `onError` cleanly.

## Notes / gotchas

- **Multi-city stale-state bug:** opening one MFCG city then another in the same session can redirect back to the first (community-reported). Each pin gets its own fully-parameterized URL, and the iframe `src` swaps per click, which avoids it. Don't reuse one cached iframe across pins — key the iframe on `location._id` so React remounts it.
- **No attribution required**, but it's appreciated and good citizenship — consider a small "City maps by Watabou's MFCG" credit near the drill-down view.
- **Don't pre-open** dozens of iframes (e.g. one per pin offscreen) — that's a lot of cross-origin loads. Lazy-render only the active drill-down.
