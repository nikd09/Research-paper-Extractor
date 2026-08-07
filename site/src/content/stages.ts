import type { Specimen, Stage } from './types'

/**
 * Source of truth: src/pipeline/pipeline.py (call order), src/utils/config.py
 * (STAGE_CONFIG, model lists, key pools) and the module named on each stage.
 */
export const STAGES: Stage[] = [
  {
    id: 'ingest',
    index: 0,
    name: 'Ingest & prepare',
    verb: 'read the PDF three different ways',
    summary: 'Text, real table structure, and the specific pages figures live on.',
    what:
      'PyMuPDF gives the raw text, and on a two-column academic layout it gives it badly — cells reordered, rows merged, exponents fused. So two more passes run before any model sees the paper. pdfplumber pulls tables as actual rows and columns and they get injected ahead of the text as authoritative context. Separately, every “Fig. N.” caption is matched to its page, and only those pages are rendered at 320 DPI, so the verify stage can be told “Figure 18 is attached image 2” instead of “here is a 39-page PDF, go find it”.',
    model: 'none — pdfplumber + PyMuPDF, local',
    keyPool: 'no API call',
    tier: 'none',
    calls: '0',
    file: 'src/core/pdf_reader.py · prompt_builder.py · figure_extractor.py',
    code: {
      lang: 'python',
      caption: 'src/core/figure_extractor.py — caption pattern, not first mention',
      source: `# A real figure CAPTION, as opposed to an in-text citation like
# "as shown in Fig. 15 that friction drops...", almost always looks
# like "Fig. 15. <capitalized description>".
_FIGURE_CAPTION_RE = re.compile(
    r"(?i:\\bfig(?:ure)?\\.?\\s*)(\\d+)(?i:\\s*[.:]\\s*)[A-Z(]",
)

RENDER_DPI = 320  # high enough to read axis gridlines/tick labels`,
    },
    example: {
      label: 'Attached image 2 = page 8',
      value: 'contains: Figure 18, Figure 19',
      confidence: 'not_reported',
      note: 'The manifest line the verify prompt gets. Nothing is extracted yet.',
    },
  },
  {
    id: 'extract',
    index: 1,
    name: 'Extract',
    verb: 'understand and pull structured knowledge in one call',
    summary: 'One prompt does understanding and extraction. It used to be two.',
    what:
      'Prompt_12 merges what were once Prompt 1 and Prompt 2 — the model reads the paper and fills the whole PaperAnalysis schema in a single schema-constrained call. Every numeric claim comes out as a MetricValue record: which material, under what condition, the value, the unit, and where it says it got it. Nothing here is trusted yet. Everything is born unverified.',
    model: 'gemini-3.6-flash → gemini-3.5-flash',
    keyPool: 'free keys, round-robin · paid fallback',
    tier: 'free',
    calls: '1',
    file: 'prompts/Prompt_12_Understand_And_Extract.md',
    code: {
      lang: 'python',
      caption: 'src/pipeline/pipeline.py — the whole extraction stage',
      source: `analysis = self.ai.extract(
    "Prompt_12_Understand_And_Extract.md",
    extract_text,
    schema=PaperAnalysis,
    stage="extract",
)`,
    },
    example: {
      label: 'PA46-MP1100-cb / dry sliding vs 16MnCr5 steel, 2 MPa, 0.5 m/s',
      value: '~0.25',
      confidence: 'unverified',
      note: 'Read off Figure 6. Plausible, unproven, and treated as unproven.',
    },
  },
  {
    id: 'verify',
    index: 2,
    name: 'Verify',
    verb: 'check the claims against the figure pages they came from',
    summary: 'Multimodal, but pointed at named pages instead of the whole document.',
    what:
      'The verify prompt gets the paper text, the extracted JSON, and the rendered figure pages with a manifest saying which figure is on which image. Values read exactly off a gridline come back confirmed; values interpolated between gridlines come back approximate and stay that way. Attaching the whole PDF to one generic “verify against the figures” call was the earlier design, and it made the model search the entire document against every other page competing for attention.',
    model: 'gemini-3.6-flash ⇄ gemini-3.5-flash (cascade)',
    keyPool: 'free keys first, then flash on the paid key',
    tier: 'free',
    calls: '1',
    file: 'prompts/Prompt_3_Verification.md',
    code: {
      lang: 'python',
      caption: 'src/utils/config.py — free tier first, and Pro is not in this cascade',
      source: `VERIFY_CASCADE = [
    {"models": ["models/gemini-3.6-flash", "models/gemini-3.5-flash"],
     "keys": FREE_API_KEYS},
    {"models": ["models/gemini-3.6-flash", "models/gemini-3.5-flash"],
     "keys": [PAID_API_KEY] if PAID_API_KEY else []},
]`,
    },
    example: {
      label: 'PA46-MP1100-cb / dry sliding vs 16MnCr5 steel, 2 MPa, 0.5 m/s',
      value: '~0.25',
      confidence: 'approximate',
      note: 'Figure 6 has no gridline there. The tilde is the honest part.',
    },
  },
  {
    id: 'validate',
    index: 3,
    name: 'Validate',
    verb: 'find the number in the text, verbatim, or flag it',
    summary: 'Regex. Free. Deterministic. Outranks everything that follows.',
    what:
      'Every value is normalised — Unicode minus folded to ASCII, 2.0 × 10⁻⁵ rewritten to 2.0e-5, whitespace stripped — and then looked for in the paper’s own text. Found, and sitting within 400 characters of its material or condition: confirmed. Not found: unverified. This check cannot explain why something is ungrounded and does not try; that is what the next two stages are for.',
    model: 'none — regex',
    keyPool: 'no API call',
    tier: 'none',
    calls: '0',
    file: 'src/core/validator.py',
    code: {
      lang: 'python',
      caption: 'src/core/validator.py — grounding, then attribution',
      source: `if NumericValidator._is_grounded(mv.value, norm_source) and \\
   NumericValidator._is_attributed_nearby(
       mv.value, mv.material, mv.condition, source_text
   ):
    mv.confidence = "confirmed"
else:
    mv.confidence = "unverified"`,
    },
    example: {
      label: '12% PTFE-filled SiO₂ epoxy / dry sliding, 60 N load, 140 MPa',
      value: '0.095',
      confidence: 'confirmed',
      note: 'In the text, character for character. Nothing downstream may downgrade it.',
    },
  },
  {
    id: 'crosscheck',
    index: 4,
    name: 'Crosscheck',
    verb: 'extract the paper again, blind, and diff entry by entry',
    summary: 'A cheaper model, no knowledge of the first result, compared per record.',
    what:
      'A second full extraction runs on the same paper with a different model that has never seen the primary output. Each still-unproven MetricValue is matched to its closest counterpart by material-token overlap, then by condition, and only that counterpart’s numbers are compared. If they agree, the value is confirmed. If they don’t — or if the numbers agree but the conditions share no tokens at all — it becomes crosscheck_mismatch. Values already confirmed by the validator are skipped entirely.',
    model: 'gemini-3.5-flash-lite → gemini-3.6-flash',
    keyPool: 'free keys · paid fallback',
    tier: 'free',
    calls: '1',
    file: 'src/core/crosscheck.py',
    code: {
      lang: 'python',
      caption: 'src/core/crosscheck.py — per entry, and condition has a vote',
      source: `condition_mismatch = (
    match is not None
    and mv.condition and match.condition
    and _condition_overlap(mv.condition, match.condition) == 0
)

if primary_numbers & match_numbers and not condition_mismatch:
    mv.confidence = "confirmed"
else:
    mv.confidence = "crosscheck_mismatch"`,
    },
    example: {
      label: 'PTFE composite / strong adhesion load range',
      value: '6300–8000 N',
      confidence: 'crosscheck_mismatch',
      note: 'Real flag from a real run — knowledge_base/seat_recliner.md still carries it.',
    },
  },
  {
    id: 'escalate',
    index: 5,
    name: 'Escalate',
    verb: 'send only what is still flagged to the expensive model',
    summary: 'The one stage that can bill. On a clean paper it makes zero calls.',
    what:
      'Everything still carrying unverified or crosscheck_mismatch — not the paper, not even the whole performance section, just those specific records — goes to Pro with the source text first and the figure pages second. Pro either confirms the value, corrects it, or writes “Not Reported”. It is never allowed to change which material an entry belongs to; the merge preserves the original identity and takes only the value.',
    model: 'gemini-3.1-pro-preview',
    keyPool: 'paid key, forced',
    tier: 'paid',
    calls: '0 or 1',
    file: 'src/core/escalation.py',
    code: {
      lang: 'python',
      caption: 'src/core/escalation.py — nothing flagged, nothing spent',
      source: `flagged = Escalator.collect_flagged(analysis)
if not flagged:
    Logger.success("[escalation] Nothing flagged -- skipping Pro "
                   "pass entirely (zero paid cost).")
    return 0`,
    },
    example: {
      label: 'PTFE composite / strong adhesion load range',
      value: '6300–8000 N',
      confidence: 'confirmed',
      note: 'Resolved against the source text. The material label was never up for revision.',
    },
  },
  {
    id: 'rag',
    index: 6,
    name: 'RAG optimise',
    verb: 'emit markdown and retrieval chunks in one call',
    summary: 'Three artifacts out: JSON, markdown, chunks — each traceable to the paper.',
    what:
      'Markdown and chunks used to be two prompts, each re-sending the full analysis JSON. They are one now. The chunk IDs that matter — paper_id, source_file, paper_title — are not filled by the model at all; the pipeline stamps them deterministically afterwards, so a retrieval agent can always resolve a chunk back to the exact paper it came from. That gap is the one that made an earlier internal agent untrustworthy.',
    model: 'gemini-3.6-flash → gemini-3.5-flash',
    keyPool: 'free keys · paid fallback',
    tier: 'free',
    calls: '1',
    file: 'prompts/Prompt_4_RAG_Optimization.md',
    code: {
      lang: 'python',
      caption: 'src/pipeline/pipeline.py — traceability is stamped, not generated',
      source: `for chunk in rag_output.chunks:
    chunk.paper_id = analysis.processing.paper_id
    chunk.source_file = analysis.processing.source_file
    chunk.paper_title = analysis.metadata.title`,
    },
    example: {
      label: 'chunk.paper_id',
      value: '29fbc589e4f8…5ee9ed',
      confidence: 'confirmed',
      note: 'SHA of the source PDF. Not a value the model was asked to remember.',
    },
  },
]

