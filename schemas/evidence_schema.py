from pydantic import BaseModel, Field


class Evidence(BaseModel):

    page: int | None = None

    section: str | None = None

    figure: str | None = None

    table: str | None = None

    confidence: int = 10


class EvidenceItem(BaseModel):

    value: str

    evidence: Evidence = Field(default_factory=Evidence)