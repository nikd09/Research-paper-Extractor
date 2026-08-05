import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from src.core.pdf_reader import PDFReader
from src.providers.gemini_client import GeminiClient
from src.ai.ai_extractor import AIExtractor


PDF_PATH = (
    "papers/input/Friction and wear characteristics of different Pb-free bearing materials "
    "in mixed and boundary lubrication regimes.pdf"
)

print("Reading PDF...")

paper_text = PDFReader.extract_text(PDF_PATH)

print(f"Characters: {len(paper_text)}")

provider = GeminiClient()

extractor = AIExtractor(provider)

print("Running Prompt 1...")

result = extractor.extract(
    "Prompt_1_Analysis.md",
    paper_text
)

print("\n")
print("=" * 80)
print(result)
print("=" * 80)