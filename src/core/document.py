from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Document:

    text: str

    path: Path

    filename: str

    page_count: int
