# The Multi-Tier Verification & Extraction Pipeline — project site

The site for the extraction engine in this repo. Eight URL-routed tabs covering the
verification model, the architecture, the domain-pack question, the seat recliner case
study, the engineering log, cost and ops, and the known limits.

Vite + React + TypeScript, Tailwind CSS v4, Framer Motion, react-router-dom,
prism-react-renderer, lucide-react. IBM Plex is self-hosted via `@fontsource` — the
build makes no external network requests at runtime.

## Local development

```bash
cd site
npm install
npm run dev          # http://localhost:5173
```

```bash
npm run build        # type-check + production build into site/dist
npm run preview      # serve the production build
npm run lint
```

`npm run build` also writes `dist/404.html` as a copy of `dist/index.html`. GitHub Pages
has no rewrite rule, so without it a hard refresh on `/verification` would 404 instead of
reaching the router.

## Deploy

`.github/workflows/deploy-site.yml` builds and deploys on any push to `main` that touches
`site/`. It sets `SITE_BASE=/Research-paper-Extractor/` so asset URLs and the router
basename match a project site.

One-time setup in the repo: **Settings → Pages → Source: GitHub Actions**. After that the
site is at `https://nikd09.github.io/Research-paper-Extractor/`.

Serving from a domain root instead (Vercel, a custom domain) needs no code change — leave
`SITE_BASE` unset and `base` falls back to `/`.

## Content lives in data, not JSX

Everything the site states is a typed record in `src/content/`. Components render those
records; they don't contain copy. That mirrors what the engine itself is trying to reach —
retargeting the site to a different domain should be a data edit.

| File | What's in it |
| --- | --- |
| `types.ts` | Every content type. Start here. |
| `confidence.ts` | The six confidence states, the three mechanisms, the evidence ladder. |
| `stages.ts` | The seven pipeline stages, the three tracked specimens, the API-call meter. |
| `bugs.ts` | The engineering log entries. |
| `packs.ts` | Domain locks, the pack proposal, Pack 01 and Pack 02. |
| `caseStudy.ts` | Spec numbers, extracted values, the Flash-vs-Pro comparison. |
| `ops.ts` | Stage routing and the key-rotation code excerpts. |
| `limits.ts` | Status, what's tested, what isn't, and the known limits. |
| `quotes.ts` | The pull quotes. |
| `nav.ts` | Tab order, labels and routes. |

### Adding a domain pack to the site

The engine's own pack refactor isn't shipped yet (tab 04 says so). On the site side,
adding a second pack is a data edit:

1. Add a `PackDef` to `PACKS` in `src/content/packs.ts`. The toggle on tab 04 renders every
   entry in that array, so a third pack needs no component change.
2. Set `status: 'illustrative'` for anything that hasn't actually been run. The tab renders
   an unmissable warning banner for that status and it should stay that way — nothing on
   this site should imply results that don't exist.
3. If the pack is real and running, add its extracted values to `EXTRACTED` in
   `caseStudy.ts` and its spec numbers to `SPEC`, both sourced from the pipeline's own
   output rather than typed from memory.
4. Retargeting the whole site to a different domain means replacing the modules in
   `src/content/` and leaving `src/components/` and `src/routes/` alone. If a change forces
   a component edit, that's the site's version of the same coupling tab 04 complains about.

### The pull quotes

`src/content/quotes.ts` holds six quotes, each with a `status` field. Anything marked
`draft-reconstruction` renders with a visible "awaiting Nik's edit" badge, because those
were drafted from the bug history rather than from his memory. Editing the text and
flipping `status` to `'approved'` removes the badge.

## Design constraints worth keeping

- **Copper (`--color-copper`) marks anything that costs money. Nothing else, ever.** A reader
  should be able to find every paid-tier call on the site by scanning for one colour.
- **The six confidence hues appear only on confidence states.** Not on charts, not on
  syntax highlighting, not as decoration.
- **Every numeric value sets in mono.** Numbers are the subject.
- **One orchestrated motion moment per tab, at most.** The hero's confidence stamp, the
  travelling specimen tray, the ladder assembling on scroll. `prefers-reduced-motion` means
  static, not faster.

## Accessibility

Checked with axe-core (WCAG 2.1 A/AA) across all eight routes — clean. Tabs use the ARIA
tabs pattern with roving tabindex and arrow/Home/End navigation, scroll containers are
keyboard-reachable, and the layout holds down to 360px.
