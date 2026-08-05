import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from schemas.paper_schema import PaperAnalysis
from src.core.json_writer import JSONWriter


paper = PaperAnalysis()

JSONWriter.save(
    paper,
    "outputs/json/test.json"
)