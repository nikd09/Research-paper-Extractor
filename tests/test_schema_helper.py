import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from src.utils.schema_helper import SchemaHelper


print(
    SchemaHelper.json_schema()
)