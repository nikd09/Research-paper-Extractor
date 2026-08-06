import { Check, CircleDashed, X } from 'lucide-react'
import { Eyebrow, PageHead, Panel, Prose, SectionHead } from '../components/primitives'
import { LIMITS, RUNS, WHAT_IS_NOT_TESTED, WHAT_IS_TESTED, WHAT_RUNS } from '../content/limits'

const KIND_LABEL = {
  evidence: 'evidence',
  coverage: 'coverage',
  heuristic: 'heuristic',
  untested: 'untested',
  'open-question': 'open question',
} as const

export function Status() {
  return (
    <div className="space-y-24 md:space-y-32">
      <PageHead
        ord="08"
        title="Status & limits"
        standfirst={
          <>
            <p>
              Version 3.0. It runs, on six papers, on one domain, against no labelled ground truth.
              Everything below is what I know is weak about it.
            </p>
            <p className="mt-4">
              A project that hides this tab is asking to be taken on trust, which is a strange thing
              for a verification engine to ask.
            </p>
          </>
        }
      />

      <section>
        <ul className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {RUNS.map((r) => (
            <li key={r.label} className="bg-panel p-5">
              <p className="font-mono text-3xl leading-none tabular-nums">{r.value}</p>
              <p className="mt-2 text-sm text-dim">{r.label}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionHead ord="8.1" title="What runs, what’s tested, what isn’t" />
        <div className="grid gap-px border border-line bg-line lg:grid-cols-3">
          <Column icon="runs" title="Runs today" items={WHAT_RUNS} />
          <Column icon="tested" title="Tested" items={WHAT_IS_TESTED} />
          <Column icon="untested" title="Not tested" items={WHAT_IS_NOT_TESTED} />
        </div>

        <p className="mt-6 max-w-[70ch] text-sm text-dim">
          The gap between the middle column and the right one is the honest shape of this project.
          The tests prove the pipeline executes and that two specific historical bugs stay fixed.
          They prove nothing about accuracy, because measuring accuracy needs a labelled set and
          building one for tribology papers is its own project.
        </p>
      </section>

      <section>
        <SectionHead ord="8.2" title="Known limits">
          <p>Ten of them, in the order I’d want a reviewer to push on.</p>
        </SectionHead>

        <ol className="space-y-px border border-line bg-line">
          {LIMITS.map((l, i) => (
            <li key={l.id} className="bg-panel p-5 md:p-6">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
                <span className="font-mono text-xs text-dimmer">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="text-lg font-semibold md:text-xl">{l.title}</h3>
                <span className="border border-line-bright px-2 py-0.5 font-mono text-[0.625rem] text-dim">
                  {KIND_LABEL[l.kind]}
                </span>
              </div>
              <p className="mt-3 max-w-[72ch] text-[0.9375rem] leading-[1.7] text-dim">{l.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <div className="grid gap-8 lg:grid-cols-2">
          <Prose>
            <p>
              None of these are reasons not to use it. They’re the boundary of what its output means.
              A value marked <span className="font-mono text-confirmed">confirmed</span> by the
              deterministic check is as strong a claim as this system makes, and it means one
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
                <span className="font-mono text-xs text-signal">01</span> — the domain pack refactor,
                so the three copies of the field list become one declaration.
              </li>
              <li className="border-b border-line pb-3">
                <span className="font-mono text-xs text-signal">02</span> — hand the structured
                tables to the validator, so attribution stops being a proximity guess.
              </li>
              <li className="border-b border-line pb-3">
                <span className="font-mono text-xs text-signal">03</span> — a non-Gemini model in the
                crosscheck slot, which is the only way rung three of the ladder earns its name.
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
