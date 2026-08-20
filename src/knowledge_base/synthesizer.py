"""
Cross-paper synthesis -- runs ONCE (on demand, not per-paper) over
everything already sitting in outputs/json/, using whichever model is
selected via --model (see synthesize.py). Produces a ranked, cited design
brief for the seat recliner application, plus a deterministic grounding
check (SynthesisValidator) since this stage has no crosscheck/escalation
safety net of its own.
"""

import json
from pathlib import Path
from typing import Dict

import fitz

from schemas.synthesis_schema import SynthesisReport
from src.ai.ai_extractor import AIExtractor
from src.core.pdf_reader import PDFReader
from src.core.synthesis_validator import SynthesisValidator
from src.providers.gemini_client import GeminiClient
from src.utils import config as cfg
from src.utils.logger import Logger

# Confirmed real-world bug: the synthesis stage used to only ever see the
# processed literature papers -- the actual project spec/market-case
# documents were never given to it, so the operating envelope had to be
# hand-typed as a paraphrase (DEFAULT_ENVELOPE in synthesize.py), and that
# paraphrase turned out to be wrong on several material points (grease
# lubrication, real temperature range, PFAS-free constraint, real load/
# pressure magnitudes) simply because nobody re-read the source PDFs
# before typing it. Drop the actual requirements documents (spec sheets,
# market case decks, RFQs, etc. -- anything that ISN'T tribology
# literature to be run through the full per-paper extraction schema) in
# this folder, and they'll be read directly and treated as the
# authoritative requirements source, ahead of any --envelope text.
REQUIREMENTS_DIR = Path("docs/requirements")


