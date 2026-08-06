import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Play, Square } from 'lucide-react'
import { CodeBlock } from '../components/CodeBlock'
import { ConfidenceStamp } from '../components/ConfidenceStamp'
import { SpecimenTray } from '../components/SpecimenTray'
import {
  Eyebrow,
  FileRef,
  FreeTag,
  PageHead,
  PaidTag,
  Panel,
  Prose,
  SectionHead,
} from '../components/primitives'
import { STAGES } from '../content/stages'

export function Architecture() {
  const [active, setActive] = useState(0)
  const [running, setRunning] = useState(false)
  const [trayY, setTrayY] = useState(0)
  const reduce = useReducedMotion()

  const rowRefs = useRef<(HTMLLIElement | null)[]>([])
  const listRef = useRef<HTMLOListElement>(null)

  // The tray rides alongside the pipeline: measure where the open stage sits
  // and glide to it. Measured after render, so an expanded row is included.
  // Rects rather than offsetTop — the two elements have different offset
  // parents, and mixing them puts the tray 500px up the page.
  useLayoutEffect(() => {
    function measure() {
      const row = rowRefs.current[active]
      const list = listRef.current
      if (!row || !list) return
      setTrayY(row.getBoundingClientRect().top - list.getBoundingClientRect().top)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [active])

  useEffect(() => {
    if (!running) return
    if (active === STAGES.length - 1) {
      setRunning(false)
      return
    }
    const t = setTimeout(() => setActive((a) => Math.min(a + 1, STAGES.length - 1)), 1900)
    return () => clearTimeout(t)
  }, [running, active])

  function run() {
    if (running) {
      setRunning(false)
      return
    }
    setActive(0)
    setRunning(true)
  }

  return (
    <div className="space-y-24 md:space-y-32">
      <PageHead
        ord="02"
        title="Seven stages"
        standfirst={
          <>
            <p>
              Three of them make a model call on the free tier. Two make no call at all. One can
              bill, and on a clean paper it doesn’t run.
            </p>
            <p className="mt-4">
              Click any stage to open it. Or press run and watch three real values — pulled from
              three papers in this repo — travel down the pipeline and change state.
            </p>
          </>
        }
      />

      <section>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <SectionHead ord="2.1" title="The pipeline" />
          <button
            type="button"
            onClick={run}
            aria-pressed={running}
            className="inline-flex items-center gap-2 border border-signal/50 bg-signal/10 px-4 py-2 font-mono text-xs tracking-wide text-signal transition-colors hover:bg-signal/20"
          >
            {running ? <Square size={13} aria-hidden /> : <Play size={13} aria-hidden />}
            {running ? 'stop' : 'run the pipeline'}
          </button>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <ol ref={listRef} className="relative space-y-px">
            {STAGES.map((stage, i) => {
              const open = i === active
              return (
                <li
                  key={stage.id}
                  ref={(el) => {
                    rowRefs.current[i] = el
                  }}
                  className={`border ${open ? 'border-signal/45 bg-panel' : 'border-line bg-panel/50'}`}
                >
                  <h3>
                    <button
                      type="button"
                      onClick={() => {
                        setRunning(false)
                        setActive(i)
                      }}
                      aria-expanded={open}
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-panel-2 md:gap-4 md:px-5"
                    >
                      <span className={`font-mono text-xs ${open ? 'text-signal' : 'text-dimmer'}`}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-base font-medium md:text-lg">
                          {stage.name}
                        </span>
                        <span className="mt-0.5 block text-sm text-dim">{stage.summary}</span>
                      </span>
                      <span className="hidden shrink-0 sm:block">
                        {stage.tier === 'paid' ? (
                          <PaidTag>{stage.calls} call</PaidTag>
                        ) : (
                          <FreeTag>
                            {stage.calls} {stage.tier === 'none' ? 'calls' : 'call'}
                          </FreeTag>
                        )}
                      </span>
                    </button>
                  </h3>

                  {open && (
                    <div className="border-t border-line px-4 pt-5 pb-6 md:px-5">
                      <p className="mb-5 max-w-[68ch] text-[0.9375rem] leading-[1.7] text-dim">
                        {stage.what}
                      </p>

                      <dl className="mb-5 grid gap-px border border-line bg-line text-xs sm:grid-cols-3">
                        <div className="bg-panel-2 p-3">
                          <dt className="eyebrow mb-1">Model</dt>
                          <dd
                            className={`font-mono ${stage.tier === 'paid' ? 'text-copper' : 'text-text'}`}
                          >
                            {stage.model}
                          </dd>
                        </div>
                        <div className="bg-panel-2 p-3">
                          <dt className="eyebrow mb-1">Key pool</dt>
                          <dd
                            className={`font-mono ${stage.tier === 'paid' ? 'text-copper' : 'text-text'}`}
                          >
                            {stage.keyPool}
                          </dd>
                        </div>
                        <div className="bg-panel-2 p-3">
                          <dt className="eyebrow mb-1">Calls per paper</dt>
                          <dd
                            className={`font-mono ${stage.tier === 'paid' ? 'text-copper' : 'text-text'}`}
                          >
                            {stage.calls}
                          </dd>
                        </div>
                      </dl>

                      <CodeBlock
                        code={stage.code.source}
                        lang={stage.code.lang}
                        caption={stage.code.caption}
                      />

                      <div className="mt-5 border border-line bg-panel-2 p-4">
                        <Eyebrow className="mb-3">From a processed paper</Eyebrow>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-mono text-xs text-dim">{stage.example.label}</p>
                            <p className="mt-1 font-mono text-lg tabular-nums">
                              {stage.example.value}
                            </p>
                          </div>
                          <ConfidenceStamp state={stage.example.confidence} size="md" />
                        </div>
                        <p className="mt-3 text-sm text-dim">{stage.example.note}</p>
                      </div>

                      <div className="mt-4">
                        <FileRef path={stage.file} />
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ol>

          {/* desktop: the tray travels down beside the stages */}
          <div className="relative hidden lg:block">
            <motion.div
              className="absolute top-0 right-0 left-0"
              animate={{ y: trayY }}
              transition={
                reduce ? { duration: 0 } : { type: 'spring', stiffness: 90, damping: 20, mass: 0.9 }
              }
            >
              <SpecimenTray stage={active} />
            </motion.div>
          </div>

          {/* narrow: no travel, same data */}
          <div className="lg:hidden">
            <SpecimenTray stage={active} />
          </div>
        </div>
      </section>

      <section>
        <SectionHead ord="2.2" title="What the stage list is actually saying" />
        <div className="grid gap-8 lg:grid-cols-2">
          <Prose>
            <p>
              Read the pipeline as a triage funnel rather than a sequence and it makes more sense.
              Extraction is cheap and generous — it pulls everything it can find. Every stage after
              it exists to shrink the set of claims that still need an opinion from something
              expensive.
            </p>
            <p>
              By the time anything reaches Pro, the free tier has resolved almost all of it, and
              what’s left is small enough to send as a list of individual records instead of a
              document. That’s the whole cost argument. It only works because the cheap checks are
              trusted more than the expensive one, not less.
            </p>
          </Prose>
          <Panel className="p-5 md:p-6">
            <Eyebrow className="mb-4">Per paper, in practice</Eyebrow>
            <dl className="space-y-3 font-mono text-sm">
              <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
                <dt className="text-dim">prompt-driven calls</dt>
                <dd>3</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
                <dt className="text-dim">+ blind crosscheck extraction</dt>
                <dd>1</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
                <dt className="text-dim">stages with no API call</dt>
                <dd>2</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-copper">paid calls, clean paper</dt>
                <dd className="text-copper">0</dd>
              </div>
            </dl>
            <p className="mt-4 text-sm text-dim">
              Five prompts became three when understanding merged with extraction, and markdown
              merged with chunking. The crosscheck reuses the extraction prompt verbatim — a
              different prompt would have made disagreement mean less.
            </p>
          </Panel>
        </div>
      </section>
    </div>
  )
}
