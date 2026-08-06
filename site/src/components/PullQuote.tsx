import type { Quote } from '../content/types'

/**
 * Nik's own words, styled apart from body copy. Anything still marked
 * `draft-reconstruction` says so on the page — it's a reconstruction from
 * the bug history, not his memory, and it shouldn't read as his until he
 * has edited it.
 */
export function PullQuote({ quote }: { quote: Quote }) {
  const draft = quote.status === 'draft-reconstruction'
  return (
    <figure className="relative border-l-2 border-signal/60 bg-panel/60 py-6 pr-6 pl-6 md:pl-8">
      <figcaption className="eyebrow mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span>{quote.prompt}</span>
        {draft && (
          <span className="border border-approximate/40 bg-approximate/10 px-2 py-0.5 text-[0.625rem] tracking-wider text-approximate normal-case">
            draft reconstruction — awaiting Nik’s edit
          </span>
        )}
      </figcaption>
      <blockquote className="max-w-[66ch] space-y-4 font-display text-[1.0625rem] leading-[1.6] text-text md:text-xl md:leading-[1.55]">
        {quote.body.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </blockquote>
    </figure>
  )
}
