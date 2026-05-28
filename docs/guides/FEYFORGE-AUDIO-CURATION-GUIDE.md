# FEYFORGE-AUDIO-CURATION-GUIDE.md

A guide for composing and uploading instrument variants for the FeyForge
adaptive music engine. Primarily for Ashley as the composer, with notes
for Nae as the admin reviewer.

---

## How the engine works (the short version)

Each scene + mode (e.g. Forest → Combat) has a set of **instruments**
(strings, brass, percussion, pads, etc.). For each instrument, you compose
up to **5 variants** — one per intensity level on the DM's 1–5 slider. As
the DM moves the slider, the engine crossfades between adjacent variants
of the same instrument over ~4 seconds.

**Your job:** compose stems where each instrument *evolves* across the
intensity range. Not "louder strings at higher intensity" — fundamentally
different musical ideas that capture rising energy.

---

## The variant model

For each instrument, you can compose all 5 levels or skip ones that don't
serve the scene. Example for Forest → Combat:

| Instrument | Intensity 1 | Intensity 2 | Intensity 3 | Intensity 4 | Intensity 5 |
|------------|-------------|-------------|-------------|-------------|-------------|
| Pads | sustained drone | gentle motion | low pulse | — | — |
| Strings | sparse notes | legato phrases | rhythmic ostinato | tremolo | spiccato runs |
| Brass | — | — | sustained chords | aggressive stabs | full fanfare |
| Percussion | — | soft hits | tom roll | full kit | full kit + cymbals |

Empty cells = silence for that instrument at that intensity. That's a
**feature**, not a gap. Use absence intentionally — pads dropping out at
high energy or brass entering at intensity 3 is musically meaningful.

---

## Mode behavior to know about

- **Explore ↔ Combat are hard switches.** When the DM changes modes, all
  current-mode instruments fade out and the new-mode instruments start fresh.
  This is by design — mode changes in tabletop are dramatic moments and the
  music should mark them.
- **Victory always returns to Explore.** Combat → Victory → Explore, regardless
  of what was playing before. Compose accordingly: Victory is a "the day is
  won" moment that lands cleanly into exploration.

---

## Composition constraints

### BPM and loop length

All instruments in the same scene+mode must share BPM and loop length.
**Variants of the same instrument** must also match. So all Forest Combat
files (strings 1–5, brass 3–5, etc.) are the same tempo and the same
duration.

This matters because:
- All instruments play simultaneously when their slots align
- When intensity changes, a new variant of an instrument starts at position 0
  of its loop, while other instruments continue playing — they need to share
  a rhythmic grid

### Key signature

Variants of the same instrument should be in the same key. Different
instruments within a scene+mode should also be in the same key. Otherwise
crossfading variants creates dissonance.

### Loudness

Each variant should sit at a similar perceived loudness within its instrument
family. The normalize script will handle peak normalization at upload, but
your mix decisions before export matter. If intensity 5 strings are 3x as
loud as intensity 1 strings in your DAW, the player experience will feel
unbalanced even after normalization.

---

## Composition workflow

### 1. Pick a scene + mode

Start with one combination. e.g. **Forest → Combat**.

### 2. Decide your instruments

Choose 3–6 instruments for the scene. Examples:
- **Strings** (could be split into "High Strings" and "Low Strings" for
  more granularity)
- **Brass**
- **Percussion** (could split into "Toms", "Cymbals", "Tribal Drums")
- **Pads / Atmosphere**
- **Choir**
- **Solo melody** (flute, horn, etc.)

Free-text instrument names — name them whatever fits the piece.

### 3. Plan the intensity arc

For each instrument, decide which intensities it appears at. A useful
exercise: write a one-sentence description of the scene at each intensity
level.

```
Forest Combat:
  1 — distant tension, calm before the storm
  2 — first hostile movements, footfalls
  3 — direct engagement, weapons drawn
  4 — full battle, party fighting for their lives
  5 — climactic moment, ultimate stakes
```

Then for each instrument, decide which descriptions it should reinforce.
Pads serve 1–3. Brass serves 3–5. Percussion serves 2–5. Each instrument
doesn't have to do everything.

### 4. Compose all variants of one instrument together

Work instrument by instrument. Compose strings 1–5 in sequence — this keeps
the musical voice consistent across the intensity range. Don't bounce around.

### 5. Cross-check between instruments

After each instrument is done, play them simultaneously at the same intensity
to verify they sit well together. Then play different combinations:
strings 3 + brass 3 + percussion 3, etc.

### 6. Export each variant as its own file

One file per variant. No "stems within stems" — if you want strings to have
two distinct character lines, that's two separate instruments
("High Strings" and "Low Strings"), each with their own intensity variants.

