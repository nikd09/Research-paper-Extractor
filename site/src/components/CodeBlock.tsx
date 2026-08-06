import { Highlight, type PrismTheme } from 'prism-react-renderer'

/**
 * Syntax colours deliberately stay off the semantic palette: no confidence
 * hue and no copper appears in code, so those two legends keep meaning
 * exactly one thing on the page.
 */
const assayTheme: PrismTheme = {
  plain: { color: '#c8d2da', backgroundColor: 'transparent' },
  styles: [
    { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: '#8b98a3', fontStyle: 'italic' } },
    { types: ['string', 'char', 'attr-value'], style: { color: '#9dbfa9' } },
    { types: ['number', 'boolean'], style: { color: '#dfe5e9' } },
    { types: ['keyword', 'control-flow'], style: { color: '#7fb6cd' } },
    { types: ['function', 'class-name'], style: { color: '#e2e8ec' } },
    { types: ['operator', 'punctuation'], style: { color: '#8b98a3' } },
    { types: ['builtin', 'decorator'], style: { color: '#a9c3d1' } },
    { types: ['property', 'variable', 'constant'], style: { color: '#c8d2da' } },
  ],
}

interface Props {
  code: string
  lang?: string
  caption?: string
  /** Show line numbers — worth it for anything over ~6 lines. */
  numbered?: boolean
}

export function CodeBlock({ code, lang = 'python', caption, numbered = false }: Props) {
  return (
    // min-w-0: as a grid/flex item the figure would otherwise size to its
    // widest code line and push the whole page sideways on a phone.
    <figure className="min-w-0 max-w-full overflow-hidden border border-line bg-[#12181e]">
      {caption && (
        <figcaption className="flex items-center gap-2 border-b border-line px-4 py-2 font-mono text-[0.6875rem] tracking-wide text-dim">
          <span className="text-signal/70">§</span>
          {caption}
        </figcaption>
      )}
      {/* tabIndex: a scroll container needs to be reachable, or a keyboard
          user can't scroll a wide line into view. */}
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={caption ?? 'Code'}>
        <Highlight code={code.trim()} language={lang} theme={assayTheme}>
          {({ tokens, getLineProps, getTokenProps }) => (
            // w-max, not min-w-max: a min-width propagates up through the
            // scroll container and widens the whole page on narrow screens.
            <pre className="w-max px-4 py-4 text-[0.8125rem] leading-[1.65]">
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })}>
                  {numbered && (
                    <span className="mr-4 inline-block w-6 text-right text-dimmer select-none">
                      {i + 1}
                    </span>
                  )}
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token })} />
                  ))}
                </div>
              ))}
            </pre>
          )}
        </Highlight>
      </div>
    </figure>
  )
}
