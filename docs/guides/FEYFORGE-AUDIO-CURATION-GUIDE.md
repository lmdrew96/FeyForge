# FEYFORGE-AUDIO-CURATION-GUIDE.md

A practical guide for sourcing, preparing, and uploading audio stems for the
FeyForge adaptive music engine. This is the guide for you and Ashley — not for
Cody.

---

## How the engine works (the short version)

Each scene+mode (e.g. Town → Explore) has 4–5 stems. Each stem is a single
looping audio file — one instrument group (just strings, just drums, just pads,
etc.). Every stem has an intensity window (min–max on a 1–5 scale). As the DM
moves the intensity slider, stems fade in and out over ~4 seconds based on their
windows.

**Your job:** find or make loops that sound good together and upload them as
individual files. You assign the intensity windows when you approve them in the
admin panel.

---

## What makes a good stem

- **Single instrument group** — just the strings, just the percussion, just the
  atmospheric pads. Not a full mix.
- **Loops cleanly** — the end flows back into the beginning without a pop, gap,
  or awkward beat.
- **Matches the scene energy** — a "Full Percussion" stem for Town → Explore
  should feel busier than a "Soft Melody" stem for the same scene.
- **Royalty-free** — Freesound (CC0 or CC-BY), Pixabay Music, or your own
  GarageBand exports.

---

## Stem roles and intensity windows

Use this as a starting template. You don't have to follow it exactly — trust
your ears.

| Stem role | Intensity window | Character |
|-----------|-----------------|-----------|
| Pads / atmosphere | 1–3 | Foundation, always present at low energy, fades as it builds |
| Soft melody | 1–4 | Melodic thread, present through most of the range |
| Rhythm / light percussion | 2–5 | Grows in as energy rises |
| Lead instrument (strings, brass, etc.) | 3–5 | Upper half only |
| Full percussion / high energy layer | 4–5 | High energy only |

At intensity 1: just pads + soft melody. Sparse, atmospheric.
At intensity 3: everything overlaps briefly — the richest mix.
At intensity 5: rhythm + lead + percussion. Pads gone. Full energy.

---

## Option A — Source from Freesound / Pixabay

Good for: getting started fast, atmospheric layers, weather sounds, crowd noise.

