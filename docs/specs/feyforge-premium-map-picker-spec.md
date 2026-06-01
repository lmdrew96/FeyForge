# FeyForge — Premium Map Picker Spec

_For Cody. Addendum to the world-map specs. Premium feature._

## The idea in one line

A premium DM picks a **vibe** in 3–4 taps ("scattered islands · frozen north · wild & sparse · a region") and a finished, populated, FeyForge-native map appears — **never seeing Azgaar at all.**

## Decision (locked — don't reopen)

This is **NOT** a live generator and **NOT** runtime headless Azgaar. It's a **pre-baked, attribute-tagged library + a filter picker** that runs on the `adoptPreset` engine already shipped (v0.58).

Why not the alternatives (all evaluated and rejected this arc):
- **Custom generator** → rebuilds the hard 20% of Azgaar; trades away the visual fidelity that's the premium draw. Rejected repeatedly.
- **Runtime headless Azgaar (Puppeteer-in-prod)** → works and is MIT-legal, but Azgaar's generators are entangled with D3/DOM (19-stage `settings→generators→worlddata→renderer` pipeline writing to live SVG selection handles), so it needs real headless Chrome in a worker/container, ~seconds/map latency, off-Vercel. Too much runtime ops for the payoff. **Reconsider ONLY if pre-baked filtering proves too coarse in practice.**
- **URL-param prefill / maplink** → still dumps the DM into Azgaar's full editor + export dance. Same context-switch we rejected.

**The clever move:** the Puppeteer complexity lives in an **offline bake script Nae runs on her own laptop**, not in production. Runtime is just "filter the library, adopt the match" — which already exists.

## Pipeline overview

```
[Nae, offline]  bake script → ~150 maps across the vibe matrix → human cull → ~120 tagged maps → R2 + seed
[DM, runtime]   picker (4 vibe filters) → query tagged library → adoptPreset(match) → populated map appears
```

## The 4 filter dimensions (DM-facing — no Azgaar vocabulary)

| Axis | Options | Count |
|---|---|---|
| **Shape of the world** | archipelago · scattered islands · continents · one big landmass | 4 |
| **Climate** | frozen north · temperate · arid/desert · tropical | 4 |
| **Civilization** | wild & sparse · settled · crowded & contested | 3 |
| **Scale** | a region · a whole world | 2 |

4 × 4 × 3 × 2 = **96 combinatorial cells.**

**Hard rule:** four axes is the CEILING. Do not expose Azgaar's raw knobs (cultures-set, provinces-ratio, growth-rate, etc.) in the picker — that rebuilds the 300-option panel we spent this whole arc escaping. DM picks a vibe; the matrix maps vibe → params behind the scenes.

## Vibe → Azgaar param mapping (the keystone)

Each axis drives a CLUSTER of Azgaar settings, not one knob.

### Shape → heightmap `template`
- archipelago → `Archipelago`
- scattered islands → `Low Island` or `High Island`
- continents → `Continents`
- one big landmass → `Pangea`
- ⚠️ AVOID `Old World`, `Peninsula`, `Fractious` — they generate land that bleeds off-canvas (the framing bug confirmed earlier in this project). Contained templates only.

### Climate → `temperatureEquator` + `temperaturePole` + `precipitation` + globe latitudes
- frozen north → low equator temp + very low pole temp + push latitudes north (map sits high on globe)
- temperate → default temps, moderate precipitation
- arid/desert → normal temp + **LOW precipitation** ← precipitation is the desert lever per Azgaar docs, NOT temperature
- tropical → high equator temp + high precipitation

### Civilization → `statesNumber` + `townsNumber` + burg density
- wild & sparse → few states + low town count → lots of neutral wilderness
- settled → balanced defaults
- crowded & contested → many states + high town count → dense borders + many pins

