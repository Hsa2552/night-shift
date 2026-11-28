/// <reference types="vitest/config" />
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, normalizePath } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// BASE_PATH : '/' par défaut (Vercel, Netlify, local).
// Le workflow GitHub Pages le règle sur '/<nom-du-depot>/'.
const base = process.env.BASE_PATH ?? '/'
const require = createRequire(import.meta.url)
const pdfjsRoot = dirname(require.resolve('pdfjs-dist/package.json'))

function buildRevision() {
  try {
    const git = (args: string[]) =>
      execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    const revision = git(['rev-parse', 'HEAD'])
    return git(['status', '--porcelain', '--untracked-files=no']) ? revision + '-dirty' : revision
  } catch {
    const revision = process.env.UNSPOIL_BUILD_SHA
    return revision && /^[a-f0-9]{40}$/.test(revision) ? revision : 'unknown'
  }
}

export default defineConfig({
  base,
  resolve: {
    alias: [
      // The vector probe only needs OPS. Share the reader's PDF.js runtime and worker.
      { find: /^pdfjs-dist$/, replacement: normalizePath(join(pdfjsRoot, 'legacy/build/pdf.mjs')) },
    ],
  },
  plugins: [
    {
      name: 'unspoil-build-revision',
      transformIndexHtml: () => [
        {
          tag: 'meta',
          attrs: { name: 'unspoil-build', content: buildRevision() },
          injectTo: 'head',
        },
      ],
    },
    react(),
    tailwindcss(),
    {
      name: 'pdfjs-assets',
      apply: 'build',
      generateBundle() {
        // PDF.js looks up these resources by their original filenames.
        for (const directory of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
          for (const file of readdirSync(join(pdfjsRoot, directory))) {
            this.emitFile({
              type: 'asset',
              fileName: `pdfjs/${directory}/${file}`,
              source: readFileSync(join(pdfjsRoot, directory, file)),
            })
          }
        }
      },
    },
    VitePWA({
      // Keep the old chunks available while an open tab can still import the PDF reader.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Unspoil',
        short_name: 'Unspoil',
        description: 'Entraînez-vous sur vos annales PDF en masquant les corrigés.',
        lang: 'fr',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        clientsClaim: true,
        globPatterns: [
          '**/*.{js,mjs,css,html,svg,png,ico,woff2,webmanifest,bcmap,pfb,ttf,wasm,icc}',
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
