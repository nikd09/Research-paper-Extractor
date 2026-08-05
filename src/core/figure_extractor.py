"""
Fix #2 (targeted): figure-to-page mapping + high-DPI rendering.

Attaching the whole PDF to one generic "verify against figures" call gives
the model no way to know WHICH page has the figure a given numeric claim
came from -- it has to search the entire document itself, competing
against every other page's visual content in the same pass. That's a real
contributor to the chart-misreading failures observed earlier.

This module instead:
  1. Scans every page's text for "Fig. N" / "Figure N" captions (handling
     both the normal spaced form and the glued "Fig.N" form some PDFs'
     broken font encoding produces -- see prompt_builder.py for the same
     issue affecting table captions).
  2. Maps each figure number to the page it FIRST appears on (in academic
     papers the figure and its caption/first mention are almost always on
     the same page or the very next one).
  3. Renders only those specific pages as high-DPI PNGs via PyMuPDF, so the
     verify prompt can be given "Figure 18 is the image on page 8" instead
     of "here is the whole 39-page PDF, go find it yourself."

Deduplicates by page number (e.g. Fig. 18 and Fig. 19 on the same page
render once, not twice).
"""

import re
from pathlib import Path
from typing import Dict, List, Tuple

import fitz

from src.utils.logger import Logger

_FIGURE_MENTION_RE = re.compile(r"\bfig(?:ure)?\.?\s*(\d+)\b", re.IGNORECASE)

# A real figure CAPTION, as opposed to an in-text citation like "as shown
# in Fig. 15 that friction drops...", almost always looks like
# "Fig. 15. <capitalized description>" or "Figure 15: <description>" at or
# near the start of a text line -- i.e. the figure number is immediately
# followed by a period/colon and then a capital letter, not by "shows",
# "that", "illustrates", etc. This is intentionally stricter than
# _FIGURE_MENTION_RE so it can be tried FIRST and preferred over a raw
# first-mention page, which is frequently just an earlier in-text citation
# rather than the page the actual chart lives on.
# Case-insensitive on "fig(ure)"/punctuation (scoped inline flag) but the
# trailing [A-Z(] deliberately stays case-SENSITIVE -- that capital letter
# (or opening paren, e.g. "Fig. 3. (a) Compressive...") is exactly what
# distinguishes an actual caption from a mid-sentence citation like
# "...as shown in fig. 15 that friction rises...".
_FIGURE_CAPTION_RE = re.compile(
    r"(?i:\bfig(?:ure)?\.?\s*)(\d+)(?i:\s*[.:]\s*)[A-Z(]",
)

RENDER_DPI = 320  # high enough to read axis gridlines/tick labels clearly


def find_figure_pages(pdf_path: Path) -> Dict[str, int]:
    """Returns {'Figure 13': 7, 'Figure 18': 8, ...} -- the page each
    figure's actual CAPTION appears on, 1-indexed.

    Two passes:
      1. Prefer the page matching the strict caption pattern
         ("Fig. N. <Capitalized text>") -- this is the actual figure page,
         not just a page that mentions the figure in prose.
      2. For any figure number with no caption-pattern match anywhere in
         the document (rare -- some PDFs' text extraction breaks the
         punctuation), fall back to its first raw mention, same as before.
         This is a best-effort fallback, not a confirmed caption page --
         downstream prompts should still verify against text/table content
         when in doubt rather than trusting figure-page images blindly.
    """
    caption_pages: Dict[str, int] = {}
    first_mention_pages: Dict[str, int] = {}

    doc = fitz.open(pdf_path)
    try:
        for page_num in range(len(doc)):
            text = doc[page_num].get_text()

            for match in _FIGURE_CAPTION_RE.finditer(text):
                label = f"Figure {match.group(1)}"
                if label not in caption_pages:
                    caption_pages[label] = page_num + 1

            for match in _FIGURE_MENTION_RE.finditer(text):
                label = f"Figure {match.group(1)}"
                if label not in first_mention_pages:
                    first_mention_pages[label] = page_num + 1
    finally:
        doc.close()

    # Merge: caption-pattern match wins where available, first-mention is
    # the fallback for anything the strict pattern didn't catch.
    figure_pages: Dict[str, int] = dict(first_mention_pages)
    figure_pages.update(caption_pages)

    missed = set(first_mention_pages) - set(caption_pages)
    if missed:
        Logger.warning(
            f"[figure_extractor] {len(missed)} figure(s) had no strict "
            f"caption-pattern match ({sorted(missed)}) -- using first "
            f"in-text mention page as a fallback, which may not be the "
            f"actual chart page. Verify these against text/table content "
            f"before trusting a figure-read value from them."
        )

    return figure_pages


def render_pages(pdf_path: Path, page_numbers: List[int], dpi: int = RENDER_DPI) -> Dict[int, bytes]:
    """Renders the given 1-indexed page numbers as PNG bytes."""
    rendered = {}

    doc = fitz.open(pdf_path)
    try:
        for page_num in page_numbers:
            if not (1 <= page_num <= len(doc)):
                continue
            pix = doc[page_num - 1].get_pixmap(dpi=dpi)
            rendered[page_num] = pix.tobytes("png")
    finally:
        doc.close()

    return rendered


class FigureExtractor:

    @staticmethod
    def build_manifest_and_images(pdf_path: Path) -> Tuple[str, List[bytes]]:
        """
        Returns (manifest_text, images) where images is one PNG per unique
        page that contains at least one figure, in page order, and
        manifest_text tells the model which figure(s) are on which
        attached-image index -- e.g.:

            Attached image 1 = page 7  -> contains: Figure 13
            Attached image 2 = page 8  -> contains: Figure 18, Figure 19

        Empty manifest/[] if no "Fig. N" captions were found at all (some
        papers' figures live only in Supplementary Information, not in the
        main PDF text -- nothing to target in that case).
        """
        figure_pages = find_figure_pages(pdf_path)
        if not figure_pages:
            Logger.warning(
                "[figure_extractor] No 'Fig. N' captions found in the PDF text -- "
                "cannot target specific figures. If this paper has charts, they "
                "likely live in a Supplementary Information file not included here."
            )
            return "", []

        page_to_figures: Dict[int, List[str]] = {}
        for label, page_num in figure_pages.items():
            page_to_figures.setdefault(page_num, []).append(label)

        unique_pages = sorted(page_to_figures.keys())
        images_by_page = render_pages(pdf_path, unique_pages)

        manifest_lines = []
        images = []
        for i, page_num in enumerate(unique_pages, start=1):
            if page_num not in images_by_page:
                continue
            figs = ", ".join(sorted(page_to_figures[page_num], key=lambda s: int(s.split()[1])))
            manifest_lines.append(f"Attached image {i} = page {page_num} -> contains: {figs}")
            images.append(images_by_page[page_num])

        Logger.success(
            f"[figure_extractor] Rendered {len(images)} page(s) covering "
            f"{len(figure_pages)} referenced figure(s)."
        )

        return "\n".join(manifest_lines), images
