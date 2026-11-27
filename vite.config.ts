/// <reference types="vitest/config" />
import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// BASE_PATH : '/' par défaut (Vercel, Netlify, local).
// Le workflow GitHub Pages le règle sur '/<nom-du-depot>/'.
const base = process.env.BASE_PATH ?? '/'
const require = createRequire(import.meta.url)
const pdfjsRoot = dirname(require.resolve('pdfjs-dist/package.json'))

export default defineConfig({
  base,
  plugins: [
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
      // Service worker généré automatiquement et mis à jour sans intervention.
      // Si le sujet exige un service worker sur mesure (notifications push, cache
      // particulier), passer à strategies: 'injectManifest' (voir memoire/ARCHITECTURE.md).
      registerType: 'autoUpdate',
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
