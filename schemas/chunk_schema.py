from typing import List

from pydantic import BaseModel, Field


class Chunk(BaseModel):

    title: str = ""
    summary: str = ""
    content: str = ""
    keywords: List[str] = Field(default_factory=list)
    engineering_topics: List[str] = Field(default_factory=list)
    materials: List[str] = Field(default_factory=list)
    applications: List[str] = Field(default_factory=list)
    source_sections: List[str] = Field(default_factory=list)
    related_chunks: List[str] = Field(default_factory=list)

    # Traceability back to the source paper. Deliberately NOT filled by the
    # LLM's own judgement -- Pipeline.run() stamps these deterministically
    # from analysis.processing / analysis.metadata after generation, so a
    # retrieval agent can always resolve a chunk back to its exact source
    # paper/JSON/markdown file, closing the same citation-reliability gap
    # André flagged in the internal Copilot agent.
    paper_id: str = ""
    source_file: str = ""
    paper_title: str = ""


class ChunkCollection(BaseModel):

    chunks: List[Chunk] = Field(default_factory=list)


class RagOutput(BaseModel):
    """Combined Prompt 4 output -- markdown + chunks in one schema-enforced
    call, instead of two separate calls each resending the full analysis
    JSON as input."""

    markdown: str = ""
    chunks: List[Chunk] = Field(default_factory=list)