### 7. Bake any time-stretched loops before exporting

If you're using GarageBand Apple Loops at a tempo different from their native
BPM, GarageBand stretches them during playback but exports them at their
original tempo with silence padding. **Solo each track and export it
individually** to bake the time-stretching, then re-import that baked file
before doing your final stem export. (Or compose at a tempo close to your
source loops' native BPM to avoid this entirely.)

---

## File naming

Use kebab-case. The pattern is:

```
<scene>-<mode>-<instrument>-<intensity>.mp3
```

Examples:
```
forest-combat-strings-1.mp3
forest-combat-strings-3.mp3
forest-combat-brass-4.mp3
forest-explore-pads-2.mp3
dungeon-combat-percussion-5.mp3
```

This is for your own organization — the admin panel doesn't read filenames.
But it'll save you when you upload 20+ files at once.

---

## Folder structure

```
feyforge-audio/
  raw/        ← work-in-progress DAW exports
  ready/      ← normalized, final files ready to upload
```

---

## Running the normalize script

After exporting from your DAW:

```bash
python3 scripts/audio-pipeline/feyforge_normalize.py \
  --input ./feyforge-audio/raw \
  --output ./feyforge-audio/ready
```

Each file is processed independently:
- Normalized to -1dBFS peak
- Trailing silence trimmed
- Re-exported at 320kbps MP3

No duration matching is enforced anymore (the engine handles different file
lengths since variants don't replace each other in real time — they crossfade
over 4 seconds).

---

## Uploading

```bash
pnpm upload --input ./feyforge-audio/ready --type music
```

Files go to R2 and land in the admin review queue as pending. The script
skips duplicates (safe to re-run).

---

## Admin review (Nae)

For each pending track:
1. Listen — make sure it sounds right
2. Set tier (free / premium)
3. Fill out variant assignment:
   - **Scene**: forest, town, etc. (dropdown)
   - **Mode**: explore, combat, or victory
   - **Instrument**: free-text with autocomplete from existing instruments
     in this scene+mode (so "Strings" stays consistent across all 5 variants)
   - **Intensity**: 1–5
4. Multiple assignments per track are possible (rare — usually 1:1)
5. Click **Approve + Assign**

The variant is immediately live in any session.

---

## Sources for raw audio (if you're not composing from scratch)

If Ashley isn't available or you want test material:

**Looperman** ([looperman.com](https://looperman.com)) — free loop library,
every loop tagged with BPM and key, strong orchestral/cinematic section.
Best free option for finding tempo-matched stems.

**Freesound** ([freesound.org](https://freesound.org)) — filter by
`license:Creative Commons 0`, duration 10–120s. BPM tagging is inconsistent,
so ear-test required.

**Pixabay Music** ([pixabay.com](https://pixabay.com)) — full mixes, not
stems. Better for ambience layers than music variants.

**Splice** ([splice.com](https://splice.com)) — paid ($8–16/month), best-in-class
filtering by BPM/key/instrument, huge cinematic catalog. Worth it if you're
curating a lot.

**Demucs stem separation** — for tracks you already have but need
instrument-separated. Quality varies; see the `scripts/audio-pipeline/`
folder for the separator script.

---

## Common pitfalls

**The intensity arc is too uniform**
If intensity 1 vs 5 just feels louder, the variants aren't distinct enough.
Each variant should be a different musical *idea*, not just a volume bump.

**Variants drift in tempo across an instrument**
If strings 3 and strings 4 are at slightly different tempos, the crossfade
will feel weird. DAW project tempo locked at the start prevents this.

**Instruments fight at intensity overlaps**
If your strings at intensity 3 and your brass at intensity 3 occupy the
same melodic space, the mix gets muddy at that level. Compose them with
distinct roles (e.g. strings on melody, brass on harmonic stabs).

**GarageBand export has silence padding at the end**
You forgot to bake time-stretched loops before exporting. Solo the track,
export it solo, re-import the exported file, then do your final stem export.

**Empty intensity slots not used intentionally**
"I just didn't have time" is fine for MVP. "Pads drop out at high energy
because the scene gets too chaotic for sustained tones" is better.

---

## Checklist per scene+mode

- [ ] 3–6 instruments planned
- [ ] Each instrument has 1–5 variants composed
- [ ] All files at same BPM
- [ ] All files at same loop length
- [ ] All files in same key
- [ ] Time-stretched loops baked before final export
- [ ] Loudness balanced across variants of each instrument
- [ ] Cross-checked combinations at each intensity sound coherent
- [ ] Exported with the kebab-case naming convention
- [ ] In `feyforge-audio/ready/` folder
- [ ] Uploaded via `pnpm upload` script
- [ ] Each file approved + assigned in admin panel
