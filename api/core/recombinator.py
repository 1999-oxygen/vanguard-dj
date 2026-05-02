"""
VANGUARD UNIVERSAL - THE RECOMBINATOR
Takes raw atoms from the Fusion Engine and generates a phase-locked,
BPM-synced, and Key-matched 'Flight Plan' for the audio engine.
"""
import json
import hashlib
import os
from typing import List, Dict, Optional
from datetime import datetime

# Import harmonic utilities for key distance calculation
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class UniversalRecombinator:
    def __init__(self, master_bpm=124.0, master_key="8A", sample_rate=44100):
        self.master_bpm = master_bpm
        self.master_key = master_key
        self.sr = sample_rate
        self.ghost_tail_samples = int(0.010 * self.sr)  # 10ms micro-fade for zero clicks

    def _calculate_stretch_ratio(self, original_bpm):
        """Calculates how much the audio needs to be warped to fit the master tempo."""
        if original_bpm <= 0:
            return 1.0
        return self.master_bpm / original_bpm

    def _calculate_pitch_shift(self, original_key):
        """
        Calculates required semitone shift to match the Master Key.
        Uses Camelot wheel logic for harmonic mixing.
        """
        if not original_key or original_key == self.master_key:
            return 0.0

        # Parse Camelot keys
        def parse_camelot(key):
            if not key or len(key) < 2:
                return (0, 'A')
            num = int(''.join(c for c in key if c.isdigit()))
            mode = key[-1] if key[-1] in 'AB' else 'A'
            return (num, mode)

        orig = parse_camelot(original_key)
        master = parse_camelot(self.master_key)

        # Same key
        if orig == master:
            return 0.0

        # Calculate semitone difference on the Camelot wheel
        # Each number = 1 semitone, A/B = minor/major (relative = 3 semitones)
        num_diff = (master[0] - orig[0]) % 12
        if num_diff > 6:
            num_diff -= 12

        # Mode difference (A=minor, B=major)
        mode_diff = 0
        if orig[1] != master[1]:
            # Relative major/minor = 3 semitones
            mode_diff = 3 if master[1] == 'B' else -3

        return float(num_diff + mode_diff)

    def build_flight_plan(self, fusion_elements: List[Dict], output_name="dynamic_fusion_01"):
        """
        Compiles the queried atoms into a continuous, gapless timeline.
        """
        print(f"\n[RECOMBINATOR] Assembling Universal Timeline...")
        print(f"-> Target BPM: {self.master_bpm} | Target Key: {self.master_key}")

        timeline = []
        current_playhead_sample = 0
        total_duration_samples = 0

        for index, element in enumerate(fusion_elements):
            # 1. Calculate Elastic Audio parameters
            original_bpm = element.get('bpm', self.master_bpm)
            stretch_ratio = self._calculate_stretch_ratio(original_bpm)
            pitch_shift = self._calculate_pitch_shift(element.get('key', self.master_key))

            # 2. Calculate actual playback duration after time-stretching
            playback_bounds = element.get('playback_bounds', [0, int(4 * 60 / original_bpm * self.sr)])
            original_duration_samples = playback_bounds[1] - playback_bounds[0]
            warped_duration_samples = int(original_duration_samples / stretch_ratio)

            # 3. Create the Timeline Event
            event = {
                "sequence_id": index,
                "atom_id": element.get('atom_id', f"atom_{index}"),
                "source_file": element.get('source_track', 'unknown'),
                "track_name": element.get('track_name', 'Unknown Track'),

                # Audio Engine Routing
                "stem_target": element.get('stem_target', 'master'),

                # Synchronization Data
                "trigger_sample_master": current_playhead_sample,
                "trigger_time_sec": round(current_playhead_sample / self.sr, 4),
                "source_start_sample": playback_bounds[0],
                "source_end_sample": playback_bounds[1],

                # DSP Processing Data
                "time_stretch_ratio": round(stretch_ratio, 4),
                "pitch_shift_semitones": round(pitch_shift, 2),
                "ghost_tail_ms": 10.0,

                # Duration info
                "original_duration_samples": original_duration_samples,
                "warped_duration_samples": warped_duration_samples,
                "warped_duration_sec": round(warped_duration_samples / self.sr, 3),

                # Source metadata
                "original_bpm": original_bpm,
                "original_key": element.get('key', 'Unknown'),

                # Metrics for UI
                "ui_metrics": element.get('metrics', {})
            }

            timeline.append(event)

            # Move the playhead forward with ghost tail overlap
            current_playhead_sample += (warped_duration_samples - self.ghost_tail_samples)
            total_duration_samples = current_playhead_sample + self.ghost_tail_samples

        # Generate the Final JSON Payload
        fusion_id = hashlib.md5(f"{output_name}_{datetime.now().isoformat()}".encode()).hexdigest()[:8]

        flight_plan = {
            "fusion_id": fusion_id,
            "title": output_name,
            "engine_spec": "VANGUARD_UNIVERSAL_V1",
            "global_bpm": self.master_bpm,
            "global_key": self.master_key,
            "sample_rate": self.sr,
            "total_events": len(timeline),
            "total_duration_samples": total_duration_samples,
            "total_duration_sec": round(total_duration_samples / self.sr, 2),
            "ghost_tail_samples": self.ghost_tail_samples,
            "timeline": timeline
        }

        return flight_plan

    def save_flight_plan(self, flight_plan: Dict, cache_dir: str = "data/cache"):
        """Save flight plan to disk for the audio engine to pick up."""
        os.makedirs(cache_dir, exist_ok=True)
        output_path = os.path.join(cache_dir, f"{flight_plan['title']}.json")

        with open(output_path, "w") as f:
            json.dump(flight_plan, f, indent=4)

        print(f"[SUCCESS] Flight Plan Generated: {flight_plan['total_events']} Atoms linked.")
        print(f"-> Saved to {output_path}")
        print(f"-> Total Duration: {flight_plan['total_duration_sec']}s")

        return output_path


