"""
VANGUARD UNIVERSAL - FUSION QUERY ENGINE
The tool to categorize, filter, and pull segments for live mixing.
"""
from sqlalchemy import and_
from db.schema import SessionLocal, Atom, Track


class FusionQueryEngine:
    def __init__(self):
        self.db = SessionLocal()

    def get_fusion_elements(self,
                            min_energy=0.0, max_energy=1.0,
                            min_danceability=0.0,
                            require_vocals=False,
                            derivation="BEAT_GRID_4BAR",
                            limit=10):
        """
        Pulls exactly the right puzzle pieces for your mix.
        """
        print(f"\n[FUSION ENGINE] Scanning Quantum Database...")
        print(f"-> Energy: {min_energy} - {max_energy}")
        print(f"-> Vocals Req: {require_vocals}")

        query = self.db.query(Atom).join(Track)

        # Apply Filters
        filters = [
            Atom.energy_rms >= min_energy,
            Atom.energy_rms <= max_energy,
            Atom.danceability >= min_danceability,
            Atom.derivation_type == derivation
        ]

        # If we need vocals, check lyric density (Words per second > 0.5)
        if require_vocals:
            filters.append(Atom.lyric_density > 0.5)

        results = query.filter(and_(*filters)).limit(limit).all()

        print(f"[SUCCESS] Found {len(results)} Fusion-Ready Segments.\n")

        fusion_payload = []
        for r in results:
            data = {
                "atom_id": r.atom_id,
                "source_track": r.track.filename,
                "bpm": r.track.bpm,
                "duration": round(r.duration_sec, 2),
                "metrics": {
                    "energy": round(r.energy_rms, 3),
                    "vocals_wps": round(r.lyric_density, 2)
                },
                "playback_bounds": [r.start_sample, r.end_sample]
            }
            print(f"- {data['source_track']} | Energy: {data['metrics']['energy']} | BPM: {data['bpm']}")
            fusion_payload.append(data)

        return fusion_payload


# Example Usage:
if __name__ == "__main__":
    engine = FusionQueryEngine()

    # "I want high-energy segments that have vocals, cut into 4-bar loops"
    ready_to_mix = engine.get_fusion_elements(
        min_energy=0.15,  # In RMS terms, this is quite loud
        max_energy=1.0,
        require_vocals=True,
        limit=5
    )
