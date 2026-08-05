import json
from pathlib import Path

from pydantic import BaseModel


class ChunkWriter:

    @staticmethod
    def save(chunks, output_path: str):

        output_path = Path(output_path)

        output_path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        if isinstance(chunks, BaseModel):
            chunks = chunks.model_dump()

        elif isinstance(chunks, str):
            text = chunks.strip()

            # Some models wrap structured output in ```json fences despite
            # instructions not to -- strip them before parsing.
            if text.startswith("```"):
                text = text.strip("`")
                if text.lower().startswith("json"):
                    text = text[4:]
                text = text.strip()

            try:
                chunks = json.loads(text)
            except json.JSONDecodeError:
                raise ValueError(
                    "Prompt 4 did not return valid JSON."
                )

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(
                chunks,
                f,
                indent=4,
                ensure_ascii=False,
            )

        print(f"[SUCCESS] Chunks saved -> {output_path}")