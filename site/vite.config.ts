import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'

// SITE_BASE is set by the Pages workflow to '/<repo-name>/'. Local dev and
// any host serving from a domain root leave it unset.
const base = process.env.SITE_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    {
      // GitHub Pages has no rewrite rule, so a hard refresh on /verification
      // would 404. Pages serves 404.html for unknown paths; making that a
      // copy of index.html hands the URL back to the router.
      name: 'spa-404-fallback',
      closeBundle() {
        const dist = resolve(import.meta.dirname, 'dist')
        copyFileSync(resolve(dist, 'index.html'), resolve(dist, '404.html'))
      },
    },
  ],
})
