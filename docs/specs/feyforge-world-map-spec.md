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

- **burg → pin math:** `x = burg.x / info.width * 100`, `y = burg.y / info.height * 100`. Same for `pack.markers`. Already verified.
- **maplink:** `https://azgaar.github.io/Fantasy-Map-Generator/?maplink=<url>` auto-loads a hosted `.map`. The R2 bucket must return CORS headers (Azgaar fetches it client-side).
- **Convex CLI footgun:** when adding the new schema, regenerate with `npx convex deploy` (pushes to prod + regens types, leaves `.env.local` alone). **Do not** run `npx convex dev` — it rewrites `.env.local` to a local empty backend and silently breaks the app against prod.
- **Reveal + DM/player visibility:** reuse the DM-controlled sync pattern already proven by the audio system (partySessions). Don't invent a new sync path.
- **Don't render** Azgaar's cultures/religions/states/etc. layers on import — settlements, water, natural features, routes only.

---

## Execution addendum (Cody — pre-build findings, not yet started)

Investigated the live deployment before building. The spec's design is locked and unchanged; these are **execution-only** facts the spec didn't cover. Phase 1 has **not been started** — no schema/code changes made this session beyond an earlier throwaway draft (see below).

### Table-name collisions (must reconcile first)
All three table names already exist with **different shapes**, and hold test rows from an earlier discarded draft:
- `worldMaps` — **1 test row**, old shape (`imageUrl, fogOfWarEnabled, userId`). Reshape to spec (`imageStorageKey, width, height, source, isPremiumPreset, scaleMilesPerPx`).
- `mapPins` — **2 test rows**. The discarded draft used this table; **spec does not** (spec puts pins in `mapLocations`). **Drop the table.**
- `mapLocations` — **empty**, but its name is reclaimed by the spec with a NEW shape. Currently wired to legacy `convex/world.ts` + `lib/world-store.ts`.

### REQUIRED first step — clear test rows before any schema change
A Convex schema push **fails validation** if existing rows don't match the new shape, or if a still-populated table is dropped. So the order is non-negotiable:
1. Add a temp mutation (e.g. `convex/_cleanupWorldMap.ts`) that deletes all `worldMaps` + `mapPins` rows. `npx convex deploy`, run it, then delete the temp file.
2. THEN reshape schema + `npx convex deploy`. **Never `npx convex dev`** (rewrites `.env.local`, per gotcha above).

### Legacy retirement — MOSTLY dead, with ONE live consumer
Empty table, but `api.world.list` has a real caller. Plan:
- **`app/dm/campaign-web/page.tsx:136`** calls `api.world.list` live (reads `_id` + `name` for the Story Web location sidebar). **Must repoint** to `api.worldMap.listLocations({ campaignId })` — campaign-web already has `campaignId` in scope. NOT a delete.
- Safe to delete: `lib/world-store.ts`, the `api.world.list`/`setLocations` block in `components/providers/data-loader.tsx` (~lines 184, 191, 213–215), `useCampaignLocations` in `lib/hooks/use-campaign-data.ts` (zero callers), `MapLocation`/`NewMapLocation` in `lib/types.ts`.
- `convex/world.ts` itself: delete only AFTER campaign-web is repointed and confirmed building.

### Locked decisions from this session
- **Presets → copy pins into campaign.** `adoptPreset(campaignId, presetMapId)` clones the preset's locations into campaign-scoped rows (`campaignId = current, revealed = false`) AND inserts a campaign `worldMaps` row pointing at the same `imageStorageKey`. Per-campaign reveal state, fully independent — mirrors the wiki pattern.
- **Build the admin R2 upload route now.** `POST /api/world-map/upload`, admin-gated, reuses `lib/r2.ts` `getPresignedUploadUrl`. Serves Phase 1 presets AND Phase 2 premium uploads (not throwaway).

### OPEN — needs Nae before image rendering works
Spec stores `imageStorageKey`, but `<img src>` needs a PUBLIC url. `R2_PUBLIC_URL` exists server-side only.
1. Is the R2 bucket (or its custom domain) **public-read**? (Audio appears to rely on this; unverified for images.)
2. If yes: add `NEXT_PUBLIC_R2_PUBLIC_URL` (same value as `R2_PUBLIC_URL`) to `.env.local` + Vercel so the client can build `${base}/${imageStorageKey}`.

