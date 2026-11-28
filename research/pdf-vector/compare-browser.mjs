import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const [server, ...args] = process.argv.slice(2)
const nativeText = args[0] === '--native-text'
const vector = nativeText || args[0] === '--vector'
const files = vector ? args.slice(1) : args
const url = server ? new URL(server) : null
if (!url || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || !files.length) {
  throw new Error(
    'Usage: node compare-browser.mjs <URL locale Vite> [--vector | --native-text] <PDF>...',
  )
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
  const sources = vector
    ? [
        '/src/detection/visual/vector/index.ts',
        '/src/detection/visual/vector/geometry.ts',
        '/src/detection/visual/vector/cases.ts',
        '/research/pdf-vector/pdfjs-browser.ts',
      ]
    : ['/src/pdf/index.ts', '/src/detection/boxes.ts']
  if (nativeText)
    sources.push(
      '/src/detection/visual/vector/native-page.ts',
      '/src/detection/visual/vector/glyph-run.ts',
      '/src/detection/visual/vector/text-colors.ts',
      '/src/detection/visual/vector/symbol-relations.ts',
      '/src/detection/visual/vector/graphics.ts',
      '/src/pdf/read-text.ts',
    )
  const fingerprints = {}
  for (const path of sources) {
    const source = await tab.evaluate(async (path) => (await import(path + '?raw')).default, path)
    fingerprints[path] = createHash('sha256').update(source).digest('hex')
  }
  const documents = []
  for (const file of files) {
    const bytes = await readFile(file)
    const observed = await tab.evaluate(
      async ({ encoded, vector, nativeText }) => {
        const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0))
        if (vector) {
          const { measure } = await import('/research/pdf-vector/pdfjs-browser.ts')
          return measure(bytes, nativeText)
        }
        const { openPdf } = await import('/src/pdf/index.ts')
        const { findBoxes } = await import('/src/detection/boxes.ts')
        const doc = await openPdf(new Blob([bytes]))
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
      },
      { encoded: bytes.toString('base64'), vector, nativeText },
    )
    documents.push({ build, sha256: createHash('sha256').update(bytes).digest('hex'), ...observed })
  }
  console.log(
    JSON.stringify({
      format: nativeText
        ? 'unspoil-native-text/1'
        : vector
          ? 'unspoil-pdfjs-vector/1'
          : 'unspoil-raster-comparison/1',
      sourceSha256: fingerprints,
      documents,
    }),
  )
} finally {
  await browser.close()
}
