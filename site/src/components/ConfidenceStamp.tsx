import type { ConfidenceKey } from '../content/types'

const TONE: Record<ConfidenceKey, { text: string; border: string; bg: string; dot: string }> = {
  confirmed: {
    text: 'text-confirmed',
    border: 'border-confirmed/45',
    bg: 'bg-confirmed/10',
    dot: 'bg-confirmed',
  },
  approximate: {
    text: 'text-approximate',
    border: 'border-approximate/45',
    bg: 'bg-approximate/10',
    dot: 'bg-approximate',
  },
  unverified: {
    text: 'text-unverified',
    border: 'border-unverified/45',
    bg: 'bg-unverified/10',
    dot: 'bg-unverified',
  },
  crosscheck_mismatch: {
    text: 'text-mismatch',
    border: 'border-mismatch/45',
    bg: 'bg-mismatch/10',
    dot: 'bg-mismatch',
  },
  contradicts_table: {
    text: 'text-contradicts',
    border: 'border-contradicts/45',
    bg: 'bg-contradicts/10',
    dot: 'bg-contradicts',
  },
  not_reported: {
    text: 'text-notreported',
    border: 'border-notreported/45',
    bg: 'bg-notreported/10',
    dot: 'bg-notreported',
  },
}

interface Props {
  state: ConfidenceKey
  size?: 'sm' | 'md'
  className?: string
}

/**
 * The lab stamp. These six hues appear nowhere else on the site, so a reader
 * can learn the legend once and then read trust off colour alone.
 */
export function ConfidenceStamp({ state, size = 'sm', className = '' }: Props) {
  const tone = TONE[state]
  const dims = size === 'md' ? 'text-[0.8125rem] px-2.5 py-1' : 'text-[0.6875rem] px-2 py-0.5'
  return (
    <span
      className={`inline-flex items-center gap-1.5 border font-mono tracking-wide whitespace-nowrap ${tone.text} ${tone.border} ${tone.bg} ${dims} ${className}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden />
      {state}
    </span>
  )
}
