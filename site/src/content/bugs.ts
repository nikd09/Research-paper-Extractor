import type { LogEntry } from './types'

/**
 * Sourced from CHANGELOG_v3.md (the confirmed-bug list), the module-level
 * docstrings the fixes left behind, and the Run 2 / Run 3 comparison.
 * Nothing here is a hypothetical — every entry names the file it changed.
 */
export const LOG: LogEntry[] = [
  {
    id: 'run3',
    marker: 'Run 2 → Run 3',
    title: 'The better architecture lost',
    severity: 'silent-pass',
    broke:
      'Run 3 fixed everything I could name about Run 2. Figure-targeted verification instead of shipping the whole PDF at the model. A deterministic validator. Cross-model checking. Escalation on flagged residuals instead of an unconditional Pro pass over every paper. Every one of those decisions is defensible on its own and I’d make most of them again. The output was worse.',
    found:
      'By hand. I put Run 2’s output and Run 3’s output next to the source papers and read them against each other. Run 2 — blunt, expensive, un-triaged — had caught values Run 3 missed. Nothing in the logs said so. Both runs completed cleanly.',
    changed:
      'v3.0 is Run 3’s architecture with the specific gaps that comparison exposed closed one at a time, rather than a fourth rewrite. The lasting change was to how I evaluate: a gate is only as good as its discriminator, and triage that hands fewer claims to the strong model is only cheaper if the triage is right about which claims those are. “The architecture is better” is a hypothesis about the diagram, not a fact about the output.',
    file: 'CHANGELOG_v3.md — base: Run 3 codebase',
  },
  {
    id: 'setunion',
    marker: 'v3.0 · fix 4 + fix 6',
    title: 'The crosscheck that cleared a whole field on one lucky match',
    severity: 'silent-pass',
    broke:
      'Cross-model verification compared each performance field as one unordered set of numbers. If any number in an eight-entry field also appeared anywhere in the independent extraction’s numbers for that field, the entire field was marked as agreeing. A paper’s real PPS wear rate of 6.6E-6 sat correctly in one entry and a fabricated 6.6E-7 — a decade off — sat in the same field. Both cleared. Not flagged, not hedged. Passed, and formatted exactly like every correct value around them.',
    found:
      'With the PDF open next to the output, checking by hand — the thing I’d been telling myself I didn’t need to do anymore now that the architecture was better. It wasn’t an edge case. It was sitting in normal-looking output.',
    changed:
      'Two structural changes, not one. PerformanceMetrics stopped being List[str] and became records with material, condition, value, unit, source and confidence — because a bare list of strings gives a comparison no unit smaller than the whole field. Then crosscheck was rewritten to match each entry against its best-matching counterpart by material-token overlap and flag only that entry. There’s a reproduction test that runs the exact 6.6E-6 / 6.6E-7 pair through both versions.',
    code: {
      lang: 'python',
      caption: 'src/core/crosscheck.py — per entry now, and one lucky match clears nothing else',
      source: `match = _best_match(mv, secondary_values)
match_numbers = _numbers_of(match) if match else set()

if primary_numbers & match_numbers and not condition_mismatch:
    mv.confidence = "confirmed"
else:
    mv.confidence = "crosscheck_mismatch"
    flagged += 1`,
    },
    file: 'src/core/crosscheck.py · schemas/paper_schema.py',
  },
  {
    id: 'dataloss',
    marker: 'v3.0 · fix 2',
    title: 'A false flag that became permanent data loss',
    severity: 'data-loss',
    broke:
      'The paper stated a value as 2.0 × 10⁻⁵. The extraction wrote 2.0E-5. The validator compared them as strings, found no match, and flagged the value unverified — a false positive, since the number was right there in the prose. Escalation then picked it up, and escalation had only ever been given the figure images, not the source text. So Pro went looking for a text-stated value in a chart, couldn’t find it, and did exactly what I’d instructed it to do with a value it couldn’t confirm: wrote “Not Reported” over a correct answer.',
    found:
      'Working backward from a missing value I knew was in the paper, because I’d read it myself. Every individual stage looked correct in the log. The validator did its job. Escalation ran. Pro followed its prompt. Nothing errored anywhere along the chain that destroyed the data.',
    changed:
      'Three things. Normalisation now folds U+2212, en dash and em dash to ASCII and rewrites a × 10^b into ae b form before comparing, in both directions. Escalation now receives the source text first and the figures second, with the prompt telling it plainly that most flagged values turn out to be stated in prose. And escalation only ever resolves the value — it can’t relabel which material an entry belongs to, which closed a second path to a different bug.',
    code: {
      lang: 'python',
      caption: 'src/core/validator.py — the comparison that should have existed first',
      source: `def _canonicalize_scientific_notation(s: str) -> str:
    """Rewrites 'a x 10^b' / 'a × 10-b' into 'aeb' so they compare
    equal to values already written in E-notation. Confirmed bug: a
    value stated as '2.0 × 10−5' and extracted as '2.0E-5' were
    treated as different numbers and never matched, causing a
    genuinely text-grounded value to be flagged unverified."""
    return _SCI_NOTATION_RE.sub(lambda m: f"{m.group(1)}e{m.group(2)}", s)`,
    },
    file: 'src/core/validator.py · src/core/escalation.py',
  },
  {
    id: 'envelope',
    marker: 'v3.0 · synthesis',
    title: 'Rigorous about the paper’s numbers, casual about my own input',
    severity: 'wrong-input',
    broke:
      'The synthesis stage ranks materials against an operating envelope. That envelope was a string constant I typed from memory — DEFAULT_ENVELOPE — describing light-to-moderate contact pressure and a cabin range of roughly −20 °C to 80 °C. The actual spec documents say 110 MPa test pressure and an operating range of −45 °C to +93 °C, with excursions above 200 °C during welding. So a pipeline built entirely around never trusting an unverified number was ranking materials against an unverified paraphrase of its own requirements.',
    found:
      'Re-reading the market case and spec PDFs while writing something else, and recognising that none of the numbers in them matched the ones I’d been ranking against for weeks.',
    changed:
      'docs/requirements/ is read directly now. Every PDF in that folder is loaded as plain text and injected ahead of everything else as the authoritative requirements source, with the hand-typed envelope demoted to supplementary framing that must not override it. If the folder is empty the synthesiser says so loudly instead of quietly falling back.',
    code: {
      lang: 'python',
      caption: 'src/knowledge_base/synthesizer.py — the comment I left for myself',
      source: `# Confirmed real-world bug: the synthesis stage used to only ever
# see the processed literature papers -- the actual project spec/
# market-case documents were never given to it, so the operating
# envelope had to be hand-typed as a paraphrase (DEFAULT_ENVELOPE
# in synthesize.py), and that paraphrase turned out to be wrong on
# several material points (grease lubrication, real temperature
# range, PFAS-free constraint, real load/pressure magnitudes)
# simply because nobody re-read the source PDFs before typing it.
REQUIREMENTS_DIR = Path("docs/requirements")`,
    },
    file: 'src/knowledge_base/synthesizer.py · synthesize.py',
  },
  {
    id: 'relevance',
    marker: 'v3.0 · fix 3',
    title: 'A hydropower bearing paper explained its seat recliner relevance',
    severity: 'silent-pass',
    broke:
      'Two fields, automotive_relevance and seat_recliner_relevance, both plain strings. Their names presuppose that relevance exists, there was no instruction anywhere to leave them blank, and a schema-conformant model fills every field it’s given. So an unrelated hydropower turbine bearing paper came back with fluent, confident, entirely invented reasoning about automotive seat recliners. Confirmed on two unrelated papers.',
    found:
      'Reading output for a paper I already knew had nothing to do with the application.',
    changed:
      'Both became records: stated_in_paper as a boolean, plus a note that must either quote the paper or be prefixed as an explicit inference. The distinction between “the paper says this” and “this is my inference” is now structural rather than a matter of phrasing.',
    file: 'schemas/paper_schema.py — RelevanceNote',
  },
  {
    id: 'traceability',
    marker: 'v3.0 · fix 1',
    title: 'Every run I’d ever done had a blank model field',
    severity: 'wrong-attribution',
    broke:
      'processing.model was hardcoded to an empty string with a comment saying the model would be filled in automatically later. It never was, on any run. Every output file in the project claimed no model produced it.',
    found: 'Source review, not observation. Nothing about the output looked wrong.',
    changed:
      'The Gemini client logs the model that actually served every stage, and the pipeline stamps both the primary extraction model and the full per-stage history. A trivial bug, but the field it broke is the one that makes cost auditing and “which tier produced this number” answerable at all.',
    file: 'src/pipeline/pipeline.py · src/providers/gemini_client.py',
  },
  {
    id: 'hardness',
    marker: 'v3.0 · fix 5',
    title: 'The field called hardness_values had never once held a hardness',
    severity: 'wrong-attribution',
    broke:
      'Every paper reviewed reported yield strength or offset yield strength in that field. Not Rockwell, not Brinell, not Shore. The name was a guess I made early about what this literature reports, and the literature disagreed with it for months without anything breaking.',
    found: 'Reading extracted output across papers and noticing the units were never hardness units.',
    changed:
      'Renamed to mechanical_properties, with the per-record unit disambiguating which property it is. Which also means the field name stopped asserting something about the data that the data didn’t support.',
    file: 'schemas/paper_schema.py — PerformanceMetrics',
  },
  {
    id: 'figurepage',
    marker: 'v3.0 · fix 8',
    title: 'Reading the wrong page because a sentence mentioned a figure',
    severity: 'wrong-attribution',
    broke:
      'Figure pages were located by the first appearance of “Fig. N” anywhere in the document. In an academic paper that’s frequently an in-text citation — “as shown in Fig. 15 that friction drops…” — several pages before the chart. The verify stage was being handed the wrong page and asked to read a value off it.',
    found:
      'Testing the page-selection heuristic against a real citation sentence and a real caption sentence from the same paper.',
    changed:
      'A stricter caption pattern runs first: figure number, then a period or colon, then a capital letter or an opening paren — which is what a caption looks like and what a mid-sentence citation doesn’t. First-mention survives only as a fallback, and when it’s used the log says so, because a fallback page is not a confirmed caption page.',
    file: 'src/core/figure_extractor.py',
  },
  {
    id: 'chartgap',
    marker: 'v3.0 · chart completeness',
    title: 'Six series on a chart, and the extraction found two of them',
    severity: 'silent-pass',
    broke:
      'A figure with six data series, each carrying a printed numeric label, came back with two extracted records. The four series that existed only as chart labels — never restated anywhere in body text — were silently dropped: no confidence flag, no note, no trace in the output that anything had been skipped. Separately, a printed chart label reading “0.564” was extracted as “~0.56” with confidence approximate — under-confident, since a number printed directly on a chart is as authoritative as a table cell, not a gridline interpolation.',
    found:
      'By hand, the way most of these are — counting labeled points on the actual figure and counting matching records in the JSON. Six and two.',
    changed:
      'Two prompt-level fixes, no code. The extraction prompt gained a rule that every labeled series, bar or point in a multi-series chart becomes its own record, whether or not prose ever restates it — with a count-and-compare self-check before the model finalizes an answer. The verify prompt, which should have caught the gap and had no completeness check at all, got the same self-check plus the 6-series/2-extracted failure mode named as an anti-pattern to test against. Both prompts also sharpened the line between the two states: a number printed as text on the chart is confirmed at its exact printed value; approximate now applies only to genuine between-gridline interpolation with no printed label present.',
    code: {
      lang: 'markdown',
      caption: 'prompts/Prompt_3_Verification.md — the completeness check, added',
      source: `Completeness check -- confirmed real failure mode: a chart with 6 data
series each carrying a printed numeric label had only 2 of 6 series
extracted, with no confidence flag and no trace they were skipped.
Count the labeled series/bars/points in the figure and compare it
against the extracted records citing that figure as source. If the
extracted count is lower, add the missing records now.`,
    },
    file: 'prompts/Prompt_12_Understand_And_Extract.md · prompts/Prompt_3_Verification.md',
  },
  {
    id: 'derived',
    marker: 'v3.0 · derived confidence',
    title: 'A number the pipeline calculated wore the same stamp as one it had read',
    severity: 'silent-pass',
    broke:
      'The extraction was doing arithmetic — reading “2.5E-5, a 50% reduction from X” and computing X = 5.0E-5 — and then labeling the computed value confirmed, as if it had been read verbatim off the page. Nothing in the record distinguished a number the paper stated from a number the pipeline had derived itself. A related gap sat next to it: the existing prose-vs-table contradiction rule had no equivalent for prose-vs-prose, so two different stated percentages for the same comparison in two different places — abstract versus results section — silently collapsed to one, with no contradiction flagged.',
    found:
      'By hand, reading extracted output against the paper it came from, the same way as the chart-completeness gap above.',
    changed:
      'A new confidence state, derived, for a value calculated from a stated percentage or ratio rather than read directly — never confirmed, and source must name what it was computed from. validator.py adds it to the skip-set so the grounding check doesn’t clobber a legitimately-computed value back to unverified for not appearing verbatim. crosscheck.py deliberately does NOT skip it the same way: a dedicated branch lets a second independent extraction still contest a bad derivation. Agreement leaves the value at derived, never promoted. Disagreement flags crosscheck_mismatch, same as any other contested value — a second wrong derivation is still real evidence something’s off.',
    code: {
      lang: 'python',
      caption: 'src/core/crosscheck.py — the branch a computed value gets instead of the skip',
      source: `if mv.confidence == "derived":
    if agrees:
        pass  # stays "derived" -- corroborated, not upgraded
    else:
        mv.confidence = "crosscheck_mismatch"
    continue`,
    },
    file: 'src/core/crosscheck.py · src/core/validator.py · schemas/paper_schema.py',
  },
]
