import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { CodeBlock } from '../components/CodeBlock'
import { PullQuote } from '../components/PullQuote'
import { Eyebrow, PageHead, Panel, Prose, SectionHead } from '../components/primitives'
import { DOMAIN_LOCKS, PACKS, PACK_PROPOSAL } from '../content/packs'
import { QUOTES } from '../content/quotes'

const STATUS_STYLE = {
  swappable: 'text-confirmed border-confirmed/40 bg-confirmed/10',
  hardcoded: 'text-mismatch border-mismatch/40 bg-mismatch/10',
  duplicated: 'text-approximate border-approximate/40 bg-approximate/10',
} as const

export function DomainPacks() {
  const [packIndex, setPackIndex] = useState(0)
  const pack = PACKS[packIndex]

  return (
    <div className="space-y-24 md:space-y-32">
      <PageHead
        ord="04"
        title="Domain packs"
        standfirst={
          <>
            <p>
              The engine is domain-agnostic in its architecture and domain-locked in its schema.
              Both halves of that sentence are true right now, and this tab is the one that says so
              plainly.
            </p>
            <p className="mt-4">
              What follows is where the seat recliner currently lives in the code, what a domain
              pack would replace, and what stands in the way. The refactor is designed. It has not
              shipped.
            </p>
          </>
        }
      />

      {/* ------------------------------------------------ the locks */}
      <section>
        <SectionHead ord="4.1" title="Where the domain actually lives">
          <p>
            Seven places. One of them already behaves like configuration; the rest are type
            definitions, field names and a list written out three times.
          </p>
        </SectionHead>

        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Domain lock table">
          <table className="w-full min-w-[46rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-line-bright">
                <th className="eyebrow py-3 pr-4 font-normal">Domain-locked</th>
                <th className="eyebrow py-3 pr-4 font-normal">What it is</th>
                <th className="eyebrow py-3 font-normal">Today</th>
              </tr>
            </thead>
            <tbody>
              {DOMAIN_LOCKS.map((lock) => (
                <tr key={lock.where} className="border-b border-line align-top">
                  <td className="py-4 pr-4">
                    <span className="font-mono text-[0.8125rem] break-words text-signal/90">
                      {lock.where}
                    </span>
                  </td>
                  <td className="max-w-[38rem] py-4 pr-4 text-sm leading-relaxed text-dim">
                    {lock.what}
                  </td>
                  <td className="py-4 whitespace-nowrap">
                    <span
                      className={`border px-2 py-0.5 font-mono text-[0.625rem] ${STATUS_STYLE[lock.status]}`}
                    >
                      {lock.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-6 max-w-[68ch] text-sm text-dim">
          The row that bothers me most is the duplicated one. Six field names, written out three
          times, in three modules that all have to agree for verification to cover a metric. Add a
          seventh metric and forget one file and nothing fails — that metric just stops being
          checked, quietly, which is the exact failure mode this whole project exists to prevent.
        </p>
      </section>

      {/* ------------------------------------------------ the proposal */}
      <section>
        <SectionHead ord="4.2" title="What a pack would be">
          <p>
            One folder. Prompts, metric field definitions, relevance targets, compliance flags and
            requirements documents, declared once instead of scattered across a schema, three
            verification modules and a string constant.
          </p>
        </SectionHead>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
          <CodeBlock code={PACK_PROPOSAL} lang="yaml" caption="proposed — packs/<name>/pack.yaml" />
          <Prose>
            <p>
              The single-sourcing is the point. The three duplicated <code>_FIELDS</code> lists
              become one declaration that the validator, the crosscheck and the escalator all read,
              so a metric that exists is a metric that gets verified. Relevance stops being two
              hardcoded field names and becomes a list of targets. The PFAS rule stops being a
              boolean welded into MaterialEntry and becomes a compliance clause the pack declares.
            </p>
            <p>
              None of that is hard. It’s a day or two of work and a migration of the existing
              outputs. What makes it worth doing carefully is that a half-done version — packs for
              the prompts, hardcoded fields for everything else — would read as configurable while
              still silently ignoring half of what you configured.
            </p>
          </Prose>
        </div>
      </section>

      {/* ------------------------------------------------ side by side */}
      <section>
        <SectionHead ord="4.3" title="Two packs, side by side">
          <p>
            Pack 01 is real and running. Pack 02 is a sketch of a second domain, included to show
            which lines would change.
          </p>
        </SectionHead>

        <div
          role="group"
          aria-label="Choose a domain pack"
          className="mb-6 inline-flex border border-line"
        >
          {PACKS.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPackIndex(i)}
              aria-pressed={packIndex === i}
              className={`px-4 py-2 font-mono text-xs transition-colors ${
                packIndex === i
                  ? 'bg-signal/15 text-signal'
                  : 'text-dim hover:bg-panel-2 hover:text-text'
              }`}
            >
              {p.id}
            </button>
          ))}
        </div>

        {pack.status === 'illustrative' && (
          <div className="mb-6 flex items-start gap-3 border border-approximate/45 bg-approximate/10 p-4">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-approximate" aria-hidden />
            <p className="text-sm text-approximate">
              <span className="font-mono">Illustrative only.</span> Nothing has been run against this
              pack. There are no results for it, no extracted values, and no claim that the engine
              handles this domain today — only a demonstration of which configuration would have to
              change.
            </p>
          </div>
        )}

        <Panel className="p-5 md:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-5">
            <h3 className="text-xl font-semibold md:text-2xl">{pack.name}</h3>
            <span
              className={`border px-2 py-0.5 font-mono text-[0.6875rem] ${
                pack.status === 'running'
                  ? 'border-confirmed/40 bg-confirmed/10 text-confirmed'
                  : 'border-approximate/40 bg-approximate/10 text-approximate'
              }`}
            >
              {pack.status}
            </span>
          </div>

          <dl className="grid gap-x-10 gap-y-6 md:grid-cols-2">
            <Field label="Application">{pack.application}</Field>
            <Field label="Requirements source">
              <span className="font-mono text-[0.8125rem]">{pack.requirements}</span>
            </Field>
            <Field label="Relevance targets">
              <ul className="flex flex-wrap gap-2">
                {pack.relevanceTargets.map((t) => (
                  <li
                    key={t}
                    className="border border-line-bright bg-panel-2 px-2 py-0.5 font-mono text-xs"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </Field>
            <Field label="Compliance rule">{pack.compliance}</Field>
            <Field label="Metric fields">
              <ul className="flex flex-wrap gap-2">
                {pack.metrics.map((m) => (
                  <li
                    key={m}
                    className="border border-line-bright bg-panel-2 px-2 py-0.5 font-mono text-xs"
                  >
                    {m}
                  </li>
                ))}
              </ul>
            </Field>
            <Field label="Benchmarked against">
              <span className="font-mono text-[0.8125rem]">{pack.benchmarks.join(' · ')}</span>
            </Field>
          </dl>

          <p className="mt-8 border-t border-line pt-5 text-sm text-dim">{pack.note}</p>
        </Panel>
      </section>

      <section>
        <PullQuote quote={QUOTES.differently} />
      </section>

      <section>
        <Eyebrow className="mb-4">Honest summary</Eyebrow>
        <Prose>
          <p>
            Retargeting The Multi-Tier Verification &amp; Extraction Pipeline today means editing
            five files and keeping three copies of a list in sync. Retargeting it after the pack refactor means writing one <code>pack.yaml</code> and
            dropping in prompts and requirements documents. The distance between those two sentences
            is the honest state of the generalisation claim, and I’d rather this tab said so than
            have someone discover it by trying.
          </p>
        </Prose>
      </section>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="eyebrow mb-2">{label}</dt>
      <dd className="text-sm leading-relaxed text-dim">{children}</dd>
    </div>
  )
}