**Freesound.org tips:**
- Search `[instrument] loop fantasy` or `[instrument] loop medieval`
- Filter by license: **CC0** (no attribution required) or **CC-BY** (credit in
  your app's credits page)
- Filter by duration: 10s–120s works well for looping stems
- Listen for clean loop points — if the end doesn't match the beginning,
  Audacity can fix it (see below)

**Pixabay Music tips:**
- Use the genre filter: **Cinematic**, **Ambient**, or **Classical**
- All Pixabay music is royalty-free with no attribution required
- Full mixes download here, not stems — better for ambience layers than music
  stems

---

## Option B — GarageBand Apple Loops

Good for: making your own stems with zero mixing knowledge required.

GarageBand ships with hundreds of pre-recorded instrument loops sorted by
genre, instrument, and mood. You're not playing anything or programming MIDI —
you're dragging loops onto a timeline and exporting.

**Workflow:**

1. Open GarageBand → New Project → Empty Project
2. Click the loop browser (top right, looks like a loop icon)
3. Filter by **Genre: Cinematic** or **Instrument: Strings / Brass / Percussion**
4. Drag a loop onto the timeline — it auto-repeats to fill the region
5. Set your cycle region to a clean bar length (8, 16, or 32 bars)
6. **Export**: Share → Export Song to Disk → MP3 → Highest Quality (320kbps)
7. Name it descriptively: `town-explore-strings-mid.mp3`

For each scene+mode, make one export per stem role. Each export is one
instrument group only — mute everything else before exporting.

**Key thing:** all stems for the same scene+mode should use the same BPM and
loop length. GarageBand's Apple Loops are all BPM-synced by default — if you
stick to loops from the same tempo project they'll automatically match.

---

## Option C — Demucs stem separation

Good for: tracks you already have downloaded that you love but can't find
instrument-separated versions of.

Run the separator script on your raw files:

```bash
python scripts/audio-pipeline/feyforge_stems.py \
  --input ./feyforge-audio/raw \
  --output ./feyforge-audio/stems
```

You'll get per-instrument stems in `feyforge-audio/stems/track-name/`. Quality
varies — simpler tracks separate better than dense ones. Check each stem for
bleed before uploading.

Demucs stem categories:
- `other.mp3` — pads, strings, atmosphere (often the most useful)
- `piano.mp3` — keys
- `guitar.mp3` — plucked strings, guitar
- `bass.mp3` — bass line
- `drums.mp3` — percussion
- `vocals.mp3` — usually empty for instrumentals, ignore it

---

## Cleaning up loops in Audacity

Use Audacity to fix loop points and normalize volume before uploading.
Free, available at audacityteam.org.

**Fix a loop point:**
1. Open the file in Audacity
2. Zoom into the end of the track
3. Find a zero-crossing near the natural end of a musical phrase
4. Select from that point to the end → Delete
5. File → Export → MP3

**Normalize:**
Effect → Normalize → set peak amplitude to **-1.0 dB** → OK

**Test the loop:**
Enable Transport → Loop Play, then hit play. Listen for pops or gaps. If you
hear one, trim a little more from the end until it's clean.

---

## Folder structure

Keep your working files organized:

```
feyforge-audio/
  raw/          ← source downloads (don't upload these)
  stems/        ← Demucs output
  exports/      ← GarageBand exports before cleanup
  ready/        ← cleaned, normalized, loop-trimmed files (upload these)
```

Name files descriptively in kebab-case:

```
town-explore-pads.mp3
town-explore-strings-mid.mp3
town-explore-full-percussion.mp3
forest-combat-brass-lead.mp3
dungeon-explore-atmosphere.mp3
```

You don't have to include the scene/mode in the filename — the admin panel is
where you assign those — but it helps you stay organized locally.

---

## Running the normalize script

After cleaning in Audacity, run the normalizer to do a final check and
ensure consistent loudness across all stems:

```bash
python scripts/audio-pipeline/feyforge_normalize.py \
  --input ./feyforge-audio/exports \
  --output ./feyforge-audio/ready
```

For music stems, each file is processed individually — there's no duration
matching requirement anymore (unlike the old Low/Med/High system). The script
just normalizes loudness and trims trailing silence.

---

## Uploading

Once your files are in `feyforge-audio/ready/`, upload them all at once:

```bash
pnpm upload --input ./feyforge-audio/ready --type music
```

For ambience layers:

```bash
pnpm upload --input ./feyforge-audio/ready --type ambience
```

Files go to R2 and land in the admin review queue as pending. The script skips
files it's already uploaded (safe to re-run).

---

## Approving in the admin panel

1. Open FeyForge admin → Audio Review
2. Find your pending track, hit play — give it a listen
3. Set tier: **Free** or **Premium**
4. For music tracks, fill out stem assignment slots:
   - **Scene** — pick from the dropdown (town, forest, dungeon, etc.)
   - **Mode** — explore, combat, or victory
   - **Stem name** — descriptive label (e.g. "Strings — Mid Layer")
   - **Intensity min/max** — where this stem should be audible (1–5)
   - Add more slots if the same file works for multiple scenes/modes
5. Click **Approve + Assign Stems**

The stem is immediately live in any session using that scene.

---

## Intensity window quick reference

Not sure what window to set? Use this:

| This stem sounds like... | Set window to |
|--------------------------|--------------|
| Atmospheric, droney, sparse | 1–2 or 1–3 |
| Melodic but gentle | 1–4 |
| Rhythmic, some energy | 2–4 or 2–5 |
| Bold, punchy, full | 3–5 |
| Intense, driving, loud | 4–5 or 5 only |

When in doubt: overlap generously. The 4-second fade smooths everything out.
Having stems overlap at intensity 3 creates the richest, most interesting
midpoint.

---

## Checklist per stem

- [ ] Single instrument group only (not a full mix)
- [ ] Loops cleanly — tested in Audacity loop play
- [ ] Normalized to -1dBFS
- [ ] Named descriptively in kebab-case
- [ ] In `feyforge-audio/ready/` folder
- [ ] Uploaded via upload script
- [ ] Approved in admin panel with at least one stem slot assigned
