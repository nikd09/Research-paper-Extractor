export interface TabDef {
  path: string
  label: string
  /** Mono index shown in the rail — the tabs are numbered like stages. */
  ord: string
  blurb: string
}

export const TABS: TabDef[] = [
  { path: '/', label: 'Overview', ord: '01', blurb: 'The thesis, and what the engine emits.' },
  {
    path: '/architecture',
    label: 'Architecture',
    ord: '02',
    blurb: 'Seven stages, and three values travelling through them.',
  },
  {
    path: '/verification',
    label: 'Verification model',
    ord: '03',
    blurb: 'The evidence hierarchy. The part worth arguing with.',
  },
  {
    path: '/domain-packs',
    label: 'Domain packs',
    ord: '04',
    blurb: 'Where the seat recliner is still welded into the schema.',
  },
  {
    path: '/case-study',
    label: 'Case study',
    ord: '05',
    blurb: 'The first configured instance: a PFAS-free sliding layer.',
  },
  {
    path: '/engineering-log',
    label: 'Engineering log',
    ord: '06',
    blurb: 'Every bug that changed the architecture.',
  },
  {
    path: '/cost-ops',
    label: 'Cost & ops',
    ord: '07',
    blurb: 'Key pools, 429s, and why a clean paper is free.',
  },
  {
    path: '/status',
    label: 'Status & limits',
    ord: '08',
    blurb: 'What runs, what is tested, what is not.',
  },
]

/** DOM id for a tab, so its panel can point back at it with aria-labelledby. */
export function tabId(path: string) {
  return `tab-${path === '/' ? 'overview' : path.slice(1)}`
}
