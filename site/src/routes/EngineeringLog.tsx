import { useState } from 'react'
import { Check, ChevronDown, CircleDashed, X } from 'lucide-react'
import { CodeBlock } from '../components/CodeBlock'
import { PullQuote } from '../components/PullQuote'
import { Eyebrow, FileRef, PageHead, Panel, Prose, SectionHead } from '../components/primitives'
import { LOG } from '../content/bugs'
import { LIMITS, RUNS, WHAT_IS_NOT_TESTED, WHAT_IS_TESTED, WHAT_RUNS } from '../content/limits'
import { QUOTES } from '../content/quotes'
import type { Limit, LogEntry } from '../content/types'

const KIND_LABEL: Record<Limit['kind'], string> = {
  evidence: 'evidence',
  coverage: 'coverage',
  heuristic: 'heuristic',
  untested: 'untested',
  'open-question': 'open question',
}

const SEVERITY: Record<LogEntry['severity'], { label: string; className: string }> = {
  'data-loss': { label: 'data loss', className: 'text-mismatch border-mismatch/40 bg-mismatch/10' },
  'silent-pass': {
    label: 'silent pass',
    className: 'text-unverified border-unverified/40 bg-unverified/10',
  },
  'wrong-attribution': {
    label: 'wrong attribution',
    className: 'text-approximate border-approximate/40 bg-approximate/10',
  },
  'wrong-input': {
    label: 'wrong input',
    className: 'text-contradicts border-contradicts/40 bg-contradicts/10',
  },
}

/** Where a pull quote sits in the log. */
const QUOTE_AFTER: Record<string, keyof typeof QUOTES> = {
  run3: 'wrongBelief',
  setunion: 'confidentlyWrong',
  dataloss: 'costliestBug',
}

function entryAnchor(id: string) {
  return `log-${id}`
}

