import json
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from schemas.paper_schema import PaperAnalysis
from src.exporters.chunk_writer import ChunkWriter


json_file = "outputs/json/Friction_and_wear_characteristics_of_different_Pb-free_bearing_materials_in_mixed_and_boundary_lubrication_regimes.json"

with open(json_file, "r", encoding="utf-8") as f:
    data = json.load(f)

analysis = PaperAnalysis(**data)

chunk_file = json_file.replace(
    "outputs/json",
    "outputs/chunks"
).replace(
    ".json",
    "_chunks.json"
)

ChunkWriter.save(
    analysis,
    chunk_file
)

print("\nDone!")