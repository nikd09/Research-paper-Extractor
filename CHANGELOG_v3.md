# v3.0 — Structured Metrics Restructure

Base: Run 3 codebase (best existing architecture: figure-targeted verify,
table pre-extraction, deterministic validator, cross-model check, targeted
Pro escalation). This version fixes the specific bugs confirmed by
comparing Run 2 vs Run 3 outputs against original papers, plus a source
code review of both.

## Fixed

1. **`processing.model` was hardcoded to `""`** (pipeline.py). Every past
   run had a blank traceability field. Now stamped from the real model
   used, plus a new `processing.models_used` dict showing which model
   handled every stage (extract/verify/crosscheck/escalation/rag) — useful
   for cost auditing across the pipeline, not just the primary extraction.

2. **Unicode minus sign broke numeric grounding** (validator.py). Source
   PDFs commonly use U+2212 (−) instead of ASCII "-" in exponents (e.g.
   "6.6E−6"). `_normalize()` now folds Unicode minus/en-dash/em-dash to
   ASCII before comparison in both directions.

3. **`relevance` fields fabricated content with no basis in the paper**
   (confirmed on two unrelated papers — a PTFE tribology paper and an
   unrelated hydropower bearing paper both got fabricated "seat recliner
   relevance" text). Restructured `automotive_relevance` /
   `seat_recliner_relevance` from plain strings into
   `{stated_in_paper: bool, note: str}` records, with explicit prompt
   rules distinguishing "the paper says this" from "this is my inference."

4. **`PerformanceMetrics` fields were unlabeled `List[str]`** — root cause
   of two separate confirmed bugs:
   - Markdown generation had to re-guess which material a number belonged
     to, and got it wrong (a material's yield strength was written up
     under a different material's name).
   - Cross-model verification could only compare each field as one
     unordered set of numbers, so a single coincidental match cleared an
     entire field, including genuinely wrong values sitting right next to
     it (reproduced and confirmed with a test: a real 6.6E-6 wear rate and
     a fabricated 6.6E-7 in the same field — the old crosscheck logic
     would let the fabricated one through untouched).

   Replaced with `MetricValue` records: `material`, `condition`, `value`,
   `unit`, `source`, `confidence`. `confidence` replaces the old approach
   of appending free-text tags like `[unverified: ...]` onto the value
   string — every downstream consumer previously had to string-match for
   these tags, and they were confirmed to sometimes silently not get added
   between pipeline runs. Now it's a first-class enum-like field:
   `confirmed | approximate | unverified | crosscheck_mismatch | not_reported`.

5. **`hardness_values` field name didn't match its contents.** Every paper
   reviewed so far reported yield strength / offset yield strength in this
   field, never actual hardness (Rockwell/Brinell/Shore). Renamed to
   `mechanical_properties`; `unit` on each record disambiguates what kind
   of property it is.

6. **`crosscheck.py` compared fields as unordered number sets, not
   per-entry.** Rewritten to match each primary `MetricValue` against its
   best-matching secondary entry (by material/condition token overlap) and
   flag only that specific entry as `crosscheck_mismatch` — verified with
   a reproduction test that this catches the exact bug in #4 above that
   the old logic missed.

7. **`escalation.py`** updated to collect/resolve flagged `MetricValue`
   entries instead of scanning value strings for bracketed tags. Escalation
   resolves the VALUE only — it never re-labels which material/condition an
   entry belongs to, closing off a second path to the same misattribution
   bug.

8. **`figure_extractor.py`'s page-selection heuristic** used to take the
   FIRST mention of "Fig. N" anywhere in the document, which is frequently
   an in-text citation ("as shown in Fig. 15 that...") rather than the
   actual captioned figure page. Added a stricter caption-pattern match
   ("Fig. N. <Capitalized description>") that's tried first and preferred
   over the raw first-mention fallback — verified against both a real
   citation sentence and a real caption sentence.

## Verification performed

- Full syntax check across every `.py` file in the project: clean.
- Full real-import check of every module (schemas, core, exporters,
  providers, ai, pipeline, knowledge_base, utils): clean, no import errors.
- `Pipeline()` constructs correctly; all 4 prompt files load.
- Full `pipeline.run()` dry-run against a real uploaded PDF with Gemini
  calls mocked out: table pre-extraction, figure-page rendering, validator,
  crosscheck, escalation, JSON/Markdown/Chunk writers all executed in the
  correct order and produced valid, correctly-structured output files.
- Reproduced the exact real-world "6.6E-6 vs fabricated 6.6E-7" bug in a
  standalone test and confirmed the new validator + crosscheck pipeline
  correctly isolates and flags only the bad value, where the old pipeline
  would have missed it.
- Reproduced the figure-caption-vs-citation ambiguity in a standalone test
  and confirmed the new regex correctly distinguishes them.

## Not changed in this pass (still worth doing, lower priority)

- `MANUAL_PRO_VERIFY` in `config.py` is still `False` by default — Pro
  verification runs only as targeted escalation on flagged residuals, not
  as an unconditional full pass. This is the intentional cost-vs-coverage
  tradeoff from Run 3; the fixes above close the specific gaps that made
  that tradeoff unsafe (crosscheck blind spot, missing grounding fixes),
  but if a given paper's results still look off, flip this to `True` for
  that run.
- GUI (`gui/api.py`, `gui/app.js`) was checked and needed no changes — it
  never reads the restructured fields directly, only orchestrates the
  pipeline and shows progress/counts.
