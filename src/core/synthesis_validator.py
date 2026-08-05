"""
Deterministic grounding check for SynthesisReport -- the equivalent of
validator.py/crosscheck.py, but for the synthesis stage.

Synthesis has no multi-model crosscheck or escalation (it's a single call
over a small, already-verified corpus), so this is the ONLY automated
safety net catching a hallucinated citation or a value that doesn't
actually exist in the source data. It doesn't re-judge the *reasoning*
(ranking, tradeoffs) -- only whether the concrete, checkable claims
(paper_ids, numeric values) are real.
"""

import re
from typing import Dict, List

from schemas.synthesis_schema import SynthesisReport
from src.utils.logger import Logger

_NUMBER_RE = re.compile(r"-?\d+(?:\.\d+)?")


def _numbers_in(text: str) -> List[str]:
    return [m.group(0) for m in _NUMBER_RE.finditer(text)]


class SynthesisValidator:

    @staticmethod
    def check(report: SynthesisReport, source_papers: Dict[str, dict]) -> int:
        """
        source_papers: {paper_id: full paper JSON dict} for every paper
        actually passed into the synthesis prompt.

        Sets .citation_verified on each MaterialRecommendation. Returns
        count of recommendations that failed the check.
        """
        valid_ids = set(source_papers.keys())
        failed = 0

        # 1. papers_considered must not invent paper_ids that weren't
        #    actually supplied.
        phantom_papers = [p for p in report.papers_considered if p not in valid_ids]
        if phantom_papers:
            Logger.warning(
                f"[synthesis_validator] papers_considered lists {len(phantom_papers)} "
                f"paper_id(s) not present in the input set: {phantom_papers} -- "
                f"likely hallucinated."
            )

        missing_papers = [p for p in valid_ids if p not in report.papers_considered]
        if missing_papers:
            Logger.warning(
                f"[synthesis_validator] {len(missing_papers)} supplied paper(s) never "
                f"appear in papers_considered -- model may have silently ignored input: "
                f"{missing_papers}"
            )

        # 2. Every recommendation's supporting_papers and key_metrics must
        #    be traceable to real data.
        for rec in report.ranked_materials:
            ok = True

            bad_refs = [p for p in rec.supporting_papers if p not in valid_ids]
            if bad_refs:
                Logger.warning(
                    f"[synthesis_validator] '{rec.material}' cites unknown paper_id(s) "
                    f"{bad_refs} -- flagging as unverified."
                )
                ok = False

            if not rec.supporting_papers:
                Logger.warning(
                    f"[synthesis_validator] '{rec.material}' has no supporting_papers at "
                    f"all -- flagging as unverified."
                )
                ok = False

            # Check each numeric claim in key_metrics actually appears
            # somewhere in one of the cited papers' extracted values.
            cited_source_text = " ".join(
                mv.get("value", "")
                for pid in rec.supporting_papers if pid in source_papers
                for field in source_papers[pid].get("performance", {}).values()
                if isinstance(field, list)
                for mv in field if isinstance(mv, dict)
            )

            for metric in rec.key_metrics:
                claim_numbers = _numbers_in(metric)
                if claim_numbers and not any(n in cited_source_text for n in claim_numbers):
                    Logger.warning(
                        f"[synthesis_validator] '{rec.material}' key_metric "
                        f"\"{metric}\" contains number(s) not found in its cited "
                        f"papers' extracted values -- possible fabrication/rounding "
                        f"drift, flagging as unverified."
                    )
                    ok = False

            # PFAS/fluoropolymer compliance cross-check. Best-effort token
            # overlap between the recommendation's material name and each
            # cited paper's materials/coatings/lubricants entries -- if any
            # matched source entry is flagged
            # contains_fluoropolymer_or_pfas=True while the recommendation
            # claims pfas_free_compliant="yes", that's a real, checkable
            # contradiction, not a style nitpick.
            rec_tokens = set(rec.material.lower().replace("-", " ").split())
            for pid in rec.supporting_papers:
                if pid not in source_papers:
                    continue
                mat_block = source_papers[pid].get("materials", {})
                all_entries = (
                    (mat_block.get("materials") or [])
                    + (mat_block.get("coatings") or [])
                    + (mat_block.get("lubricants") or [])
                )
                for entry in all_entries:
                    if not isinstance(entry, dict):
                        continue
                    entry_name = entry.get("name", "")
                    entry_tokens = set(entry_name.lower().replace("-", " ").split())
                    if rec_tokens & entry_tokens and entry.get("contains_fluoropolymer_or_pfas"):
                        if rec.pfas_free_compliant == "yes":
                            Logger.warning(
                                f"[synthesis_validator] '{rec.material}' is marked "
                                f"pfas_free_compliant='yes' but matches source material "
                                f"'{entry_name}' in paper {pid}, which is flagged "
                                f"contains_fluoropolymer_or_pfas=True -- contradiction, "
                                f"flagging as unverified."
                            )
                            ok = False

            rec.citation_verified = ok
            if not ok:
                failed += 1

        if failed:
            Logger.warning(
                f"[synthesis_validator] {failed}/{len(report.ranked_materials)} "
                f"recommendation(s) failed grounding check -- review before trusting."
            )
        else:
            Logger.success(
                "[synthesis_validator] All recommendations trace to real "
                "paper_ids and real extracted values."
            )

        return failed
