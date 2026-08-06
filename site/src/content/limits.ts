import type { Limit } from './types'

export const RUNS = [
  { label: 'Pipeline version', value: '3.0' },
  { label: 'Papers processed', value: '6' },
  { label: 'Artifacts per paper', value: '3' },
  { label: 'Synthesis runs compared', value: '2' },
]

export const WHAT_RUNS = [
  'Per-paper pipeline end to end: ingest → extract → verify → validate → crosscheck → escalate → RAG output.',
  'Cross-paper synthesis on demand, with the requirements PDFs read as the authoritative envelope.',
  'Knowledge-base rebuild from existing JSON — no API calls, pure local reorganisation.',
  'A local GUI that orchestrates the pipeline and reports progress.',
]

export const WHAT_IS_TESTED = [
  'A full pipeline.run() dry run against a real PDF with every Gemini call mocked: table pre-extraction, figure rendering, validator, crosscheck, escalation and all three writers execute in order and produce valid output files.',
  'The 6.6E-6 / fabricated 6.6E-7 case, reproduced standalone — the new validator and crosscheck isolate and flag only the bad value where the old set-union logic passed both.',
  'The figure caption-versus-citation regex, against a real caption sentence and a real in-text citation from the same paper.',
  'Syntax and real-import checks across every module, and that all prompt files load.',
]

export const WHAT_IS_NOT_TESTED = [
  'Accuracy against a labelled ground-truth set. There isn’t one. Every accuracy claim in this project comes from reading output against source PDFs by hand.',
  'Behaviour on paper layouts outside the six in the corpus — single-column, supplementary-only figures, scanned pages with no text layer.',
  'The PFAS compliance contradiction path in the synthesis validator. The code is there and the logic is exercised by construction, but no paper in this corpus has produced a real contradiction to catch.',
  'Any non-Gemini model in any stage.',
]

export const LIMITS: Limit[] = [
  {
    id: 'correlated',
    title: 'Two Gemini models agreeing is correlated evidence',
    kind: 'evidence',
    detail:
      'The crosscheck is a different model, not an independent one. Same family, same training lineage, same failure modes on a mangled exponent or a misread axis. When they agree wrongly they agree confidently, and the value comes out confirmed. The evidence ladder ranks this below a verbatim text match for exactly that reason, but a genuinely independent second opinion would need a model from another provider in that slot.',
  },
  {
    id: 'overlap',
    title: '_material_overlap is a crude token count',
    kind: 'heuristic',
    detail:
      'Matching a primary value to its counterpart in the blind extraction is done by counting shared alphanumeric tokens in the material name, then in the condition. It works because material names in this literature are distinctive strings. It would not survive a domain where two genuinely different materials share most of their name, and it has no concept of synonymy at all.',
  },
  {
    id: 'attribution',
    title: 'Proximity is not attribution',
    kind: 'heuristic',
    detail:
      'The validator checks that a number appears within 400 characters of its material or condition tokens. That reliably catches a value attributed to a clearly unrelated material. It does not reliably catch a value mismatched to the wrong sibling row inside a tightly packed table where three materials all contain the substring “PTFE”. Solving that needs real row and column structure — which the table pre-extraction has and the validator currently isn’t given.',
  },
  {
    id: 'figurefallback',
    title: 'The figure-page fallback can point at the wrong page',
    kind: 'heuristic',
    detail:
      'When no strict caption pattern matches a figure number anywhere in the document — usually because the PDF’s text extraction broke the punctuation — the first in-text mention is used instead. That page may be several pages before the actual chart. The log warns loudly when this happens, and a value read from such a page deserves the warning.',
  },
  {
    id: 'corpus',
    title: 'Six papers is a corpus, not a benchmark',
    kind: 'coverage',
    detail:
      'Everything on this site — the confidence distribution, the observation that most low-friction candidates are fluoropolymer-based, the Flash versus Pro comparison — comes from six papers on one topic. It is enough to find bugs. It is not enough to characterise how the engine behaves on literature in general.',
  },
  {
    id: 'synthesis-net',
    title: 'Synthesis has one safety net, not three',
    kind: 'coverage',
    detail:
      'The per-paper pipeline has a deterministic check, a second model and an escalation path. Synthesis has a deterministic grounding check and nothing else: it verifies that cited paper_ids exist and that numbers in the recommendations appear in the cited papers’ extracted values. It does not re-judge the reasoning — a ranking can be perfectly cited and still badly argued, and nothing in the pipeline would notice.',
  },
  {
    id: 'domain',
    title: 'The domain layer is designed, not shipped',
    kind: 'open-question',
    detail:
      'Tab 04 covers this in full. Six metric field names are copy-pasted into three modules, the PFAS flag lives in the schema, and two relevance fields have the application in their names. The engine is domain-agnostic in architecture and domain-locked in schema, and it will stay that way until the pack refactor lands.',
  },
  {
    id: 'chunking',
    title: 'The Copilot Studio chunking question is still open',
    kind: 'open-question',
    detail:
      'The pipeline emits retrieval chunks with paper_id, source_file and paper_title stamped deterministically, so any chunk can be traced back to its exact source. What I don’t yet know is how Copilot Studio re-chunks that content on ingest, and whether the traceability fields survive the boundary. If it splits a chunk and drops the metadata, the citation guarantee ends at the door of the system it was built for.',
  },
  {
    id: 'manual-pro',
    title: 'MANUAL_PRO_VERIFY is off, and that is a bet',
    kind: 'untested',
    detail:
      'Pro does not run a full verification pass by default — only targeted escalation on flagged residuals. That is the cost-versus-coverage tradeoff inherited from Run 3, and the fixes in v3.0 closed the specific gaps that made it unsafe. It is still a bet that the free tier’s triage is catching what matters, and the honest version of that sentence is: on the six papers I checked by hand, it was.',
  },
  {
    id: 'pacific',
    title: 'The quota reset ignores daylight saving',
    kind: 'untested',
    detail:
      'Exhausted keys are cleared at the next Pacific midnight, computed with a fixed −8 hour offset and no DST handling. For a daily reset check the error is an hour, twice a year, in a direction that makes the pipeline wait slightly longer than it needs to. Documented rather than fixed.',
  },
]
