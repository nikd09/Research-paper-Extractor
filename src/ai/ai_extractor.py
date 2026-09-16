from typing import List, Optional

from src.ai.prompt_loader import PromptLoader
from src.packs.loader import PackLoader
from src.packs.prompt_renderer import render as render_pack_prompt


class AIExtractor:

    def __init__(self, provider):

        self.provider = provider

    def extract(
        self,
        prompt_file: str,
        paper_text: str,
        schema=None,
        stage: str = "extract",
        file_path=None,
        images: Optional[List[bytes]] = None,
    ):

        # Every prompt file passes through the active pack's renderer --
        # a no-op for prompts with no {{PACK_*}} placeholders, and how
        # Prompt_12/Prompt_4/Prompt_Synthesis pick up the pack's metric
        # field names, relevance targets, and compliance rule instead of
        # having them hardcoded. See src/packs/prompt_renderer.py.
        prompt = render_pack_prompt(PromptLoader.load(prompt_file), PackLoader.get_active())

        final_prompt = f"""
{prompt}

==========================================================
RESEARCH PAPER
==========================================================

{paper_text}
"""

        return self.provider.generate(
            final_prompt,
            schema=schema,
            stage=stage,
            file_path=file_path,
            images=images,
        )
