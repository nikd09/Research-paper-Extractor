from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.append(str(PROJECT_ROOT))

from src.core.pdf_reader import PDFReader

pdf = PROJECT_ROOT / "papers" / "input" / "Friction and wear characteristics of different Pb-free bearing materials in mixed and boundary lubrication regimes.pdf"

text = PDFReader.extract_text(pdf)

print("=" * 80)
print(text[:3000])
print("=" * 80)
print(f"\nCharacters: {len(text):,}")