from dataclasses import dataclass, field

from src.models.metadata import Metadata
from src.models.section import Section
from src.models.figure import Figure
from src.models.table import Table
from src.models.reference import Reference


@dataclass
class Paper:

    metadata: Metadata = field(default_factory=Metadata)

    abstract: str = ""

    sections: list[Section] = field(default_factory=list)

    figures: list[Figure] = field(default_factory=list)

    tables: list[Table] = field(default_factory=list)

    references: list[Reference] = field(default_factory=list)