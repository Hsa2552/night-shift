import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright-core'
import { build, normalizePath, preview } from 'vite'

export const hash = (data) => createHash('sha256').update(data).digest('hex')
const digest = (data) => hash(JSON.stringify(data) ?? 'undefined')

export async function openBuild(checkout) {
  const git = (...args) => execFileSync('git', args, { cwd: checkout, encoding: 'utf8' }).trim()
  const sha = git('rev-parse', 'HEAD')
  const dirty = !!git('status', '--porcelain')
  const manifest = JSON.parse(await readFile(resolve(checkout, 'dist/.vite/manifest.json'), 'utf8'))
  const webManifest = JSON.parse(
    await readFile(resolve(checkout, 'dist/manifest.webmanifest'), 'utf8'),
  )
  const pdfjs = JSON.parse(
    await readFile(resolve(checkout, 'node_modules/pdfjs-dist/package.json'), 'utf8'),
  ).version
  const source = await preview({
    root: checkout,
    configFile: false,
    base: webManifest.scope,
    preview: { host: '127.0.0.1', port: 0, strictPort: true },
  })
  try {
    const browser = await chromium.launch({ channel: process.env.UNSPOIL_CHANNEL || 'msedge' })
    return {
      browser,
      git: { sha, dirty },
      pdfjs,
      url: `http://127.0.0.1:${source.httpServer.address().port}${webManifest.scope}`,
      reader: manifest['src/pdf/index.ts'].file,
      detection: manifest['src/detection/index.ts'].file,
      worker: manifest['src/pdf/index.ts'].assets?.find((file) => file.includes('pdf.worker')),
      close: async () => {
        await browser.close()
        await source.close()
      },
    }
  } catch (error) {
    await source.close()
    throw error
  }
}

export async function gotoBuild(page, release) {
  await page.goto(release.url, { waitUntil: 'domcontentloaded' })
  const stamp = release.git.sha + (release.git.dirty ? '-dirty' : '')
  assert.equal(await page.locator('meta[name=unspoil-build]').getAttribute('content'), stamp)
}

export async function openBrowserProbe(page, release, file) {
  await page.evaluate(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.id = 'parity-input'
    input.hidden = true
    document.body.append(input)
  })
  await page.locator('#parity-input').setInputFiles(file)
  return page.evaluate(
    async ({ reader, detection }) => {
      const { openPdf } = await import(new URL(reader, location.href).href)
      const { detectCorrections } = await import(new URL(detection, location.href).href)
      const input = document.querySelector('#parity-input')
      const pdf = await openPdf(input.files[0])
      input.remove()
      try {
        const pages = []
        for (let index = 0; index < pdf.pageCount; index++) pages.push(await pdf.getPageData(index))
        const rasterRequests = []
        const vectorRequests = []
        const result = await detectCorrections({
          pages,
          getRaster(index) {
            rasterRequests.push(index)
            return pdf.getRaster(index)
          },
          getVectors:
            pdf.getVectors &&
            ((index) => {
              vectorRequests.push(index)
              return pdf.getVectors(index)
            }),
        })
        window.parityPdf = pdf
        return { pages, result, rasterRequests, vectorRequests }
      } catch (error) {
        await pdf.close()
        throw error
      }
    },
    { reader: release.reader, detection: release.detection },
  )
}

export async function browserRaster(page, index) {
  const { width, height, base64 } = await page.evaluate(async (index) => {
    const { width, height, rgba } = await window.parityPdf.getRaster(index)
    return {
      width,
      height,
      base64: new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength).toBase64(),
    }
  }, index)
  return { width, height, rgba: new Uint8ClampedArray(Buffer.from(base64, 'base64')) }
}

