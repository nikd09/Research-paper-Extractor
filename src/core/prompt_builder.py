"""
Fix #3: structured table pre-extraction (crop-and-validate, two-strategy).

PyMuPDF's page.get_text() often mangles multi-column table layouts (cells
reordered, rows merged) -- a real source of extraction error separate from
the chart-vision problem. pdfplumber extracts tables as actual rows/columns,
which we render as clean markdown and inject into the prompt as authoritative
context, so the model reads real structured data instead of re-deriving
numbers from jumbled column text.

Two detection passes, in order:
  1. Whole-page "lines" strategy -- catches ruled tables with visible
     borders. Safe to run on every page (low false-positive rate).
  2. Caption-anchored "text" strategy -- for borderless tables (whitespace-
     aligned only, e.g. this project's own "Table 3: Measured density...").
     Running the text-strategy on a WHOLE page is NOT safe: on a two-column
     academic layout, pdfplumber's whitespace heuristic misreads the gutter
     between columns as a table boundary and turns the entire body-text
     column into one giant garbage "table". So pass 2 instead:
       a. locates every "Table N" caption occurrence via word positions,
       b. crops a small region (one column width, ~300pt tall) starting
          at that occurrence,
       c. runs text-strategy ONLY on that crop,
       d. validates the result looks like a real table (few, dense rows)
          rather than wrapped paragraph text (many, sparse "rows") --
          this also naturally rejects inline references like "...are
          listed in Table 1." that aren't the actual caption.

If a page's raw text contains a table caption but neither pass produced a
validated table, that is logged loudly instead of silently proceeding.
"""

import re
from pathlib import Path
from typing import List, Optional

from src.utils.logger import Logger

_TABLE_CAPTION_RE = re.compile(r"^table$", re.IGNORECASE)

# A real small data table, cropped to ~300pt tall, rarely has more than
# this many detected rows; dense wrapped paragraph text does (each line of
# prose becomes a spurious "row"). Tune here if a paper's real tables are
# unusually long.
_MAX_PLAUSIBLE_ROWS = 20
_MIN_NUMERIC_CELL_FRACTION = 0.2
_NUMERIC_CELL_RE = re.compile(r"\d")
_CROP_HEIGHT = 200  # points, below the caption position -- tuned to fit
                     # typical small academic property/density tables while
                     # staying tight enough to exclude the next paragraph


def _table_to_markdown(rows: List[List[str]]) -> str:
    if not rows:
        return ""
    cleaned = [[(c or "").strip() for c in row] for row in rows]
    header, body = cleaned[0], cleaned[1:]
    lines = [
        "| " + " | ".join(header) + " |",
        "| " + " | ".join(["---"] * len(header)) + " |",
    ]
    lines += ["| " + " | ".join(row) + " |" for row in body]
    return "\n".join(lines)


def _looks_like_real_table(table: List[List[str]]) -> bool:
    if len(table) < 2 or len(table[0]) < 2:
        return False
    if len(table) > _MAX_PLAUSIBLE_ROWS:
        return False  # almost certainly wrapped paragraph text, not a table

    cells = [c.strip() for row in table for c in (row or []) if c and c.strip()]
    if not cells:
        return False

    # Real data tables are mostly numbers (measurements, IDs, temperatures...).
    # Wrapped paragraph text mis-detected as a "table" almost never has short,
    # mostly-numeric cells -- this is a far more reliable signal than cell
    # length or word count, which both come out similar for either case due
    # to how the text-strategy fragments whitespace-separated text.
    numeric_cells = [c for c in cells if _NUMERIC_CELL_RE.search(c) and len(c.split()) <= 2]
    return (len(numeric_cells) / len(cells)) >= _MIN_NUMERIC_CELL_FRACTION


_GLUED_CAPTION_RE = re.compile(r"^table(\d+)$", re.IGNORECASE)


def _find_caption_positions(page) -> List[dict]:
    """Every occurrence of the word 'Table' immediately followed by a
    number -- includes both the real caption and any inline references
    like '...see Table 1.'; both are tried, only real ones will validate.
    Also handles 'Table1' glued into one token, a symptom of some PDFs'
    broken font/word-spacing encoding (see prompt_builder module docstring)."""
    words = page.extract_words()
    hits = []
    for i, w in enumerate(words):
        if _TABLE_CAPTION_RE.match(w["text"]) and i + 1 < len(words):
            next_word = words[i + 1]["text"].rstrip(".,:;")
            if next_word.isdigit():
                hits.append({"top": w["top"], "x0": w["x0"]})
        elif _GLUED_CAPTION_RE.match(w["text"]):
            hits.append({"top": w["top"], "x0": w["x0"]})
    return hits


