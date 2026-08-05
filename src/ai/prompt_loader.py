from pathlib import Path


class PromptLoader:

    PROMPTS_DIR = Path("prompts")

    @classmethod
    def load(cls, filename: str) -> str:

        prompt_file = cls.PROMPTS_DIR / filename

        if not prompt_file.exists():
            raise FileNotFoundError(f"Prompt not found: {prompt_file}")

        return prompt_file.read_text(
            encoding="utf-8"
        )