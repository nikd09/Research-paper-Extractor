import fitz
from pathlib import Path

from src.core.document import Document
from src.utils.logger import Logger


class PDFReader:

    @staticmethod
    def read_all(input_dir: str = "papers/input"):

        papers = Path(input_dir)

        pdfs = sorted(papers.glob("*.pdf"))

        if not pdfs:
            raise FileNotFoundError(
                f"No PDF found inside {input_dir}."
            )

        documents = []

        for pdf in pdfs:
            documents.append(PDFReader.read(pdf))

        Logger.success(f"Found {len(documents)} PDF(s).")

        return documents

    @staticmethod
    def read(pdf_path: Path) -> Document:

        pdf_path = Path(pdf_path)

        if not pdf_path.exists():
            raise FileNotFoundError(f"{pdf_path} not found.")

        Logger.info(f"Reading {pdf_path.name}")

        pdf = fitz.open(pdf_path)

        text = ""

        for page in pdf:
            text += page.get_text()

        page_count = len(pdf)

        pdf.close()

        text = PDFReader.clean_text(text)

        return Document(
            text=text,
            path=pdf_path,
            filename=pdf_path.name,
            page_count=page_count,
        )

    @staticmethod
    def clean_text(text: str) -> str:

        text = text.replace("\r", "")
        text = text.replace("\t", " ")

        # Fix for confirmed bug: some PDFs (MDPI/LaTeX-generated ones in
        # particular) embed special symbols like µ and ± via a subsetted
        # font with a broken/missing ToUnicode map. When that happens,
        # PyMuPDF can emit the font's raw internal glyph index instead of
        # the correct character -- which lands in the C0 control-character
        # range (e.g. \u0005, \u0006) and then gets copied verbatim into
        # every downstream output, including the final JSON.
        # Strip any non-printable control character (keeping \n) and log
        # how many were found so a specific paper's affected values can be
        # manually spot-checked against the PDF.
        control_chars = [c for c in text if ord(c) < 32 and c not in ("\n",)]
        if control_chars:
            from collections import Counter
            from src.utils.logger import Logger
            counts = Counter(control_chars)
            summary = ", ".join(f"U+{ord(c):04X} x{n}" for c, n in counts.items())
            Logger.warning(
                f"[pdf_reader] {len(control_chars)} unprintable control "
                f"character(s) found in extracted text ({summary}) -- likely "
                f"a broken font symbol mapping (often µ or ± in MDPI/LaTeX "
                f"PDFs). Replaced with '[?]'. Manually check values near "
                f"these in the source PDF if precision matters."
            )
            for c in counts:
                text = text.replace(c, "[?]")

        while "  " in text:
            text = text.replace("  ", " ")

        while "\n\n\n" in text:
            text = text.replace("\n\n\n", "\n\n")

        return text.strip()