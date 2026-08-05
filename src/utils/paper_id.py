import hashlib
from pathlib import Path


class PaperID:

    @staticmethod
    def from_pdf(pdf_path: str) -> str:

        pdf_path = Path(pdf_path)

        sha = hashlib.sha256()

        with open(pdf_path, "rb") as f:
            while True:
                chunk = f.read(8192)

                if not chunk:
                    break

                sha.update(chunk)

        return sha.hexdigest()