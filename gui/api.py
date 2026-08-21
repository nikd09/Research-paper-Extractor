"""
Phase 2 -- Desktop GUI backend.

Architecture:
- pywebview gives us a native window + native OS folder-picker dialogs.
- The pipeline runs on a background thread so the UI never freezes.
- Instead of a polling HTTP server, this thread pushes JSON events
  straight into the page with window.evaluate_js(). Cheaper and
  simpler than running Flask + fetch polling for a single-user desktop app.
"""

import json
import os
import subprocess
import sys
import threading
import time
import traceback
from pathlib import Path
import webview

# Make "src.*" importable regardless of the working directory the GUI
# is launched from.
sys.path.append(str(Path(__file__).resolve().parents[1]))

from src.core.pdf_reader import PDFReader
from src.pipeline.pipeline import Pipeline
from src.utils.file_utils import FileUtils
from src.utils.output_checker import OutputChecker
from src.utils.config import PREFERRED_MODELS, SYNTHESIS_MODEL_OPTIONS
from src.knowledge_base.synthesizer import Synthesizer

SETTINGS_FILE = Path(__file__).parent / "gui_settings.json"
DEFAULT_INPUT_DIR = "papers/input"
DEFAULT_OUTPUT_DIR = "outputs"
DEFAULT_ENVELOPE = (
    "Automotive seat recliner pivot/bushing mechanism: low sliding speed "
    "(oscillatory, not continuous rotation), boundary-lubricated or dry "
    "sliding, light-to-moderate contact pressure, indoor cabin temperature "
    "range (roughly -20C to 80C), multi-year maintenance-free service life, "
    "priority on low friction (avoid squeak/stick-slip), low wear, and no "
    "grease contamination of upholstery. Static friction / stiction "
    "(stick-slip onset) matters as much as steady-state dynamic friction, "
    "since that transition is the primary driver of audible squeak."
)


