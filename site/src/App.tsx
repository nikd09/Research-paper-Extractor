import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { TabNav } from './components/TabNav'
import { TABS, tabId } from './content/nav'
import { Overview } from './routes/Overview'
import { Architecture } from './routes/Architecture'
import { Verification } from './routes/Verification'
import { DomainPacks } from './routes/DomainPacks'
import { CaseStudy } from './routes/CaseStudy'
import { EngineeringLog } from './routes/EngineeringLog'
import { CostOps } from './routes/CostOps'
import { Status } from './routes/Status'

function ScrollReset() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])
  return null
}

export default function App() {
  const { pathname } = useLocation()
  const active = TABS.find((t) => t.path === pathname) ?? TABS[0]

  useEffect(() => {
    document.title =
      pathname === '/'
        ? 'The Multi-Tier Verification & Extraction Pipeline'
        : `${active.label} — The Multi-Tier Verification & Extraction Pipeline`
  }, [pathname, active.label])

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <ScrollReset />

      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:border focus:border-signal focus:bg-panel focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-line bg-ground/92 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-[1180px] px-4 md:px-8">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pt-4 pb-2">
            {/* the old wordmark ("Assay", 5 letters, uppercase+tracked like a
                logotype) doesn't survive a name this long -- readable size,
                normal case, and room to wrap instead. */}
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-display text-base leading-snug font-semibold sm:text-lg">
                The Multi-Tier Verification &amp; Extraction Pipeline
              </span>
              <span className="hidden font-mono text-[0.6875rem] text-dim sm:inline">
                v3.0 · knowledge extraction with provenance
              </span>
            </div>
            <a
              href="https://github.com/nikd09/Research-paper-Extractor"
              className="font-mono text-[0.6875rem] text-dim underline decoration-line-bright underline-offset-4 transition-colors hover:text-signal"
            >
              github.com/nikd09/Research-paper-Extractor
            </a>
          </div>
          <TabNav />
        </div>
      </header>

      <main
        id="content"
        role="tabpanel"
        aria-labelledby={tabId(active.path)}
        className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-12 md:px-8 md:py-16"
      >
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/architecture" element={<Architecture />} />
          <Route path="/verification" element={<Verification />} />
          <Route path="/domain-packs" element={<DomainPacks />} />
          <Route path="/case-study" element={<CaseStudy />} />
          <Route path="/engineering-log" element={<EngineeringLog />} />
          <Route path="/cost-ops" element={<CostOps />} />
          <Route path="/status" element={<Status />} />
          <Route path="*" element={<Overview />} />
        </Routes>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-4 px-4 py-8 font-mono text-xs text-dimmer md:px-8">
          <span>
            The Multi-Tier Verification &amp; Extraction Pipeline · v3.0 · first configured
            instance: seat recliner sliding layer
          </span>
          <span>Built by Nik. Every number on this site came out of the repo.</span>
        </div>
      </footer>
    </div>
  )
}