### Carry-over from the discarded draft
The pin-placement bug was diagnosed (don't re-debug from scratch): (1) measure clicks against the **same element** the pins are positioned within, and (2) anchor the pin **icon tip** to the coordinate, not the whole marker button (the name label below the icon was pushing the visual tip off the click point). Apply both in the rebuild.

### Patch status
ChaosPatch `130d9a61…` ("Build World Map UI") is **in_progress**. Working tree has an uncommitted ~833-line draft of `app/dm/world-map/page.tsx` + `convex/worldMap.ts` (the `mapPins`/URL-paste version) — these get **rewritten** to match this spec; nothing committed, nothing to preserve except the bug-fix notes above.

---

## Appendix B — Session handoff (2026-05-30)

### TL;DR — PHASE 1 CODE COMPLETE, but NOT yet deployed to Convex prod, UNTESTED, UNCOMMITTED
Design locked (this spec). Phase 1 is **fully written**: schema reshaped, all Convex functions, admin upload route, full UI rebuild with the pin bug fixed, legacy retired, account-deletion patched. `tsc` clean, `eslint` clean, `pnpm build` passes.

**Convex prod state — VERIFIED CLEAN (not half-migrated):**
- Prod is entirely on the **OLD deploy**: old schema (`mapPins` table still exists, old `worldMaps`/`mapLocations` shapes), old functions (`world:list` still resolves). Confirmed by live probes.
- The ONLY thing that landed on prod was the **cleanup mutation** (first deploy, under the old schema) which deleted the 3 test rows. All map tables are now **empty**.
- Every **reshape** deploy FAILED at `tsc` (admin.ts/data-loader referenced old fields) or was denied — so **the new schema never reached prod.** No partial migration. `world:list` returning `[]` confirms old funcs intact + tables empty.
- **Local code is fully on the new approach and compiles clean** (tsc/eslint/build green), uncommitted.
- **NEXT STEP (needs Nae's explicit OK):** one `npx convex deploy` (NOT dev) pushes the new schema + worldMap.ts + patched admin.ts atomically. Because all map tables are empty, schema validation passes cleanly. After it lands, `world:list` 404s (expected — world.ts deleted) and `worldMap:listPresets` resolves.

### ⚠️ Required before Vercel deploy
Add `NEXT_PUBLIC_R2_PUBLIC_URL=https://pub-4dba6cbf9c354ad0832edcf4fb6e0b22.r2.dev` to **Vercel** env (already in local `.env.local`). Without it, map images render as broken links in production.

### What was built (Phase 1)
- **Schema** (`convex/schema.ts`, deployed): `worldMaps` (imageStorageKey/width/height/source/isPremiumPreset/presetSourceId) + `mapLocations` (worldMapId/type/x/y/revealed/dmNotes/playerNotes/drillDownMapId/campaignNodeId); `mapPins` dropped.
- **`convex/worldMap.ts`** (deployed): getMap, setCampaignMap, updateCampaignMap, listPresets, adoptPreset, saveAsPreset (admin), listLocations (DM all / players revealed-only + dmNotes stripped server-side), createLocation, updateLocation, setRevealed, removeLocation. All membership-gated like wiki.ts.
- **`app/api/world-map/upload/route.ts`**: presigned R2 PUT under `maps/<userId>/`, gated to admin OR premium. Reused for Phase 2 premium uploads.
- **`app/dm/world-map/page.tsx`**: full rebuild. Preset picker (free) + upload (premium/admin) when no map; pannable/zoomable map with pins; DM add/edit/move/delete + reveal toggle; pin detail with playerNotes (all)/dmNotes (DM) + drill-down indicator; player view = revealed pins only; admin "save as preset". **Pin bug fixed** (icon tip anchored to coord, clicks measured against the image element).
- **Legacy retired**: deleted `convex/world.ts`, `lib/world-store.ts`, `useCampaignLocations`, `MapLocation`/`NewMapLocation` types, `toLocation` adapter, data-loader block. Repointed `app/dm/campaign-web/page.tsx` → `api.worldMap.listLocations`.

### How Nae tests it
As DM/admin: World Map → upload a PNG (export one from Azgaar first) → Add → click map to place a pin → fill notes → Save → reveal/hide/move/edit/delete → "save as preset" (admin) to populate the free-tier picker. As a player (second account via join code): map + revealed pins only, no dmNotes, no DM tools.

### NOT done (deliberately deferred to Phase 2)
Azgaar `.map`/JSON auto-import (parse pack.burgs/markers → mapLocations), Watabou drill-down launchpad (the `drillDownMapId` field + UI indicator exist; no editor to set it yet), guided-create via `?maplink=`. Travel/distance (`scaleMilesPerPx` stored, unused).

### Old TL;DR (superseded)
Design is **locked** (this spec). Backend/UI build is **planned and sequenced but barely started** — only a temp cleanup mutation has been written, and it has **not been run**. **No schema change, no deploy, no data deleted.** Safe to stop here; nothing is half-migrated.

### What's committed/pushed vs. local-only
- **Pushed to GitHub (main):** this spec doc (with both appendices). That's the durable artifact.
- **Local, uncommitted, NOT pushed** (intentionally — they diverge from the locked spec and will be rewritten):
  - `app/dm/world-map/page.tsx` — 833-line draft, OLD approach (`mapPins` + paste-a-URL). Carries the diagnosed pin-bug fix notes (see Appendix A "Carry-over").
  - `convex/worldMap.ts` — draft, OLD approach (`mapPins`). Will be rewritten to spec (`mapLocations`, presets, `adoptPreset`).
  - `convex/_cleanupWorldMap.ts` — **temp** cleanup mutation (deletes `worldMaps` + `mapPins` test rows). Written, **not deployed, not run.**
  - `convex/_generated/api.d.ts` — regenerated against the draft; will regenerate again after the real schema lands.

### Phase 1 task list (6 tasks)
1. ⏳ **Clear test rows** — cleanup mutation written; still need to `npx convex deploy` → `npx convex run _cleanupWorldMap:run` → delete the temp file. *(in progress)*
2. ☐ **Reshape schema** — `worldMaps` + `mapLocations` to spec shape; drop `mapPins`.
3. ☐ **Write `convex/worldMap.ts`** — `getMap`, `listLocations` (DM all / players revealed-only), location CRUD + `setRevealed`, `listPresets`, `adoptPreset`.
4. ☐ **Repoint campaign-web + retire legacy** — swap `api.world.list` → `api.worldMap.listLocations` at `app/dm/campaign-web/page.tsx:136`; then delete `convex/world.ts`, `lib/world-store.ts`, the data-loader block, `useCampaignLocations`, `MapLocation` types.
5. ☐ **Admin R2 upload route** — `POST /api/world-map/upload`, admin-gated.
6. ☐ **Rebuild World Map UI** to spec (preset picker, reveal, drill-down, premium-gated authoring) + fix pin bug.

### NEXT ACTION when resuming
Run the cleanup, then do schema + `worldMap.ts` + legacy retirement as **one atomic deploy** (because deleting `convex/world.ts` and reshaping `mapLocations` must land together with the campaign-web repoint, or the `convex deploy` won't compile). Sequence:
1. `npx convex deploy` (pushes cleanup mutation; old schema still valid) → `npx convex run _cleanupWorldMap:run` → confirm `{ deleted: 3 }` → delete `convex/_cleanupWorldMap.ts`.
2. Reshape `convex/schema.ts`, write `convex/worldMap.ts`, delete `convex/world.ts`, repoint campaign-web, clean data-loader/types → `npx convex deploy`. **Never `npx convex dev`** (rewrites `.env.local`).

### Resolved this session (so we don't re-litigate)
- **R2 is public-read** — bucket serves via `https://pub-4dba6cbf9c354ad0832edcf4fb6e0b22.r2.dev` (audio already relies on it). Map images go in the same `feyforge-audio` bucket under a `maps/` (or `images/`) prefix.
- **Client env var still needed:** add `NEXT_PUBLIC_R2_PUBLIC_URL` (same value as `R2_PUBLIC_URL`) to `.env.local` **and Vercel** so the browser can build `${base}/${imageStorageKey}`. Not yet added.
- **Presets → copy into campaign** (per-campaign reveal state). **Admin upload route built now** (serves presets + Phase 2 premium uploads).
