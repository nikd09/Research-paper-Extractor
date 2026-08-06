import { CodeBlock } from '../components/CodeBlock'
import { PullQuote } from '../components/PullQuote'
import { Eyebrow, FileRef, PageHead, Prose } from '../components/primitives'
import { LOG } from '../content/bugs'
import { QUOTES } from '../content/quotes'
import type { LogEntry } from '../content/types'

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

export function EngineeringLog() {
  return (
    <div className="space-y-16">
      <PageHead
        ord="06"
        title="Engineering log"
        standfirst={
          <>
            <p>
              Eight things that broke, in the order they changed the architecture. None of them
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

      <div className="flex items-center gap-4 border-y border-line py-3 font-mono text-[0.6875rem] text-dim">
        <span className="text-signal">{LOG.length} entries</span>
        <span className="text-dimmer">·</span>
        <span>run 2 → run 3 → v3.0</span>
        <span className="ml-auto hidden sm:inline text-dimmer">
          each entry: what broke · how I found it · what changed
        </span>
      </div>

      <ol className="relative">
        {/* the spine */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-2 bottom-0 left-[0.5625rem] w-px bg-line md:left-[3.4375rem]"
        />

        {LOG.map((entry, i) => {
          const sev = SEVERITY[entry.severity]
          const quoteKey = QUOTE_AFTER[entry.id]
          return (
            <li key={entry.id} className="relative pb-16 md:pb-24">
              <div className="grid grid-cols-1 gap-x-8 md:grid-cols-[7rem_minmax(0,1fr)]">
                {/* marker column */}
                <div className="relative mb-4 md:mb-0 md:text-right">
                  <span
                    aria-hidden
                    className="absolute top-[0.4375rem] left-[0.25rem] h-2.5 w-2.5 rounded-full border border-line-bright bg-ground md:left-auto md:-right-[1.4375rem]"
                  />
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
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl leading-tight font-semibold md:text-[1.75rem]">
                      {entry.title}
                    </h2>
                    <span
                      className={`border px-2 py-0.5 font-mono text-[0.625rem] tracking-wide ${sev.className}`}
                    >
                      {sev.label}
                    </span>
                  </div>

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
            Six of the eight were found by reading output against a source document by hand. One was
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
