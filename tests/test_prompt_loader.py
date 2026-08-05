import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from src.ai.prompt_loader import PromptLoader


prompt = PromptLoader.load("Prompt_1_Analysis.md")

print(prompt)