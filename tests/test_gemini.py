from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.append(str(PROJECT_ROOT))

from src.providers.gemini_client import GeminiClient

client = GeminiClient()

response = client.generate("Reply with exactly: Gemini is working.")

print()
print(response)