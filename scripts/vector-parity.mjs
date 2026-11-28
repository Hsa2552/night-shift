import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { basename, isAbsolute, relative, resolve, sep } from 'node:path'
import { gotoBuild, hash, nodeProbe, openBuild } from './pdf-parity.mjs'

const [source, reportPath, ...files] = process.argv.slice(2)
assert.ok(
  source && reportPath && files.length,
  'Usage: node scripts/vector-parity.mjs <checkout construit avec --manifest> <rapport hors dépôt> <PDF>…',
)
const checkout = resolve(source)
for (const root of [process.cwd(), checkout]) {
  const place = relative(root, resolve(reportPath))
  assert.ok(isAbsolute(place) || place.startsWith('..' + sep), 'Rapport hors du dépôt')
}
const { loadPdf, nativeSquares } = await nodeProbe(checkout, {
  './src/detection/visual/vector/cases.ts': 'nativeSquares',
})
const manifest = JSON.parse(await readFile(resolve(checkout, 'dist/.vite/manifest.json'), 'utf8'))
const vectorEntry = manifest['src/detection/visual/vector/index.ts']?.file
const { GEO_METRICS_VERSION } = await import('../src/detection/eval/geo.ts')
const build = await openBuild(checkout)
function signature(obs) {
  if (!obs) return null
  const { rectangles, textPaint, ...pageData } = obs
  const paint = textPaint.map(({ font, ...item }) => ({
    ...item,
    font: font?.replace(/^g_d\d+_/, ''),
  }))
  const cases = nativeSquares(rectangles)
  const digest = (entry) => hash(JSON.stringify(entry))
  return {
    page: digest(pageData),
    rects: digest(rectangles),
    paints: digest(paint),
    rectsWithoutOrder: digest(rectangles.map(({ operatorIndex: _operatorIndex, ...item }) => item)),
    paintsWithoutOrder: digest(paint.map(({ operatorIndex: _operatorIndex, ...item }) => item)),
    candidates: digest(cases),
    counts: {
      rectangles: rectangles.length,
      paints: paint.length,
      images: obs.images,
      filled: cases.filter(({ nativeState }) => nativeState === 'filled').length,
      empty: cases.filter(({ nativeState }) => nativeState === 'empty').length,
      ambiguous: cases.filter(({ nativeState }) => nativeState === 'ambiguous').length,
    },
  }
}

try {
  const context = await build.browser.newContext({ serviceWorkers: 'block' })
  const stamp = await context.newPage()
  await gotoBuild(stamp, build)
  await stamp.close()
  const page = await context.newPage()
  const workers = () =>
    page.workers().filter((worker) => worker.url().includes('/pdf.worker')).length
  const url = new URL('vector-parity-lab', build.url).href
  await page.route(url, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<div id="root" hidden></div><input id="vector-fixture" type="file">',
    }),
  )
  const requested = new Set()
  page.on('request', (request) => requested.add(request.url()))
  await page.goto(url)
  await page.evaluate(async (reader) => {
    window.vectorOpen = (await import(new URL(reader, location.href).href)).openPdf
  }, build.reader)
  const vectorUrl = vectorEntry ? new URL(vectorEntry, build.url).href : undefined
  if (vectorUrl) assert.equal(requested.has(vectorUrl), false, 'Chargement vectoriel prématuré')
  const session = await context.newCDPSession(page)
  const heap = async () => {
    await session.send('HeapProfiler.collectGarbage')
    return (await session.send('Runtime.getHeapUsage')).usedSize
  }
  const before = await heap()
  const docs = []
  for (const file of files) {
    const bytes = await readFile(file)
    const pdfSha256 = hash(bytes)
    const truth = process.env.UNSPOIL_VECTOR_TRUTH_DIR
      ? await readFile(
          resolve(process.env.UNSPOIL_VECTOR_TRUTH_DIR, basename(file).replace(/\.pdf$/i, '.json')),
        ).catch((error) => {
          if (error.code === 'ENOENT') return null
          throw error
        })
      : null
    if (truth) assert.equal(JSON.parse(truth).sha256, pdfSha256)
    const node = await loadPdf(new Uint8Array(bytes), { raster: false })
    await page.locator('#vector-fixture').setInputFiles(resolve(file))
    const pageCount = await page.evaluate(async () => {
      const picker = document.querySelector('#vector-fixture')
      window.vectorPdf = await window.vectorOpen(picker.files[0])
      picker.value = ''
      return window.vectorPdf.pageCount
    })
    assert.equal(pageCount, node.pages.length)
    const pages = []
    let edgeMs = 0
    let nodeMs = 0
    try {
      for (let index = 0; index < pageCount; index++) {
        const start = performance.now()
        const nodeVectors = await node.getVectors(index)
        nodeMs += performance.now() - start
        const { observation, duration } = await page.evaluate(async (i) => {
          const start = performance.now()
          const observation = await window.vectorPdf.getVectors(i)
          return { observation, duration: performance.now() - start }
        }, index)
        edgeMs += duration
        if (observation) {
          const { width, height } = node.pages[index]
          assert.equal(observation.pageIndex, index)
          assert.deepEqual([observation.width, observation.height], [width, height])
          assert.ok(
            observation.rectangles.every(
              ({ region }) =>
                region.pageIndex === index && Object.values(region.bbox).every(Number.isFinite),
            ),
          )
        }
        pages.push({ index, node: signature(nodeVectors), edge: signature(observation) })
      }
    } finally {
      await node.close()
      await page.evaluate(async () => {
        await window.vectorPdf.close()
        delete window.vectorPdf
      })
    }
    const end = Date.now() + 3000
    while (workers() && Date.now() < end) await new Promise((resolve) => setTimeout(resolve, 25))
    assert.equal(workers(), 0)
    const row = {
      file: basename(file),
      pdfSha256,
      truthSha256: truth ? hash(truth) : undefined,
      pages: pageCount,
      unavailable: pages.filter((p) => !p.edge || !p.node).length,
      matching: pages.filter(
        (p) => p.edge && p.node && JSON.stringify(p.edge) === JSON.stringify(p.node),
      ).length,
      nodeMs: Math.round(nodeMs),
      edgeMs: Math.round(edgeMs),
      jsBytesAfterClose: await heap(),
      workersAfterClose: workers(),
    }
    docs.push({ ...row, observations: pages })
    console.log(JSON.stringify(row))
  }
  if (vectorUrl)
    assert.equal(
      requested.has(vectorUrl),
      true,
      'Le paquet vectoriel doit être chargé à la demande',
    )
  await writeFile(
    reportPath,
    JSON.stringify(
      {
        git: build.git,
        metricsVersion: GEO_METRICS_VERSION,
        browser: build.browser.version(),
        pdfjs: build.pdfjs,
        node: process.version,
        heapBefore: before,
        vectorEntry,
        documents: docs,
      },
      null,
      2,
    ),
  )
} finally {
  await build.close()
}
