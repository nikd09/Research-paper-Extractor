import { useState } from 'react'
import { CodeBlock } from '../components/CodeBlock'
import { Eyebrow, PageHead, Panel, Prose, SectionHead } from '../components/primitives'
import { PER_PROJECT_NOTE, ROTATION_CODE, STAGE_ROUTING } from '../content/ops'

/** Per paper: extract, verify, crosscheck, rag. Escalation is conditional. */
const FREE_CALLS_PER_PAPER = 4

export function CostOps() {
  const [papers, setPapers] = useState(50)
  const [flagRate, setFlagRate] = useState(30)

  const freeCalls = papers * FREE_CALLS_PER_PAPER
  const paidCalls = Math.round((papers * flagRate) / 100)
  const total = freeCalls + paidCalls
  const paidShare = total === 0 ? 0 : Math.round((paidCalls / total) * 100)

  return (
    <div className="space-y-24 md:space-y-32">
      <PageHead
        ord="07"
        title="Cost & ops"
        standfirst={
          <>
            <p>
              The cost design is one rule applied everywhere: the expensive model is the last thing
              consulted, on the smallest possible input, and only when something is actually wrong.
              A paper the free tier resolves cleanly never touches the paid key at all.
            </p>
            <p className="mt-4">
              The interesting part isn’t the saving. It’s that the rule survives contact with rate
              limits, key exhaustion and one stage where it doesn’t apply.
            </p>
          </>
        }
      />

      {/* ------------------------------------------------ routing */}
      <section>
        <SectionHead ord="7.1" title="Stage routing">
          <p>
            Every call names its stage. STAGE_CONFIG resolves that to a model list and a key pool,
            so tier decisions live in one file instead of at every call site.
          </p>
        </SectionHead>

        <div className="overflow-x-auto border border-line" tabIndex={0} role="region" aria-label="Stage routing table">
          <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line-bright bg-panel-2">
                <th className="eyebrow px-4 py-3 font-normal">Stage</th>
                <th className="eyebrow px-4 py-3 font-normal">Models</th>
                <th className="eyebrow px-4 py-3 font-normal">Keys</th>
                <th className="eyebrow px-4 py-3 font-normal">Note</th>
              </tr>
            </thead>
            <tbody>
              {STAGE_ROUTING.map((r) => (
                <tr key={r.stage} className="border-b border-line bg-panel align-top last:border-0">
                  <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                    <span className={r.paid ? 'text-copper' : 'text-signal/90'}>{r.stage}</span>
                  </td>
                  <td
                    className={`px-4 py-3 font-mono text-xs ${r.paid ? 'text-copper' : 'text-text'}`}
                  >
                    {r.models}
                  </td>
                  <td
                    className={`px-4 py-3 font-mono text-xs ${r.paid ? 'text-copper' : 'text-dim'}`}
                  >
                    {r.keys}
                  </td>
                  <td className="px-4 py-3 text-xs leading-relaxed text-dim">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ------------------------------------------------ key pools */}
      <section>
        <SectionHead ord="7.2" title="Key pools, 429s, and a limit that isn’t where you think">
          <p>
            Two free keys and one paid key. On a 429 the key is marked exhausted until the next
            Pacific midnight and the pool rotates; only when every free key is spent does a stage
            fall through to the paid one.
          </p>
        </SectionHead>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
          <CodeBlock code={ROTATION_CODE} caption="src/providers/key_manager.py" />
          <div className="space-y-6">
            <Prose>
              <p>
                The thing worth knowing about free-tier key pools is in the comment at the top of
                that file. Quota is enforced per Google Cloud project, not per API key. Two keys
                minted inside one project look like twice the capacity in the code and are exactly
                the same capacity in reality.
              </p>
              <p>
                The rotation can’t detect that, and I’d rather the class say so than imply a
                guarantee it can’t make.
              </p>
            </Prose>
            <CodeBlock code={PER_PROJECT_NOTE} caption="the comment that documents the trap" />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ cost model */}
      <section>
        <SectionHead ord="7.3" title="What a corpus costs">
          <p>
            Four free calls per paper, always. Escalation adds one paid call per paper that still has
            something flagged after the free tier has finished with it — not one per flagged value.
          </p>
        </SectionHead>

        <Panel className="p-5 md:p-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-8">
              <div>
                <label htmlFor="papers" className="eyebrow mb-3 block">
                  Corpus size — <span className="text-text">{papers} papers</span>
                </label>
                <input
                  id="papers"
                  type="range"
                  min={1}
                  max={500}
                  value={papers}
                  onChange={(e) => setPapers(Number(e.target.value))}
                  className="w-full accent-[var(--color-signal)]"
                />
                <div className="mt-1 flex justify-between font-mono text-[0.625rem] text-dimmer">
                  <span>1</span>
                  <span>500</span>
                </div>
              </div>

              <div>
                <label htmlFor="flagged" className="eyebrow mb-3 block">
                  Papers still carrying a flag —{' '}
                  <span className="text-text">{flagRate}%</span>
                </label>
                <input
                  id="flagged"
                  type="range"
                  min={0}
                  max={100}
                  value={flagRate}
                  onChange={(e) => setFlagRate(Number(e.target.value))}
                  className="w-full accent-[var(--color-copper)]"
                />
                <div className="mt-1 flex justify-between font-mono text-[0.625rem] text-dimmer">
                  <span>0% — every paper clean</span>
                  <span>100%</span>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-dim">
                A clean paper is one where the deterministic validator and the crosscheck between
                them resolved every numeric claim. Escalation collects what’s left and sends it as a
                single request, so a paper with nine flagged values still costs one paid call.
              </p>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-px border border-line bg-line">
                <div className="bg-panel-2 p-4">
                  <p className="eyebrow mb-2">Free calls</p>
                  <p className="font-mono text-3xl tabular-nums">{freeCalls.toLocaleString()}</p>
                </div>
                <div className="bg-panel-2 p-4">
                  <p className="eyebrow mb-2">Paid calls</p>
                  <p className="font-mono text-3xl tabular-nums text-copper">
                    {paidCalls.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* tier split */}
              <div>
                <div className="mb-2 flex justify-between font-mono text-[0.6875rem] text-dim">
                  <span>tier split</span>
                  <span className={paidShare ? 'text-copper' : 'text-dim'}>
                    {paidShare}% paid
                  </span>
                </div>
                <div className="flex h-3 overflow-hidden border border-line">
                  <div
                    className="bg-signal-dim transition-all duration-300"
                    style={{ width: `${100 - paidShare}%` }}
                  />
                  <div
                    className="bg-copper transition-all duration-300"
                    style={{ width: `${paidShare}%` }}
                  />
                </div>
              </div>

              <div className="border border-line bg-[#12181e] p-4 font-mono text-xs leading-relaxed text-dim">
                <p>free = papers × 4</p>
                <p>
                  <span className="text-copper">paid</span> = papers × flagged_rate
                </p>
                <p className="mt-2 text-dimmer">
                  # extract · verify · crosscheck · rag are free-pool stages
                </p>
                <p className="text-dimmer"># escalation is one call per flagged paper, or none</p>
              </div>

              <p className="text-sm text-dim">
                {flagRate === 0
                  ? 'At zero flags the paid key is never touched. That is the property the whole triage design exists to produce.'
                  : `At ${flagRate}%, ${paidShare}% of all calls in the run are on the paid tier — and each one carries only the specific records that survived every free check.`}
              </p>
            </div>
          </div>
        </Panel>
      </section>

      {/* ------------------------------------------------ the inversion */}
      <section>
        <SectionHead ord="7.4" title="The one stage where the rule inverts" />
        <div className="grid gap-8 lg:grid-cols-2">
          <Prose>
            <p>
              Every per-paper stage is cheap-first because cost scales with the corpus. Synthesis
              doesn’t: it runs once, on demand, over the already-extracted JSON — six papers in, one
              design brief out. There’s no volume to control cost against, so “use the cheap model”
              stops being an argument and becomes a habit.
            </p>
            <p>
              So the model became a flag instead of a constant, both runs were executed on the same
              input, and the two outputs are in the repo to be read against each other. The tab
              before this one is what that comparison found.
            </p>
          </Prose>
          <Panel className="p-5 md:p-6">
            <Eyebrow className="mb-4">Prompt calls per paper</Eyebrow>
            <div className="space-y-4 font-mono text-sm">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <span className="text-dim">before</span>
                <span className="text-2xl tabular-nums text-dim line-through decoration-mismatch/60">
                  5
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-dim">now</span>
                <span className="text-2xl tabular-nums">3</span>
              </div>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-dim">
              Understanding merged into extraction; markdown merged into chunking. Each merge removed
              a call that was re-sending the entire analysis JSON as its input. The crosscheck adds a
              fourth call by design — it reuses the extraction prompt exactly, because a second
              opinion produced by a different question isn’t a second opinion.
            </p>
          </Panel>
        </div>
      </section>
    </div>
  )
}
