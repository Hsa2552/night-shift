import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const [pdfPath, annotationsPath] = process.argv.slice(2)
if (!pdfPath) {
  console.error('Usage: node src/detection/visual/evaluate.mjs <PDF local> [annotations.json]')
  process.exit(1)
}

const base = new URL(process.env.UNSPOIL_EVAL_URL ?? 'http://127.0.0.1:5173/')
if (!['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) {
  throw new Error("Le banc d'essai exige un serveur Vite local.")
}

const playwright = process.env.UNSPOIL_PLAYWRIGHT_MODULE
const { chromium } = await import(playwright ? pathToFileURL(playwright).href : 'playwright')
const browser = await chromium.launch({ channel: process.env.UNSPOIL_EVAL_CHANNEL })
try {
  const page = await browser.newPage({ serviceWorkers: 'block' })
  await page.route('**/*', (route) =>
    new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort(),
  )
  await page.goto(base.href)
  const encoded = (await readFile(pdfPath)).toString('base64')
  const annotations = annotationsPath ? JSON.parse(await readFile(annotationsPath, 'utf8')) : []
  const report = await page.evaluate(
    async ({ encoded, annotations }) => {
      const { openPdf } = await import('/src/pdf/index.ts')
      const { analyzeColorPage, readColorConvention } =
        await import('/src/detection/visual/index.ts')
      const pdf = await openPdf(new Blob([Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0))]))
      const pages = []
      for (let index = 0; index < pdf.pageCount; index += 1) {
        pages.push(await pdf.getPageData(index))
      }
      const convention = readColorConvention(pages)
      const rows = []
      for (const page of pages) {
        const raster = await pdf.getRaster(page.pageIndex)
        const start = performance.now()
        const { ink, blocks, needsFallback } = analyzeColorPage(page, raster, convention)
        const durationMs = Math.round((performance.now() - start) * 10) / 10
        const masks = blocks.flatMap((block) => block.regions.map(({ bbox }) => bbox))
        const hueCounts = {}
        let neutralFragments = 0
        for (const sample of ink?.text ?? []) {
          if (sample.neutralPixels >= 3) neutralFragments += 1
          for (const { hue, pixels } of sample.colors) {
            if (pixels >= 3) hueCounts[hue] = (hueCounts[hue] ?? 0) + 1
          }
        }
        const matches = annotations.filter((truth) => truth.pageIndex === page.pageIndex)
        const overlaps = (a, b) =>
          a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
        const reference = matches.map(({ bbox, hue }) => ({
          measured: (ink?.text ?? []).some(
            (item) =>
              overlaps(item.region.bbox, bbox) &&
              (hue === undefined
                ? item.neutralPixels >= 3
                : item.colors.some((color) => {
                    const distance = Math.abs(color.hue - hue)
                    return color.pixels >= 3 && Math.min(distance, 360 - distance) <= 20
                  })),
          ),
          touchesMask: masks.some((mask) => overlaps(mask, bbox)),
        }))
        rows.push({
          page: page.pageIndex + 1,
          raster: [raster.width, raster.height],
          durationMs,
          neutralFragments,
          hueCounts,
          chromaticRegions: ink?.regions.length ?? 0,
          regionsWithoutText:
            ink?.regions.filter(({ textIndices }) => !textIndices.length).length ?? 0,
          blocks: blocks.length,
          needsFallback,
          annotated: reference.length,
          observed: reference.filter(({ measured }) => measured).length,
          touchedByMask: reference.filter(({ touchesMask }) => touchesMask).length,
        })
      }
      await pdf.close()
      return { convention, pages: rows }
    },
    { encoded, annotations },
  )
  console.log(JSON.stringify(report, null, 2))
} finally {
  await browser.close()
}