async function browserControls(page, release, checkout, bytes, productionRasters) {
  assert.ok(release.worker, 'Worker PDF.js absent du manifeste de production')
  const moduleUrl = new URL('__parity_control.mjs', release.url).href
  const runtime = await readFile(resolve(checkout, 'node_modules/pdfjs-dist/legacy/build/pdf.mjs'))
  await page.route(moduleUrl, (route) =>
    route.fulfill({ contentType: 'text/javascript', body: runtime }),
  )
  await page.evaluate(async (url) => {
    window.parityControl = await import(url)
  }, moduleUrl)
  const variants = [
    ['edge-fontface', {}],
    ['edge-system-fonts-off', { useSystemFonts: false }],
    ['edge-outline-fonts', { disableFontFace: true, useSystemFonts: false }],
  ]
  const data = bytes.toString('base64')
  const out = new Map()
  for (const [name, options] of variants) {
    await page.evaluate(
      async ({ data, worker, options }) => {
        const { getDocument, GlobalWorkerOptions } = window.parityControl
        GlobalWorkerOptions.workerSrc = new URL(worker, location.href).href
        const url = (directory) => new URL(`pdfjs/${directory}/`, location.href).href
        const task = getDocument({
          data: Uint8Array.fromBase64(data),
          cMapUrl: url('cmaps'),
          cMapPacked: true,
          standardFontDataUrl: url('standard_fonts'),
          wasmUrl: url('wasm'),
          iccUrl: url('iccs'),
          ...options,
        })
        window.parityControlTask = task
        window.parityControlDocument = await task.promise
      },
      { data, worker: release.worker, options },
    )
    const rasters = new Map()
    try {
      for (const [index, { width, height }] of productionRasters) {
        const base64 = await page.evaluate(
          async ({ index, width, height }) => {
            const pdfPage = await window.parityControlDocument.getPage(index + 1)
            const viewport = pdfPage.getViewport({ scale: 1 })
            const canvas = document.createElement('canvas')
            const context = canvas.getContext('2d', { alpha: true, willReadFrequently: true })
            canvas.width = width
            canvas.height = height
            const transform = [width / viewport.width, 0, 0, height / viewport.height, 0, 0]
            await pdfPage.render({ canvas, viewport, transform, background: '#fff' }).promise
            const { data } = context.getImageData(0, 0, width, height)
            const base64 = new Uint8Array(data.buffer, data.byteOffset, data.byteLength).toBase64()
            canvas.width = 0
            canvas.height = 0
            return base64
          },
          { index, width, height },
        )
        rasters.set(index, {
          width,
          height,
          rgba: new Uint8ClampedArray(Buffer.from(base64, 'base64')),
        })
      }
    } finally {
      await page.evaluate(() => window.parityControlTask.destroy())
    }
    out.set(name, rasters)
  }
  return out
}

export async function nodeProbe(checkout, extraSources = {}) {
  const sources = {
    './src/detection/index.ts': 'detectCorrections',
    './src/detection/layout.ts': 'layoutPage',
    './src/detection/visual/index.ts': 'observePageInk',
    './src/detection/eval/loader.ts': 'loadPdf',
    ...extraSources,
  }
  const work = resolve(checkout, 'dev-dist/parity-ssr')
  const entry = resolve(work, 'entry.mjs')
  await mkdir(work, { recursive: true })
  await writeFile(
    entry,
    Object.entries(sources)
      .map(
        ([path, symbol]) =>
          `export { ${symbol} } from ${JSON.stringify(resolve(checkout, path).replaceAll('\\', '/'))}`,
      )
      .join('\n') +
      `\nexport { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'` +
      `\nexport { fitCanvas, MAX_RASTER_PIXELS } from ${JSON.stringify(resolve(checkout, 'src/pdf/canvas-size.ts').replaceAll('\\', '/'))}`,
  )
  await build({
    configFile: false,
    root: checkout,
    logLevel: 'error',
    resolve: {
      alias: [
        {
          find: /^pdfjs-dist$/,
          replacement: normalizePath(
            resolve(checkout, 'node_modules/pdfjs-dist/legacy/build/pdf.mjs'),
          ),
        },
      ],
    },
    build: {
      ssr: entry,
      outDir: work,
      emptyOutDir: false,
      rollupOptions: { output: { entryFileNames: 'probe.mjs' } },
    },
  })
  return import(pathToFileURL(resolve(work, 'probe.mjs')).href)
}

