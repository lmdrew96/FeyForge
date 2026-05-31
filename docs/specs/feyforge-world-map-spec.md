# FeyForge — World Map Feature Spec

_For Cody. Stack: Next.js / Convex / Claude API, R2 storage, React Flow campaign web._

## Decision (locked — don't reopen)

**Approach: Azgaar import + curated presets.** Not a custom generator, not a fork, not an embed-with-hidden-options.

- **No generator** — rebuilding Azgaar's landmass/rivers/biomes/settlements is re-implementing the thing we're importing, and a "clean stylized" generator trades away the visual fidelity that's the whole premium draw.
- **No fork** — Azgaar is ~50k lines of messy D3 mid-TS-rewrite. MIT lets us legally, engineering says don't.
- **No embed-and-strip** — cross-origin iframe can't extract pins; self-hosting to fix that is a brittle soft-fork.

## Licensing (settled)

Azgaar source is **MIT** (© Max Haniyeu/Azgaar); generated output is **free for commercial use**. Safe to ship presets we author in Azgaar, and safe to deep-link into it.

## Scope

**In:** world / exploration map — regions, bodies of water, natural features (terrain), **settlements**, points of interest; per-feature reveal/fog; drill-down to local maps; campaign-web links.

**Out:**
- **Battle-map VTT** (grid, tokens, token movement) — that's Roll20/Foundry territory, very high effort. We do world-map + drill-down, not tactical combat maps.
- **Azgaar's sim layers** — on import, ignore cultures, religions, states/diplomacy, population, military, heraldry, era/year, climate zones. We render settlements, water, terrain, and routes only.

## Required map elements

1. Land shapes & borders (random is fine) — comes from the imported image.
2. Region + body-of-water names — label anchors, DM-editable.
3. Natural features (mountains, forests, etc.) — terrain markers / backdrop.
4. **Settlements** (towns/cities/capitals) — the headline element. These _are_ the pins; the whole reveal/drill-down/campaign-web system hangs on them.
5. **Scale / distance** — overland travel is distance × time. Store miles-per-pixel so we can support travel later.
6. **POIs** (dungeons, ruins, shrines) — distinct from natural features: they get drill-down + DM secrets.
7. Roads/routes — nice-to-have, defer if needed.

## Data model (the spine — build this first)

```ts
// convex/schema.ts additions

worldMaps: defineTable({
  campaignId: v.optional(v.id("campaigns")),
  name: v.string(),
  imageStorageKey: v.string(),              // R2 key, rendered map (PNG/SVG/WebP)
  width: v.number(),                         // px (Azgaar info.width)
  height: v.number(),                        // px (Azgaar info.height)
  scaleMilesPerPx: v.optional(v.number()),   // for travel/distance
  source: v.union(
    v.literal("preset"),
    v.literal("import"),
    v.literal("upload"),
  ),
  isPremiumPreset: v.optional(v.boolean()),
})
  .index("by_campaign", ["campaignId"]),

mapLocations: defineTable({
  worldMapId: v.id("worldMaps"),
  campaignId: v.optional(v.id("campaigns")),
  type: v.union(
    v.literal("settlement"),
    v.literal("poi"),
    v.literal("natural"),
    v.literal("water"),
    v.literal("region"),
  ),
  name: v.string(),
  x: v.number(),                             // normalized 0–100
  y: v.number(),                             // normalized 0–100
  revealed: v.boolean(),                     // DM-toggleable; drives fog
  dmNotes: v.optional(v.string()),           // private to DM
  playerNotes: v.optional(v.string()),       // shown to players once revealed
  drillDownMapId: v.optional(v.id("worldMaps")), // local map (Watabou)
  campaignNodeId: v.optional(v.string()),    // React Flow node link
})
  .index("by_worldMap", ["worldMapId"])
  .index("by_campaign", ["campaignId"]),
```

**Note:** `region`/`water` are stored as a single label-anchor point (x/y), not a polygon. The imported image already shows the boundaries visually — we only need a clickable anchor for the name/notes. Polygon hit-areas can come later if needed.

