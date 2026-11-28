import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const [server, ...files] = process.argv.slice(2)
const url = new URL(server)
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || !files.length) {
  throw new Error('Usage: node compare-browser.mjs <URL locale Vite> <PDF>...')
}

const modulePath = process.env.UNSPOIL_PLAYWRIGHT_MODULE
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright-core')
const browser = await chromium.launch({ channel: process.env.UNSPOIL_CHANNEL ?? 'msedge' })
try {
  const tab = await browser.newPage()
  await tab.route('**/*', (route) =>
    new URL(route.request().url()).origin === url.origin ? route.continue() : route.abort(),
  )
  const response = await tab.request.get(url.href)
  const build = (await response.text()).match(/name="unspoil-build" content="([^"]+)"/)?.[1]
  const labUrl = new URL('/__unspoil_vector_lab__', url).href
  await tab.route(labUrl, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>Unspoil vector lab</title>' }),
  )
  await tab.goto(labUrl)
  const documents = []
  for (const file of files) {
    const bytes = await readFile(file)
    const observed = await tab.evaluate(async (encoded) => {
      const { openPdf } = await import('/src/pdf/index.ts')
      const { findBoxes } = await import('/src/detection/boxes.ts')
      const doc = await openPdf(
        new Blob([Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0))]),
      )
      try {
        const pages = []
        for (let pageIndex = 0; pageIndex < doc.pageCount; pageIndex++) {
          const page = await doc.getPageData(pageIndex)
          const start = performance.now()
          const raster = await doc.getRaster(pageIndex)
          const rendered = performance.now()
          const cases = findBoxes(raster, page).map(({ bbox, filled }) => ({
            bbox: [bbox.x, bbox.y, bbox.width, bbox.height],
            state: filled ? 'filled' : 'empty',
          }))
          pages.push({
            pageIndex,
            rasterMs: rendered - start,
            ms: performance.now() - rendered,
            cases,
          })
        }
        return { pages }
      } finally {
        await doc.close()
      }
    }, bytes.toString('base64'))
    documents.push({ build, sha256: createHash('sha256').update(bytes).digest('hex'), ...observed })
  }
  console.log(JSON.stringify({ format: 'unspoil-raster-comparison/1', documents }))
} finally {
  await browser.close()
}
