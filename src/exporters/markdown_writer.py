from pathlib import Path


class MarkdownWriter:

    @staticmethod
    def save(markdown: str, output_path: str):

        output_path = Path(output_path)

        output_path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        output_path.write_text(
            markdown,
            encoding="utf-8",
        )

        print(f"[SUCCESS] Markdown saved -> {output_path}")