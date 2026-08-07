import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react'
import { Eyebrow, PageHead, Panel } from '../components/primitives'
import { GUI_STEPS } from '../content/gui'

export function UsageGuide() {
  const reduce = useReducedMotion()
  const [active, setActive] = useState(0)
  const [lightbox, setLightbox] = useState<number | null>(null)
  const sectionRefs = useRef<(HTMLElement | null)[]>([])

  // Rail + progress line track scroll position via the real content
  // sections below, not the sticky rail itself (a sticky element can't
  // usefully observe its own position).
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = sectionRefs.current.indexOf(entry.target as HTMLElement)
            if (idx !== -1) setActive(idx)
          }
        }
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: 0 },
    )
    sectionRefs.current.forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (lightbox === null) return
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightbox(null)
      if (e.key === 'ArrowRight') setLightbox((i) => (i === null ? i : (i + 1) % GUI_STEPS.length))
      if (e.key === 'ArrowLeft')
        setLightbox((i) => (i === null ? i : (i - 1 + GUI_STEPS.length) % GUI_STEPS.length))
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [lightbox])

  function jumpTo(i: number) {
    sectionRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="space-y-16">
      <PageHead
        ord="08"
        title="Using the GUI"
        standfirst={
          <>
            <p>
              Four real screenshots of the actual desktop tool, in the order a first run through
              it goes. Double-clicking <code className="text-signal">Start GUI.bat</code> is the
              one step with nothing to screenshot — it just opens the window below.
            </p>
            <p className="mt-4">
              This replaces what used to sit on this tab. The honest status-and-limits accounting
              didn’t go away — it moved to the bottom of the engineering log, where “what’s
              actually proven” belongs next to the bugs that tested it.
            </p>
          </>
        }
      />

      <div className="grid gap-10 lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start lg:gap-14">
        {/* sticky rail — desktop only */}
        <nav
          aria-label="Jump to a step"
          className="hidden lg:sticky lg:top-24 lg:block lg:self-start"
        >
          <ol className="relative border-l border-line pl-5">
            {GUI_STEPS.map((step, i) => {
              const isActive = active === i
              return (
                <li key={step.id} className="mb-7 last:mb-0">
                  <button
                    type="button"
                    onClick={() => jumpTo(i)}
                    aria-current={isActive}
                    className="group block text-left"
                  >
                    <span
                      aria-hidden
                      className={`absolute -left-[3px] h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                        isActive ? 'scale-150 bg-signal' : 'bg-line-bright group-hover:bg-dim'
                      }`}
                    />
                    <span
                      className={`font-mono text-[0.6875rem] transition-colors ${
                        isActive ? 'text-signal' : 'text-dimmer group-hover:text-dim'
                      }`}
                    >
                      {step.n} · {step.kicker}
                    </span>
                    <p
                      className={`mt-1 text-sm leading-snug font-medium transition-colors ${
                        isActive ? 'text-text' : 'text-dimmer group-hover:text-dim'
                      }`}
                    >
                      {step.title}
                    </p>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>

        {/* the four steps, alternating image/text sides */}
        <div className="space-y-20 md:space-y-28">
          {GUI_STEPS.map((step, i) => {
            const flip = i % 2 === 1
            return (
              <motion.section
                key={step.id}
                ref={(el: HTMLElement | null) => {
                  sectionRefs.current[i] = el
                }}
                initial={reduce ? false : { opacity: 0, y: 24 }}
                whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="scroll-mt-24"
              >
                <div className={`flex flex-col gap-8 md:gap-10 lg:flex-row lg:items-center ${flip ? 'lg:flex-row-reverse' : ''}`}>
                  <button
                    type="button"
                    onClick={() => setLightbox(i)}
                    className="group relative flex w-full shrink-0 items-center justify-center overflow-hidden border border-line-bright bg-ground lg:w-[58%]"
                  >
                    <div
                      className="relative flex w-full items-center justify-center p-3 md:p-5"
                      style={{ maxHeight: '30rem' }}
                    >
                      <img
                        src={step.image}
                        alt={step.alt}
                        width={step.width}
                        height={step.height}
                        loading="lazy"
                        className="max-h-[26rem] w-auto max-w-full object-contain transition-transform duration-500 ease-out group-hover:scale-[1.02]"
                      />
                    </div>
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ground/70 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    />
                    <span className="absolute right-3 bottom-3 flex items-center gap-1.5 border border-line-bright bg-panel/90 px-2 py-1 font-mono text-[0.625rem] text-dim opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100">
                      <Maximize2 size={11} aria-hidden />
                      enlarge
                    </span>
                    <span className="absolute top-3 left-3 border border-line-bright bg-panel/90 px-2 py-0.5 font-mono text-[0.625rem] text-signal backdrop-blur-sm">
                      {step.n}
                    </span>
                  </button>

                  <div className="lg:w-[42%]">
                    <Eyebrow className="mb-2">{step.kicker}</Eyebrow>
                    <h2 className="text-2xl leading-tight font-semibold md:text-[1.75rem]">
                      {step.title}
                    </h2>
                    <p className="mt-4 max-w-[52ch] text-[0.9375rem] leading-relaxed text-dim">
                      {step.caption}
                    </p>
                  </div>
                </div>
              </motion.section>
            )
          })}
        </div>
      </div>

      <Panel className="p-5 md:p-8">
        <Eyebrow className="mb-3">One thing the screenshots don’t show</Eyebrow>
        <p className="max-w-[68ch] text-sm leading-relaxed text-dim">
          The GUI is a thin front end over the same <code className="text-signal">pipeline.run()</code> covered
          on Tab 02 — the Prompt Model dropdown and the free/paid routing behind it, the five
          console checkpoints, the Knowledge Base build — all of it is the engine already
          described on this site, wearing a window instead of a terminal. Nothing about running it
          from the GUI changes what a confidence state means or what gets escalated.
        </p>
      </Panel>

      <AnimatePresence>
        {lightbox !== null && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={GUI_STEPS[lightbox].title}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ground/95 p-4 backdrop-blur-sm md:p-10"
            onClick={() => setLightbox(null)}
          >
            <button
              type="button"
              onClick={() => setLightbox(null)}
              aria-label="Close"
              className="absolute top-4 right-4 border border-line-bright bg-panel p-2 text-dim transition-colors hover:text-signal md:top-6 md:right-6"
            >
              <X size={18} aria-hidden />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setLightbox((i) => (i === null ? i : (i - 1 + GUI_STEPS.length) % GUI_STEPS.length))
              }}
              aria-label="Previous screenshot"
              className="absolute left-2 border border-line-bright bg-panel p-2 text-dim transition-colors hover:text-signal md:left-6"
            >
              <ChevronLeft size={20} aria-hidden />
            </button>

            <motion.img
              key={lightbox}
              initial={reduce ? false : { opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
              src={GUI_STEPS[lightbox].image}
              alt={GUI_STEPS[lightbox].alt}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[82vh] max-w-[88vw] border border-line-bright object-contain"
            />

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setLightbox((i) => (i === null ? i : (i + 1) % GUI_STEPS.length))
              }}
              aria-label="Next screenshot"
              className="absolute right-2 border border-line-bright bg-panel p-2 text-dim transition-colors hover:text-signal md:right-6"
            >
              <ChevronRight size={20} aria-hidden />
            </button>

            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 font-mono text-[0.6875rem] text-dim md:bottom-6">
              <span className="text-signal">{GUI_STEPS[lightbox].n}</span>
              <span>{GUI_STEPS[lightbox].title}</span>
              <span className="text-dimmer">
                · {lightbox + 1} / {GUI_STEPS.length}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
