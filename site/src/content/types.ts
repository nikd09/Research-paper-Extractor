/**
 * Every tab renders from these types. Retargeting the site to a different
 * domain pack should be an edit to the data modules in this folder and
 * nothing else — same idea the engine itself is trying to reach.
 */

export type ConfidenceKey =
  | 'confirmed'
  | 'approximate'
  | 'derived'
  | 'unverified'
  | 'crosscheck_mismatch'
  | 'contradicts_table'
  | 'not_reported'

export interface ConfidenceState {
  key: ConfidenceKey
  /** What the stamp reads on screen. */
  label: string
  /** Tailwind colour token suffix, e.g. `confirmed` -> text-confirmed. */
  tone: string
  /** One line: what the pipeline means by this state. */
  meaning: string
  /** Which stage can set it. */
  setBy: string
  /** What a downstream consumer should do about it. */
  consequence: string
}

export interface Mechanism {
  id: string
  name: string
  model: string
  /** 'free' | 'paid' — drives whether copper is allowed to appear. */
  tier: 'free' | 'paid' | 'none'
  cost: string
  authority: string
  whatItProves: string
  whatItCannotProve: string
  file: string
}

/** One rung of the evidence hierarchy. Rendered as a ladder, not a table. */
export interface EvidenceRung {
  rank: number
  label: string
  detail: string
  produces: ConfidenceKey
  /** Short mono tag shown on the rung, e.g. 'regex, free'. */
  tag: string
}

export interface Stage {
  id: string
  index: number
  name: string
  verb: string
  /** One-sentence summary shown on the collapsed stage. */
  summary: string
  /** Long-form: what actually happens here. */
  what: string
  model: string
  keyPool: string
  tier: 'free' | 'paid' | 'none'
  calls: string
  file: string
  code: { lang: string; source: string; caption: string }
  /** A real line from a processed paper in this repo. */
  example: { label: string; value: string; confidence: ConfidenceKey; note: string }
}

/** A tracked value moving down the pipeline in the specimen tray. */
export interface Specimen {
  id: string
  material: string
  condition: string
  unit: string
  paper: string
  /** confidence + value after each stage index (0-6). */
  track: { stage: number; value: string; confidence: ConfidenceKey; note: string }[]
}

export interface LogEntry {
  id: string
  /** Run label or version the bug belongs to — the log's sense of time. */
  marker: string
  title: string
  /** What broke. */
  broke: string
  /** How it was found. */
  found: string
  /** What changed structurally. */
  changed: string
  /** Optional code, usually the fix. */
  code?: { lang: string; source: string; caption: string }
  /** Where it lives now. */
  file: string
  severity: 'data-loss' | 'silent-pass' | 'wrong-attribution' | 'wrong-input'
}

export interface DomainLock {
  where: string
  what: string
  kind: 'prompt' | 'schema' | 'code' | 'docs'
  /** Is this already swappable, or does it need the refactor? */
  status: 'swappable' | 'hardcoded' | 'duplicated'
}

export interface PackField {
  key: string
  pack01: string
  pack02: string
}

export interface Quote {
  id: string
  prompt: string
  body: string[]
  /** Until Nik edits these, they carry a visible draft marker. */
  status: 'draft-reconstruction' | 'approved'
}

export interface Limit {
  id: string
  title: string
  detail: string
  kind: 'evidence' | 'coverage' | 'heuristic' | 'untested' | 'open-question'
}
