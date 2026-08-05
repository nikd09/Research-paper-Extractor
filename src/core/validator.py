"""
Fix #1: deterministic numeric-grounding check.

After extraction/verification, every MetricValue's `.value` is checked for
literal presence in the source text. Anything NOT found verbatim (allowing
for scientific-notation / spacing / Unicode-minus variants) did not come
from the paper's text -- it's either chart-derived (Fix #2 should have
grounded it via vision, and would have set confidence="approximate" or
"confirmed" already) or fabricated.

This is regex substring matching, not an LLM call -- free, deterministic,
and it does not attempt to explain *why* something is ungrounded (crosscheck
/ escalation handle that later if needed).

Sets `.confidence` directly on each MetricValue rather than appending a
free-text tag to `.value` -- confidence is now a first-class field, not
something every downstream consumer has to re-parse out of a string.
"""

import re
from typing import List, Tuple

from schemas.paper_schema import MetricValue
from src.utils.logger import Logger

# Matches things like: 1.13 x 10^-7, 1.13x10-7, 2.2E-07, 250 N, 0.28, 78.9 MPa
_NUMBER_RE = re.compile(
    r"""
    -?\d+(?:\.\d+)?                # base number
    (?:\s*[xX×]\s*10\s*\^?\s*-?\d+)?   # optional x10^n
    (?:[eE]-?\d+)?                 # optional scientific E notation
    """,
    re.VERBOSE,
)

# Unicode characters that appear in real academic-PDF-extracted text as a
# stand-in for a plain ASCII minus sign (most commonly in front of an
# exponent, e.g. "6.6E−6" using U+2212 MINUS SIGN, not "-" U+002D).
# Confirmed present in this project's own source papers (e.g. "10− 5 Pa").
# Without folding these to ASCII "-", a genuinely-present value can fail
# the verbatim check (false "[unverified]") and, separately, a value the
# model claims with a plain "-" can fail to match text that actually used
# one of these -- silently breaking grounding in both directions.
_UNICODE_MINUS_CHARS = ["\u2212", "\u2013", "\u2014"]  # minus sign, en dash, em dash
import re as _re

_SCI_NOTATION_RE = _re.compile(
    r"(-?\d+(?:\.\d+)?)\s*[xX×]\s*10\s*\^?\s*(-?\d+)"
)


def _canonicalize_scientific_notation(s: str) -> str:
    """Rewrites 'a x 10^b' / 'a × 10-b' style numbers into 'aeb' form so
    they compare equal to values already written in E-notation. Confirmed
    bug: a value stated in the paper as '2.0 × 10−5' and extracted as
    '2.0E-5' were treated as different numbers and never matched, causing
    a genuinely text-grounded value to be flagged unverified."""
    return _SCI_NOTATION_RE.sub(lambda m: f"{m.group(1)}e{m.group(2)}", s)

def _normalize(s: str) -> str:
    s = s.lower()
    s = s.replace("×", "x").replace("^", "")
    for ch in _UNICODE_MINUS_CHARS:
        s = s.replace(ch, "-")
    s = _canonicalize_scientific_notation(s)
    s = re.sub(r"\s+", "", s)
    return s


def _numbers_in(text: str) -> List[str]:
    # Normalize unicode minus BEFORE regex matching too, so "6.6E−6" (with
    # the unicode minus inside the exponent) is actually recognized as a
    # number by _NUMBER_RE in the first place, not just at comparison time.
    normalized_text = text
    for ch in _UNICODE_MINUS_CHARS:
        normalized_text = normalized_text.replace(ch, "-")
    return [m.group(0) for m in _NUMBER_RE.finditer(normalized_text)]


class NumericValidator:

    @staticmethod
    def _is_grounded(value: str, norm_source: str) -> bool:
        numbers = _numbers_in(value)
        if not numbers:
            return True  # nothing numeric to check -- pass through as grounded
        return all(_normalize(n) in norm_source for n in numbers)

    @staticmethod
    def check_field(values: List[MetricValue], source_text: str) -> Tuple[int, int]:
        """Sets .confidence on each MetricValue in place. Returns
        (grounded_count, ungrounded_count)."""
        norm_source = _normalize(source_text)
        grounded_n, ungrounded_n = 0, 0

        for mv in values:
            if mv.confidence in ("approximate", "not_reported"):
                # Already explicitly handled by the extraction/verify step
                # (e.g. a chart read with no exact gridline, or genuinely
                # unrecoverable) -- don't downgrade or override those.
                grounded_n += 1
                continue

            if NumericValidator._is_grounded(mv.value, norm_source):
                mv.confidence = "confirmed"
                grounded_n += 1
            else:
                mv.confidence = "unverified"
                ungrounded_n += 1

        return grounded_n, ungrounded_n

    @staticmethod
    def annotate(analysis, source_text: str) -> int:
        """
        Walks every structured PerformanceMetrics field on `analysis.performance`
        and sets .confidence on each MetricValue in place. Returns the total
        count flagged as unverified.
        """
        perf = getattr(analysis, "performance", None)
        if perf is None:
            return 0

        fields = [
            "friction_coefficients",
            "wear_rates",
            "mechanical_properties",
            "loads",
            "temperatures",
            "sliding_speeds",
        ]

        flagged_total = 0

        for field in fields:
            values = getattr(perf, field, None)
            if not values:
                continue

            grounded_n, ungrounded_n = NumericValidator.check_field(values, source_text)
            if ungrounded_n:
                flagged_total += ungrounded_n
                Logger.warning(
                    f"[validator] performance.{field}: {ungrounded_n}/{len(values)} "
                    f"value(s) not found verbatim in source text -- flagged unverified."
                )

        if flagged_total:
            Logger.warning(
                f"[validator] {flagged_total} numeric claim(s) flagged as unverified. "
                f"Likely chart-derived values the text extraction missed -- "
                f"the multimodal verify pass (Fix #2) should catch these; if it "
                f"still fails, crosscheck/escalation get another chance."
            )
        else:
            Logger.success("[validator] All numeric claims grounded in source text.")

        return flagged_total