function compareText(node, edge) {
  const normalize = (list) =>
    list.map(({ fontName, ...item }) => ({
      ...item,
      fontName: fontName?.replace(/^g_d\d+_/, ''),
    }))
  const a = normalize(node.textItems)
  const b = normalize(edge.textItems)
  const by = (key) =>
    a.filter((item, index) => digest(item[key]) !== digest(b[index]?.[key])).length
  const first = a.findIndex((item, index) => digest(item) !== digest(b[index] ?? null))
  return {
    dimensions: [
      [node.width, node.height],
      [edge.width, edge.height],
    ],
    fragments: [a.length, b.length],
    matchesAfterFontId: digest(a) === digest(b),
    textDifferences: by('text'),
    bboxDifferences: by('bbox'),
    fontSizeDifferences: by('fontSize'),
    fontNameDifferences: by('fontName'),
    hasEOLDifferences: by('hasEOL'),
    firstDifferentIndex: first < 0 ? null : first,
  }
}

function compareRaster(node, edge) {
  const sameSize = node.width === edge.width && node.height === edge.height
  let different = 0
  let inkChanged = 0
  if (sameSize) {
    for (let i = 0; i < node.rgba.length; i += 4) {
      const a = node.rgba.subarray(i, i + 3)
      const b = edge.rgba.subarray(i, i + 3)
      if (a.some((sample, channel) => sample !== b[channel])) different++
      if (a.some((sample) => sample < 239) !== b.some((sample) => sample < 239)) inkChanged++
    }
  }
  return {
    dimensions: [
      [node.width, node.height],
      [edge.width, edge.height],
    ],
    hashes: [hash(node.rgba), hash(edge.rgba)],
    differentPixels: sameSize ? different : null,
    inkChangedPixels: sameSize ? inkChanged : null,
  }
}

