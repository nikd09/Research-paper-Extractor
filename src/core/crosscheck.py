"""
Fix #5: dual-model numeric cross-check -- now PER-ENTRY, not per-field.

The pipeline runs a second, fully independent extraction (Prompt_12, cheap
model, zero knowledge of the primary result) and this module diffs its
PerformanceMetrics against the primary analysis.

CONFIRMED BUG in the previous version: it compared each field's numbers as
one unordered set-union. If ANY number in an 8-entry field also appeared
anywhere in the independent extraction's numbers for that field, the
ENTIRE field was marked "agrees" -- including any wrong values sitting
right next to that one coincidental match. This was the most likely
mechanism behind a confirmed real-world miss: a paper's true PPS wear rate
(6.6E-6) appeared correctly in one field while a fabricated 6.6E-7 (10x
off) sat unflagged in another, because *some* other number in the same
field happened to match the independent pass.

Now each MetricValue is compared individually against the closest-matching
entry in the secondary extraction (same field, best material-name overlap),
and only THAT entry's confidence is affected -- a lucky match elsewhere in
the field can no longer clear an unrelated wrong value.
"""

from typing import List, Optional

from schemas.paper_schema import MetricValue
from src.core.validator import _normalize, _numbers_in
from src.utils.logger import Logger

_FIELDS = [
    "friction_coefficients",
    "wear_rates",
    "mechanical_properties",
    "loads",
    "temperatures",
    "sliding_speeds",
]


def _numbers_of(mv: MetricValue) -> set:
    return {_normalize(n) for n in _numbers_in(mv.value)}


def _material_overlap(a: str, b: str) -> int:
    """Crude but effective: count shared alphanumeric tokens between two
    material/condition labels, case-insensitive. Used only to find the
    BEST candidate match in the secondary list, not as a correctness
    check by itself."""
    ta = set(_normalize(a).replace("-", " ").split())
    tb = set(_normalize(b).replace("-", " ").split())
    return len(ta & tb)


def _best_match(primary_mv: MetricValue, secondary_values: List[MetricValue]) -> Optional[MetricValue]:
    if not secondary_values:
        return None
    label = f"{primary_mv.material} {primary_mv.condition}"
    scored = [
        (_material_overlap(label, f"{mv.material} {mv.condition}"), mv)
        for mv in secondary_values
    ]
    scored.sort(key=lambda t: t[0], reverse=True)
    best_score, best_mv = scored[0]
    return best_mv if best_score > 0 else (secondary_values[0] if len(secondary_values) == 1 else None)


class CrossChecker:

    @staticmethod
    def compare(primary_analysis, secondary_analysis, secondary_model_label: str = "") -> int:
        """
        Compares primary_analysis.performance against
        secondary_analysis.performance ENTRY BY ENTRY. Sets .confidence on
        primary MetricValues in place. Returns count of entries flagged
        crosscheck_mismatch.
        """
        primary = primary_analysis.performance
        secondary = getattr(secondary_analysis, "performance", None)

        flagged = 0

        for field in _FIELDS:
            primary_values: List[MetricValue] = getattr(primary, field, None) or []
            if not primary_values:
                continue

            secondary_values: List[MetricValue] = getattr(secondary, field, None) if secondary else []

            for mv in primary_values:
                if mv.confidence in ("approximate", "not_reported", "confirmed"):
                    # "confirmed" already passed the deterministic text-
                    # grounding check in validator.py -- that's a stronger
                    # signal than an independent Flash-Lite re-extraction,
                    # so don't let crosscheck downgrade it.
                    continue

                primary_numbers = _numbers_of(mv)
                if not primary_numbers:
                    continue

                match = _best_match(mv, secondary_values)
                match_numbers = _numbers_of(match) if match else set()

                if primary_numbers & match_numbers:
                    # Independent pass found the same number for the
                    # closest-matching material/condition -- treat as
                    # confirmed even though it wasn't in raw text (it's
                    # very likely a correctly-read chart value).
                    mv.confidence = "confirmed"
                else:
                    mv.confidence = "crosscheck_mismatch"
                    flagged += 1

        if flagged:
            label = f" (vs {secondary_model_label})" if secondary_model_label else ""
            Logger.warning(
                f"[crosscheck] {flagged} value(s) had no matching number from "
                f"the independent extraction{label} -- flagged crosscheck_mismatch."
            )
        else:
            Logger.success("[crosscheck] Independent pass agrees with primary extraction.")

        return flagged
