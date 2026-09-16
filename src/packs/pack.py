"""
A "pack" is everything that used to be welded into the seat-recliner
application: which performance metrics get extracted from a paper, what
"relevant to our use case" means, whether a PFAS/fluoropolymer material
is something to exclude or something to specifically study, the target
operating envelope, and where the output files land.

Before packs existed, this information was typed out separately in
validator.py, crosscheck.py, escalation.py, three prompt files, and
synthesize.py -- six places, one seat recliner. A pack collects all of it
into one file, so a new research focus is "write one new pack.json and
select it," not "edit six files and hope nothing was missed."

See packs/seat-recliner/pack.json for the real, running example this was
migrated from, and packs/pfas-corrosion/pack.json for a second real pack.
"""

from typing import List

from pydantic import BaseModel, Field


class ComplianceRule(BaseModel):
    """Describes what a MaterialEntry.contains_fluoropolymer_or_pfas flag
    should actually mean for this pack's purposes. The schema field itself
    stays fixed (see schemas/paper_schema.py) -- only its INTERPRETATION
    changes per pack:

      "exclude" -- flagged materials are disqualified from top
                   recommendations (the seat-recliner case: PFAS-free is
                   a hard requirement).
      "include" -- flagged materials are exactly what's being studied,
                   not something to filter out (the PFAS-corrosion case).
      "note"    -- flagged for visibility only, no ranking effect.
    """

    mode: str = "note"  # "exclude" | "include" | "note"

    # The exact paragraph substituted into Prompt_Synthesis.md's
    # compliance rule. Kept as pack-owned prose (not auto-generated from
    # `mode`) so the wording stays precise and reviewable -- see the
    # module docstring in schema_builder.py for why.
    prompt_text: str = ""


class Pack(BaseModel):
    id: str
    name: str

    # One-paragraph description of the target application/research
    # question. Substituted into each prompt's role/framing section.
    application: str = ""

    # Which List[MetricValue] buckets PerformanceMetrics should have for
    # this pack, e.g. ["friction_coefficients", "wear_rates", ...] for
    # tribology, or ["corrosion_rates", "pitting_potentials", ...] for a
    # corrosion study. This is the field that used to be typed out
    # separately in validator.py, crosscheck.py, and escalation.py.
    metrics: List[str] = Field(default_factory=list)

    # Which RelevanceNote fields Relevance should have, e.g.
    # ["seat_recliner_relevance", "automotive_relevance"]. ORDER MATTERS:
    # the FIRST entry is treated as the "primary" relevance target --
    # src/knowledge_base/builder.py uses it to decide whether a paper
    # counts as relevant at all when building the knowledge base. List
    # the target that should gate inclusion first.
    relevance_targets: List[str] = Field(default_factory=list)

    compliance: ComplianceRule = Field(default_factory=ComplianceRule)

    # Substituted into Prompt_Synthesis.md's ROLE section and used as the
    # default --envelope text for synthesize.py / the GUI's envelope box.
    envelope: str = ""

    # Where synthesize.py looks for the actual spec/market-case PDFs for
    # this pack (see src/knowledge_base/synthesizer.py's
    # REQUIREMENTS_DIR handling -- now pack-scoped instead of hardcoded).
    requirements_dir: str = "docs/requirements"

    # Default output folder suggested for this pack (Phase 4 uses this to
    # steer different packs toward different folders by default, rather
    # than everyone silently sharing "outputs/").
    output_dir: str = "outputs"
