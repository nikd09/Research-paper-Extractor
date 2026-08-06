import type { ReactNode } from 'react'

export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`eyebrow ${className}`}>{children}</p>
}

export function Panel({
  children,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'article' | 'li'
}) {
  return (
    <Tag className={`border border-line bg-panel ${className}`}>
      {children}
    </Tag>
  )
}

/** Page-level heading block. Every tab opens with one. */
export function PageHead({
  ord,
  title,
  standfirst,
}: {
  ord: string
  title: string
  standfirst: ReactNode
}) {
  return (
    <header className="mb-12 md:mb-16">
      <Eyebrow className="mb-3">Tab {ord}</Eyebrow>
      <h1 className="text-4xl leading-[1.05] font-semibold md:text-6xl">{title}</h1>
      <div className="mt-5 max-w-[62ch] text-[1.0625rem] text-dim md:text-lg">{standfirst}</div>
    </header>
  )
}

export function SectionHead({
  ord,
  title,
  children,
}: {
  ord?: string
  title: string
  children?: ReactNode
}) {
  return (
    <div className="mb-7">
      <div className="flex items-baseline gap-3">
        {ord && <span className="font-mono text-xs text-signal">{ord}</span>}
        <h2 className="text-2xl font-semibold md:text-3xl">{title}</h2>
      </div>
      {children && <div className="mt-3 max-w-[64ch] text-dim">{children}</div>}
    </div>
  )
}

/** A value. Always mono, always slightly larger than the label next to it. */
export function Value({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`font-mono tabular-nums text-text ${className}`}>{children}</span>
  )
}

/** Marks anything that costs money. Copper appears here and nowhere else. */
export function PaidTag({ children = 'paid' }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 border border-copper/50 bg-copper/10 px-2 py-0.5 font-mono text-[0.6875rem] tracking-wide text-copper">
      <span className="h-1.5 w-1.5 rounded-full bg-copper" aria-hidden />
      {children}
    </span>
  )
}

export function FreeTag({ children = 'free' }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 border border-line-bright bg-panel-2 px-2 py-0.5 font-mono text-[0.6875rem] tracking-wide text-dim">
      {children}
    </span>
  )
}

/** Repo path, rendered as the clickable-looking thing it is. */
export function FileRef({ path }: { path: string }) {
  return <span className="font-mono text-xs text-signal/85 break-all">{path}</span>
}

export function Prose({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`max-w-[68ch] space-y-4 text-[1.0625rem] leading-[1.7] ${className}`}>
      {children}
    </div>
  )
}
