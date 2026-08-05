# Phase 2 — Desktop GUI

## Run it
```
pip install -r requirements-gui.txt
python run_gui.py
```
(Standard `requirements.txt` still installs everything the pipeline itself needs — pywebview is the only new dependency, kept in its own file since `requirements.txt` is UTF-16 encoded and best left untouched.)

## Why pywebview instead of Flask + a browser tab
- Native OS folder-picker dialogs (`Browse` buttons) — a plain web page can't do this reliably.
- One process, no port/host management, no CORS.
- Python pushes progress straight into the page with `window.evaluate_js()` the moment something happens — no polling loop wasting cycles/tokens on "did anything change yet?" requests.
- Ships as a real desktop window, matching the Phase 2 vision.

## What changed in the pipeline (all backward compatible)
- `Pipeline(model_override=...)` — lets the GUI force a specific Gemini model instead of always cascading through `PREFERRED_MODELS`. If the forced model fails, it still falls back to the normal cascade.
- `Pipeline.run(document, output_dir=..., progress_callback=...)` — output folder is now configurable, and every stage (`[1/5]` … `[5/5]`) fires a callback the GUI (or a future logger) can hook into.
- `PDFReader.read_all(input_dir=...)` — input folder is now configurable.
- `OutputChecker.already_processed(filename, output_dir=...)` — respects the same configurable output folder.
- `tests/test_pipeline.py` and CLI usage are untouched — all new parameters default to the original hardcoded paths.

## Layout
```
gui/
  api.py          # PipelineAPI: exposed to JS as pywebview.api.*, runs pipeline on a worker thread
  index.html      # window contents
  style.css       # instrument-panel dark theme
  app.js          # wires buttons to the API, renders live events
  gui_settings.json  # auto-created — remembers last input/output folder + model
```

## Ready for the next phases
- **Phase 3 (logging):** every `progress_callback` event already carries paper name, step, timing, success/failure — writing a structured `pipeline.log` entry per paper is a small addition to `_run_worker`, not a redesign.
- **Phase 4 (config.yaml):** `gui_settings.json` is already doing the same job in miniature (remembering input/output/model). Promoting it to a `config.yaml` the CLI also reads is straightforward.
- **Phase 5 (dashboard):** the same `_push()` events (papers processed, per-paper seconds, failures) are exactly the aggregates a dashboard would need — they're just not persisted/summed yet.
