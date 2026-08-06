import type { ConfidenceKey } from './types'

/** Straight out of docs/requirements/ — the two Saint-Gobain PDFs. */
export const SPEC = [
  { label: 'Surface pressure', value: '110', unit: 'MPa', note: 'linear bearing tester' },
  { label: 'Speed', value: '35', unit: 'mm/s', note: 'oscillating, not continuous' },
  { label: 'Cycles', value: '33,750', unit: '', note: '6,750 durability cycles × 5 rotations' },
  { label: 'Movement', value: '±52', unit: '°', note: 'CW/CCW, 5 shaft rotations each' },
  { label: 'Operating range', value: '−45 … +93', unit: '°C', note: 'storage to +120 °C' },
  { label: 'Welding excursion', value: '>200', unit: '°C', note: 'max 30 s; +210 °C 1 h cataphoresis' },
  { label: 'Compression test', value: '400', unit: 'MPa', note: 'deformation under load' },
  { label: 'Press-fit retention', value: '>1000', unit: 'N', note: 'at ⌀35 +0.021/0 housing' },
]

export const BENCHMARKS = ['PRO100E', 'OILES Drymet LF', 'GGB DU']

export interface ExtractedRow {
  material: string
  condition: string
  value: string
  unit: string
  confidence: ConfidenceKey
  pfas: boolean
}

/**
 * Real rows from knowledge_base/seat_recliner.md, produced by the pipeline
 * over the six-paper corpus. Confidence states are the ones the run actually
 * assigned.
 */
export const EXTRACTED: ExtractedRow[] = [
  {
    material: 'PTFE (unreinforced)',
    condition: 'dry',
    value: '0.02–0.04',
    unit: 'COF',
    confidence: 'confirmed',
    pfas: true,
  },
  {
    material: 'Copper-fluoroplastic composite coating',
    condition: 'non-lubricated dry friction',
    value: '0.085',
    unit: 'COF',
    confidence: 'confirmed',
    pfas: true,
  },
  {
    material: '12% PTFE-filled SiO₂ epoxy',
    condition: 'dry sliding, 60 N, 140 MPa',
    value: '0.095',
    unit: 'COF',
    confidence: 'confirmed',
    pfas: true,
  },
  {
    material: 'Composite K (epoxy + UHMWPE + MoS₂ + Kevlar)',
    condition: 'PV = 19.8 → 46.25 MPa·m/s',
    value: '0.09–0.07',
    unit: 'COF',
    confidence: 'confirmed',
    pfas: false,
  },
  {
    material: 'iglidur P210',
    condition: 'technical dry friction',
    value: '0.124',
    unit: 'COF',
    confidence: 'confirmed',
    pfas: false,
  },
  {
    material: 'NORDEN Marine 605',
    condition: 'dry running, 115 N, 0.15 mm clearance',
    value: '0.184',
    unit: 'COF',
    confidence: 'confirmed',
    pfas: true,
  },
  {
    material: 'PA46-MP1100-cb',
    condition: 'dry vs 16MnCr5, 2 MPa, 0.5 m/s',
    value: '~0.25',
    unit: 'COF',
    confidence: 'approximate',
    pfas: true,
  },
  {
    material: '12% PTFE-filled SiO₂ epoxy',
    condition: 'dry sliding, 60 N, 140 MPa',
    value: '8.4 × 10⁻⁷',
    unit: 'mm³/Nm',
    confidence: 'confirmed',
    pfas: true,
  },
  {
    material: 'Composite B (epoxy + UHMWPE + MoS₂ + base oil)',
    condition: 'PV = 37.0 MPa·m/s',
    value: '5.77 × 10⁻⁶',
    unit: 'mm³/Nm',
    confidence: 'confirmed',
    pfas: false,
  },
  {
    material: 'PTFE composite',
    condition: 'strong adhesion load range',
    value: '6300–8000',
    unit: 'N',
    confidence: 'crosscheck_mismatch',
    pfas: true,
  },
]

export interface SynthesisDiff {
  aspect: string
  flash: string
  pro: string
}

/**
 * Both runs, same six papers, same prompt, same hand-typed envelope.
 * knowledge_base/seat_recliner_synthesis_flash.md vs …_pro.md.
 */
export const SYNTHESIS_DIFF: SynthesisDiff[] = [
  {
    aspect: 'Materials ranked',
    flash: '6',
    pro: '5',
  },
  {
    aspect: 'Top pick',
    flash: 'PA46-MP1100-cb / PA46-MP1200-cb — the chemically bonded irradiated-PTFE compounds',
    pro: 'PTFE (unlubricated), as a liner or filler rather than a bulk bushing',
  },
  {
    aspect: 'What it did with approximate values',
    flash:
      'Ranked PA46 first on numbers read off a chart, then noted at the end of the entry that they were approximate chart reads.',
    pro: 'Demoted the same material to fifth and said why in the rationale: the friction values cited for it were classified as approximate chart reads in the data.',
  },
  {
    aspect: 'The oil-containing composite',
    flash:
      'Kept Composite B at #5 for its 0.056 friction coefficient, with the upholstery contamination risk listed as a tradeoff.',
    pro: 'Left it out of the ranking entirely.',
  },
  {
    aspect: 'Stiction and squeak',
    flash:
      'Listed acoustic performance — squeak, stick-slip, tactile feel — as untested across all six papers.',
    pro:
      'Said the same, then reasoned from it: the corpus reports only steady-state dynamic friction, so the static-to-dynamic gap that actually drives squeak has to be inferred rather than read. That gap is a named line in the spec.',
  },
  {
    aspect: 'Corpus gaps found',
    flash: '4 — no oscillatory testing, unusable engine-bearing paper, no sub-zero data, no acoustics',
    pro: '3 — no oscillatory low-speed data, no static friction measurements, engine plain bearings unsuitable',
  },
]
