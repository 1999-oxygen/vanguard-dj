import librosa
import numpy as np
import json
import os
from typing import Dict, Any, Optional

class VanguardAnalyzer:
    def __init__(self, target_sr: int = 44100):
        self.sr = target_sr
        self.keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

    def analyze_track(self, file_path: str) -> Dict[str, Any]:
        """
        Analyze an audio track and return its DNA payload.

        1. Beat & Tempo Extraction
        2. Harmonic Key Detection (Chromagram)
        3. Spectral Energy Profiling (RMS)
        4. Playlist Atomizer (4-beat chunks)
        """
        if not os.path.isfile(file_path):
            raise FileNotFoundError(f"Audio file not found: {file_path}")

        # Load audio (mono for analysis to save memory)
        y, sr = librosa.load(file_path, sr=self.sr, mono=True)

        # 1. Beat & Tempo Extraction
        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=self.sr)
        # Handle both scalar and array returns from different librosa versions
        if hasattr(tempo, '__iter__'):
            tempo_val = float(tempo[0])
        else:
            tempo_val = float(tempo)
        beat_times = librosa.frames_to_time(beat_frames, sr=self.sr)

        # 2. Harmonic Key Detection (Chromagram)
        chroma = librosa.feature.chroma_cqt(y=y, sr=self.sr)
        key_index = int(np.argmax(np.sum(chroma, axis=1)))
        detected_key = self.keys[key_index]

        # 3. Spectral Energy Profiling (RMS)
        rms = librosa.feature.rms(y=y)[0]
        rms_times = librosa.frames_to_time(np.arange(len(rms)), sr=self.sr)

        # 4. Playlist Atomizer (Segmenting into 4-beat chunks)
        atoms = []
        for i in range(0, len(beat_times) - 4, 4):
            start_time = float(beat_times[i])
            end_time = float(beat_times[i + 4])

            # Find average energy for this specific atom
            atom_rms_indices = np.where((rms_times >= start_time) & (rms_times < end_time))[0]
            atom_energy = float(np.mean(rms[atom_rms_indices])) if len(atom_rms_indices) > 0 else 0.0

            atoms.append({
                "atom_id": f"atom_{i // 4}",
                "start_sec": start_time,
                "end_sec": end_time,
                "duration": round(end_time - start_time, 3),
                "energy_level": round(atom_energy * 10, 2)  # Scale 1-10
            })

        # 5. Compile DNA Payload
        dna_payload = {
            "track_name": os.path.basename(file_path),
            "bpm": round(tempo_val, 2),
            "key": detected_key,
            "total_atoms": len(atoms),
            "atoms": atoms
        }

        return dna_payload

    def analyze_bytes(self, audio_bytes: bytes, filename: str = "upload") -> Dict[str, Any]:
        """
        Analyze audio from raw bytes (for API ingestion).
        Writes to a temp file, analyzes, then cleans up.
        """
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name
        try:
            result = self.analyze_track(tmp_path)
            result["track_name"] = filename
            return result
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


# Standalone convenience
if __name__ == "__main__":
    import sys
    analyzer = VanguardAnalyzer()
    if len(sys.argv) < 2:
        print("Usage: python analyzer.py <path_to_audio_file>")
        sys.exit(1)

    file_path = sys.argv[1]
    dna = analyzer.analyze_track(file_path)

    out_path = "track_dna.json"
    with open(out_path, "w") as f:
        json.dump(dna, f, indent=4)

    print(f"[VANGUARD AI] Analysis complete. DNA saved to {out_path}")
    print(json.dumps(dna, indent=2))

