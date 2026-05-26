# FEYFORGE-AUDIO-CURATION-GUIDE.md

A practical guide for preparing Low/Med/High track variants for the FeyForge
adaptive music engine. Follow this process for every track you want to use
in the scene music mixer.

---

## The content contract

The three variants assigned to any scene+mode slot (e.g. Town → Explore) must be:

- **The same musical piece** at different arrangement densities
- **The same BPM** — even a few BPM off will cause the blend to drift out of sync
- **The same loop length** — or a clean multiple (e.g. 32 bars, 64 bars, 128 bars)
- **The same key**

If these constraints aren't met, blended intensities (2 and 4) will sound like
two songs fighting. The engine can't fix bad source material.

---

## Required tools

| Tool | Purpose | Cost |
|------|---------|------|
| Python 3.10+ | Run the helper scripts | Free |
| Demucs | AI stem separation | Free (local) |
| GarageBand | Reassemble stems into variants | Free (Mac App Store) |
| feyforge_stems.py | Batch Demucs runner | Included |
| feyforge_normalize.py | Normalize + duration check | Included |

Install Python dependencies once:

```bash
pip3 install demucs pydub
brew install ffmpeg   # required by pydub
```

---

## Step 1 — Organize your raw tracks

Create a working folder:

```
feyforge-audio/
  raw/          ← drop your source MP3s/WAVs here
  stems/        ← Demucs output (created by script)
  exports/      ← your GarageBand exports (you create these)
    track-name/
      low.mp3
      med.mp3
      high.mp3
  ready/        ← normalized, upload-ready (created by script)
```

---

## Step 2 — Run Demucs stem separation

Run from the project root:

```bash
python3 scripts/audio-pipeline/feyforge_stems.py --input ./feyforge-audio/raw --output ./feyforge-audio/stems
```

To process a single track:

```bash
python3 scripts/audio-pipeline/feyforge_stems.py --track ./feyforge-audio/raw/my-track.mp3 --output ./feyforge-audio/stems
```

**Output per track** (`stems/track-name/`):

| Stem | Contents |
|------|---------|
| `other.mp3` | Ambient pads, strings, atmosphere |
| `piano.mp3` | Piano / keys |
| `guitar.mp3` | Guitar / plucked strings |
| `bass.mp3` | Bass line |
| `drums.mp3` | Percussion |
| `vocals.mp3` | Usually empty for instrumentals — ignore |

⚠️ Demucs quality varies by track. Dense, heavily-layered tracks will have
more "bleed" between stems. Simpler orchestral/acoustic tracks separate
much cleaner. Run a test track before committing to a full batch.

---

## Step 3 — Assemble variants in GarageBand

Open GarageBand → New Project → Empty Project.

Import all stems from `stems/track-name/` as separate audio tracks.

Build three exports per the table below. For each export:
`Share → Export Song to Disk → MP3 → Highest Quality (320kbps)`

Save as `exports/track-name/low.mp3`, `med.mp3`, `high.mp3`.

### Stem mix guide per variant

| Variant | other | piano/guitar | bass | drums | Notes |
|---------|-------|-------------|------|-------|-------|
| **Low** | 100% | 0–20% | 20% | 0% | Atmosphere only. Peaceful, minimal. |
| **Med** | 80% | 70% | 80% | 30–50% | Melody present, light rhythm. |
| **High** | 100% | 100% | 100% | 100% | Full reconstruction. All stems at unity. |

These are starting points — trust your ears. The goal is a clear, audible
difference in energy between each variant.

### Loop trimming in GarageBand

Before exporting, make sure each variant:
1. Ends at a musically natural point (end of a phrase, end of a bar)
2. Can loop seamlessly — the last beat/note should flow into the first beat
   without a gap or pop

Use the cycle region (yellow bar at the top of the timeline) to test the loop.
**All three variants must end at the same bar/beat position** so they stay in
sync when blended by the engine.

---

## Step 4 — Normalize and validate

```bash
python3 scripts/audio-pipeline/feyforge_normalize.py --input ./feyforge-audio/exports --output ./feyforge-audio/ready
```

This script:
- Normalizes peak loudness to **-1dBFS** across all three variants
- Trims trailing silence
- Warns you if the three variants have significantly different durations
  (a sign that loop points need fixing in GarageBand)
- Outputs upload-ready MP3s to `./feyforge-audio/ready/track-name/{low,med,high}.mp3`

If you see a duration mismatch warning, go back to GarageBand and align the
export end points before re-running.

---

## Step 5 — Upload to FeyForge

In FeyForge, navigate to the scene music set manager (DM library view).

For each scene+mode slot, upload:
- `low.mp3` → Low track
- `med.mp3` → Med track
- `high.mp3` → High track

Files are uploaded to R2 and associated with the `sceneMusicSets` record.

---

## Checklist per track

- [ ] Stems look clean (no obvious bleed artifacts in key stems)
- [ ] Low variant is clearly less energetic than High
- [ ] All three variants have the same BPM and loop length
- [ ] Loop plays seamlessly (tested in GarageBand cycle region)
- [ ] Normalizer ran without duration mismatch warnings
- [ ] Upload-ready files are in `./feyforge-audio/ready/track-name/`

---

## Track naming convention

Use kebab-case. Be descriptive — you'll be looking at these in dropdowns.

```
town-explore          → town-explore/low.mp3, med.mp3, high.mp3
town-combat           → town-combat/low.mp3, med.mp3, high.mp3
town-victory          → town-victory/low.mp3, med.mp3, high.mp3
forest-explore        → forest-explore/low.mp3, ...
dungeon-combat        → dungeon-combat/low.mp3, ...
```

---

## Troubleshooting

**Demucs bleed is too bad (drums audible in other stem)**
Some tracks just don't separate well. Try the `mdx_extra` model instead:
```bash
python3 scripts/audio-pipeline/feyforge_stems.py --input ./feyforge-audio/raw --output ./feyforge-audio/stems
# Edit the script: change DEMUCS_MODEL = "htdemucs" to "mdx_extra"
```
`mdx_extra` sometimes handles dense productions better at the cost of speed.

**Low and High sound too similar**
Lean harder on stem omission. For Low, zero out drums and bass entirely.
The energy difference needs to be obvious — the blend will smooth it out.

**Duration mismatch warning won't go away**
Open GarageBand, enable the metronome, and make sure your cycle region ends
on an exact bar boundary for all three variants before exporting.

**feyforge_normalize.py pydub error**
Make sure ffmpeg is installed: `brew install ffmpeg`