async function diagnose() {
  const [source, path, annotation, output] = process.argv.slice(2)
  assert.ok(
    source && path && annotation && output,
    'Usage: node scripts/pdf-parity.mjs <checkout propre construit avec --manifest> <PDF> <vérité> <rapport hors dépôt>',
  )
  const checkout = resolve(source)
  const bytes = await readFile(path)
  const truthBytes = await readFile(annotation)
  const { scoreGeo, GEO_METRICS_VERSION } = await import('../src/detection/eval/geo.ts')
  const truth = JSON.parse(truthBytes)
  const {
    loadPdf,
    detectCorrections,
    layoutPage,
    observePageInk,
    getDocument,
    fitCanvas,
    MAX_RASTER_PIXELS,
  } = await nodeProbe(checkout)
  const fontRoot =
    resolve(checkout, 'node_modules/pdfjs-dist/standard_fonts').replaceAll('\\', '/') + '/'
  const node = await loadPdf(new Uint8Array(bytes), { standardFontDataUrl: fontRoot, raster: true })
  assert.ok(node.getRaster, 'Rendu Node requis')
  try {
    const release = await openBuild(checkout)
    try {
      const page = await release.browser.newPage({ serviceWorkers: 'block' })
      const resources = new Set()
      page.on('request', (request) => {
        const address = new URL(request.url())
        if (address.pathname.includes('/pdfjs/') || address.pathname.includes('/pdf.worker')) {
          resources.add(address.pathname)
        }
      })
      await gotoBuild(page, release)
      const edge = await openBrowserProbe(page, release, resolve(path))
      assert.equal(node.pages.length, edge.pages.length)
      const indexes = node.pages.map(({ pageIndex }) => pageIndex)
      const nodeRasters = new Map()
      const edgeRasters = new Map()
      const pages = []
      const normalizedLayout = (page) => {
        const layout = layoutPage(page)
        for (const line of layout.lines) {
          line.fontNames = line.fontNames.map((name) => name.replace(/^g_d\d+_/, ''))
        }
        return digest(layout)
      }
      for (const index of indexes) {
        const nodeRaster = await node.getRaster(index)
        const edgeRaster = await browserRaster(page, index)
        nodeRasters.set(index, nodeRaster)
        edgeRasters.set(index, edgeRaster)
        const a = node.pages[index]
        const b = edge.pages[index]
        pages.push({
          index,
          text: compareText(a, b),
          layout: [normalizedLayout(a), normalizedLayout(b)],
          raster: compareRaster(nodeRaster, edgeRaster),
          color: [
            digest(observePageInk(a, nodeRaster)),
            digest(observePageInk(a, edgeRaster)),
            digest(observePageInk(b, nodeRaster)),
            digest(observePageInk(b, edgeRaster)),
          ],
        })
      }
      const outcomes = []
      const reportResult = (text, raster, result, sourcePages, requests) => ({
        text,
        raster,
        requests,
        resultSha256: digest(result),
        ...scoreGeo(truth, result, sourcePages),
      })
      for (const [text, sourcePages] of [
        ['node', node.pages],
        ['edge', edge.pages],
      ]) {
        for (const [raster, rasters] of [
          ['node', nodeRasters],
          ['edge', edgeRasters],
        ]) {
          const requests = []
          const result = await detectCorrections({
            pages: sourcePages,
            getRaster: async (index) => {
              requests.push(index)
              return rasters.get(index)
            },
          })
          outcomes.push(reportResult(text, raster, result, sourcePages, requests))
        }
      }
      if (process.env.UNSPOIL_PARITY_CONTROLS === '1') {
        const asset = (directory) =>
          resolve(checkout, 'node_modules/pdfjs-dist', directory).replaceAll('\\', '/') + '/'
        const variants = [
          ['transform', {}],
          [
            'transform-resources',
            {
              standardFontDataUrl: asset('standard_fonts'),
              cMapUrl: asset('cmaps'),
              cMapPacked: true,
              wasmUrl: asset('wasm'),
              iccUrl: asset('iccs'),
            },
          ],
          [
            'transform-resources-system-fonts',
            {
              standardFontDataUrl: asset('standard_fonts'),
              cMapUrl: asset('cmaps'),
              cMapPacked: true,
              wasmUrl: asset('wasm'),
              iccUrl: asset('iccs'),
              useSystemFonts: true,
            },
          ],
        ]
        for (const [name, options] of variants) {
          const task = getDocument({
            data: new Uint8Array(bytes),
            standardFontDataUrl: fontRoot,
            useSystemFonts: false,
            ...options,
          })
          try {
            const document = await task.promise
            const requests = []
            const result = await detectCorrections({
              pages: node.pages,
              getRaster: async (index) => {
                requests.push(index)
                const pdfPage = await document.getPage(index + 1)
                const viewport = pdfPage.getViewport({ scale: 1 })
                const { width, height } = fitCanvas(
                  viewport.width,
                  viewport.height,
                  1,
                  MAX_RASTER_PIXELS,
                )
                const { canvas, context } = document.canvasFactory.create(width, height)
                const transform = [width / viewport.width, 0, 0, height / viewport.height, 0, 0]
                try {
                  await pdfPage.render({
                    canvas,
                    canvasContext: context,
                    viewport,
                    transform,
                    background: '#fff',
                  }).promise
                  return { width, height, rgba: context.getImageData(0, 0, width, height).data }
                } finally {
                  document.canvasFactory.destroy({ canvas, context })
                }
              },
            })
            outcomes.push(reportResult('node', name, result, node.pages, requests))
          } finally {
            await task.destroy()
          }
        }
        const browserVariants = await browserControls(page, release, checkout, bytes, edgeRasters)
        for (const [name, rasters] of browserVariants) {
          const requests = []
          const result = await detectCorrections({
            pages: edge.pages,
            getRaster: async (index) => {
              requests.push(index)
              return rasters.get(index)
            },
          })
          outcomes.push({
            ...reportResult('edge', name, result, edge.pages, requests),
            byPageVersusProduction: indexes.map((index) =>
              compareRaster(rasters.get(index), edgeRasters.get(index)),
            ),
          })
        }
      }
      await page.evaluate(() => window.parityPdf.close())
      const report = {
        git: release.git,
        pdfSha256: hash(bytes),
        truthSha256: hash(truthBytes),
        truthVersion: truth.format,
        metricsVersion: GEO_METRICS_VERSION,
        runtime: {
          browser: release.browser.version(),
          node: process.version,
          pdfjs: release.pdfjs,
        },
        resources: [...resources],
        pages,
        outcomes,
        realBrowser: reportResult('edge', 'edge', edge.result, edge.pages, edge.rasterRequests),
      }
      await mkdir(dirname(resolve(output)), { recursive: true })
      await writeFile(output, JSON.stringify(report, null, 2))
      for (const outcome of [...outcomes, report.realBrowser]) {
        console.log(
          outcome.text,
          outcome.raster,
          outcome.corrections,
          outcome.resultSha256.slice(0, 12),
        )
      }
    } finally {
      await release.close()
    }
  } finally {
    await node.close()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await diagnose()
}
