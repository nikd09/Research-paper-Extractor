import { useRef } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { TABS, tabId } from '../content/nav'

/**
 * Persistent top-level navigation. Real links (deep-linkable, shareable,
 * middle-clickable) wearing tab semantics, with roving tabindex and
 * arrow-key movement per the ARIA tabs pattern.
 */
export function TabNav() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const railRef = useRef<HTMLDivElement>(null)

  const currentIndex = Math.max(
    0,
    TABS.findIndex((t) => t.path === pathname),
  )

  function focusTab(index: number) {
    const next = (index + TABS.length) % TABS.length
    navigate(TABS[next].path)
    const el = railRef.current?.querySelectorAll<HTMLAnchorElement>('[role="tab"]')[next]
    el?.focus()
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  function onKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault()
        focusTab(currentIndex + 1)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault()
        focusTab(currentIndex - 1)
        break
      case 'Home':
        e.preventDefault()
        focusTab(0)
        break
      case 'End':
        e.preventDefault()
        focusTab(TABS.length - 1)
        break
    }
  }

  return (
    <div
      ref={railRef}
      role="tablist"
      aria-label="Sections"
      onKeyDown={onKeyDown}
      className="scrollbar-none -mx-4 flex gap-px overflow-x-auto px-4 md:mx-0 md:px-0"
    >
      {TABS.map((tab, i) => {
        const selected = i === currentIndex
        return (
          <NavLink
            key={tab.path}
            to={tab.path}
            role="tab"
            id={tabId(tab.path)}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            title={tab.blurb}
            className={`group relative flex shrink-0 items-baseline gap-2 border-b-2 px-3 py-3 text-sm whitespace-nowrap transition-colors duration-150 md:px-4 ${
              selected
                ? 'border-signal text-text'
                : 'border-transparent text-dim hover:border-line-bright hover:text-text'
            }`}
          >
            <span
              className={`font-mono text-[0.6875rem] ${selected ? 'text-signal' : 'text-dimmer'}`}
            >
              {tab.ord}
            </span>
            <span className="font-display font-medium tracking-wide">{tab.label}</span>
          </NavLink>
        )
      })}
    </div>
  )
}
