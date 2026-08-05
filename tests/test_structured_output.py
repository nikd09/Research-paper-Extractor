import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from src.providers.gemini_client import GeminiClient
from schemas.paper_schema import PaperAnalysis


client = GeminiClient()

result = client.generate(
    """
Return an analysis of this simple text.

Research:
A steel pin slides against a PTFE surface.
Wear was reduced by 20%.

""",
    schema=PaperAnalysis,
)

print(type(result))
print()

print(result)