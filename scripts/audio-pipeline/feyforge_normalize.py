#!/usr/bin/env python3
"""
feyforge_normalize.py

Normalizes and trims trailing silence on a flat folder of stem files
before uploading to FeyForge/R2.

- Normalizes peak loudness to -1dBFS per file
- Trims trailing silence
- Exports each file individually to the output folder as MP3 320k

Usage:
    python feyforge_normalize.py --input ./exports --output ./ready

Requirements:
    pip install pydub
    # Also requires ffmpeg: brew install ffmpeg
"""

import argparse
import sys
from pathlib import Path

try:
    from pydub import AudioSegment
    from pydub.effects import normalize
except ImportError:
    print("❌  pydub not found. Install it with:\n    pip install pydub")
    print("    Also requires ffmpeg:     brew install ffmpeg")
    sys.exit(1)


SUPPORTED_EXTENSIONS = {".mp3", ".wav", ".aiff", ".flac", ".m4a", ".ogg"}
TARGET_PEAK_DBFS = -1.0
SILENCE_THRESHOLD_DBFS = -60.0
SILENCE_CHUNK_MS = 100


def trim_trailing_silence(audio: AudioSegment) -> AudioSegment:
    """Trim trailing silence from an audio segment."""
    end = len(audio)
    while end > SILENCE_CHUNK_MS:
        chunk = audio[end - SILENCE_CHUNK_MS:end]
        if chunk.dBFS > SILENCE_THRESHOLD_DBFS:
            break
        end -= SILENCE_CHUNK_MS
    return audio[:end]


def process_file(src: Path, output_dir: Path) -> None:
    print(f"\n🎵  {src.name}")
    audio = AudioSegment.from_file(str(src))
    original_ms = len(audio)
    audio = trim_trailing_silence(audio)
    trimmed_ms = original_ms - len(audio)
    audio = normalize(audio, headroom=(0 - TARGET_PEAK_DBFS))

    out_path = output_dir / f"{src.stem}.mp3"
    audio.export(str(out_path), format="mp3", bitrate="320k")

    if trimmed_ms > 0:
        print(f"    ✂️   Trimmed {trimmed_ms}ms of trailing silence")
    print(f"    ✅  {out_path.name} — {len(audio)/1000:.1f}s, peak: {audio.max_dBFS:.1f}dBFS")


def main():
    parser = argparse.ArgumentParser(
        description="Normalize and trim a flat folder of FeyForge stem files"
    )
    parser.add_argument(
        "--input", "-i",
        required=True,
        help="Folder containing stem files (flat — not nested)",
    )
    parser.add_argument(
        "--output", "-o",
        default="./ready",
        help="Folder to write normalized exports (default: ./ready)",
    )
    args = parser.parse_args()

    input_dir = Path(args.input)
    output_dir = Path(args.output)

    if not input_dir.is_dir():
        print(f"❌  Input folder not found: {input_dir}")
        sys.exit(1)

    output_dir.mkdir(parents=True, exist_ok=True)

    files = sorted(
        f for f in input_dir.iterdir()
        if f.is_file() and f.suffix.lower() in SUPPORTED_EXTENSIONS
    )
    if not files:
        print(f"❌  No audio files found in {input_dir}")
        print(f"    Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}")
        sys.exit(1)

    print(f"🎶  FeyForge Normalizer")
    print(f"    Files found: {len(files)}")
    print(f"    Target peak: {TARGET_PEAK_DBFS}dBFS")
    print(f"    Output     : {output_dir.resolve()}")

    for src in files:
        process_file(src, output_dir)

    print(f"\n{'─' * 50}")
    print(f"✨  Done! Normalized {len(files)} file(s).")
    print(f"📁  Upload-ready files in: {output_dir.resolve()}")
    print(f"{'─' * 50}\n")


if __name__ == "__main__":
    main()