def recombine_from_segments(segments: List[Dict], master_bpm: float = 124.0,
                            master_key: str = "8A", output_name: str = "auto_mix") -> Dict:
    """
    Convenience function: Convert segment pool atoms into fusion elements
    and build a flight plan.
    """
    fusion_elements = []

    for seg in segments:
        element = {
            "atom_id": seg.get('id', f"seg_{len(fusion_elements)}"),
            "source_track": seg.get('trackName', 'unknown'),
            "track_name": seg.get('trackName', 'Unknown'),
            "bpm": seg.get('features', {}).get('bpm', master_bpm),
            "key": seg.get('features', {}).get('key', master_key),
            "playback_bounds": [
                int(seg.get('start', 0) * 44100),
                int(seg.get('end', seg.get('duration', 4)) * 44100)
            ],
            "stem_target": seg.get('stem_target', 'master'),
            "metrics": {
                "energy": seg.get('features', {}).get('avgEnergy', 0.5),
                "duration": seg.get('duration', 4)
            }
        }
        fusion_elements.append(element)

    recombinator = UniversalRecombinator(master_bpm=master_bpm, master_key=master_key)
    flight_plan = recombinator.build_flight_plan(fusion_elements, output_name)

    return flight_plan


# Example Integration Pipeline
if __name__ == "__main__":
    # MOCK DATA from the Query Engine
    mock_fusion_elements = [
        {
            "atom_id": "trk_1_grid_4",
            "source_track": "audio/vox_loop_120.wav",
            "track_name": "Vocal Loop 120",
            "bpm": 120.0,
            "key": "8A",
            "playback_bounds": [44100, 220500],
            "stem_target": "vocals",
            "metrics": {"energy": 0.85, "vocals_wps": 2.4}
        },
        {
            "atom_id": "trk_2_grid_8",
            "source_track": "audio/synth_drop_126.wav",
            "track_name": "Synth Drop 126",
            "bpm": 126.0,
            "key": "9A",
            "playback_bounds": [0, 176400],
            "stem_target": "master",
            "metrics": {"energy": 0.92, "vocals_wps": 0.0}
        },
        {
            "atom_id": "trk_3_grid_2",
            "source_track": "audio/drum_loop_130.wav",
            "track_name": "Drum Loop 130",
            "bpm": 130.0,
            "key": "7A",
            "playback_bounds": [0, 132300],
            "stem_target": "drums",
            "metrics": {"energy": 0.78, "vocals_wps": 0.0}
        }
    ]

    # Initialize the Recombinator to a master tempo
    recombinator = UniversalRecombinator(master_bpm=128.0, master_key="8A")

    # Build and export the timeline
    plan = recombinator.build_flight_plan(mock_fusion_elements, "peak_hour_mashup")
    recombinator.save_flight_plan(plan)

    print("\nFlight Plan Preview:")
    for event in plan['timeline'][:3]:
        print(f"  [{event['sequence_id']}] {event['track_name']}")
        print(f"      Trigger: {event['trigger_time_sec']}s | "
              f"Stretch: {event['time_stretch_ratio']}x | "
              f"Pitch: {event['pitch_shift_semitones']}st")

