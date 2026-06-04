# FeyForge — Premium Map Curation (manual)

_How Nae stocks the premium "vibe" map library. Companion to
`feyforge-premium-map-picker-spec.md`._

## Why manual (and not the headless bake)

The original plan auto-generated the library by driving Azgaar headless
(Puppeteer). We built that and hit a wall: Azgaar's web app renders maps
**perfectly when you use it by hand**, but **headless re-generation is brittle** —
the rendered PNG came out blank (a coastline-mask bug we fixed) and, worse,
detecting when each async generation truly finishes was unreliable across many
maps. Rather than keep fighting the automation, we let Azgaar do what it's great at
interactively, and **you curate the worlds you like.** You get guaranteed-good maps
and you pick the vibes; the pipeline just ingests them.

The picker, schema, backend, and seed pipeline are all built and unchanged — this
doc is only about **sourcing the map files**.

## The loop

```
Azgaar UI → export .map + .png → maps/premium-src/ → pnpm tag-premium → pnpm seed:premium → picker fills
```

1. Open **https://azgaar.github.io/Fantasy-Map-Generator/**
2. Set the options for the vibe you want (table below).
3. Click **New Map!** (or press **F2**) to generate with those options.
4. **Turn on the Biomes layer** (Layers menu → Biomes) so you can _see_ the climate —
   frozen reads as tundra/ice, arid as desert tan, tropical as lush green. If it
   doesn't read as the vibe, tweak and regenerate.
5. When you like it, export **both** files into `maps/premium-src/` with the **same
   base name**:
   - **Menu → Export → Export to .map** → `something.map`
   - **Menu → Export → Save as image → PNG** → `something.png`
6. Repeat for the vibes you want. Aim for variety across **shape × climate** first
   (those are the most visually distinct axes); a dozen good ones beats 100 samey.
7. `pnpm tag-premium` — interactively pick the 4 vibe axes + a name for each map.
8. `npx convex deploy` (ensure the latest `seedPreset` is live), then
   `pnpm seed:premium` — uploads the PNGs to R2 and seeds them as premium worlds.
9. Open the World Map → **Premium worlds** picker (premium/admin account). Your
   curated worlds appear, filterable by vibe.

## Vibe → Azgaar settings

These are the mappings the (retired) bake script used — proven to produce the right
look. Set them in the **Options** panel and the **World Configurator** (the globe
icon, or Tools → Configure world) before pressing New Map.

### Shape → Heightmap template (Options → Heightmap → Template)
| Vibe | Template |
|---|---|
| Archipelago | **Archipelago** |
| Scattered isles | **High Island** |
| Continents | **Continents** |
| One landmass | **Pangea** |

⚠️ **Avoid** Old World, Peninsula, Fractious, Isthmus — they generate land that
bleeds off the canvas (looks cut off).

### Climate → World Configurator (temps + precipitation + latitude)
Precipitation is the desert lever (NOT temperature). "Frozen" pushes the map north
(low latitude value = North) and drops all temps.

| Vibe | Equator | N Pole | S Pole | Precipitation | Latitude |
|---|---|---|---|---|---|
| Frozen north | 5 °C | −35 | −30 | ~90% | ~18 (north) |
| Temperate | 27 °C | −25 | −15 | ~100% | 50 (equator) |
| Arid / desert | 30 °C | −20 | −10 | **~12% (low)** | ~42 |
| Tropical | 30 °C | −10 | 0 | ~280% (high) | 50 |

Climate is partly emergent (temperature × precipitation × latitude × seed), so some
seeds won't read as the tag — that's why you eyeball with the Biomes layer and only
keep the ones that look right.

### Civilization → Options (States + Burgs number)
| Vibe | States | Burgs (towns) |
|---|---|---|
| Wild & sparse | 5 | ~120 |
| Settled | 13 | ~450 |
| Crowded | 28 | ~900 |

### Scale → Options → Map size
| Vibe | Map size |
|---|---|
| A region | ~30% |
| A whole world | 100% |

## Notes

- **File naming** is free-form; `tag-premium` derives a clean slug from the base
  name. Just keep the `.map` and `.png` base names identical.
- **Pins ride along.** The `.map` carries settlements (with Watabou MFCG city links)
  and POIs; the seed curates them exactly like the free presets, so adoptPreset's
  density tiers work on premium maps too. POIs are now **typed** (dungeon / ruin /
  monster / encounter / tavern / landmark → SVG pin icons) and dungeon/encounter pins
  carry a **drill-down URL** (One Page Dungeon / premade-NPC), extracted from the
  Azgaar marker legend at parse time — DM-only, never sent to players.
- **Re-seeding is safe.** `seedPreset` upserts by image key, so re-running
  `pnpm seed:premium` retunes in place; already-adopted campaigns are independent
  clones and unaffected.
- `maps/` is git-ignored — these source files live only on your machine.