class PipelineAPI:
    """Exposed to the frontend as `pywebview.api.<method>`."""

    def __init__(self):
        self.window = None
        self._running = False
        self._cancel_requested = False
        self._synthesis_running = False
        self.current_input_dir = DEFAULT_INPUT_DIR

    def set_window(self, window):
        self.window = window

    # ------------------------------------------------------------------
    # Settings (remembers last-used folders/model between launches)
    # ------------------------------------------------------------------

    def load_settings(self):
        if SETTINGS_FILE.exists():
            try:
                settings = json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
                self.current_input_dir = settings.get("input_dir", DEFAULT_INPUT_DIR)
                settings.setdefault("synthesis_model", "flash")
                settings.setdefault("envelope", DEFAULT_ENVELOPE)
                return settings
            except Exception:
                pass
        self.current_input_dir = DEFAULT_INPUT_DIR
        return {
            "input_dir": DEFAULT_INPUT_DIR,
            "output_dir": DEFAULT_OUTPUT_DIR,
            "model": PREFERRED_MODELS[0],
            "synthesis_model": "flash",
            "envelope": DEFAULT_ENVELOPE,
        }

    def save_settings(self, input_dir, output_dir, model, synthesis_model=None, envelope=None):
        self.current_input_dir = input_dir
        # Read back whatever's already saved so partial saves (e.g. just
        # the pipeline settings, without touching the envelope textarea)
        # don't clobber the other half of the settings file.
        existing = {}
        if SETTINGS_FILE.exists():
            try:
                existing = json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
            except Exception:
                pass
        SETTINGS_FILE.write_text(
            json.dumps(
                {
                    "input_dir": input_dir,
                    "output_dir": output_dir,
                    "model": model,
                    "synthesis_model": synthesis_model if synthesis_model is not None else existing.get("synthesis_model", "flash"),
                    "envelope": envelope if envelope is not None else existing.get("envelope", DEFAULT_ENVELOPE),
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        return {"ok": True}

    def get_models(self):
        return PREFERRED_MODELS

    def get_synthesis_models(self):
        # [{key: "flash", label: "Flash (fast, cheap)"}, {key: "pro", label: "Pro (slower, stronger reasoning)"}]
        labels = {
            "flash": "Flash -- fast, cheap, good for iterating",
            "pro": "Pro -- slower, stronger cross-paper reasoning",
        }
        return [
            {"key": k, "model": v, "label": labels.get(k, k)}
            for k, v in SYNTHESIS_MODEL_OPTIONS.items()
        ]

    # ------------------------------------------------------------------
    # Native folder picker
    # ------------------------------------------------------------------

    def browse_folder(self, current_path=""):
        start_dir = current_path if current_path and Path(current_path).exists() else str(Path.cwd())
        result = self.window.create_file_dialog(webview.FOLDER_DIALOG, directory=start_dir)
        if result:
            return result[0]
        return None

    # ------------------------------------------------------------------
    # Scan folders (updates the Found / Already Processed / Remaining stats)
    # ------------------------------------------------------------------

    def scan(self, input_dir, output_dir):
        try:
            folder = Path(input_dir)
            if not folder.exists():
                return {"error": f"Folder not found: {input_dir}"}

            pdfs = sorted(folder.glob("*.pdf"))
            processed = 0
            for pdf in pdfs:
                base_name = FileUtils.safe_name(pdf.name)
                if OutputChecker.already_processed(base_name, output_dir):
                    processed += 1

            return {
                "found": len(pdfs),
                "processed": processed,
                "remaining": len(pdfs) - processed,
            }
        except Exception as e:
            return {"error": str(e)}

    # ------------------------------------------------------------------
    # Run the pipeline
    # ------------------------------------------------------------------

    def start_pipeline(self, input_dir, output_dir, model):
        if self._running:
            return {"error": "Pipeline is already running."}

        self._cancel_requested = False
        self._running = True

        thread = threading.Thread(
            target=self._run_worker,
            args=(input_dir, output_dir, model),
            daemon=True,
        )
        thread.start()
        return {"started": True}

    def cancel_pipeline(self):
        self._cancel_requested = True
        return {"cancelling": True}

    def is_running(self):
        return {"running": self._running}

    # ------------------------------------------------------------------
    # Internal: push an event to the page
    # ------------------------------------------------------------------

    def _push(self, event, payload):
        if not self.window:
            return
        try:
            self.window.evaluate_js(
                f"window.onPipelineEvent({json.dumps(event)}, {json.dumps(payload)})"
            )
        except Exception:
            pass  # window may be closing -- never let this crash the worker

    def _on_model_fallback(self, requested, used, reason):
        self._push("model_fallback", {
            "requested": requested,
            "used": used,
            "reason": reason,
        })

    # ------------------------------------------------------------------
    # Cross-paper synthesis (runs ONCE on demand, not per-paper -- see
    # src/knowledge_base/synthesizer.py for why this is a separate stage
    # from the main pipeline, including why it's worth using "pro" for the
    # version that actually informs a real materials decision rather than
    # defaulting to "flash" everywhere).
    # ------------------------------------------------------------------

    def run_synthesis(self, output_dir, model_key, envelope):
        if self._synthesis_running:
            return {"error": "Synthesis is already running."}

        self._synthesis_running = True

        thread = threading.Thread(
            target=self._synthesis_worker,
            args=(output_dir, model_key, envelope),
            daemon=True,
        )
        thread.start()
        return {"started": True}

    def _synthesis_worker(self, output_dir, model_key, envelope):
        try:
            self._push("synthesis_start", {"model_key": model_key})

            synthesizer = Synthesizer(model_key=model_key, output_dir=output_dir)
            report = synthesizer.run(operating_envelope=envelope)

            unverified = sum(1 for r in report.ranked_materials if not r.citation_verified)

            md_path = synthesizer.kb_dir / f"seat_recliner_synthesis_{model_key}.md"

            self._push("synthesis_done", {
                "model_key": model_key,
                "model_used": report.model_used,
                "ranked_count": len(report.ranked_materials),
                "unverified_count": unverified,
                "contradiction_count": len(report.contradictions),
                "gap_count": len(report.gaps),
                "markdown_path": str(md_path),
                "markdown": md_path.read_text(encoding="utf-8") if md_path.exists() else "",
            })
        except Exception as e:
            traceback.print_exc()
            self._push("synthesis_error", {"message": str(e)})
        finally:
            self._synthesis_running = False

# ------------------------------------------------------------------

    # Drag-and-drop / file-picker paper upload

    # ------------------------------------------------------------------



    def upload_papers(self, input_dir, file_paths):

        """file_paths: list of absolute source paths (from JS drag-drop or

        a native file-picker dialog) to copy into the input folder."""

        import shutil



        dest_dir = Path(input_dir)

        dest_dir.mkdir(parents=True, exist_ok=True)



        copied, skipped = [], []

        for src in file_paths:

            src_path = Path(src)

            if src_path.suffix.lower() != ".pdf":

                skipped.append(src_path.name)

                continue

            dest = dest_dir / src_path.name

            try:

                shutil.copy2(src_path, dest)

                copied.append(src_path.name)

            except Exception:

                skipped.append(src_path.name)



        return {"copied": copied, "skipped": skipped}



    def pick_papers(self):

        """Native multi-file picker, as an alternative to drag-drop."""

        result = self.window.create_file_dialog(

            webview.OPEN_DIALOG,

            allow_multiple=True,

            file_types=("PDF Files (*.pdf)",),

        )

        return list(result) if result else []



    def open_folder(self, path):

        try:

            os_platform = sys.platform

            if os_platform.startswith("win"):

                os.startfile(path)  # noqa

            elif os_platform == "darwin":

                subprocess.Popen(["open", path])

            else:

                subprocess.Popen(["xdg-open", path])

            return {"ok": True}

        except Exception as e:

            return {"error": str(e)}



    def _run_worker(self, input_dir, output_dir, model):

        try:

            documents = PDFReader.read_all(input_dir)

        except Exception as e:

            self._push("error", {"message": str(e)})

            self._running = False

            return



        to_process = []

        already = 0

        for doc in documents:

            base_name = FileUtils.safe_name(doc.filename)

            if OutputChecker.already_processed(base_name, output_dir):

                already += 1

            else:

                to_process.append(doc)



        total = len(to_process)

        self._push("scan", {

            "found": len(documents),

            "processed": already,

            "remaining": total,

        })



        if total == 0:

            self._push("done", {"message": "Nothing to do -- all papers already processed."})

            self._running = False

            return



        pipeline = Pipeline(model_override=model or None, on_fallback=self._on_model_fallback)

        durations = []



        for idx, document in enumerate(to_process, start=1):

            if self._cancel_requested:

                self._push("cancelled", {"message": "Cancelled by user."})

                self._running = False

                return



            self._push("paper_start", {

                "index": idx, "total": total, "filename": document.filename,

            })



            t0 = time.perf_counter()



            def on_step(step, step_total, label, _idx=idx, _name=document.filename):

                self._push("step", {

                    "paper_index": _idx,

                    "paper_total": total,

                    "filename": _name,

                    "step": step,

                    "step_total": step_total,

                    "label": label,

                })



            try:

                pipeline.run(document, output_dir=output_dir, progress_callback=on_step)

                elapsed = time.perf_counter() - t0

                durations.append(elapsed)

                avg = sum(durations) / len(durations)

                eta_seconds = round(avg * (total - idx))

                self._push("paper_done", {

                    "index": idx, "total": total, "filename": document.filename,

                    "seconds": round(elapsed, 1), "eta_seconds": eta_seconds,

                })

            except Exception as e:

                traceback.print_exc()

                self._push("paper_error", {

                    "index": idx, "total": total,

                    "filename": document.filename, "message": str(e),

                })



        self._push("done", {"message": f"Pipeline completed -- {total} paper(s) processed."})

        self._running = False


def main():
    api = PipelineAPI()
    html_path = Path(__file__).parent / "index.html"

    window = webview.create_window(
        "Engineering Knowledge Extraction Pipeline",
        str(html_path),
        js_api=api,
        width=1120,
        height=780,
        min_size=(900, 640),
        background_color="#0b0f14",
    )
    api.set_window(window)

    # Confirmed bug in pywebview 6.2.1 itself (webview/platforms/winforms.py,
    # init_storage()): with the default private_mode=True and no storage_path,
    # the WebView2 profile directory is created via the throwaway expression
    # `tempfile.TemporaryDirectory().name` -- nothing keeps a reference to
    # that TemporaryDirectory object, so CPython's refcounting GC can finalize
    # it (deleting the directory it just created) before or while WebView2 is
    # still initializing into it. That race is what produces "CoreWebView2
    # can only be accessed from the UI thread" / E_NOINTERFACE / "maximum
    # recursion depth exceeded" on later launches. Passing an explicit
    # storage_path routes init_storage() through its other branch instead: a
    # real, persistent directory created with os.makedirs, no throwaway
    # object to race against.
    webview_cache_dir = Path(__file__).parent / ".webview_cache"
    webview_cache_dir.mkdir(exist_ok=True)

    webview.start(storage_path=str(webview_cache_dir))

