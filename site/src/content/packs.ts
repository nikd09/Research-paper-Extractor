import type { DomainLock } from './types'

/** Everywhere the seat recliner is currently welded into the engine. */
export const DOMAIN_LOCKS: DomainLock[] = [
  {
    where: 'prompts/*.md',
    what: 'Five prompt files. The intended config layer, and the one part that already works like one — swapping them retargets what the model looks for without touching Python.',
    kind: 'prompt',
    status: 'swappable',
  },
  {
    where: 'Relevance.automotive_relevance · seat_recliner_relevance',
    what: 'The field names themselves encode the use case. A different domain doesn’t want these renamed, it wants them declared.',
    kind: 'schema',
    status: 'hardcoded',
  },
  {
    where: 'MaterialEntry.contains_fluoropolymer_or_pfas · pfas_basis',
    what: 'A PFAS compliance filter sitting in the schema every paper is parsed into. Correct for this application, meaningless for most others.',
    kind: 'schema',
    status: 'hardcoded',
  },
  {
    where: 'PerformanceMetrics fields',
    what: 'friction_coefficients, wear_rates, sliding_speeds, loads, temperatures, mechanical_properties — a tribology vocabulary, fixed at the type level.',
    kind: 'schema',
    status: 'hardcoded',
  },
  {
    where: 'validator.py · crosscheck.py · escalation.py',
    what: 'The same six field names written out three times: a local list in NumericValidator.annotate, and _FIELDS in each of the other two. Add a metric to the domain and you edit three files, or you silently stop verifying one of them.',
    kind: 'code',
    status: 'duplicated',
  },
  {
    where: 'DEFAULT_ENVELOPE · docs/requirements/',
    what: 'The seat recliner spec — one as a string constant in synthesize.py, one as a folder of PDFs the synthesiser reads as authoritative.',
    kind: 'docs',
    status: 'hardcoded',
  },
  {
    where: 'seat_recliner_synthesis_<model>.md · knowledge_base/seat_recliner.md',
    what: 'Output filenames with the application baked in, written by the synthesiser and the knowledge-base builder.',
    kind: 'code',
    status: 'hardcoded',
  },
]

export interface PackDef {
  id: string
  name: string
  status: 'running' | 'illustrative'
  application: string
  requirements: string
  relevanceTargets: string[]
  compliance: string
  metrics: string[]
  benchmarks: string[]
  note: string
}

export const PACKS: PackDef[] = [
  {
    id: 'pack-01',
    name: 'Pack 01 — seat recliner sliding layer',
    status: 'running',
    application: 'Automotive seat recliner pivot bushing, PFAS-free sliding layer',
    requirements: 'docs/requirements/ — market case deck + spec & test recommendation (2 PDFs)',
    relevanceTargets: ['automotive_relevance', 'seat_recliner_relevance'],
    compliance: 'contains_fluoropolymer_or_pfas → hard exclusion, with pfas_basis recording whether the paper said so or the name implied it',
    metrics: [
      'friction_coefficients',
      'wear_rates',
      'mechanical_properties',
      'loads',
      'temperatures',
      'sliding_speeds',
    ],
    benchmarks: ['PRO100E', 'OILES Drymet LF', 'GGB DU'],
    note: 'Real. Six papers processed, three artifacts each, two synthesis runs compared.',
  },
  {
    id: 'pack-02',
    name: 'Pack 02 — slotted-rib bearing (illustrative)',
    status: 'illustrative',
    application: 'PFAS-free sliding material for a slotted-rib bearing design',
    requirements: 'packs/slotted-rib/requirements/ — whatever spec documents that programme has',
    relevanceTargets: ['bearing_relevance', 'slotted_rib_relevance'],
    compliance: 'same PFAS rule, declared by the pack rather than compiled into the schema',
    metrics: [
      'friction_coefficients',
      'wear_rates',
      'mechanical_properties',
      'press_fit_retention_force',
      'deformation_under_load',
      'temperatures',
    ],
    benchmarks: ['— whatever this programme benchmarks against'],
    note: 'Not run. Nothing has been extracted for this pack and no results exist for it. It’s here to show which lines of configuration would have to change, and nothing else.',
  },
]

export const PACK_PROPOSAL = `packs/
  seat-recliner/
    pack.yaml            # everything below, declared once
    prompts/             # the five prompt files, unchanged
    requirements/        # the spec PDFs the synthesiser already reads

# pack.yaml
name: seat-recliner
application: >
  Automotive seat recliner pivot bushing. PFAS-free sliding layer,
  benchmarked against PRO100E, OILES Drymet LF and GGB DU.

metrics:                 # replaces the six names copy-pasted into
  - friction_coefficients #   validator.py, crosscheck.py, escalation.py
  - wear_rates
  - mechanical_properties
  - loads
  - temperatures
  - sliding_speeds

relevance_targets:       # replaces Relevance's hardcoded field names
  - automotive
  - seat_recliner

compliance:              # replaces MaterialEntry's PFAS fields
  - flag: contains_fluoropolymer_or_pfas
    chemistries: [PTFE, PVDF, FEP, PFA, ETFE]
    basis_field: pfas_basis`
