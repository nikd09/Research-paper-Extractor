import { ConfidenceStamp } from '../components/ConfidenceStamp'
import { CodeBlock } from '../components/CodeBlock'
import { EvidenceLadder } from '../components/EvidenceLadder'
import { PullQuote } from '../components/PullQuote'
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
import {
  CONFIDENCE_STATES,
  DERIVED_BRANCH_CODE,
  FAIL_CLOSED_CODE,
  MECHANISMS,
  PRECEDENCE_CODE,
} from '../content/confidence'
import { QUOTES } from '../content/quotes'

export function Verification() {
  return (
    <div className="space-y-24 md:space-y-32">
      <PageHead
        ord="03"
        title="The verification model"
        standfirst={
          <>
            <p>
              Three checks run over every numeric claim, and they don’t have equal authority. A
              regex that finds a number verbatim in the source beats a second model’s opinion, so
              the cheap deterministic check outranks the expensive probabilistic one.
            </p>
            <p className="mt-4">
              That ordering took me a while to get right. My first version let whichever stage ran
              last win, which meant a paid model could overwrite a value the source text had already
              proved.
            </p>
          </>
        }
      />

      {/* ------------------------------------------------ states */}
      <section>
        <SectionHead ord="3.1" title="Seven states, one field">
          <p>
            Every extracted number is a record, not a string — material, condition, value, unit,
            source, and one confidence state. The state is a first-class field because the previous
            design appended tags like <code className="text-signal">[unverified: …]</code> onto the
            value text, which made “is this hedged?” a string-matching problem for every consumer
            downstream, and the tags were confirmed to sometimes silently not get added between
            runs.
          </p>
        </SectionHead>

        <ul className="grid gap-px border border-line bg-line sm:grid-cols-2">
          {CONFIDENCE_STATES.map((s) => (
            <li key={s.key} className="flex flex-col gap-3 bg-panel p-5 md:p-6">
              <ConfidenceStamp state={s.key} size="md" className="self-start" />
              <p className="text-[0.9375rem] leading-relaxed">{s.meaning}</p>
              <dl className="mt-auto space-y-1.5 pt-2 text-xs text-dim">
                <div className="flex gap-2">
                  <dt className="shrink-0 font-mono text-dimmer">set by</dt>
                  <dd className="font-mono">{s.setBy}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="shrink-0 font-mono text-dimmer">then</dt>
                  <dd>{s.consequence}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>

        <p className="mt-5 max-w-[68ch] text-sm text-dim">
          Five of these were in the original design.{' '}
          <span className="font-mono text-contradicts">contradicts_table</span> came later, when a
          paper turned out to state one number in its prose and a different one in its own table for
          the same material. Neither is wrong to extract. Picking a winner silently would have made
          the paper’s inconsistency look like mine.{' '}
          <span className="font-mono text-derived">derived</span> came later still, for the values
          the pipeline calculates itself — a stated baseline back-computed from a stated percentage
          reduction — which is a different kind of unverified from a value nobody could find at all.
        </p>
      </section>

      {/* ------------------------------------------------ the ladder */}
      <section>
        <SectionHead ord="3.2" title="The precedence ladder">
          <p>
            This is the part I’d point at first. Not a scoring function, not a weighted average — an
            ordering, enforced in code, over what counts as evidence that a number is real.
          </p>
        </SectionHead>

        <Panel className="p-5 md:p-10">
          <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4 border-b border-line pb-5">
            <Eyebrow>Evidence hierarchy · strongest at the top</Eyebrow>
            <span className="font-mono text-[0.6875rem] text-dim">
              a rung may set a state a lower rung cannot overwrite
            </span>
          </div>
          <EvidenceLadder />
        </Panel>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start">
          <Prose>
            <p>
              The ladder is only real because of one guard clause. Before the crosscheck stage
              touches a value, it checks what the value already carries. If the deterministic
              validator found that exact number in the paper’s own text, crosscheck skips it —
              permanently, regardless of what the second model thinks.
            </p>
            <p>
              Without that clause the stages just run in sequence and the last one to write wins,
              which is an ordering by accident of scheduling rather than by strength of evidence.
              Same three checks, completely different system.
            </p>
          </Prose>
          <div>
            <CodeBlock
              code={PRECEDENCE_CODE}
              caption="src/core/crosscheck.py — the four lines the ladder rests on"
            />
          </div>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start">
          <Prose>
            <p>
              <span className="font-mono text-derived">derived</span> is the one state that
              deliberately does not take that skip. A calculated value still needs checking — it
              just needs a different check than a read one, because agreement can’t promote it and
              disagreement still means something. If the independent extraction derives (or reads) a
              different number for the same material and condition, that is a real signal that the
              primary derivation picked the wrong percentage or made an arithmetic error.
            </p>
            <p>
              So crosscheck gives it its own branch instead of a skip. Agreement leaves it exactly
              where it was — <span className="font-mono text-derived">derived</span>, never upgraded.
              Disagreement flags it, same as any other mismatched value.
            </p>
          </Prose>
          <div>
            <CodeBlock
              code={DERIVED_BRANCH_CODE}
              caption="src/core/crosscheck.py — the branch a computed value gets instead of the skip"
            />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ mechanisms */}
      <section>
        <SectionHead ord="3.3" title="Three checks, three different authorities">
          <p>
            Cost and authority run in opposite directions here. The free deterministic check has the
            final say; the paid model is the last one consulted and the least trusted on its own.
          </p>
        </SectionHead>

        <div className="grid gap-px border border-line bg-line lg:grid-cols-3">
          {MECHANISMS.map((m, i) => (
            <article key={m.id} className="flex flex-col gap-4 bg-panel p-5 md:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="font-mono text-[0.6875rem] text-dimmer">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="mt-1 text-xl font-semibold">{m.name}</h3>
                </div>
                {m.tier === 'paid' ? <PaidTag /> : <FreeTag>{m.tier === 'none' ? 'no api' : 'free'}</FreeTag>}
              </div>

              <dl className="space-y-1 border-y border-line py-3 font-mono text-[0.6875rem]">
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0 text-dimmer">model</dt>
                  <dd className={m.tier === 'paid' ? 'text-copper' : 'text-text'}>{m.model}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0 text-dimmer">cost</dt>
                  <dd className={m.tier === 'paid' ? 'text-copper' : 'text-dim'}>{m.cost}</dd>
                </div>
              </dl>

              <p className="text-sm leading-relaxed text-dim">
                <span className="text-text">Authority. </span>
                {m.authority}
              </p>
              <p className="text-sm leading-relaxed text-dim">
                <span className="text-confirmed">Proves. </span>
                {m.whatItProves}
              </p>
              <p className="text-sm leading-relaxed text-dim">
                <span className="text-mismatch">Cannot prove. </span>
                {m.whatItCannotProve}
              </p>

              <div className="mt-auto pt-2">
                <FileRef path={m.file} />
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------ fail closed */}
      <section>
        <SectionHead ord="3.4" title="The default is the hedged one">
          <p>
            <span className="font-mono text-unverified">confidence</span> defaults to{' '}
            <span className="font-mono text-unverified">unverified</span>, and that single line is
            most of the safety in the system.
          </p>
        </SectionHead>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start">
          <div>
            <CodeBlock code={FAIL_CLOSED_CODE} caption="schemas/paper_schema.py — MetricValue" />
          </div>
          <Prose>
            <p>
              If the validator never runs — a config flag flipped, an exception swallowed, a stage
              quietly skipped because a key pool was empty — nothing marks the value as good. It
              stays hedged and it goes out hedged. The failure mode of a broken verification stage
              is an output that reads more cautious than it needs to.
            </p>
            <p>
              The alternative default is a system whose silence means approval. I’ve seen what that
              produces: an answer nobody can trace, delivered in the same confident tone as one they
              can.
            </p>
          </Prose>
        </div>
      </section>

      {/* ------------------------------------------------ caveat */}
      <section>
        <SectionHead ord="3.5" title="What agreement between two models is not" />

        <Panel className="border-mismatch/35 p-5 md:p-8">
          <Eyebrow className="mb-4">The honest caveat</Eyebrow>
          <Prose className="text-text">
            <p>
              Rung three of the ladder says “independent agreement”, and independent is doing more
              work in that sentence than it can carry. The crosscheck runs{' '}
              <span className="font-mono text-sm">gemini-3.5-flash-lite</span> against the same paper
              with no knowledge of the first result. Different model, same family, same training
              lineage, same tokeniser quirks on a mangled exponent.
            </p>
            <p>
              That is correlated evidence, not replication. When both models misread the same axis
              on the same chart, they misread it together and the value comes out{' '}
              <span className="font-mono text-confirmed">confirmed</span>. The ladder ranks it below
              a verbatim text match for exactly this reason, and it’s the reason I’d want a
              non-Gemini model in that slot before I’d call the crosscheck a real second opinion.
            </p>
          </Prose>
        </Panel>
      </section>

      <section>
        <PullQuote quote={QUOTES.proudOf} />
      </section>
    </div>
  )
}
