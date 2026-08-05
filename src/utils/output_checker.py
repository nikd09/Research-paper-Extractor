from pathlib import Path


class OutputChecker:

    @staticmethod
    def already_processed(filename: str, output_dir: str = "outputs") -> bool:
        """
        A paper only counts as processed once ALL THREE artifacts exist.
        Checking JSON alone was wrong: JSON is saved before the Markdown/
        Chunks steps run, so a paper that failed on step 4 or 5 (e.g. a
        malformed chunk response) would be marked done forever with
        incomplete output, and silently skipped on every future run.
        """

        base = Path(output_dir)

        json_file = base / "json" / f"{filename}.json"
        markdown_file = base / "markdown" / f"{filename}.md"
        chunk_file = base / "chunks" / f"{filename}_chunks.json"

        return json_file.exists() and markdown_file.exists() and chunk_file.exists()

    @staticmethod
    def missing_artifacts(filename: str, output_dir: str = "outputs") -> list:
        """Returns which of [json, markdown, chunks] are missing -- useful
        for diagnosing a partially-processed paper without re-deriving the
        three paths by hand."""

        base = Path(output_dir)
        checks = {
            "json": base / "json" / f"{filename}.json",
            "markdown": base / "markdown" / f"{filename}.md",
            "chunks": base / "chunks" / f"{filename}_chunks.json",
        }
        return [name for name, path in checks.items() if not path.exists()]
