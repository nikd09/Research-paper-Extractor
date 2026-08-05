"""
Schema for the cross-paper synthesis stage.

Unlike per-paper extraction (which runs once per PDF and is designed to be
cheap-first), synthesis runs ONCE over the small set of already-verified
outputs already sitting in outputs/json/ -- so cost scales with "how many
times you run this," not with paper count. That changes the cost/benefit
calculus: there's no volume to control cost against, so it's the right
place to use your strongest available model rather than the cheapest.

It has no equivalent of validator.py/crosscheck.py/escalation.py watching
it, which is exactly why every claim here MUST cite which source paper(s)
it came from -- SynthesisValidator (synthesizer.py) deterministically
checks that every cited paper_id actually exists among the inputs, so a
hallucinated citation is at least catchable, even though the reasoning
itself isn't independently re-verified the way per-paper numbers are.
"""

from typing import List

from pydantic import BaseModel, Field


class MaterialRecommendation(BaseModel):
    material: str = ""                      # e.g. "PA66-MP1100-cb", "Composite B (Epoxy+UHMWPE+MoS2+Base Oil)"
    recommended_for: str = ""                # e.g. "moderate PV, boundary lubrication, <70°C"
    rationale: str = ""                      # why this material fits, grounded in cited data
    key_metrics: List[str] = Field(default_factory=list)   # e.g. ["COF 0.056 @ 20N/1.0m/s", "Tg 94°C"]
    tradeoffs: str = ""                      # honest downsides / open questions
    supporting_papers: List[str] = Field(default_factory=list)   # paper_id values, not titles -- must be checkable

    # "yes" / "no" / "unclear" -- must match the source paper's
    # MaterialEntry.contains_fluoropolymer_or_pfas for the cited material(s).
    # This is a real compliance constraint from the project's actual spec
    # (PFAS-free / PTFE-free sliding layer), not a soft preference -- a
    # material flagged "no" here while its source data says otherwise is a
    # genuine contradiction, not just a style issue. SynthesisValidator
    # cross-checks this deterministically where it can.
    pfas_free_compliant: str = "unclear"

    # Every number in key_metrics/rationale must trace to a supporting
    # paper's actual extracted MetricValue -- SynthesisValidator checks
    # this deterministically rather than trusting the model's citation.
    citation_verified: bool = False


class Contradiction(BaseModel):
    topic: str = ""             # e.g. "PTFE dry-sliding COF"
    description: str = ""       # what the papers disagree on
    paper_a: str = ""           # paper_id
    paper_a_value: str = ""
    paper_b: str = ""           # paper_id
    paper_b_value: str = ""
    likely_explanation: str = ""  # e.g. "different test conditions, not a real conflict"


class SynthesisReport(BaseModel):
    design_brief: str = ""                          # 1-2 paragraph plain-English summary
    operating_envelope_assumed: str = ""             # what conditions this ranking targets
    ranked_materials: List[MaterialRecommendation] = Field(default_factory=list)
    contradictions: List[Contradiction] = Field(default_factory=list)
    gaps: List[str] = Field(default_factory=list)    # what's missing across the corpus
    papers_considered: List[str] = Field(default_factory=list)  # paper_ids actually passed in

    # Stamped by code after the call, not asked of the model -- same
    # traceability principle as processing.model in paper_schema.py.
    model_used: str = ""
