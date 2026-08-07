import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ConfidenceStamp } from './ConfidenceStamp'
import { Eyebrow } from './primitives'
import type { ConfidenceKey } from '../content/types'

interface Step {
  state: ConfidenceKey
  /** What .value reads at this point. validator/crosscheck only ever set
   * .confidence -- escalation is the one stage that can overwrite .value,
   * so the fabricated number survives unchanged until the last step. */
  value: string
  mechanism: string
  because: string
  holdMs: number
}

/**
 * The reproduction case from CHANGELOG_v3: a paper's real PPS wear rate of
 * 6.6E-6 alongside a fabricated 6.6E-7 in the same field. The old crosscheck
 * cleared both. This is what the three stages do to it now.
 */
const STEPS: Step[] = [
  {
    state: 'unverified',
    value: '6.6E-7',
    mechanism: 'validator · regex · free',
    because: 'Not found verbatim in the reflowed text. Everything starts here.',
    holdMs: 2600,
  },
  {
    state: 'crosscheck_mismatch',
    value: '6.6E-7',
    mechanism: 'crosscheck · gemini-3.5-flash-lite · free',
    because: 'The blind second extraction found a different number for the same material — 6.6E-7 didn’t reproduce.',
    holdMs: 3400,
  },
  {
    state: 'confirmed',
    value: '6.6E-6',
    mechanism: 'escalation · gemini-3.1-pro-preview · paid',
    because: 'Pro found the value stated in the paper’s own text. 6.6E-7 was never there.',
    holdMs: 0,
  },
]

export function Hero() {
  const reduce = useReducedMotion()
  const [step, setStep] = useState(reduce ? STEPS.length - 1 : 0)
  const [inView, setInView] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  // Reset to step 0 on scrolling away and let the advance effect below
  // re-run the sequence once the card is back in view, instead of the
  // animation finishing once, off-screen, with no way back to step 0
  // short of a full reload.
  useEffect(() => {
    if (reduce) return
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
        } else {
          setInView(false)
          setStep(0)
        }
      },
      { threshold: 0.2 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [reduce])

  useEffect(() => {
    if (reduce || !inView) return
    if (step >= STEPS.length - 1) return
    const t = setTimeout(() => setStep((s) => s + 1), STEPS[step].holdMs)
    return () => clearTimeout(t)
  }, [step, reduce, inView])

  const current = STEPS[step]

  return (
    <div ref={containerRef} className="border border-line-bright bg-panel">
      <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
        <Eyebrow>Specimen record · wear rate</Eyebrow>
        <span className="font-mono text-[0.6875rem] text-dimmer">CHANGELOG_v3 · fix 4 / fix 6</span>
      </div>

      <div className="px-5 py-6 md:px-7 md:py-8">
        <p className="font-mono text-xs text-dim">PPS + PTFE + MoS₂ composite</p>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={current.value}
              initial={reduce ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: 0.3 }}
              className="font-mono text-4xl leading-none tabular-nums md:text-5xl"
            >
              {current.value}
              <span className="ml-2 align-baseline text-base text-dim md:text-lg">mm³/Nm</span>
            </motion.p>
          </AnimatePresence>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={current.state}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            >
              <ConfidenceStamp state={current.state} size="md" />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* the three-state rail */}
        <div className="mt-6 flex gap-1" aria-hidden>
          {STEPS.map((s, i) => (
            <motion.span
              key={s.state}
              className="h-[3px] flex-1"
              animate={{
                backgroundColor:
                  i <= step
                    ? s.state === 'confirmed'
                      ? 'var(--color-confirmed)'
                      : s.state === 'crosscheck_mismatch'
                        ? 'var(--color-mismatch)'
                        : 'var(--color-unverified)'
                    : 'var(--color-line)',
              }}
              transition={{ duration: 0.5 }}
            />
          ))}
        </div>

        <div className="mt-4 min-h-[4.5rem]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={current.mechanism}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={{ duration: 0.35 }}
            >
              <p className="font-mono text-[0.6875rem] tracking-wide text-signal">
                {current.mechanism}
              </p>
              <p className="mt-1.5 max-w-[46ch] text-sm leading-relaxed text-dim">
                {current.because}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {reduce && (
          <ul className="mt-2 space-y-1 border-t border-line pt-3 text-xs text-dim">
            {STEPS.slice(0, -1).map((s) => (
              <li key={s.state} className="font-mono">
                {s.value} — {s.state} — {s.mechanism}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
