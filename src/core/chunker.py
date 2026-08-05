import re
from typing import List

from src.utils.logger import Logger


class Chunker:

    MAX_CHARS = 12000

    @staticmethod
    def split(text: str) -> List[str]:

        Logger.info("Creating chunks...")

        # Split on blank lines (paragraphs)
        paragraphs = re.split(r"\n\s*\n", text)

        chunks = []
        current = ""

        for paragraph in paragraphs:

            if len(current) + len(paragraph) < Chunker.MAX_CHARS:
                current += paragraph + "\n\n"
            else:
                chunks.append(current.strip())
                current = paragraph + "\n\n"

        if current.strip():
            chunks.append(current.strip())

        Logger.success(f"{len(chunks)} chunks created.")

        return chunks