#!/usr/bin/env python3
"""
feyforge_stems.py

Batch stem separator for FeyForge audio curation.
Runs Demucs (htdemucs, 6-stem) on every MP3/WAV in an input folder,
then organizes outputs into a clean per-track folder structure.

Usage:
    python feyforge_stems.py --input ./raw --output ./stems

Requirements:
    pip install demucs

Output structure:
    stems/
      track-name/
        drums.mp3
        bass.mp3
        guitar.mp3
        piano.mp3
        other.mp3
        vocals.mp3   ← usually empty for instrumental tracks, safe to ignore
"""

import argparse
import subprocess
import shutil
import sys
from pathlib import Path


SUPPORTED_EXTENSIONS = {".mp3", ".wav", ".flac", ".aiff", ".m4a"}
DEMUCS_MODEL = "htdemucs"


def check_demucs():
    if shutil.which("demucs") is None:
        try:
            import demucs  # noqa: F401
        except ImportError:
            print("❌  Demucs not found. Install it with:\n    pip3 install demucs")
            sys.exit(1)


def get_tracks(input_dir: Path) -> list[Path]:
    tracks = [
        f for f in input_dir.iterdir()
        if f.is_file() and f.suffix.lower() in SUPPORTED_EXTENSIONS
    ]
    if not tracks:
        print(f"❌  No supported audio files found in {input_dir}")
        sys.exit(1)
    return sorted(tracks)


def separate_track(track: Path, output_dir: Path) -> None:
    dest = output_dir / track.stem
    if dest.exists() and any(dest.iterdir()):
        print(f"\n⏭️   Skipping (already separated): {track.name}")
        return

    print(f"\n🎵  Separating: {track.name}")
    result = subprocess.run(
        [
            sys.executable, "-m", "demucs",
            "--mp3",
            "--mp3-bitrate", "320",
            "-n", DEMUCS_MODEL,
            "-o", str(output_dir / "_raw"),
            str(track),
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"⚠️   Demucs error on {track.name}:\n{result.stderr}")
        return

    # Demucs outputs to: _raw/htdemucs/<track_stem>/drum.mp3 etc.
    track_stem = track.stem
    raw_path = output_dir / "_raw" / DEMUCS_MODEL / track_stem

    if not raw_path.exists():
        print(f"⚠️   Expected output not found at {raw_path}")
        return

    # Move into clean destination: stems/<track_stem>/
    dest.mkdir(parents=True, exist_ok=True)

    for stem_file in raw_path.iterdir():
        shutil.move(str(stem_file), str(dest / stem_file.name))

    print(f"✅  Stems saved to: {dest}")


def cleanup_raw(output_dir: Path) -> None:
    raw = output_dir / "_raw"
    if raw.exists():
        shutil.rmtree(raw)


def print_summary(output_dir: Path, tracks: list[Path]) -> None:
    print(f"\n{'─' * 50}")
    print(f"✨  Done! Separated {len(tracks)} track(s).")
    print(f"📁  Output: {output_dir.resolve()}")
    print(f"\nNext steps:")
    print(f"  1. Open GarageBand and import stems from each track folder")
    print(f"  2. Build Low / Med / High exports per the curation guide")
    print(f"  3. Run feyforge_normalize.py on your exports before uploading")
    print(f"{'─' * 50}\n")


def main():
    parser = argparse.ArgumentParser(
        description="Batch Demucs stem separator for FeyForge audio curation"
    )
    parser.add_argument(
        "--input", "-i",
        required=True,
        help="Folder containing raw audio tracks to separate",
    )
    parser.add_argument(
        "--output", "-o",
        default="./stems",
        help="Folder to write separated stems into (default: ./stems)",
    )
    parser.add_argument(
        "--track", "-t",
        help="Process a single track file instead of a whole folder",
    )
    args = parser.parse_args()

    check_demucs()

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    if args.track:
        tracks = [Path(args.track)]
    else:
        tracks = get_tracks(Path(args.input))

    print(f"🎶  FeyForge Stem Separator")
    print(f"    Model  : {DEMUCS_MODEL} (6-stem)")
    print(f"    Tracks : {len(tracks)}")
    print(f"    Output : {output_dir.resolve()}")

    for track in tracks:
        separate_track(track, output_dir)

    cleanup_raw(output_dir)
    print_summary(output_dir, tracks)


if __name__ == "__main__":
    main()