class Synthesizer:

    def __init__(self, model_key: str, output_dir: str = "outputs", kb_dir: str = "knowledge_base"):
        if model_key not in cfg.SYNTHESIS_MODEL_OPTIONS:
            raise ValueError(
                f"Unknown --model '{model_key}'. Choose one of: "
                f"{list(cfg.SYNTHESIS_MODEL_OPTIONS.keys())}"
            )

        self.model_key = model_key
        self.model_name = cfg.SYNTHESIS_MODEL_OPTIONS[model_key]
        self.json_dir = Path(output_dir) / "json"
        self.kb_dir = Path(kb_dir)

        # Same unified free-tier key cascade as every other stage now --
        # "pro" behaves like verify_escalate (high thinking budget for
        # deeper reasoning instead of a stronger/paid model tier).
        if model_key == "pro":
            cfg.STAGE_CONFIG["synthesis"] = {
                "models": [self.model_name],
                "thinking_budget": 4096,
            }
        else:
            cfg.STAGE_CONFIG["synthesis"] = {
                "models": [self.model_name],
            }

        self.provider = GeminiClient()
        self.ai = AIExtractor(self.provider)

    def _load_source_papers(self) -> Dict[str, dict]:
        papers = {}
        for path in sorted(self.json_dir.glob("*.json")):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except Exception as e:
                Logger.warning(f"[synthesizer] Skipping {path.name}, couldn't parse: {e}")
                continue
            paper_id = data.get("processing", {}).get("paper_id", "")
            if not paper_id:
                Logger.warning(f"[synthesizer] Skipping {path.name}, no paper_id in processing block.")
                continue
            papers[paper_id] = data
        return papers

    def _load_requirements_docs(self) -> str:
        """Reads every PDF in docs/requirements/ as plain text -- these are
        the actual project spec/market-case documents, not tribology
        literature, so they don't go through the per-paper extraction
        schema. Returns "" if the folder doesn't exist or is empty, so
        callers degrade gracefully to --envelope text only rather than
        crashing."""
        if not REQUIREMENTS_DIR.exists():
            return ""

        pdfs = sorted(REQUIREMENTS_DIR.glob("*.pdf"))
        if not pdfs:
            return ""

        blocks = []
        for pdf_path in pdfs:
            try:
                doc = fitz.open(pdf_path)
                text = "".join(page.get_text() for page in doc)
                doc.close()
                text = PDFReader.clean_text(text)
                blocks.append(f"--- REQUIREMENTS DOCUMENT: {pdf_path.name} ---\n{text}")
                Logger.success(f"[synthesizer] Loaded requirements document: {pdf_path.name}")
            except Exception as e:
                Logger.warning(f"[synthesizer] Couldn't read requirements doc {pdf_path.name}: {e}")

        return "\n\n".join(blocks)

    def run(self, operating_envelope: str) -> SynthesisReport:
        source_papers = self._load_source_papers()

        if not source_papers:
            raise RuntimeError(
                "No processed papers found in outputs/json/ -- run the main "
                "pipeline on at least one paper before synthesizing."
            )

        requirements_text = self._load_requirements_docs()
        if requirements_text:
            Logger.info(
                f"[synthesizer] Using {len(list(REQUIREMENTS_DIR.glob('*.pdf')))} "
                f"requirements document(s) as the authoritative source -- "
                f"--envelope text is supplementary framing only."
            )
        else:
            Logger.warning(
                f"[synthesizer] No requirements documents found in "
                f"{REQUIREMENTS_DIR}/ -- falling back to the --envelope text "
                f"alone. Add your actual spec/market-case PDFs there for a "
                f"properly grounded design brief instead of a hand-typed "
                f"paraphrase."
            )

        Logger.info(
            f"[synthesizer] Running synthesis over {len(source_papers)} paper(s) "
            f"using model={self.model_name} ({self.model_key})."
        )

        papers_block = "\n\n".join(
            f"--- PAPER (paper_id: {pid}) ---\n{json.dumps(data, indent=2)}"
            for pid, data in source_papers.items()
        )

        requirements_section = (
            f"""AUTHORITATIVE PROJECT REQUIREMENTS (real spec/market-case
documents -- this is the actual, current source of truth for the target
application; the operating envelope note below is supplementary framing
only and must NOT override anything stated here):
{requirements_text}

"""
            if requirements_text else ""
        )

        prompt_body = f"""{requirements_section}OPERATING ENVELOPE NOTE (supplementary framing{' -- no requirements documents were provided, so this is the only source of truth' if not requirements_text else ''}):
{operating_envelope}

PAPERS PROVIDED ({len(source_papers)} total):
{papers_block}
"""

        report = self.ai.extract(
            "Prompt_Synthesis.md",
            prompt_body,
            schema=SynthesisReport,
            stage="synthesis",
        )

        report.model_used = self.provider.model_call_log.get("synthesis", self.model_name)

        SynthesisValidator.check(report, source_papers)

        self._save(report)

        return report

    def _save(self, report: SynthesisReport):
        self.kb_dir.mkdir(parents=True, exist_ok=True)

        json_path = self.kb_dir / f"seat_recliner_synthesis_{self.model_key}.json"
        json_path.write_text(
            json.dumps(report.model_dump(), indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

        md_path = self.kb_dir / f"seat_recliner_synthesis_{self.model_key}.md"
        md_path.write_text(self._to_markdown(report), encoding="utf-8")

        Logger.success(f"[synthesizer] Saved -> {json_path}")
        Logger.success(f"[synthesizer] Saved -> {md_path}")

    def _to_markdown(self, report: SynthesisReport) -> str:
        lines = [
            f"# Seat Recliner Material Synthesis ({report.model_used})",
            "",
            "**AI-synthesized recommendation -- verify against source data "
            "before relying on it. `citation_verified: false` on any item "
            "below means the automated grounding check could not confirm "
            "that claim against the extracted source data; review it "
            "manually.**",
            "",
            f"## Operating envelope assumed",
            report.operating_envelope_assumed or "Not specified",
            "",
            "## Design Brief",
            report.design_brief or "Not Reported",
            "",
            "## Ranked Materials",
        ]

        for i, rec in enumerate(report.ranked_materials, 1):
            verified_tag = "" if rec.citation_verified else " ⚠️ UNVERIFIED -- see log"
            lines += [
                f"### {i}. {rec.material}{verified_tag}",
                f"- **Recommended for:** {rec.recommended_for}",
                f"- **Rationale:** {rec.rationale}",
                f"- **Key metrics:** {'; '.join(rec.key_metrics) if rec.key_metrics else 'Not Reported'}",
                f"- **Tradeoffs:** {rec.tradeoffs or 'Not Reported'}",
                f"- **Supporting papers:** {', '.join(rec.supporting_papers) if rec.supporting_papers else 'None cited'}",
                "",
            ]

        if report.contradictions:
            lines.append("## Contradictions Found Across Papers")
            for c in report.contradictions:
                lines += [
                    f"- **{c.topic}**: {c.description}",
                    f"  - {c.paper_a}: {c.paper_a_value}",
                    f"  - {c.paper_b}: {c.paper_b_value}",
                    f"  - Likely explanation: {c.likely_explanation or 'Not Reported'}",
                ]
            lines.append("")

        if report.gaps:
            lines.append("## Gaps in Current Corpus")
            for g in report.gaps:
                lines.append(f"- {g}")
            lines.append("")

        lines.append("## Papers Considered")
        for pid in report.papers_considered:
            lines.append(f"- {pid}")

        return "\n".join(lines)
