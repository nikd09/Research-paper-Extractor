"""
Last-resort escalation to the paid Pro model -- now operating on
structured MetricValue.confidence instead of scanning value strings for
"[unverified]"/"[crosscheck]" text tags.

Runs AFTER: extract (Flash/free) -> verify (Flash/free, figure-targeted) ->
NumericValidator (Fix #1) -> crosscheck (Flash-Lite/free, multimodal,
per-entry).

Only entries still carrying confidence in {"unverified", "crosscheck_mismatch"}
after all of that get sent here -- not the whole paper, not even the whole
performance section. If nothing is flagged, this makes ZERO API calls: a
clean extraction never touches the paid key at all.
"""

from typing import Dict, List, Tuple

from schemas.paper_schema import MetricValue
from src.utils.logger import Logger

_FIELDS = [
    "friction_coefficients",
    "wear_rates",
    "mechanical_properties",
    "loads",
    "temperatures",
    "sliding_speeds",
]

_FLAG_STATES = {"unverified", "crosscheck_mismatch"}


class Escalator:

    @staticmethod
    def collect_flagged(analysis) -> Dict[str, List[Tuple[int, MetricValue]]]:
        flagged = {}
        perf = analysis.performance
        for field in _FIELDS:
            values = getattr(perf, field, None) or []
            hits = [(i, v) for i, v in enumerate(values) if v.confidence in _FLAG_STATES]
            if hits:
                flagged[field] = hits
        return flagged

    @staticmethod
    def run(ai_extractor, analysis, figure_manifest: str, figure_images: List[bytes], source_text: str = "") -> int:
        from schemas.paper_schema import PerformanceMetrics

        flagged = Escalator.collect_flagged(analysis)
        if not flagged:
            Logger.success("[escalation] Nothing flagged -- skipping Pro pass entirely (zero paid cost).")
            return 0

        total_flagged = sum(len(v) for v in flagged.values())
        Logger.warning(
            f"[escalation] {total_flagged} value(s) still flagged after free-tier "
            f"verify + crosscheck -- escalating to Pro (paid) for these specific "
            f"values only."
        )

        def _describe(mv: MetricValue) -> str:
            bits = [b for b in [mv.material, mv.condition] if b]
            label = " / ".join(bits) if bits else "(material/condition not extracted)"
            return f"  - {label}: current value = \"{mv.value}\" (source claimed: {mv.source or 'unknown'})"

        claims_block = "\n".join(
            f"{field}:\n" + "\n".join(_describe(v) for _, v in items)
            for field, items in flagged.items()
        )
        

        
        prompt_body = f"""SOURCE PAPER TEXT (check this FIRST -- most flagged values
turn out to be stated in plain prose/tables, not just charts; only fall
back to reading a figure if the value genuinely isn't in this text):
{source_text}

FIGURE MANIFEST (each attached image, and which figures it contains)
{figure_manifest or '(no figures could be located in this paper)'}

FLAGGED VALUES TO RESOLVE (grouped by field -- for each, check the source
text above first, and if not found there, read the correct attached
figure. Either confirm the exact value, correct it, or replace with
"Not Reported" only if genuinely unrecoverable from BOTH text and
figures). Preserve the same material/condition identity for each -- you
are resolving the VALUE, not re-identifying which material it belongs to.
{claims_block}
"""

        try:
            resolution = ai_extractor.extract(
                "Prompt_Escalation.md",
                prompt_body,
                schema=PerformanceMetrics,
                stage="verify_escalate",
                images=figure_images,
            )
        except Exception as e:
            Logger.warning(f"[escalation] Pro pass failed, leaving flagged values as-is: {e}")
            return 0

        resolved_count = 0
        perf = analysis.performance

        for field, items in flagged.items():
            resolved_values = getattr(resolution, field, None) or []
            if len(resolved_values) != len(items):
                Logger.warning(
                    f"[escalation] performance.{field}: Pro returned "
                    f"{len(resolved_values)} value(s), expected {len(items)} -- "
                    f"leaving original flagged values untouched for this field."
                )
                continue

            current = list(getattr(perf, field))
            for (index, original_mv), resolved_mv in zip(items, resolved_values):
                # Preserve the original material/condition identity --
                # escalation resolves the VALUE only, it should never
                # relabel which material a value belongs to.
                merged = MetricValue(
                    material=original_mv.material,
                    condition=original_mv.condition,
                    value=resolved_mv.value,
                    unit=original_mv.unit or resolved_mv.unit,
                    source=resolved_mv.source or original_mv.source,
                    confidence=(
                        "not_reported" if resolved_mv.value.strip().lower() == "not reported"
                        else resolved_mv.confidence if resolved_mv.confidence in ("confirmed", "approximate")
                        else "confirmed"
                    ),
                )
                current[index] = merged
                resolved_count += 1
            setattr(perf, field, current)

        Logger.success(f"[escalation] {resolved_count}/{total_flagged} value(s) resolved by Pro.")
        return resolved_count
