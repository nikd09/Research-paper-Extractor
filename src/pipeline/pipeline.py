from datetime import datetime
import time

from schemas.paper_schema import PaperAnalysis
from schemas.chunk_schema import ChunkCollection, RagOutput

from src.ai.ai_extractor import AIExtractor
from src.core.document import Document
from src.core.json_writer import JSONWriter
from src.core.prompt_builder import PromptBuilder
from src.core.validator import NumericValidator
from src.core.crosscheck import CrossChecker
from src.core.escalation import Escalator
from src.core.figure_extractor import FigureExtractor
from src.exporters.chunk_writer import ChunkWriter
from src.exporters.markdown_writer import MarkdownWriter
from src.providers.gemini_client import GeminiClient
from src.utils.config import (
    ENABLE_NUMERIC_VALIDATION,
    ENABLE_MULTIMODAL_VERIFY,
    ENABLE_TABLE_PREEXTRACTION,
    ENABLE_CROSSCHECK,
    ENABLE_ESCALATION,
    CROSSCHECK_MODELS,
)
from src.utils.logger import Logger
from src.utils.paper_id import PaperID
from src.utils.file_utils import FileUtils
from pathlib import Path

class Pipeline:

    def __init__(self, model_override: str = None, on_fallback=None):
        self.provider = GeminiClient(model_override=model_override, on_fallback=on_fallback)
        self.ai = AIExtractor(self.provider)
        self.TOTAL_STEPS = 3 + int(ENABLE_CROSSCHECK) + int(ENABLE_ESCALATION)

    def run(
        self,
        document: Document,
        output_dir: str = "outputs",
        progress_callback=None,
    ):
        """
        progress_callback(step: int, total: int, label: str) is called at
        the start of every pipeline stage. Optional -- CLI usage (tests/
        test_pipeline.py) works unchanged without passing one.
        """

        step_counter = {"n": 0}

        def emit(label: str):
            step_counter["n"] += 1
            print(f"\n[{step_counter['n']}/{self.TOTAL_STEPS}] {label}")
            if progress_callback:
                progress_callback(step_counter["n"], self.TOTAL_STEPS, label)

        start_time = time.perf_counter()
        base_name = FileUtils.safe_name(document.filename)

        json_dir = Path(output_dir) / "json"
        markdown_dir = Path(output_dir) / "markdown"
        chunk_dir = Path(output_dir) / "chunks"

        json_dir.mkdir(parents=True, exist_ok=True)
        markdown_dir.mkdir(parents=True, exist_ok=True)
        chunk_dir.mkdir(parents=True, exist_ok=True)

        json_path = json_dir / f"{base_name}.json"
        markdown_path = markdown_dir / f"{base_name}.md"
        chunk_path = chunk_dir / f"{base_name}_chunks.json"

        # -------------------------------------------------
        # Fix #3: structured table pre-extraction (pdfplumber), injected
        # ahead of the raw text so real table structure beats reflowed text
        # -------------------------------------------------

        extract_text = document.text
        if ENABLE_TABLE_PREEXTRACTION:
            extract_text = PromptBuilder.augment_document_text(document.text, document.path)

        # -------------------------------------------------
        # Fix #2: figure-to-page mapping, rendered once and reused by every
        # stage below that needs vision (verify, crosscheck, escalation) --
        # targeted at the actual figure pages instead of the whole PDF.
        # -------------------------------------------------

        figure_manifest, figure_images = ("", [])
        if ENABLE_MULTIMODAL_VERIFY:
            figure_manifest, figure_images = FigureExtractor.build_manifest_and_images(document.path)

        # -------------------------------------------------
        # Prompt 1+2 (merged) -- understand, then extract, in one call
        # Free-tier-first key pool (stage="extract").
        # -------------------------------------------------

        emit("Understanding paper and extracting engineering knowledge...")

        analysis = self.ai.extract(
            "Prompt_12_Understand_And_Extract.md",
            extract_text,
            schema=PaperAnalysis,
            stage="extract",
        )

        # -------------------------------------------------
        # Prompt 3 -- verification. Flash-tier, free keys #1/#2 first
        # (stage="verify" cascade), figure-targeted rather than whole-PDF:
        # the manifest tells the model exactly which attached image has
        # which figure.
        # -------------------------------------------------

        emit("Verifying extraction (figure-targeted, free-tier)...")

        analysis = self.ai.extract(
            "Prompt_3_Verification.md",
            f"""
Original Research Paper (text)

{document.text}

====================================================

FIGURE MANIFEST

{figure_manifest or '(no figures located in this paper)'}

====================================================

Engineering Knowledge

{analysis.model_dump_json(indent=2)}
""",
            schema=PaperAnalysis,
            stage="verify",
            images=figure_images if ENABLE_MULTIMODAL_VERIFY else None,
        )

        # -------------------------------------------------
        # Fix #1: deterministic numeric-grounding pass. Flags (does not
        # silently accept) any number+unit claim not found verbatim in the
        # source text even after the figure-targeted verify pass.
        # -------------------------------------------------

        if ENABLE_NUMERIC_VALIDATION:
            NumericValidator.annotate(analysis, document.text)

        # -------------------------------------------------
        # Fix #5: dual-model cross-check. Independent extraction with a
        # different (cheap, free-tier) model, now ALSO multimodal against
        # the same figure images -- so it can actually contest a
        # chart-derived number, not just a text-derived one.
        # -------------------------------------------------

        if ENABLE_CROSSCHECK:
            emit("Cross-checking numeric fields against an independent extraction...")
            try:
                crosscheck_analysis = self.ai.extract(
                    "Prompt_12_Understand_And_Extract.md",
                    extract_text,
                    schema=PaperAnalysis,
                    stage="crosscheck",
                    images=figure_images if ENABLE_MULTIMODAL_VERIFY else None,
                )
                CrossChecker.compare(
                    analysis,
                    crosscheck_analysis,
                    secondary_model_label=CROSSCHECK_MODELS[0],
                )
            except Exception as e:
                Logger.warning(f"[crosscheck] Skipped due to error: {e}")

        # -------------------------------------------------
        # Last-resort escalation to Pro (paid). Only runs the API call at
        # all if something is STILL flagged after verify + crosscheck --
        # and only sends those specific values, not the whole paper.
        # -------------------------------------------------

        if ENABLE_ESCALATION:
            emit("Escalating any still-unresolved values to Pro (last resort)...")
            Escalator.run(self.ai, analysis, figure_manifest, figure_images, document.text)

        # -------------------------------------------------
        # Prompt 4 (merged) -- Markdown + Chunks in one call
        # Free-tier-first (stage="rag"). Run BEFORE final processing-
        # metadata stamping so `models_used` captures this stage too.
        # -------------------------------------------------

        emit("Generating Markdown and Chunks...")

        rag_output = self.ai.extract(
            "Prompt_4_RAG_Optimization.md",
            f"""
{analysis.model_dump_json(indent=2)}
""",
            schema=RagOutput,
            stage="rag",
        )

        # -------------------------------------------------
        # Processing Metadata
        # -------------------------------------------------

        analysis.processing.paper_id = PaperID.from_pdf(
            document.path
        )

        analysis.processing.source_file = document.filename

        analysis.processing.pipeline_version = "3.0"

        analysis.processing.processed_at = (
            datetime.now().isoformat()
        )

        analysis.processing.processing_time_seconds = round(
            time.perf_counter() - start_time,
            2,
        )

        # CONFIRMED BUG (fixed here): this used to be hardcoded to "" with
        # a comment "model will be filled automatically later" -- it never
        # was, on any run. GeminiClient now logs the real model used on
        # every stage that actually made a call (model_call_log); stamp
        # both the primary extract model and the full per-stage history so
        # every output is genuinely traceable and cost-auditable.
        from schemas.paper_schema import ModelsUsed
        log = self.provider.model_call_log

        analysis.processing.model = log.get("extract", "unknown")
        analysis.processing.models_used = ModelsUsed(
            extract=log.get("extract", "not_run"),
            verify=log.get("verify", "not_run"),
            crosscheck=log.get("crosscheck", "not_run"),
            verify_escalate=log.get("verify_escalate", "not_run"),
            rag=log.get("rag", "not_run"),
        )

        # -------------------------------------------------
        # Save JSON (after models_used is fully known)
        # -------------------------------------------------

        JSONWriter.save(
            analysis,
            json_path,
        )

        MarkdownWriter.save(
            rag_output.markdown,
            markdown_path,
        )

        # Stamp traceability fields ourselves rather than trust the model's
        # own copy of the ID -- this overwrites whatever the LLM produced
        # for these fields (schema-conformant models will attempt to fill
        # every field) with the authoritative values already computed
        # above, so every chunk can always be traced back to its source
        # paper regardless of what the model guessed.
        for chunk in rag_output.chunks:
            chunk.paper_id = analysis.processing.paper_id
            chunk.source_file = analysis.processing.source_file
            chunk.paper_title = analysis.metadata.title

        ChunkWriter.save(
            ChunkCollection(chunks=rag_output.chunks),
            chunk_path,
        )

        return analysis