export function EngineeringLog() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [severityFilter, setSeverityFilter] = useState<LogEntry['severity'] | null>(null)
  const [expandedLimits, setExpandedLimits] = useState<Record<string, boolean>>({})
  const [limitFilter, setLimitFilter] = useState<Limit['kind'] | null>(null)

  function toggle(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function jumpTo(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: true }))
    document.getElementById(entryAnchor(id))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const visibleLog = severityFilter ? LOG.filter((e) => e.severity === severityFilter) : LOG

  return (
    <div className="space-y-16">
      <PageHead
        ord="06"
        title="Engineering log"
        standfirst={
          <>
            <p>
              Ten things that broke, in the order they changed the architecture. None of them
              threw an exception. Every one of them produced output that looked exactly like output
              that worked.
            </p>
            <p className="mt-4">
              That’s the pattern, and it’s why the verification model looks the way it does. A
              pipeline that runs clean tells you nothing about whether it was right.
            </p>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-4 border-y border-line py-3 font-mono text-[0.6875rem] text-dim">
        <span className="text-signal">{LOG.length} entries</span>
        <span className="text-dimmer">·</span>
        <span>run 2 → run 3 → v3.0</span>
        <span className="ml-auto hidden sm:inline text-dimmer">
          click a title to expand · click a marker to jump and expand
        </span>
      </div>

      {/* severity filter */}
      <div role="group" aria-label="Filter by severity" className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSeverityFilter(null)}
          aria-pressed={severityFilter === null}
          className={`border px-2.5 py-1 font-mono text-[0.6875rem] tracking-wide transition-colors ${
            severityFilter === null
              ? 'border-signal/50 bg-signal/15 text-signal'
              : 'border-line-bright text-dim hover:bg-panel-2'
          }`}
        >
          all ({LOG.length})
        </button>
        {(Object.keys(SEVERITY) as LogEntry['severity'][]).map((key) => {
          const count = LOG.filter((e) => e.severity === key).length
          const sev = SEVERITY[key]
          const active = severityFilter === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSeverityFilter(active ? null : key)}
              aria-pressed={active}
              className={`border px-2.5 py-1 font-mono text-[0.6875rem] tracking-wide transition-colors ${
                active ? sev.className : 'border-line-bright text-dim hover:bg-panel-2'
              }`}
            >
              {sev.label} ({count})
            </button>
          )
        })}
      </div>

      <ol className="relative">
        {/* the spine */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-2 bottom-0 left-[0.5625rem] w-px bg-line md:left-[3.4375rem]"
        />

        {visibleLog.map((entry) => {
          const i = LOG.indexOf(entry)
          const sev = SEVERITY[entry.severity]
          const quoteKey = QUOTE_AFTER[entry.id]
          const isOpen = !!expanded[entry.id]
          return (
            <li key={entry.id} id={entryAnchor(entry.id)} className="relative scroll-mt-24 pb-16 md:pb-24">
              <div className="grid grid-cols-1 gap-x-8 md:grid-cols-[7rem_minmax(0,1fr)]">
                {/* marker column */}
                <div className="relative mb-4 md:mb-0 md:text-right">
                  <button
                    type="button"
                    onClick={() => jumpTo(entry.id)}
                    aria-label={`Jump to and expand: ${entry.title}`}
                    className="group absolute top-[0.1875rem] left-0 flex h-5 w-5 -translate-x-[0.1875rem] items-center justify-center md:left-auto md:-right-[1.6875rem]"
                  >
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 rounded-full border border-line-bright bg-ground transition-colors group-hover:border-signal group-hover:bg-signal/20"
                    />
                  </button>
                  <div className="pl-8 md:pl-0">
                    <p className="font-mono text-[0.6875rem] text-signal">
                      {String(i + 1).padStart(2, '0')}
                    </p>
                    <p className="mt-1 font-mono text-[0.6875rem] leading-relaxed text-dimmer">
                      {entry.marker}
                    </p>
                  </div>
                </div>

                {/* entry */}
                <article className="pl-8 md:pl-0">
                  <h2 className="text-2xl leading-tight font-semibold md:text-[1.75rem]">
                    <button
                      type="button"
                      onClick={() => toggle(entry.id)}
                      aria-expanded={isOpen}
                      className="group flex w-full flex-wrap items-start gap-3 text-left"
                    >
                      <ChevronDown
                        size={18}
                        aria-hidden
                        className={`mt-1.5 shrink-0 text-dimmer transition-transform group-hover:text-signal ${
                          isOpen ? 'rotate-0' : '-rotate-90'
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-3">
                          <span>{entry.title}</span>
                          <span
                            className={`border px-2 py-0.5 font-mono text-[0.625rem] tracking-wide ${sev.className}`}
                          >
                            {sev.label}
                          </span>
                        </span>
                        {!isOpen && (
                          <span className="mt-2 block max-w-[64ch] truncate text-sm font-normal text-dim">
                            {entry.broke}
                          </span>
                        )}
                      </span>
                    </button>
                  </h2>

                  {isOpen && (
                    <div className="mt-5 pl-[1.875rem]">
                      <div className="space-y-5">
                        <Movement label="What broke">{entry.broke}</Movement>
                        <Movement label="How I found it">{entry.found}</Movement>
                        <Movement label="What changed">{entry.changed}</Movement>
                      </div>

                      {entry.code && (
                        <div className="mt-6">
                          <CodeBlock
                            code={entry.code.source}
                            lang={entry.code.lang}
                            caption={entry.code.caption}
                          />
                        </div>
                      )}

                      <div className="mt-4">
                        <FileRef path={entry.file} />
                      </div>

                      {quoteKey && (
                        <div className="mt-10">
                          <PullQuote quote={QUOTES[quoteKey]} />
                        </div>
                      )}
                    </div>
                  )}
                </article>
              </div>
            </li>
          )
        })}
      </ol>

      <section className="border-t border-line pt-10">
        <Eyebrow className="mb-4">What the list has in common</Eyebrow>
        <Prose>
          <p>
            Eight of the ten were found by reading output against a source document by hand. One was
            found by source review. One was found by testing a heuristic against real sentences from
            a real paper. Zero were found by a test suite, a log line, or an exception — the tests in
            this repo check that the pipeline runs and that the shapes are right, which is a
            different question from whether the numbers are.
          </p>
          <p>
            That ratio is the argument for the whole verification model. If the only reliable
            detector of a wrong number is a person with the PDF open, then the system’s job is to
            narrow down which numbers that person has to look at.
          </p>
        </Prose>
      </section>

      {/* ------------------------------------------------ known limitations */}
      <section className="border-t border-line pt-16">
        <Eyebrow className="mb-3">Moved from Tab 08</Eyebrow>
        <SectionHead ord="6.1" title="Known limitations">
          <p>
            Version 3.0. It runs, on six papers, on one domain, against no labelled ground truth.
            This is what I know is weak about it — the same honest accounting that used to live on
            its own tab, now sitting next to the bugs that produced it.
          </p>
        </SectionHead>

        <ul className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {RUNS.map((r) => (
            <li key={r.label} className="bg-panel p-5">
              <p className="font-mono text-3xl leading-none tabular-nums">{r.value}</p>
              <p className="mt-2 text-sm text-dim">{r.label}</p>
            </li>
          ))}
        </ul>

        <div className="mt-12">
          <SectionHead ord="6.2" title="What runs, what’s tested, what isn’t" />
          <div className="grid gap-px border border-line bg-line lg:grid-cols-3">
            <Column icon="runs" title="Runs today" items={WHAT_RUNS} />
            <Column icon="tested" title="Tested" items={WHAT_IS_TESTED} />
            <Column icon="untested" title="Not tested" items={WHAT_IS_NOT_TESTED} />
          </div>
          <p className="mt-6 max-w-[70ch] text-sm text-dim">
            The gap between the middle column and the right one is the honest shape of this
            project. The tests prove the pipeline executes and that specific historical bugs stay
            fixed. They prove nothing about accuracy, because measuring accuracy needs a labelled
            set and building one for tribology papers is its own project.
          </p>
        </div>

        <div className="mt-12">
          <SectionHead ord="6.3" title="Ten limits">
            <p>In the order I’d want a reviewer to push on. Click one to expand it, or filter by kind.</p>
          </SectionHead>

          <div role="group" aria-label="Filter limits by kind" className="mb-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setLimitFilter(null)}
              aria-pressed={limitFilter === null}
              className={`border px-2.5 py-1 font-mono text-[0.6875rem] tracking-wide transition-colors ${
                limitFilter === null
                  ? 'border-signal/50 bg-signal/15 text-signal'
                  : 'border-line-bright text-dim hover:bg-panel-2'
              }`}
            >
              all ({LIMITS.length})
            </button>
            {(Object.keys(KIND_LABEL) as Limit['kind'][]).map((kind) => {
              const count = LIMITS.filter((l) => l.kind === kind).length
              if (!count) return null
              const active = limitFilter === kind
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setLimitFilter(active ? null : kind)}
                  aria-pressed={active}
                  className={`border px-2.5 py-1 font-mono text-[0.6875rem] tracking-wide transition-colors ${
                    active
                      ? 'border-signal/50 bg-signal/15 text-signal'
                      : 'border-line-bright text-dim hover:bg-panel-2'
                  }`}
                >
                  {KIND_LABEL[kind]} ({count})
                </button>
              )
            })}
          </div>

          <ol className="space-y-px border border-line bg-line">
            {LIMITS.filter((l) => !limitFilter || l.kind === limitFilter).map((l) => {
              const i = LIMITS.indexOf(l)
              const isOpen = !!expandedLimits[l.id]
              return (
                <li key={l.id} className="bg-panel p-5 md:p-6">
                  <h3 className="text-lg font-semibold md:text-xl">
                    <button
                      type="button"
                      onClick={() => setExpandedLimits((prev) => ({ ...prev, [l.id]: !prev[l.id] }))}
                      aria-expanded={isOpen}
                      className="group flex w-full flex-wrap items-baseline gap-x-4 gap-y-2 text-left"
                    >
                      <span className="font-mono text-xs font-normal text-dimmer">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <ChevronDown
                        size={14}
                        aria-hidden
                        className={`text-dimmer transition-transform group-hover:text-signal ${
                          isOpen ? 'rotate-0' : '-rotate-90'
                        }`}
                      />
                      <span>{l.title}</span>
                      <span className="border border-line-bright px-2 py-0.5 font-mono text-[0.625rem] font-normal text-dim">
                        {KIND_LABEL[l.kind]}
                      </span>
                    </button>
                  </h3>
                  {isOpen && (
                    <p className="mt-3 max-w-[72ch] pl-[3.25rem] text-[0.9375rem] leading-[1.7] text-dim">
                      {l.detail}
                    </p>
                  )}
                </li>
              )
            })}
          </ol>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          <Prose>
            <p>
              None of these are reasons not to use it. They’re the boundary of what its output
              means. A value marked <span className="font-mono text-confirmed">confirmed</span> by
              the deterministic check is as strong a claim as this system makes, and it means one
              specific thing: that number, normalised, is present in that paper’s text near that
              material. It doesn’t mean the paper is right, that the test condition matches your
              application, or that the material is a good idea.
            </p>
            <p>
              The Multi-Tier Verification &amp; Extraction Pipeline narrows down which numbers a
              person has to check. It doesn’t replace the person.
            </p>
          </Prose>
          <Panel className="self-start p-5 md:p-6">
            <Eyebrow className="mb-4">Next, in order</Eyebrow>
            <ol className="space-y-3 text-sm text-dim">
              <li className="border-b border-line pb-3">
                <span className="font-mono text-xs text-signal">01</span> — the domain pack
                refactor, so the three copies of the field list become one declaration.
              </li>
              <li className="border-b border-line pb-3">
                <span className="font-mono text-xs text-signal">02</span> — hand the structured
                tables to the validator, so attribution stops being a proximity guess.
              </li>
              <li className="border-b border-line pb-3">
                <span className="font-mono text-xs text-signal">03</span> — a non-Gemini model in
                the crosscheck slot, which is the only way rung three of the ladder earns its name.
              </li>
              <li>
                <span className="font-mono text-xs text-signal">04</span> — a labelled set, even a
                small one, so accuracy stops being an anecdote about six papers.
              </li>
            </ol>
          </Panel>
        </div>
      </section>
    </div>
  )
}

function Movement({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-5">
      <p className="eyebrow pt-1">{label}</p>
      <p className="max-w-[64ch] text-[0.9375rem] leading-[1.75] text-dim">{children}</p>
    </div>
  )
}

function Column({
  icon,
  title,
  items,
}: {
  icon: 'runs' | 'tested' | 'untested'
  title: string
  items: string[]
}) {
  const Icon = icon === 'untested' ? X : icon === 'tested' ? Check : CircleDashed
  const tone =
    icon === 'untested' ? 'text-mismatch' : icon === 'tested' ? 'text-confirmed' : 'text-signal'
  return (
    <div className="bg-panel p-5 md:p-6">
      <h3 className={`mb-4 flex items-center gap-2 font-display text-lg font-semibold ${tone}`}>
        <Icon size={16} aria-hidden />
        {title}
      </h3>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-dim">
            <span className={`mt-2 h-1 w-1 shrink-0 rounded-full ${tone.replace('text-', 'bg-')}`} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