### Scale → `mapSize` (% of globe) + `width`/`height` + burg count
- a region → smaller globe %, fewer burgs, zoomed-in feel
- a whole world → large globe %, MORE burgs (per Azgaar's own note: more burgs is what makes a template read as continental rather than islands at scale)

> **⚠️ FIRST TASK before writing the bake script:** verify the EXACT Azgaar option key names against the source `options` object (e.g. is it `statesNumber` / `regionsInput` / `temperatureEquatorInput`?). The wiki gives concepts, not literal keys. These keys drive both the generation settings and any URL params. Don't guess — read `src/` (or legacy `public/`) for the options object and the URL-param parser.

## The climate caveat (shapes the whole bake step)

Climate is **emergent** — it falls out of temperature × precipitation × globe position × random seed. Shape and civilization map cleanly to single knobs; climate does not. Some seeds in a "frozen" recipe will still render temperate.

Consequences:
1. **Depth-per-cell matters most on the climate axis** — bake extra variants of climate-tagged cells.
2. **The bake is NOT fire-and-forget.** Generate ~150, then Nae does a **thumbnail cull pass** keeping the ~120 that actually READ as their tag. Script proposes, Nae disposes. Build the script to make culling easy (contact-sheet of thumbnails + a keep/reject flow that writes the final tag set).

## Library sizing (tiered)

- 96 cells = coverage skeleton (every filter combo returns SOMETHING — no empty filters).
- ~12 high-traffic cells (temperate continents settled, frozen archipelago wild, etc.) get 3 variants each = 36.
- 84 long-tail cells get 1 each = 84.
- **~120 maps total**, ~90 min unattended bake @ ~45s/map, before cull.
- Growth is free later: re-run the script with higher depth on any slice. Architecture doesn't change.

## Schema delta

Extends the existing `worldMaps` preset model with filter attributes:

```ts
// worldMaps table — ADD (all optional so existing presets/uploads are unaffected):
vibeShape:        v.optional(v.union(
                    v.literal("archipelago"), v.literal("scattered"),
                    v.literal("continents"),  v.literal("pangaea"))),
vibeClimate:      v.optional(v.union(
                    v.literal("frozen"), v.literal("temperate"),
                    v.literal("arid"),   v.literal("tropical"))),
vibeCivilization: v.optional(v.union(
                    v.literal("wild"), v.literal("settled"), v.literal("crowded"))),
vibeScale:        v.optional(v.union(
                    v.literal("region"), v.literal("world"))),
// `source` gets a new variant: "premium-preset" (vs existing preset|import|upload)
// so the premium library is distinguishable from the 4 free presets.
```

Index on the four vibe fields (or a composite) so the filter query is cheap. Premium library = `source === "premium-preset"`; the picker filters within it.

## Build order

1. **Verify Azgaar option key names** (source read — blocks everything).
2. **Bake script** (`scripts/bake-presets.ts`) — Nae runs locally. Loops the vibe matrix, drives headless Azgaar (Puppeteer) with the mapped params, exports PNG + `.map` per map, emits a thumbnail contact sheet + a tags manifest. Reuses the existing `.map` parser + seed pipeline (`seedPreset`, SEED_SECRET-gated).
3. **Schema + seed** — add vibe fields, seed the culled ~120 as `source: "premium-preset"`.
4. **Premium picker UI** — 4-axis filter (tap chips, not Azgaar knobs) → live result count → adopt. Gated `isPremium || role === "admin"`. Sits on existing `adoptPreset`.

## Reuse / gotchas (from prior map work)

- **`.map` format is POSITIONAL** (Azgaar v1.122.11): L0 pipe header (w/h at idx 4/5), L1 pipe settings (distanceScale = miles-per-pixel at idx 1), `pack.*` bare JSON-array lines after embedded `<svg>`. Parse by element SIGNATURE, not line index. (Already implemented in the v0.58 parser — reuse it.)
- **`sanitizeText()`** strips orphaned UTF-16 surrogates from Azgaar legends (they cause Convex "Server Error" on insert). Bake output runs through the same path.
- **Convex deploy:** `npx convex deploy`, NOT `convex dev` (dev rewrites `.env.local` to a local empty backend and silently breaks prod).
- **R2 CORS** for any browser upload path is set in the Cloudflare dashboard, not via API token (PutBucketCors → 403). Bake uploads can go server-side to dodge this entirely.
- **Puppeteer is offline-only.** It must NOT land in a Vercel function or any runtime path. It's a local dev-dependency for the bake script alone.
