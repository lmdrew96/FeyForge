#!/usr/bin/env python3
"""
feyforge_normalize.py

Normalizes and loop-trims the Low/Med/High exports from GarageBand
before uploading to FeyForge/R2.

- Normalizes peak loudness to -1dB across all three variants
- Trims trailing silence
- Verifies all three variants are the same duration (warns if not)
- Exports to ./ready/<track-name>/{low,med,high}.mp3

Usage:
    python feyforge_normalize.py --input ./exports --output ./ready

Requirements:
    pip install pydub
    # Also requires ffmpeg: brew install ffmpeg
"""

import argparse
import sys
import shutil
from pathlib import Path

try:
    from pydub import AudioSegment
    from pydub.effects import normalize
except ImportError:
    print("❌  pydub not found. Install it with:\n    pip install pydub")
    print("    Also requires ffmpeg:     brew install ffmpeg")
    sys.exit(1)


EXPECTED_VARIANTS = {"low", "med", "high"}
TARGET_PEAK_DBFS = -1.0
SILENCE_THRESHOLD_DBFS = -60.0
SILENCE_CHUNK_MS = 100
DURATION_TOLERANCE_MS = 500  # warn if variants differ by more than this


def trim_trailing_silence(audio: AudioSegment) -> AudioSegment:
    """Trim trailing silence from an audio segment."""
    end = len(audio)
    while end > SILENCE_CHUNK_MS:
        chunk = audio[end - SILENCE_CHUNK_MS:end]
        if chunk.dBFS > SILENCE_THRESHOLD_DBFS:
            break
        end -= SILENCE_CHUNK_MS
    return audio[:end]


def process_set(set_dir: Path, output_dir: Path) -> None:
    print(f"\n🎵  Processing set: {set_dir.name}")

    # Find low/med/high files (any supported extension)
    variants: dict[str, Path] = {}
    for f in set_dir.iterdir():
        stem = f.stem.lower()
        if stem in EXPECTED_VARIANTS and f.suffix.lower() in {".mp3", ".wav", ".aiff"}:
            variants[stem] = f

    missing = EXPECTED_VARIANTS - set(variants.keys())
    if missing:
        print(f"⚠️   Missing variants: {missing} — skipping set")
        return

    dest = output_dir / set_dir.name
    dest.mkdir(parents=True, exist_ok=True)

    durations = {}
    for variant_name in ["low", "med", "high"]:
        src = variants[variant_name]
        print(f"    Processing {variant_name}: {src.name}")

        audio = AudioSegment.from_file(str(src))
        audio = trim_trailing_silence(audio)
        audio = normalize(audio, headroom=(0 - TARGET_PEAK_DBFS))

        out_path = dest / f"{variant_name}.mp3"
        audio.export(str(out_path), format="mp3", bitrate="320k")
        durations[variant_name] = len(audio)
        print(f"    ✅  {variant_name}.mp3 — {len(audio)/1000:.1f}s, peak: {audio.max_dBFS:.1f}dBFS")

    # Duration check
    durations_ms = list(durations.values())
    spread = max(durations_ms) - min(durations_ms)
    if spread > DURATION_TOLERANCE_MS:
        print(f"    ⚠️   Duration mismatch: low={durations['low']/1000:.1f}s, "
              f"med={durations['med']/1000:.1f}s, high={durations['high']/1000:.1f}s")
        print(f"         Variants should be the same length for clean blending.")
        print(f"         Trim loop points in GarageBand before uploading.")
    else:
        print(f"    ✅  Durations consistent (within {spread}ms)")

    print(f"    📁  Saved to: {dest}")


def main():
    parser = argparse.ArgumentParser(
        description="Normalize and validate FeyForge Low/Med/High track exports"
    )
    parser.add_argument(
        "--input", "-i",
        required=True,
        help="Folder containing subfolders per track set, each with low/med/high files",
    )
    parser.add_argument(
        "--output", "-o",
        default="./ready",
        help="Folder to write normalized exports (default: ./ready)",
    )
    args = parser.parse_args()

    input_dir = Path(args.input)
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    sets = [d for d in input_dir.iterdir() if d.is_dir()]
    if not sets:
        print(f"❌  No subfolders found in {input_dir}")
        print(f"    Expected structure: exports/<track-name>/{{low,med,high}}.mp3")
        sys.exit(1)

    print(f"🎶  FeyForge Normalizer")
    print(f"    Sets found : {len(sets)}")
    print(f"    Target peak: {TARGET_PEAK_DBFS}dBFS")
    print(f"    Output     : {output_dir.resolve()}")

    for set_dir in sorted(sets):
        process_set(set_dir, output_dir)

    print(f"\n{'─' * 50}")
    print(f"✨  Done! Normalized {len(sets)} set(s).")
    print(f"📁  Upload-ready files in: {output_dir.resolve()}")
    print(f"{'─' * 50}\n")


if __name__ == "__main__":
    main()
