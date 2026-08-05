from typing import List, Optional

from pydantic import BaseModel, Field

# ------------------------------------------------------------------
# Processing Metadata
# ------------------------------------------------------------------

class ModelsUsed(BaseModel):
    """Fixed-field record instead of a bare dict -- a bare `dict` type
    produces `additionalProperties: true` in the JSON schema sent to
    Gemini, which the free/Developer API tier rejects outright
    ("additionalProperties is only supported in Gemini Enterprise Agent
    Platform mode"). Confirmed the exact cause of a real ValueError in
    production; a fixed set of named fields avoids it entirely."""
    extract: str = "not_run"
    verify: str = "not_run"
    crosscheck: str = "not_run"
    verify_escalate: str = "not_run"
    rag: str = "not_run"


class Processing(BaseModel):

    paper_id: str = ""

    source_file: str = ""

    model: str = ""

    pipeline_version: str = "3.0"

    processed_at: str = ""

    processing_time_seconds: float = 0.0

    # Cost/traceability: which stages actually made a model call and what
    # each one ended up using, e.g. {"extract": "gemini-3.6-flash",
    # "verify": "gemini-3.5-flash", "escalation": "not_run"}. Populated by
    # Pipeline.run() from the real call history -- never guessed.
    models_used: ModelsUsed = Field(default_factory=ModelsUsed)


# ---------- DOCUMENT ----------

class Metadata(BaseModel):
    title: str = ""
    authors: List[str] = Field(default_factory=list)
    journal: str = ""
    year: str = ""
    doi: str = ""


# ---------- RESEARCH ----------

class ResearchOverview(BaseModel):
    document_type: str = ""
    research_objective: str = ""
    engineering_problem: str = ""
    motivation: str = ""
    scientific_contribution: str = ""


# ---------- ENGINEERING ----------

class EngineeringKnowledge(BaseModel):
    engineering_disciplines: List[str] = Field(default_factory=list)
    engineering_topics: List[str] = Field(default_factory=list)
    keywords: List[str] = Field(default_factory=list)
    applications: List[str] = Field(default_factory=list)


# ---------- MATERIALS ----------

class MaterialEntry(BaseModel):
    name: str = ""

    # Fluoropolymer/PFAS content is a hard compliance constraint for the
    # downstream seat-recliner application (per the project's actual
    # spec/market-case documents -- PFAS-free / PTFE-free is a named
    # requirement, not a soft preference). Common fluoropolymer chemistries
    # in tribology literature: PTFE, PVDF, FEP, PFA, ETFE, or any material
    # the paper explicitly states contains PFAS.
    contains_fluoropolymer_or_pfas: bool = False

    # "text" if the paper explicitly states PFAS/fluoropolymer content or
    # its absence; "inferred from material name" if flagged based on
    # recognizing a known fluoropolymer chemistry (e.g. "PTFE") without the
    # paper itself using the word PFAS; "not applicable" if this material
    # has no plausible PFAS connection at all. Keeps the same
    # stated-vs-inferred distinction used elsewhere (see Relevance).
    pfas_basis: str = "not applicable"


class Materials(BaseModel):
    materials: List[MaterialEntry] = Field(default_factory=list)
    coatings: List[MaterialEntry] = Field(default_factory=list)
    lubricants: List[MaterialEntry] = Field(default_factory=list)


# ---------- EXPERIMENT ----------

class Experiment(BaseModel):
    test_methods: List[str] = Field(default_factory=list)
    test_conditions: List[str] = Field(default_factory=list)
    equipment: List[str] = Field(default_factory=list)


# ---------- RESULTS ----------

# wear_mechanisms/failure_modes are pipeline narrative -- almost always a
# paraphrase of the paper's own explanation, not a copy-paste of its
# sentences. Downstream consumers (RAG/Markdown output, Copilot agents
# reading it) have no way to tell the difference from a plain string, so a
# paraphrase has been surfaced in quotation marks as if directly quoting
# the paper. `provenance` makes that distinction explicit per statement.
class MechanismNote(BaseModel):
    text: str = ""
    provenance: str = "paraphrase"   # "verbatim" | "paraphrase"


class Results(BaseModel):
    key_findings: List[str] = Field(default_factory=list)
    wear_mechanisms: List[MechanismNote] = Field(default_factory=list)
    failure_modes: List[MechanismNote] = Field(default_factory=list)
    friction_results: List[str] = Field(default_factory=list)


# ---------- ASSETS ----------

class Assets(BaseModel):
    important_figures: List[str] = Field(default_factory=list)
    important_tables: List[str] = Field(default_factory=list)
    important_equations: List[str] = Field(default_factory=list)


# ---------- PERFORMANCE (structured, labeled metric values) ----------
#
# This replaces the old `List[str]` design (e.g.
# friction_coefficients: ["~0.72 to ~1.02 (approximate, read from Figure 18)"])
# which had two confirmed failure modes in production:
#   1. Downstream Markdown generation had to re-guess which number belonged
#      to which material, and got it wrong (observed: PE's yield strength
#      written up as PPS's in one run).
#   2. Cross-model verification could only compare a field's numbers as one
#      unordered set, so a single lucky overlapping number cleared an
#      entire 8-entry field, including genuinely wrong values sitting next
#      to it.
#
# Every numeric claim is now a self-contained record: which material, under
# what condition, what the value is, where it came from, and how confident
# the pipeline is in it -- so nothing downstream (Markdown writer, chunker,
# crosscheck, escalation) has to re-derive attribution from an unlabeled
# string.

