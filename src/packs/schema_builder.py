"""
Builds the two pack-specific pieces of the extraction schema --
PerformanceMetrics and Relevance -- from the active pack's field lists,
instead of them being fixed classes with names like `friction_coefficients`
baked in at the Python level.

Why this is safe to do dynamically: every other file in the codebase that
touches these fields already accesses them by STRING name via getattr()
(validator.py, crosscheck.py, escalation.py all loop over a field-name
list), not by hardcoded dot-access like `analysis.performance.wear_rates`.
A repo-wide check confirmed there is no hardcoded `.friction_coefficients`
/ `.wear_rates` / `.seat_recliner_relevance` style access anywhere outside
this pack system and the prompt files (which are handled separately by
src/packs/prompt_renderer.py). So swapping which fields exist doesn't
break anything downstream -- JSONWriter just calls `.model_dump()`
(field-name-agnostic) and MarkdownWriter just writes whatever string the
model produced.

Every field is List[MetricValue] on PerformanceMetrics and RelevanceNote
on Relevance -- same record shape as before, just a pack-chosen set of
buckets instead of a fixed six.
"""

from typing import List, Type

from pydantic import BaseModel, Field, create_model

from src.packs.pack import Pack


def _metric_value_cls():
    # Imported lazily to avoid a circular import: schemas/paper_schema.py
    # imports FROM this module (to build PerformanceMetrics/Relevance at
    # module load time), so this module can't import MetricValue/
    # RelevanceNote from paper_schema.py at the top level.
    from schemas.paper_schema import MetricValue
    return MetricValue


def _relevance_note_cls():
    from schemas.paper_schema import RelevanceNote
    return RelevanceNote


def build_performance_metrics_model(pack: Pack) -> Type[BaseModel]:
    MetricValue = _metric_value_cls()
    fields = {
        name: (List[MetricValue], Field(default_factory=list))
        for name in pack.metrics
    }
    # __base__=BaseModel keeps this a plain Pydantic model; the class name
    # is cosmetic (shows up in schemas/debug output) but namespaced by
    # pack id so two packs' dynamically-built classes are never confused
    # with each other even if both happen to be alive in the same process
    # (e.g. the GUI listing multiple packs' summaries).
    return create_model(
        f"PerformanceMetrics_{pack.id.replace('-', '_')}",
        __base__=BaseModel,
        **fields,
    )


def build_relevance_model(pack: Pack) -> Type[BaseModel]:
    RelevanceNote = _relevance_note_cls()
    fields = {
        name: (RelevanceNote, Field(default_factory=RelevanceNote))
        for name in pack.relevance_targets
    }
    return create_model(
        f"Relevance_{pack.id.replace('-', '_')}",
        __base__=BaseModel,
        **fields,
    )
