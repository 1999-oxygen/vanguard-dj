"""Fusion engine.

This module is responsible for combining (“fusing”) compatible audio segments.
The project currently exposes an API pipeline that:
  1) analyzes segments
  2) matches segments between tracks/targets
  3) produces mix-ready instructions

`FusionEngine` is used as the final step to translate fusion/mix decisions into
an execution-ready representation.

The implementation here is intentionally lightweight: the heavy DSP lives in
other components (e.g. slicers/matchers/mix engines). This file focuses on:
  * input validation
  * deterministic fusion plan generation
  * keeping the shape of data stable for integration with `main.py`

If you already have a domain-specific fusion strategy, you can replace the
`build_fusion_plan()` logic while keeping the same public interface.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence, Tuple


@dataclass(frozen=True)
class FusionDecision:
    """A single fused segment decision.

    Attributes:
        target_time_range: (start_ms, end_ms)
        source_segments: list of segment IDs or descriptors that contribute
        mix_params: arbitrary dict of mix params (crossfade, gain, etc.)
    """

    target_time_range: Tuple[float, float]
    source_segments: List[str]
    mix_params: Dict[str, Any]


class FusionEngine:
    """Creates a fusion plan from matched segments."""

    def __init__(
        self,
        *,
        crossfade_ms: float = 50.0,
        normalize: bool = True,
        max_sources_per_decision: int = 2,
    ) -> None:
        self.crossfade_ms = float(crossfade_ms)
        self.normalize = bool(normalize)
        self.max_sources_per_decision = int(max_sources_per_decision)

    def fuse(
        self,
        *,
        target: Dict[str, Any],
        matched: Sequence[Dict[str, Any]],
        constraints: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Fuse matched segments into a fusion plan.

        Args:
            target: metadata for the target track (duration_ms, bpm, etc.)
            matched: iterable of match records. Expected shape (minimal):
                {
                  "target_range": (start_ms, end_ms),
                  "segment_id": str,
                  ... optional fields like score, gain, etc.
                }
            constraints: optional dict for extra constraints.

        Returns:
            dict that can be consumed by `main.py` / response builder.
        """

        constraints = constraints or {}

        decisions = self.build_fusion_plan(
            target=target,
            matched=matched,
            constraints=constraints,
        )

        return {
            "engine": "fusion_engine",
            "params": {
                "crossfade_ms": self.crossfade_ms,
                "normalize": self.normalize,
                "max_sources_per_decision": self.max_sources_per_decision,
            },
            "target": {
                "duration_ms": target.get("duration_ms"),
                "bpm": target.get("bpm"),
                **{k: v for k, v in target.items() if k not in {"duration_ms", "bpm"}},
            },
            "decisions": [
                {
                    "target_time_range": list(d.target_time_range),
                    "source_segments": d.source_segments,
                    "mix_params": d.mix_params,
                }
                for d in decisions
            ],
        }

    def build_fusion_plan(
        self,
        *,
        target: Dict[str, Any],
        matched: Sequence[Dict[str, Any]],
        constraints: Dict[str, Any],
    ) -> List[FusionDecision]:
        """Build a fusion plan.

        Current strategy:
          * group match records by their `target_range`
          * for each group, pick up to `max_sources_per_decision` sources
            (preferring those with highest `score` if present)
          * add a crossfade and optional normalization/gain params

        This keeps behavior deterministic for identical inputs.
        """

        if not isinstance(matched, Sequence):
            raise TypeError("matched must be a sequence")

        # Group by (start_ms, end_ms)
        grouped: Dict[Tuple[float, float], List[Dict[str, Any]]] = {}
        for rec in matched:
            if "target_range" not in rec:
                raise KeyError("Each matched record must include target_range")
            start_ms, end_ms = rec["target_range"]
            key = (float(start_ms), float(end_ms))
            grouped.setdefault(key, []).append(rec)

        # Sort keys for deterministic plan ordering
        sorted_ranges = sorted(grouped.keys(), key=lambda r: (r[0], r[1]))

        decisions: List[FusionDecision] = []
        for tr in sorted_ranges:
            recs = grouped[tr]

            # Prefer higher score if present; fallback to stable ordering
            def sort_key(r: Dict[str, Any]) -> Tuple[float, str]:
                score = float(r.get("score", 0.0))
                seg_id = str(r.get("segment_id", ""))
                return (score, seg_id)

            # Sort descending by score, then by seg_id
            recs_sorted = sorted(recs, key=sort_key, reverse=True)

            # Select sources
            chosen = recs_sorted[: self.max_sources_per_decision]
            source_ids = [str(r.get("segment_id")) for r in chosen if r.get("segment_id") is not None]
            if not source_ids:
                # If no segment_id present, we still create a decision with empty sources.
                # main.py may treat this as a no-op.
                source_ids = []

            # Mix params
            mix_params: Dict[str, Any] = {
                "crossfade_ms": self.crossfade_ms,
                "normalize": self.normalize,
            }

            # Optional gain from best record
            best = recs_sorted[0] if recs_sorted else {}
            if "gain" in best:
                mix_params["gain"] = best["gain"]

            # Optional user constraints passthrough
            for k in ("mode", "smoothing", "curve"):
                if k in constraints:
                    mix_params[k] = constraints[k]

            decisions.append(
                FusionDecision(
                    target_time_range=(tr[0], tr[1]),
                    source_segments=source_ids,
                    mix_params=mix_params,
                )
            )

        return decisions

