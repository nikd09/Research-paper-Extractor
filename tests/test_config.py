from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.append(str(PROJECT_ROOT))

from src.utils.config import *

print("API:", GEMINI_API_KEY[:10])
print("Best Model:", PREFERRED_MODELS[0])
print("Papers:", PAPERS_DIR)
print("Prompts:", PROMPTS_DIR)
print("Outputs:", OUTPUT_DIR)