/**
 * Three real values, tracked in flight. Every value and every confidence
 * state below appears in knowledge_base/seat_recliner.md or in the confirmed
 * bug list in CHANGELOG_v3.md.
 */
export const SPECIMENS: Specimen[] = [
  {
    id: 'sio2',
    material: '12% PTFE-filled SiO₂ epoxy',
    condition: 'dry sliding, 60 N, 140 MPa',
    unit: 'COF',
    paper: 'A review: enhancing tribological properties of journal bearings composite materials',
    track: [
      { stage: 0, value: '—', confidence: 'unverified', note: 'not extracted yet' },
      { stage: 1, value: '0.095', confidence: 'unverified', note: 'extracted from prose' },
      { stage: 2, value: '0.095', confidence: 'unverified', note: 'no figure to check it against' },
      { stage: 3, value: '0.095', confidence: 'confirmed', note: 'found verbatim in the text' },
      { stage: 4, value: '0.095', confidence: 'confirmed', note: 'skipped — already confirmed' },
      { stage: 5, value: '0.095', confidence: 'confirmed', note: 'not flagged, not sent' },
      { stage: 6, value: '0.095', confidence: 'confirmed', note: 'written out flat, no hedge' },
    ],
  },
  {
    id: 'pa46',
    material: 'PA46-MP1100-cb',
    condition: 'dry vs 16MnCr5, 2 MPa, 0.5 m/s',
    unit: 'COF',
    paper: 'The effect of irradiated PTFE on chemically bonded PA46-PTFE-cb compounds',
    track: [
      { stage: 0, value: '—', confidence: 'unverified', note: 'Figure 6 rendered at 320 DPI' },
      { stage: 1, value: '~0.25', confidence: 'unverified', note: 'read off the chart' },
      { stage: 2, value: '~0.25', confidence: 'approximate', note: 'between gridlines — stays a tilde' },
      { stage: 3, value: '~0.25', confidence: 'approximate', note: 'validator does not downgrade this' },
      { stage: 4, value: '~0.25', confidence: 'approximate', note: 'skipped — already handled' },
      { stage: 5, value: '~0.25', confidence: 'approximate', note: 'not flagged, not sent' },
      { stage: 6, value: '~0.25', confidence: 'approximate', note: 'ships hedged, and Pro ranked it lower for it' },
    ],
  },
  {
    id: 'ptfe-load',
    material: 'PTFE composite',
    condition: 'strong adhesion load range',
    unit: 'N',
    paper: 'A review: enhancing tribological properties of journal bearings composite materials',
    track: [
      { stage: 0, value: '—', confidence: 'unverified', note: 'not extracted yet' },
      { stage: 1, value: '6300–8000', confidence: 'unverified', note: 'extracted' },
      { stage: 2, value: '6300–8000', confidence: 'unverified', note: 'no figure carries it' },
      { stage: 3, value: '6300–8000', confidence: 'unverified', note: 'not found verbatim in the text' },
      { stage: 4, value: '6300–8000', confidence: 'crosscheck_mismatch', note: 'the blind pass got something else' },
      { stage: 5, value: '6300–8000', confidence: 'confirmed', note: 'Pro found it in the source text' },
      { stage: 6, value: '6300–8000', confidence: 'confirmed', note: 'the one value on this page that cost money' },
    ],
  },
]

/** Cumulative API calls after each stage, for the meter beside the tray. */
export const CALL_METER: { free: number; paid: number }[] = [
  { free: 0, paid: 0 },
  { free: 1, paid: 0 },
  { free: 2, paid: 0 },
  { free: 2, paid: 0 },
  { free: 3, paid: 0 },
  { free: 3, paid: 1 },
  { free: 4, paid: 1 },
]
