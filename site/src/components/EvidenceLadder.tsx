import { motion, useReducedMotion } from 'framer-motion'
import { ConfidenceStamp } from './ConfidenceStamp'
import { EVIDENCE_LADDER } from '../content/confidence'

/** Bar width encodes how far a rung outranks the ones below it. */
const WIDTH = [100, 82, 63, 42, 21]

const RUNG_COLOR: Record<string, string> = {
  confirmed: 'var(--color-confirmed)',
  approximate: 'var(--color-approximate)',
  unverified: 'var(--color-unverified)',
}

export function EvidenceLadder() {
  const reduce = useReducedMotion()

  return (
    <div>
      {/* the chart field: faint calibration rules the bars are read against */}
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to right, color-mix(in oklab, var(--color-line) 70%, transparent) 0 1px, transparent 1px 20%)',
          }}
        />

        <ol className="relative">
          {EVIDENCE_LADDER.map((rung, i) => {
            const delay = i * 0.13
            return (
              <li
                key={rung.rank}
                className="border-b border-line/70 py-5 last:border-b-0 md:py-6"
              >
                <div className="flex items-stretch gap-3 md:gap-5">
                  <span className="w-6 shrink-0 pt-2.5 text-right font-mono text-xs text-dimmer md:w-8 md:text-sm">
                    {String(rung.rank).padStart(2, '0')}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <motion.div
                        className="relative flex h-10 min-w-0 items-center gap-3 border border-line-bright bg-panel-2 pr-3 pl-4 md:h-12 md:pr-4 md:pl-5"
                        style={{ width: `${WIDTH[i]}%`, transformOrigin: 'left center' }}
                        initial={reduce ? false : { scaleX: 0.03, opacity: 0 }}
                        whileInView={reduce ? undefined : { scaleX: 1, opacity: 1 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <span
                          aria-hidden
                          className="absolute inset-y-0 left-0 w-[3px]"
                          style={{ background: RUNG_COLOR[rung.produces] }}
                        />
                        <motion.span
                          className="truncate font-display text-sm font-medium tracking-wide text-text md:text-base"
                          initial={reduce ? false : { opacity: 0 }}
                          whileInView={reduce ? undefined : { opacity: 1 }}
                          viewport={{ once: true, margin: '-80px' }}
                          transition={{ duration: 0.3, delay: delay + 0.25 }}
                        >
                          {rung.label}
                        </motion.span>
                        <span className="ml-auto hidden shrink-0 pl-4 font-mono text-[0.6875rem] text-dim md:inline">
                          {rung.tag}
                        </span>
                      </motion.div>

                      <motion.div
                        className="shrink-0 sm:pl-1"
                        initial={reduce ? false : { opacity: 0, x: -6 }}
                        whileInView={reduce ? undefined : { opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.35, delay: delay + 0.35 }}
                      >
                        <ConfidenceStamp state={rung.produces} />
                      </motion.div>
                    </div>

                    <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-dim">
                      {rung.detail}
                    </p>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </div>

      {/* the axis */}
      <div className="mt-4 flex items-center gap-3">
        <span className="w-6 shrink-0 md:w-8" />
        <div className="flex-1">
          <div
            aria-hidden
            className="h-2 border-t border-line"
            style={{
              backgroundImage:
                'repeating-linear-gradient(to right, var(--color-line) 0 1px, transparent 1px 20%)',
              backgroundSize: '100% 6px',
              backgroundRepeat: 'no-repeat',
            }}
          />
          <div className="mt-1.5 flex justify-between font-mono text-[0.625rem] tracking-[0.16em] text-dimmer uppercase">
            <span>nothing</span>
            <span className="hidden sm:inline">strength of evidence</span>
            <span>the number is in the paper</span>
          </div>
        </div>
      </div>
    </div>
  )
}
