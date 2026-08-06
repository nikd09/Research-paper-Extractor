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


def _token_overlap(a: str, b: str) -> int:
    """Crude but effective: count shared alphanumeric tokens between two
    labels, case-insensitive."""
    ta = set(_normalize(a).replace("-", " ").split())
    tb = set(_normalize(b).replace("-", " ").split())
    return len(ta & tb)


# Fix #4: material and condition overlap used to be folded into one bag of
# tokens (`f"{material} {condition}"`), so a candidate could win purely on
# condition-word overlap with the WRONG material, or vice versa -- there
# was no way to tell "same material, different condition" apart from
# "same condition, different material" once they were merged into a
# single score. Scoring them separately lets _best_match() rank on
# material first (the stronger identity signal) and lets compare() below
# check condition agreement on its own before confirming a match.
def _material_overlap(a: str, b: str) -> int:
    return _token_overlap(a, b)


def _condition_overlap(a: str, b: str) -> int:
    return _token_overlap(a, b)


def _best_match(primary_mv: MetricValue, secondary_values: List[MetricValue]) -> Optional[MetricValue]:
    if not secondary_values:
        return None
    scored = [
        (
            _material_overlap(primary_mv.material, mv.material),
            _condition_overlap(primary_mv.condition, mv.condition),
            mv,
        )
        for mv in secondary_values
    ]
    scored.sort(key=lambda t: (t[0], t[1]), reverse=True)
    best_material, best_condition, best_mv = scored[0]
    return best_mv if best_material > 0 else (secondary_values[0] if len(secondary_values) == 1 else None)


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
                if mv.confidence in ("approximate", "not_reported", "confirmed", "contradicts_table"):
                    # "confirmed" already passed the deterministic text-
                    # grounding check in validator.py -- that's a stronger
                    # signal than an independent Flash-Lite re-extraction,
                    # so don't let crosscheck downgrade it. "contradicts_table"
                    # is an already-flagged prose/table discrepancy -- don't
                    # let a second independent extraction paper over it by
                    # confirming one side. "derived" is NOT in this skip set
                    # -- see the dedicated branch below, it still gets
                    # compared, just handled differently from a normal value.
                    continue

                primary_numbers = _numbers_of(mv)
                if not primary_numbers:
                    continue

                match = _best_match(mv, secondary_values)
                match_numbers = _numbers_of(match) if match else set()

                condition_mismatch = (
                    match is not None
                    and mv.condition
                    and match.condition
                    and _condition_overlap(mv.condition, match.condition) == 0
                )

                agrees = bool(primary_numbers & match_numbers) and not condition_mismatch

                if mv.confidence == "derived":
                    # A derived value was CALCULATED, not read -- it must
                    # never be promoted to "confirmed" just because an
                    # independent extraction agrees (confirmed is reserved
                    # for literal text/table/chart-label content). But
                    # disagreement IS a meaningful signal here: if the
                    # secondary extraction independently derived (or read)
                    # a different number for the same material/condition,
                    # the primary derivation may have picked the wrong
                    # percentage or made an arithmetic error -- flag it
                    # exactly like any other mismatch instead of silently
                    # trusting a computed value forever.
                    if agrees:
                        pass  # stays "derived" -- corroborated, not upgraded
                    else:
                        mv.confidence = "crosscheck_mismatch"
                        flagged += 1
                    continue

                if agrees:
                    # Independent pass found the same number for the
                    # closest-matching material/condition -- treat as
                    # confirmed even though it wasn't in raw text (it's
                    # very likely a correctly-read chart value).
                    mv.confidence = "confirmed"
                else:
                    # Either no matching number, or the numbers happened
                    # to agree but the matched entry's condition shares
                    # zero tokens with primary's -- e.g. two different
                    # test conditions compared across materials (see
                    # Fig. 9-style wear-scar mixups). A coincidental
                    # number match under a clearly different condition is
                    # not a genuine independent confirmation.
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