## Tiers

| | Free | Premium (`isPremium` on users) |
|---|---|---|
| Map | Pick from curated presets | Import/upload your own + guided-create |
| Pins | Preset pin sets ship with the map | Author your own (manual + auto from import) |
| Reveal/fog | ✅ | ✅ |
| Drill-down | On preset pins | On your own pins |

## Phasing

**Phase 1 — engine (shippable with placeholder presets):**
- `worldMaps` + `mapLocations` schema.
- Preset picker (free): load 1–2 placeholder maps from R2.
- Render map image as backdrop, pins overlaid (reuse R2 + existing display patterns).
- DM reveal/hide toggle per location, synced to players.
- Pin click → drill-down + dmNotes/playerNotes panel (DM sees both; players see playerNotes only when revealed).
- Manual pin authoring (premium gate).
- Fix the known pin bug.

**Phase 2 — import + guided-create (the premium "wow"):**
- Azgaar `.map`/JSON import → parse `pack.burgs` + `pack.markers` → auto-create `mapLocations` (burgs → `settlement`, markers → `poi`), normalized coords.
- Watabou drill-down launchpad (city/dungeon image behind a settlement pin).
- Guided-create: host template `.map` files on R2, open Azgaar via `?maplink=<R2-url>` so users land in a finished world instead of the blank options panel.

## Implementation notes / gotchas

- **burg → pin math:** `x = burg.x / info.width * 100`, `y = burg.y / info.height * 100`. Same for `pack.markers`. Verified against real exports (see below).
- **Markers ARE populated — build the POI parser, don't stub it.** Earlier assumption was that `pack.markers` might be empty; confirmed false. The shipped presets carry 56–73 markers each, so `markers → poi` auto-import is real data, not a manual-only fallback. Parse both arrays in Phase 2:
  - `pack.burgs` → `type: "settlement"`. Each burg object has `x`, `y`, `name`, `capital` (1/0 — use to weight pin prominence), `population`, `type` (e.g. "River", "Naval"). Note `burgs[0]` is an empty placeholder `{}` — skip index 0.
  - `pack.markers` → `type: "poi"`. Marker objects carry `icon`, `x`, `y`, and a paired `legend` note (139 legend entries in the sample) — good candidate to seed `dmNotes`.
- **maplink:** `https://azgaar.github.io/Fantasy-Map-Generator/?maplink=<url>` auto-loads a hosted `.map`. The R2 bucket must return CORS headers (Azgaar fetches it client-side).
- **Convex CLI footgun:** when adding the new schema, regenerate with `npx convex deploy` (pushes to prod + regens types, leaves `.env.local` alone). **Do not** run `npx convex dev` — it rewrites `.env.local` to a local empty backend and silently breaks the app against prod.
- **Reveal + DM/player visibility:** reuse the DM-controlled sync pattern already proven by the audio system (partySessions). Don't invent a new sync path.
- **Don't render** Azgaar's cultures/religions/states/etc. layers on import — settlements, water, natural features, routes only.

## Shipped presets (validated 2026-05-31)

Real preset pairs are in the repo (`.map` + `.png`, matched filenames, in `feyforge/maps/`). Validated facts the import script can rely on:
- **Canvas:** all exported at `1512×828` (`info.width`/`info.height` in the `.map` header line 1, pipe-delimited: `version|note|date|seed|width|height|...`).
- **PNG scale:** PNGs are `6048×3312` = exactly 4× the canvas (2× export scale × 2× retina). Absolute size is irrelevant — coords normalize to 0–100, and aspect ratios are identical, so no pin drift. Don't assume PNG px == canvas px anywhere in the math; always normalize.
- **Data present:** every preset has 468–852 burgs and 56–73 markers, so both pin layers populate on import.
- **`.map` format note:** it's NOT pure JSON — line 1 is a pipe-delimited header, later lines hold the JSON pack data. Parse the header for `width`/`height`/`seed`; pull `pack.burgs`/`pack.markers` from the JSON blocks.
