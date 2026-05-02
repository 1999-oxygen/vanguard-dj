#!/usr/bin/env python3
"""
Standalone CLI runner for the Vanguard Neural Analysis Core.

Usage:
    python scripts/analyze_track.py ./music/track.wav
    python scripts/analyze_track.py ./music/track.mp3 --output ./dna/track_dna.json
"""
import argparse
import json
import os
import sys

# Add parent directory to path so we can import api.analyzer
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from api.analyzer import VanguardAnalyzer


def main():
    parser = argparse.ArgumentParser(
        description="Vanguard Neural Analysis Core — Extract Track DNA"
    )
    parser.add_argument("file", help="Path to audio file (wav, mp3, flac, etc.)")
    parser.add_argument(
        "--output",
        "-o",
        default="track_dna.json",
        help="Output JSON path (default: track_dna.json)",
    )
    parser.add_argument(
        "--sr",
        type=int,
        default=44100,
        help="Target sample rate (default: 44100)",
    )
    args = parser.parse_args()

    if not os.path.isfile(args.file):
        print(f"[ERROR] File not found: {args.file}")
        sys.exit(1)

    print("[VANGUARD AI] Initializing Neural Analysis Core...")
    analyzer = VanguardAnalyzer(target_sr=args.sr)

    print(f"[VANGUARD AI] Loading: {args.file}")
    dna = analyzer.analyze_track(args.file)

    # Ensure output directory exists
    output_dir = os.path.dirname(args.output)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)

    with open(args.output, "w") as f:
        json.dump(dna, f, indent=4)

    print(f"[VANGUARD AI] Analysis complete. DNA saved to {args.output}")
    print(f"[VANGUARD AI] Summary: {dna['bpm']} BPM | Key {dna['key']} | {dna['total_atoms']} atoms")


if __name__ == "__main__":
    main()

