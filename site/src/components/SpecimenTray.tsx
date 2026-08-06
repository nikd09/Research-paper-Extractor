import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ConfidenceStamp } from './ConfidenceStamp'
import { Eyebrow } from './primitives'
import { CALL_METER, SPECIMENS, STAGES } from '../content/stages'

/**
 * Three real values from three processed papers, carried down the pipeline.
 * The tray itself moves with the active stage; the stamps cross-fade rather
 * than cut, because a state change here is the whole point of the diagram.
 */
export function SpecimenTray({ stage }: { stage: number }) {
  const reduce = useReducedMotion()
  const meter = CALL_METER[stage]

  return (
    <div className="border border-line-bright bg-panel">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line px-4 py-3">
        <Eyebrow className="whitespace-nowrap">Specimen tray</Eyebrow>
        <span className="font-mono text-[0.6875rem] whitespace-nowrap text-dim">
          stage {String(stage + 1).padStart(2, '0')} · {STAGES[stage].name.toLowerCase()}
        </span>
      </div>

      <ul className="divide-y divide-line">
        {SPECIMENS.map((sp) => {
          const t = sp.track[stage]
          return (
            <li key={sp.id} className="px-4 py-4">
              <p className="font-display text-sm font-medium text-text">{sp.material}</p>
              <p className="mt-0.5 font-mono text-[0.6875rem] text-dimmer">{sp.condition}</p>

              <div className="mt-3 flex items-center justify-between gap-3">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={t.value}
                    initial={reduce ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? undefined : { opacity: 0, y: -4 }}
                    transition={{ duration: 0.22 }}
                    className="font-mono text-xl tabular-nums text-text"
                  >
                    {t.value}
                    <span className="ml-1.5 text-xs text-dim">{t.value === '—' ? '' : sp.unit}</span>
                  </motion.span>
                </AnimatePresence>

                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={t.confidence}
                    initial={reduce ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={reduce ? undefined : { opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ConfidenceStamp state={t.confidence} />
                  </motion.span>
                </AnimatePresence>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={t.note}
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reduce ? undefined : { opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="mt-2 text-xs leading-relaxed text-dim"
                >
                  {t.note}
                </motion.p>
              </AnimatePresence>
            </li>
          )
        })}
      </ul>

      {/* cumulative call meter — free vs paid */}
      <div className="border-t border-line px-4 py-3">
        <Eyebrow className="mb-2">API calls so far</Eyebrow>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg tabular-nums text-text">{meter.free}</span>
            <span className="font-mono text-[0.6875rem] text-dim">free</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`font-mono text-lg tabular-nums ${meter.paid ? 'text-copper' : 'text-dimmer'}`}
            >
              {meter.paid}
            </span>
            <span
              className={`font-mono text-[0.6875rem] ${meter.paid ? 'text-copper' : 'text-dimmer'}`}
            >
              paid
            </span>
          </div>
          <div className="ml-auto flex gap-1" aria-hidden>
            {Array.from({ length: meter.free }).map((_, i) => (
              <span key={`f${i}`} className="h-3 w-1.5 bg-signal-dim" />
            ))}
            {Array.from({ length: meter.paid }).map((_, i) => (
              <span key={`p${i}`} className="h-3 w-1.5 bg-copper" />
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs text-dim">
          {meter.paid === 0
            ? 'Nothing has cost anything yet.'
            : 'One paid call, for one flagged value. A paper with nothing flagged never reaches this stage.'}
        </p>
      </div>
    </div>
  )
}
