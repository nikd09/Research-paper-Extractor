import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Hero } from '../components/Hero'
import { ConfidenceStamp } from '../components/ConfidenceStamp'
import { Eyebrow, Panel, Prose, SectionHead } from '../components/primitives'
import { CONFIDENCE_STATES } from '../content/confidence'

const GLANCE = [
  { n: '7', label: 'pipeline stages', sub: 'two of them make no API call' },
  { n: '3', label: 'verification mechanisms', sub: 'ranked, not stacked' },
  { n: '6', label: 'confidence states', sub: 'one field, no free-text tags' },
  { n: '3', label: 'output artifacts', sub: 'JSON · markdown · retrieval chunks' },
  { n: '0', label: 'paid calls, clean paper', sub: 'escalation only runs on flags', copper: true },
]

export function Overview() {
  return (
    <div className="space-y-24 md:space-y-32">
      {/* ------------------------------------------------ thesis */}
      <section className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
        <div>
          <Eyebrow className="mb-4">The Multi-Tier Verification &amp; Extraction Pipeline</Eyebrow>
          <h1 className="text-4xl leading-[1.02] font-semibold md:text-[3.75rem]">
            Fluency and correctness are uncorrelated.
          </h1>
          <div className="mt-6 max-w-[56ch] space-y-4 text-[1.0625rem] leading-[1.7] text-dim md:text-lg">
            <p>
              An LLM will read a materials paper and confidently report a wear rate that’s a decade
              off. The number will sit inside a paragraph that’s otherwise perfect.
            </p>
            <p className="text-text">
              So the architecture has to assume wrong answers look exactly like right ones.
              Everything here is downstream of that sentence.
            </p>
          </div>
        </div>

        <Hero />
      </section>

      {/* ------------------------------------------------ what it does */}
      <section>
        <SectionHead ord="1.1" title="What the engine does" />
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
          <Prose>
            <p>
              The Multi-Tier Verification &amp; Extraction Pipeline reads technical PDFs and emits
              structured knowledge in which every numeric claim
              carries machine-checkable provenance and a confidence state. A value isn’t a string in
              a list — it’s a record that knows which material it belongs to, under what test
              condition, in what unit, where in the document it came from, and how strongly that
              origin was proven. Three checks decide the last part, and they’re ranked against each
              other rather than run in a row.
            </p>
            <p>
              The seat recliner work at Saint-Gobain is the first configured instance of it, not the
              product. One domain pack among many possible ones: swap the prompts, the metric
              vocabulary, the compliance flag and the requirements documents, and the same machinery
              reads a different literature. Tab 04 is honest about how far that swap currently goes
              and what still has the recliner welded into it.
            </p>
          </Prose>

          <Panel className="self-start p-5 md:p-6">
            <Eyebrow className="mb-4">The asymmetry the design is built on</Eyebrow>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="font-mono text-notreported">a missing value</dt>
                <dd className="mt-1 text-dim">costs an engineer ten minutes with a PDF.</dd>
              </div>
              <div>
                <dt className="font-mono text-mismatch">a confidently wrong one</dt>
                <dd className="mt-1 text-dim">
                  costs a material decision. If the agent says a candidate’s wear rate is 6.6E-7 and
                  the real number is 6.6E-6, that material looks ten times better than it is, and
                  someone could pick it.
                </dd>
              </div>
            </dl>
          </Panel>
        </div>
      </section>

      {/* ------------------------------------------------ at a glance */}
      <section>
        <Eyebrow className="mb-4">At a glance</Eyebrow>
        <ul className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
          {GLANCE.map((g) => (
            <li key={g.label} className="bg-panel p-5">
              <p
                className={`font-mono text-3xl leading-none tabular-nums ${g.copper ? 'text-copper' : 'text-text'}`}
              >
                {g.n}
              </p>
              <p className="mt-2 font-display text-sm font-medium">{g.label}</p>
              <p className="mt-1 text-xs text-dim">{g.sub}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------ confidence legend */}
      <section>
        <SectionHead ord="1.2" title="The confidence legend">
          <p>
            These six hues appear nowhere else on this site, and copper is reserved for anything
            that costs money. Two minutes here and you can read trust and cost off colour alone.
          </p>
        </SectionHead>

        <ul className="space-y-px border border-line bg-line">
          {CONFIDENCE_STATES.map((s) => (
            <li
              key={s.key}
              className="flex flex-col gap-2 bg-panel px-4 py-3.5 sm:flex-row sm:items-center sm:gap-6"
            >
              <span className="w-[13.5rem] shrink-0">
                <ConfidenceStamp state={s.key} />
              </span>
              <span className="text-sm text-dim">{s.meaning}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------ where to go */}
      <section>
        <SectionHead ord="1.3" title="If you only read two tabs" />
        <div className="grid gap-px border border-line bg-line md:grid-cols-2">
          <Link
            to="/verification"
            className="group flex flex-col gap-3 bg-panel p-6 transition-colors hover:bg-panel-2 md:p-8"
          >
            <Eyebrow>Tab 03</Eyebrow>
            <h3 className="text-2xl font-semibold">The verification model</h3>
            <p className="text-dim">
              The evidence hierarchy, why a regex outranks a paid model, and the four lines that
              make the ordering mean something instead of just being an order.
            </p>
            <span className="mt-2 inline-flex items-center gap-2 font-mono text-xs text-signal">
              read it <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
          <Link
            to="/engineering-log"
            className="group flex flex-col gap-3 bg-panel p-6 transition-colors hover:bg-panel-2 md:p-8"
          >
            <Eyebrow>Tab 06</Eyebrow>
            <h3 className="text-2xl font-semibold">The engineering log</h3>
            <p className="text-dim">
              Four bugs that each changed the architecture, including the one where the
              better-designed pipeline lost to the blunt one, and the one where a correct value was
              permanently erased by the stage built to rescue it.
            </p>
            <span className="mt-2 inline-flex items-center gap-2 font-mono text-xs text-signal">
              read it <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        </div>
      </section>
    </div>
  )
}
