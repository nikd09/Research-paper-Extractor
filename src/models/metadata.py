from dataclasses import dataclass, field


@dataclass
class Metadata:

    title: str = ""

    authors: list[str] = field(default_factory=list)

    journal: str = ""

    year: str = ""

    doi: str = ""

    keywords: list[str] = field(default_factory=list)