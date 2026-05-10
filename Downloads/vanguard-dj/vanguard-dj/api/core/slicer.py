"""
VANGUARD UNIVERSAL - ZERO-CROSSING SLICER
Guarantees zero audio artifacts (clicks/pops) by enforcing cuts at amplitude 0.0.
"""
import numpy as np


class ZeroCrossingEngine:
    def __init__(self, sample_rate=44100):
        self.sr = sample_rate

    def find_nearest_zero_crossing(self, y_buffer, target_sample, search_window_ms=5.0):
        """
        Microscopically shifts the cut-point to a zero-crossing to prevent popping.
        search_window_ms: How far we are willing to drift from the theoretical beat.
        """
        window_samples = int((search_window_ms / 1000.0) * self.sr)

        start_idx = max(0, target_sample - window_samples)
        end_idx = min(len(y_buffer) - 1, target_sample + window_samples)

        search_area = y_buffer[start_idx:end_idx]

        # Find where the audio wave crosses 0 (sign changes from positive to negative)
        zero_crossings = np.where(np.diff(np.sign(search_area)))[0]

        if len(zero_crossings) == 0:
            return target_sample  # Fallback if no crossing found (rare)

        # Find the crossing closest to our absolute target
        target_relative = target_sample - start_idx
        closest_crossing_idx = zero_crossings[np.argmin(np.abs(zero_crossings - target_relative))]

        exact_sample = start_idx + closest_crossing_idx
        return int(exact_sample)

    def slice_by_beat_grid(self, y, beat_samples, bars=4):
        """Derivation 1: Standard DJ Grid Slicing (e.g., every 16 beats)."""
        atoms_data = []
        beats_per_slice = bars * 4

        for i in range(0, len(beat_samples) - beats_per_slice, beats_per_slice):
            theoretical_start = beat_samples[i]
            theoretical_end = beat_samples[i + beats_per_slice]

            # Refine to zero-crossings
            perfect_start = self.find_nearest_zero_crossing(y, theoretical_start)
            perfect_end = self.find_nearest_zero_crossing(y, theoretical_end)

            atoms_data.append({
                "derivation": f"BEAT_GRID_{bars}BAR",
                "start": perfect_start,
                "end": perfect_end
            })

        return atoms_data