def _row_signature(table: List[List[str]]) -> frozenset:
    """Non-blank rows as a comparable set, ignoring column position noise --
    used only to detect near-duplicate tables from overlapping crops."""
    return frozenset(
        tuple(c.strip() for c in row if c and c.strip())
        for row in table
        if any(c and c.strip() for c in row)
    )


def _extract_via_caption_crop(page) -> List[List[List[str]]]:
    page_w, page_h = page.width, page.height
    candidates = []

    for hit in _find_caption_positions(page):
        left_half = hit["x0"] < page_w / 2
        cx0 = 0 if left_half else page_w / 2 - 20
        cx1 = page_w / 2 + 20 if left_half else page_w
        top = max(0, hit["top"] - 5)
        bottom = min(page_h, hit["top"] + _CROP_HEIGHT)

        try:
            crop = page.crop((cx0, top, cx1, bottom))
            tables = crop.extract_tables(
                table_settings={"vertical_strategy": "text", "horizontal_strategy": "text"}
            ) or []
        except Exception:
            continue

        for table in tables:
            if _looks_like_real_table(table):
                candidates.append(table)

    # Two caption occurrences on the same page (the real caption + an inline
    # "...see Table N." reference nearby) can both validate and crop
    # overlapping/near-identical content. Keep only the larger table when
    # two candidates substantially overlap in content.
    candidates.sort(key=len, reverse=True)
    kept = []
    for table in candidates:
        sig = _row_signature(table)
        is_duplicate = any(
            sig and (len(sig & _row_signature(existing)) / len(sig)) >= 0.6
            for existing in kept
        )
        if not is_duplicate:
            kept.append(table)

    return kept


def _extract_tables_from_page(page, page_has_caption: bool) -> List[List[List[str]]]:
    try:
        tables = page.extract_tables(
            table_settings={"vertical_strategy": "lines", "horizontal_strategy": "lines"}
        ) or []
    except Exception:
        tables = []

    if tables or not page_has_caption:
        return tables

    return _extract_via_caption_crop(page)


class PromptBuilder:

    @staticmethod
    def extract_tables_markdown(pdf_path: Path) -> str:
        try:
            import pdfplumber
        except ImportError:
            Logger.warning("[prompt_builder] pdfplumber not installed -- skipping table pre-extraction.")
            return ""

        blocks = []
        missed_pages = []

        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page_num, page in enumerate(pdf.pages, start=1):
                    page_text = page.extract_text() or ""
                    has_caption = bool(re.search(r"\btable\s*\d+\b", page_text, re.IGNORECASE))

                    tables = _extract_tables_from_page(page, has_caption)

                    for table in tables:
                        md = _table_to_markdown(table)
                        if md:
                            blocks.append(f"[Table on page {page_num}]\n{md}")

                    if not tables and has_caption:
                        missed_pages.append(page_num)

        except Exception as e:
            Logger.warning(f"[prompt_builder] Table pre-extraction failed: {e}")
            return ""

        if missed_pages:
            Logger.warning(
                f"[prompt_builder] Page(s) {missed_pages} mention a 'Table N' caption "
                f"but NO structured table passed validation there. That table's numbers "
                f"will only reach the model via raw (possibly reflowed) text -- worth a "
                f"manual check if it holds values you care about."
            )

        if not blocks:
            return ""

        Logger.success(f"[prompt_builder] Pre-extracted {len(blocks)} table(s) via pdfplumber.")
        return "\n\n".join(blocks)

    @staticmethod
    def augment_document_text(document_text: str, pdf_path: Path) -> str:
        """Appends a STRUCTURED TABLES block ahead of the raw text so the
        model treats it as authoritative for any numeric table data."""
        tables_md = PromptBuilder.extract_tables_markdown(pdf_path)
        if not tables_md:
            return document_text

        return f"""STRUCTURED TABLES (extracted directly from PDF table structure --
treat these as authoritative for any numeric values; the raw text below
may have reflowed table columns/rows incorrectly)
==========================================================

{tables_md}

==========================================================
RAW EXTRACTED TEXT
==========================================================

{document_text}"""
