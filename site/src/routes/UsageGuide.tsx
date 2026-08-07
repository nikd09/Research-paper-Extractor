import { Eyebrow, PageHead, Panel } from '../components/primitives'
import { GUI_STEPS } from '../content/gui'

export function UsageGuide() {
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

      <ol className="space-y-14">
        {GUI_STEPS.map((step) => (
          <li key={step.id}>
            <Panel className="overflow-hidden">
              <div className="flex flex-wrap items-baseline gap-3 border-b border-line px-5 py-4 md:px-7">
                <span className="font-mono text-xs text-signal">{step.n}</span>
                <h2 className="text-xl font-semibold md:text-2xl">{step.title}</h2>
              </div>
              <img
                src={step.image}
                alt={step.alt}
                className="block w-full border-b border-line bg-ground"
                loading="lazy"
              />
              <p className="px-5 py-5 text-[0.9375rem] leading-relaxed text-dim md:px-7">
                {step.caption}
              </p>
            </Panel>
          </li>
        ))}
      </ol>

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
    </div>
  )
}
