import { ConfidenceStamp } from '../components/ConfidenceStamp'
import { PullQuote } from '../components/PullQuote'
import { Eyebrow, PageHead, Panel, Prose, SectionHead } from '../components/primitives'
import { BENCHMARKS, EXTRACTED, SPEC, SYNTHESIS_DIFF } from '../content/caseStudy'
import { QUOTES } from '../content/quotes'

export function CaseStudy() {
  return (
    <div className="space-y-24 md:space-y-32">
      <PageHead
        ord="05"
        title="Case study: the seat recliner"
        standfirst={
          <>
            <p>
              The first configured instance. A recliner is the structural link between the seat
              cushion frame and the backrest — it holds the backrest angle in normal use and carries
              the load path in a crash. Inside it, a bushing slides.
            </p>
            <p className="mt-4">
              The brief: find a sliding-layer material that performs like Saint-Gobain’s PRO100E
              without the fluoropolymer, at roughly half the material cost. The literature mostly
              answers with PTFE.
            </p>
          </>
        }
      />

      {/* ------------------------------------------------ the spec */}
      <section>
        <SectionHead ord="5.1" title="The operating envelope, as specified">
          <p>
            Every number below is read directly out of the two requirements PDFs the synthesiser now
            treats as authoritative. Before that change, the pipeline ranked materials against a
            paraphrase I’d typed from memory — see the engineering log.
          </p>
        </SectionHead>

        <ul className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {SPEC.map((s) => (
            <li key={s.label} className="bg-panel p-4 md:p-5">
              <p className="eyebrow mb-2">{s.label}</p>
              <p className="font-mono text-2xl leading-none tabular-nums">
                {s.value}
                {s.unit && <span className="ml-1.5 text-sm text-dim">{s.unit}</span>}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-dim">{s.note}</p>
            </li>
          ))}
        </ul>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
          <Prose>
            <p>
              Two things about this envelope matter for the extraction problem. The pressure is 110
              MPa against a corpus whose test rigs mostly run between 2 and 21 MPa, and the motion
              is oscillatory at 35 mm/s against papers that almost all test continuous sliding at
              0.5 m/s or faster. So even a perfectly extracted number from a perfect paper is
              answering a slightly different question than the one being asked.
            </p>
            <p>
              That’s not a flaw in the extraction. It’s the thing extraction has to make visible, so
              a person sees the mismatch instead of inheriting it. Both synthesis runs did surface
              it, in different words.
            </p>
          </Prose>
          <Panel className="self-start p-5 md:p-6">
            <Eyebrow className="mb-3">Benchmarked against</Eyebrow>
            <ul className="space-y-2 font-mono text-sm">
              {BENCHMARKS.map((b) => (
                <li key={b} className="border-b border-line pb-2 last:border-0">
                  {b}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-dim">
              PRO100E is Saint-Gobain’s own product and the incumbent in the reference unit. The
              target is to match its behaviour without the fluoropolymer, at a minimum of half its
              material cost.
            </p>
          </Panel>
        </div>
      </section>

      {/* ------------------------------------------------ extracted values */}
      <section>
        <SectionHead ord="5.2" title="What came out of six papers">
          <p>
            Real rows from the knowledge base, with the confidence states the run assigned. The
            fluoropolymer column is the compliance filter doing its job — and quietly making the
            point that most of the best numbers in this literature belong to the chemistry the spec
            excludes.
          </p>
        </SectionHead>

        <div className="overflow-x-auto border border-line" tabIndex={0} role="region" aria-label="Extracted values table">
          <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line-bright bg-panel-2">
                <th className="eyebrow px-4 py-3 font-normal">Material</th>
                <th className="eyebrow px-4 py-3 font-normal">Condition</th>
                <th className="eyebrow px-4 py-3 text-right font-normal">Value</th>
                <th className="eyebrow px-4 py-3 font-normal">Confidence</th>
                <th className="eyebrow px-4 py-3 font-normal">PFAS</th>
              </tr>
            </thead>
            <tbody>
              {EXTRACTED.map((row, i) => (
                <tr key={i} className="border-b border-line bg-panel last:border-0">
                  <td className="px-4 py-3">{row.material}</td>
                  <td className="px-4 py-3 font-mono text-xs text-dim">{row.condition}</td>
                  <td className="px-4 py-3 text-right font-mono whitespace-nowrap tabular-nums">
                    {row.value}
                    <span className="ml-1.5 text-xs text-dim">{row.unit}</span>
                  </td>
                  <td className="px-4 py-3">
                    <ConfidenceStamp state={row.confidence} />
                  </td>
                  <td className="px-4 py-3">
                    {row.pfas ? (
                      <span className="font-mono text-xs text-mismatch">excluded</span>
                    ) : (
                      <span className="font-mono text-xs text-dimmer">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-5 max-w-[68ch] text-sm text-dim">
          Seven of these ten rows are fluoropolymer-bearing, including every one of the lowest friction
          coefficients in the set. The compliance flag doesn’t solve that; it just stops it being
          invisible. What’s left after the filter — the Kevlar-reinforced epoxy at 0.07–0.09, the
          commercial polymer bushings around 0.124 — is the honest shortlist.
        </p>
      </section>

      {/* ------------------------------------------------ flash vs pro */}
      <section>
        <SectionHead ord="5.3" title="Flash versus Pro, measured rather than assumed">
          <p>
            Synthesis runs once over the already-extracted JSON, not once per PDF. No volume means
            no volume argument, so the cheap-first rule that governs every other stage doesn’t
            automatically apply here — which is why the model is a flag and both runs are on disk.
          </p>
        </SectionHead>

        <div className="overflow-x-auto border border-line" tabIndex={0} role="region" aria-label="Flash versus Pro comparison table">
          <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line-bright bg-panel-2">
                <th className="eyebrow px-4 py-3 font-normal"> </th>
                <th className="eyebrow px-4 py-3 font-normal">gemini-3.6-flash</th>
                <th className="eyebrow px-4 py-3 font-normal text-copper">
                  gemini-3.1-pro-preview · paid
                </th>
              </tr>
            </thead>
            <tbody>
              {SYNTHESIS_DIFF.map((d) => (
                <tr key={d.aspect} className="border-b border-line bg-panel align-top last:border-0">
                  <td className="w-48 px-4 py-4 font-mono text-xs text-dim">{d.aspect}</td>
                  <td className="px-4 py-4 leading-relaxed">{d.flash}</td>
                  <td className="px-4 py-4 leading-relaxed">{d.pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <Prose>
            <p>
              The difference that decided it wasn’t the ranking. It was that Pro read the confidence
              states as evidence. Flash put a material first on numbers marked{' '}
              <span className="font-mono text-approximate">approximate</span> and mentioned their
              status afterwards, as a caveat. Pro treated the same states as a reason to rank the
              material lower, and said so in the rationale.
            </p>
            <p>
              That’s the behaviour the confidence field exists to enable, and I only found out which
              model actually uses it by running both against the same input and reading the two
              files side by side.
            </p>
          </Prose>
          <Panel className="p-5 md:p-6">
            <Eyebrow className="mb-3">The stiction finding</Eyebrow>
            <p className="text-sm leading-relaxed text-dim">
              The spec asks for a similar gap between static and dynamic friction to PRO100E. Squeak
              in a seat is a stick-slip problem, so that gap is the requirement. Every paper in the
              corpus reports steady-state dynamic friction and none of them measure stiction.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-dim">
              Flash logged the absence as a gap in a list. Pro carried it into the design brief — the
              driver of the failure mode can only be inferred from the available dynamic metrics —
              which is the sentence an engineer needs before they trust a ranking built on those
              metrics.
            </p>
          </Panel>
        </div>
      </section>

      <section>
        <PullQuote quote={QUOTES.whyItMatters} />
      </section>
    </div>
  )
}
