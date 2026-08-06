import type { ConfidenceState, EvidenceRung, Mechanism } from './types'

/**
 * Source of truth: schemas/paper_schema.py (MetricValue.confidence) and the
 * three modules that write it — src/core/validator.py, crosscheck.py,
 * escalation.py.
 */
export const CONFIDENCE_STATES: ConfidenceState[] = [
  {
    key: 'confirmed',
    label: 'confirmed',
    tone: 'confirmed',
    meaning:
      'Found verbatim in the paper’s text or table, or read exactly off a labelled gridline.',
    setBy: 'validator (free) · verify (free) · crosscheck (free) · escalation (paid)',
    consequence: 'Quote it. This is the only state a retrieval agent should state flatly.',
  },
  {
    key: 'approximate',
    label: 'approximate',
    tone: 'approximate',
    meaning:
      'Read off a chart between gridlines. The shape of the curve is right; the third digit is a guess.',
    setBy: 'verify (free, multimodal)',
    consequence: 'Usable for ranking, not for a spec sheet. Downstream text keeps the ~.',
  },
  {
    key: 'unverified',
    label: 'unverified',
    tone: 'unverified',
    meaning:
      'Not found in the source text by the deterministic check, and nothing since has vouched for it. Also the schema default.',
    setBy: 'validator (free) — and every MetricValue starts here',
    consequence: 'Hedge it, or send it to escalation. Never present it as a measurement.',
  },
  {
    key: 'crosscheck_mismatch',
    label: 'crosscheck_mismatch',
    tone: 'mismatch',
    meaning:
      'A second, independent extraction of the same paper produced a different number for this material and condition — and neither side could be confirmed against text.',
    setBy: 'crosscheck (free, Flash-Lite)',
    consequence: 'Escalate. Two models disagreeing is the cheapest useful alarm in the system.',
  },
  {
    key: 'contradicts_table',
    label: 'contradicts_table',
    tone: 'contradicts',
    meaning:
      'The prose and the table disagree with each other about the same material and condition. Both records are kept, one per source.',
    setBy: 'extract / verify (free)',
    consequence:
      'Surface both and say where each came from. Silently picking a winner here is how a paper’s own inconsistency becomes the pipeline’s fabrication.',
  },
  {
    key: 'not_reported',
    label: 'not_reported',
    tone: 'notreported',
    meaning: 'Genuinely unrecoverable from both text and figures.',
    setBy: 'escalation (paid)',
    consequence:
      'Say nothing. A missing value costs an engineer ten minutes with a PDF; a confident wrong one costs a material decision.',
  },
]

export const MECHANISMS: Mechanism[] = [
  {
    id: 'validator',
    name: 'Deterministic validator',
    model: 'no model — regex',
    tier: 'none',
    cost: 'free, ~milliseconds',
    authority: 'Highest. It is the only check that can be wrong in a way I can debug.',
    whatItProves:
      'This exact number, normalised for scientific notation, Unicode minus signs and spacing, exists in the text the paper actually contains — and at least one occurrence of it sits within 400 characters of the material or condition it was filed under.',
    whatItCannotProve:
      'That the occurrence it found is the right one. Inside a tightly packed table where three rows all contain the substring “PTFE”, proximity is not attribution.',
    file: 'src/core/validator.py',
  },
  {
    id: 'crosscheck',
    name: 'Independent crosscheck',
    model: 'gemini-3.5-flash-lite',
    tier: 'free',
    cost: 'free tier, one call per paper',
    authority:
      'Middle. It runs the same extraction prompt again with zero knowledge of the first result, then compares entry by entry.',
    whatItProves:
      'That a value not present in the reflowed text — almost always a chart read — was arrived at twice, independently, for the closest-matching material and condition.',
    whatItCannotProve:
      'Independence. Two Gemini models are correlated evidence, not replication. They share training data and they share failure modes; when they agree on a misread axis they agree confidently.',
    file: 'src/core/crosscheck.py',
  },
  {
    id: 'escalation',
    name: 'Escalation',
    model: 'gemini-3.1-pro-preview',
    tier: 'paid',
    cost: 'paid key, forced — the only stage that can bill',
    authority:
      'Last, not highest. It sees only the values still flagged after everything else, plus the source text and the figure pages they should have come from.',
    whatItProves:
      'Nothing on its own. It resolves a value, or it writes “Not Reported”. It is never allowed to re-label which material an entry belongs to — that path caused a real misattribution bug once and is now closed by construction.',
    whatItCannotProve:
      'That the flag was fair. It inherits the validator’s judgement, and for a while it inherited a false one and destroyed a correct value with it.',
    file: 'src/core/escalation.py',
  },
]

/**
 * The precedence ladder. Rung 1 outranks rung 5, and the ordering is
 * enforced in code, not by which stage happens to run last.
 */
export const EVIDENCE_LADDER: EvidenceRung[] = [
  {
    rank: 1,
    label: 'Verbatim text match',
    detail:
      'The number is in the paper. Not close to it, not consistent with it — in it, after folding U+2212 to a hyphen and 2.0 × 10⁻⁵ to 2.0e-5.',
    produces: 'confirmed',
    tag: 'regex · free',
  },
  {
    rank: 2,
    label: 'Exact gridline read',
    detail:
      'Not in the text, but sitting on a labelled gridline of a chart the model was pointed directly at — page rendered at 320 DPI, figure number named in the manifest.',
    produces: 'confirmed',
    tag: 'vision · free',
  },
  {
    rank: 3,
    label: 'Independent agreement',
    detail:
      'A second extraction, run blind on the same paper, produced the same number for the best material match — and its condition string shares at least one token with the original.',
    produces: 'confirmed',
    tag: 'flash-lite · free',
  },
  {
    rank: 4,
    label: 'Interpolation',
    detail:
      'A chart read between gridlines. The value is honest about being a visual estimate and stays that way through every downstream consumer.',
    produces: 'approximate',
    tag: 'vision · free',
  },
  {
    rank: 5,
    label: 'Nothing',
    detail:
      'No text match, no agreement, no readable figure. The default the schema starts in and the state it stays in unless something earns better.',
    produces: 'unverified',
    tag: 'default',
  },
]

/** The four lines that make the ladder real. src/core/crosscheck.py:107 */
export const PRECEDENCE_CODE = `for mv in primary_values:
    if mv.confidence in ("approximate", "not_reported",
                         "confirmed", "contradicts_table"):
        # "confirmed" already passed the deterministic text-
        # grounding check in validator.py -- that's a stronger
        # signal than an independent Flash-Lite re-extraction,
        # so don't let crosscheck downgrade it.
        continue`

/** Why the default is the hedged state and not the confident one. */
export const FAIL_CLOSED_CODE = `class MetricValue(BaseModel):
    material: str = ""       # e.g. "PA46-MP1100-cb"
    condition: str = ""      # e.g. "dry, 20 MPa"
    value: str = ""          # e.g. "6.6E-6 mm3 Nm^-1"
    unit: str = ""
    source: str = ""         # "text" | "Table 3" | "Figure 19"

    confidence: str = "unverified"   # <- the default matters`
