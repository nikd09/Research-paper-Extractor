from typing import List, Optional

from src.ai.prompt_loader import PromptLoader


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

        prompt = PromptLoader.load(prompt_file)

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