class MetricValue(BaseModel):
    material: str = ""       # e.g. "PA46-MP1100-cb", "Plain PA66", "PPS composite"
    condition: str = ""      # e.g. "dry, 20 MPa", "water lubricated, 40 MPa"
    value: str = ""          # e.g. "0.057", "~0.13", "6.6E-6 mm3 Nm^-1"
    unit: str = ""           # e.g. "MPa", "mm3 Nm^-1", "" if unitless (e.g. COF)
    source: str = ""         # "text" | "Table 3" | "Figure 19" | "Figure 19 (approximate)"

    # Single source of truth for how trustworthy this value is. Replaces
    # the old approach of appending free-text tags like
    # "[unverified: not found in extracted text]" onto the value string --
    # that made "is this hedged?" a string-matching problem for every
    # downstream consumer, and tags silently failed to get added or
    # stripped between pipeline versions with no way to detect it.
    #   confirmed          - found verbatim in text/table, or read exactly
    #                        off a figure gridline
    #   approximate         - visually interpolated from a chart (no exact
    #                        gridline at that point)
    #   unverified          - not found in source text by the deterministic
    #                        validator; not yet cross-checked or escalated
    #   crosscheck_mismatch - an independent second extraction found a
    #                        different value for this same material/
    #                        condition and neither could be confirmed
    #   contradicts_table   - a prose-stated value and a table/figure-stated
    #                        value for the same material/condition disagree;
    #                        both records are kept (one per source) rather
    #                        than one being silently dropped or preferred
    #   not_reported        - genuinely not recoverable; value should read
    #                        "Not Reported"
    confidence: str = "unverified"


class PerformanceMetrics(BaseModel):
    friction_coefficients: List[MetricValue] = Field(default_factory=list)
    wear_rates: List[MetricValue] = Field(default_factory=list)

    # Renamed from `hardness_values`. Papers in this domain very often
    # report compressive/tensile yield or offset-yield strength, NOT
    # hardness (Rockwell/Brinell/Shore) -- storing yield-strength data
    # under a field literally named "hardness_values" was a confirmed
    # mislabeling bug. This field covers yield strength, offset yield
    # strength, modulus, hardness, or any other single-number mechanical
    # property; `unit` on each MetricValue disambiguates which.
    mechanical_properties: List[MetricValue] = Field(default_factory=list)

    loads: List[MetricValue] = Field(default_factory=list)
    temperatures: List[MetricValue] = Field(default_factory=list)
    sliding_speeds: List[MetricValue] = Field(default_factory=list)


# ---------- RELEVANCE ----------
#
# Confirmed failure mode (seen on two unrelated papers): the old
# `automotive_relevance: str` / `seat_recliner_relevance: str` fields had
# no "leave blank if unsupported" instruction anywhere, and their very
# names presuppose relevance exists -- so a schema-conformant model always
# filled them, including for a hydropower-turbine paper that never
# mentions automotive or seat-recliner applications at all.
#
# This is kept (it's a genuine business-relevance feature for the
# downstream Copilot use case) but restructured so a fabricated-sounding
# claim can never be silently indistinguishable from a paper-stated one.

class RelevanceNote(BaseModel):
    # True only if the paper itself explicitly discusses this application
    # domain (even briefly). False for an engineer's own inference.
    stated_in_paper: bool = False

    # If stated_in_paper=True: quote/paraphrase what the paper says, with
    # a page/section pointer if possible.
    # If stated_in_paper=False: either "Not Reported" (no plausible
    # connection worth noting) OR a clearly-prefixed inference, e.g.
    # "Not explicitly discussed. Possible relevance: <reasoning>" --
    # never phrased as if the paper said this.
    note: str = "Not Reported"


class Relevance(BaseModel):
    automotive_relevance: RelevanceNote = Field(default_factory=RelevanceNote)
    seat_recliner_relevance: RelevanceNote = Field(default_factory=RelevanceNote)


# ---------- INDUSTRIAL INSIGHTS ----------

class IndustrialInsights(BaseModel):
    manufacturing_implications: List[str] = Field(default_factory=list)
    design_recommendations: List[str] = Field(default_factory=list)
    limitations: List[str] = Field(default_factory=list)
    future_work: List[str] = Field(default_factory=list)


# ---------- FINAL ----------

class PaperAnalysis(BaseModel):

    paper_summary: str = ""

    processing: Processing = Field(default_factory=Processing)

    metadata: Metadata = Field(default_factory=Metadata)

    research: ResearchOverview = Field(default_factory=ResearchOverview)

    engineering: EngineeringKnowledge = Field(default_factory=EngineeringKnowledge)

    materials: Materials = Field(default_factory=Materials)

    experiment: Experiment = Field(default_factory=Experiment)

    results: Results = Field(default_factory=Results)

    performance: PerformanceMetrics = Field(default_factory=PerformanceMetrics)

    assets: Assets = Field(default_factory=Assets)

    relevance: Relevance = Field(default_factory=Relevance)

    industrial: IndustrialInsights = Field(default_factory=IndustrialInsights)
