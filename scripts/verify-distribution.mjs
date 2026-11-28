import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { chromium, firefox, webkit } from 'playwright-core'
import { build } from 'vite'
import { makeGraphicsOnlyTestPdf, makeLargeTestPdf, makeTestPdf } from '../src/pdf/test-pdf.ts'

const repo = resolve(process.cwd())
const base = '/night-shift/'
const prefix = 'unspoil-private-fixture'
const scenario = process.argv[2] ?? 'resilience'
assert.ok(
  ['resilience', 'update', 'performance'].includes(scenario),
  'Expected resilience, update or performance',
)
const output = resolve(repo, 'dev-dist', 'distribution', scenario)
const types = {
  html: 'text/html',
  css: 'text/css',
  js: 'application/javascript',
  mjs: 'application/javascript',
  webmanifest: 'application/manifest+json',
  wasm: 'application/wasm',
  png: 'image/png',
  svg: 'image/svg+xml',
}
const input = (name) => resolve(repo, 'src/detection/samples', name)
// Generated test fixture: one blank page encrypted with the password "fixture-only".
const encrypted = fileURLToPath(new URL('./fixtures/password.pdf', import.meta.url))

async function deployable(version) {
  const path = resolve(output, version)
  await build({
    root: repo,
    configFile: resolve(repo, 'vite.config.ts'),
    base,
    logLevel: 'warn',
    build: { outDir: path, emptyOutDir: true, manifest: true },
    plugins: [
      {
        name: 'unspoil-release-fixture',
        enforce: 'pre',
        transformIndexHtml: () => [
          { tag: 'meta', attrs: { name: 'unspoil-distribution-test-build', content: version } },
        ],
        transform: (code, id) =>
          id.endsWith('/src/pdf/index.ts')
            ? `${code}\nglobalThis.__pdfTestBuild = ${JSON.stringify(version)};\n`
            : undefined,
      },
    ],
  })
  const emitted = JSON.parse(await readFile(resolve(path, '.vite/manifest.json'), 'utf8'))
  const pwa = JSON.parse(await readFile(resolve(path, 'manifest.webmanifest'), 'utf8'))
  assert.equal(pwa.scope, base)
  assert.equal(pwa.start_url, base)
  assert.ok(pwa.icons.some((icon) => icon.sizes === '192x192'))
  assert.ok(pwa.icons.some((icon) => icon.sizes === '512x512'))
  const serviceWorker = await readFile(resolve(path, 'sw.js'), 'utf8')
  for (const asset of [
    emitted['src/pdf/index.ts'].file,
    'pdf.worker',
    '/standard_fonts/',
    '/cmaps/',
    '/wasm/',
  ]) {
    assert.ok(serviceWorker.includes(asset), `Missing precache resource: ${asset}`)
  }
  return {
    path,
    version,
    pdf: emitted['src/pdf/index.ts'].file,
    detection: emitted['src/detection/index.ts'].file,
  }
}

const first = await deployable('one')
const second = scenario === 'update' ? await deployable('two') : undefined
let deployment = first
let online = true
const requests = []
const missing = []
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname
  requests.push({
    method: request.method,
    url: request.url,
    upload:
      Number(request.headers['content-length'] ?? 0) > 0 ||
      Boolean(request.headers['transfer-encoding']),
  })
  if (!online) return request.socket.destroy()
  if (pathname === '/release-monitor')
    return response
      .writeHead(200, { 'content-type': 'text/html' })
      .end('<!doctype html><title>Release monitor</title>')
  if (!pathname.startsWith(base)) return response.writeHead(404).end()
  const asset = pathname.slice(base.length) || 'index.html'
  try {
    const path = resolve(deployment.path, asset)
    const inside = relative(deployment.path, path)
    if (!inside || inside === '..' || inside.startsWith('..' + sep))
      return response.writeHead(404).end()
    const data = await readFile(path)
    response.setHeader('cache-control', 'no-store')
    response.setHeader('content-type', types[asset.split('.').at(-1)] ?? 'application/octet-stream')
    response.end(data)
  } catch {
    missing.push(pathname)
    response.writeHead(404).end()
  }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const url = `http://127.0.0.1:${server.address().port}${base}`
const origin = new URL(url).origin
const chromiumOptions = process.env.UNSPOIL_CHROMIUM_PATH
  ? { executablePath: process.env.UNSPOIL_CHROMIUM_PATH }
  : {}

function syntheticPdf(name, bytes) {
  return { name: `${prefix}-${name}.pdf`, mimeType: 'application/pdf', buffer: Buffer.from(bytes) }
}

async function leaveDemoOffscreen(page) {
  // The homepage opens its own synthetic PDF when the demo becomes visible.
  await page.addInitScript(() => {
    const observe = IntersectionObserver.prototype.observe
    IntersectionObserver.prototype.observe = function (element) {
      if (!element.matches('.demo-preview')) observe.call(this, element)
    }
  })
}

async function load(page, version) {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  const build = page.locator('meta[name="unspoil-distribution-test-build"]')
  assert.equal(await build.getAttribute('content'), version)
  await page.locator('input[type=file]').waitFor({ state: 'attached' })
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 20000 })
}

async function importPdf(page, file, name) {
  await page.locator('input[type=file]').setInputFiles(file)
  await page.getByRole('heading', { name }).waitFor()
  await page.getByTestId('page-cover').first().waitFor()
}

async function analyze(page) {
  await page.getByRole('button', { name: 'Masquer les corrigés' }).click()
  await page
    .getByRole('status')
    .filter({ hasText: /détecté|incertaine|ne peuvent pas être placés/i })
    .waitFor()
}

async function storage(page) {
  return page.evaluate(async () => {
    const entries = []
    for (const key of await caches.keys()) {
      const cache = await caches.open(key)
      for (const req of await cache.keys()) {
        const response = await cache.match(req)
        entries.push({ url: req.url, mime: response.headers.get('content-type') })
      }
    }
    return {
      entries,
      preferences: Object.entries(localStorage),
      temporaryKeys: Object.keys(sessionStorage),
      databases: indexedDB.databases ? (await indexedDB.databases()).map((db) => db.name) : null,
    }
  })
}

async function verifyPrivacy(page, network) {
  const retained = await storage(page)
  assert.ok(retained.entries.length > 0)
  assert.ok(retained.entries.every((entry) => new URL(entry.url).origin === origin))
  assert.ok(
    retained.entries.every(
      (entry) => !entry.mime?.startsWith('application/pdf') && !entry.url.includes(prefix),
    ),
  )
  assert.ok(
    retained.preferences.every(
      ([key, value]) => key === 'unspoil-theme' && ['light', 'dark'].includes(value),
    ),
  )
  assert.equal(retained.temporaryKeys.length, 0)
  assert.ok(!retained.databases || retained.databases.every((name) => name?.startsWith('workbox-')))
  assert.ok(
    network.every(
      (request) =>
        new URL(request.url).origin === origin &&
        request.method === 'GET' &&
        !request.body &&
        !request.url.includes(prefix),
    ),
  )
  assert.ok(
    requests.every(
      (request) => request.method === 'GET' && !request.upload && !request.url.includes(prefix),
    ),
  )
  return {
    entries: retained.entries.length,
    databases: retained.databases,
    network: network.length,
  }
}

async function exerciseReader(page) {
  await page.evaluate(() => {
    const field = document.createElement('input')
    field.id = 'reader-fixture'
    field.type = 'file'
    field.hidden = true
    document.body.append(field)
  })
  const pick = (file) => page.locator('#reader-fixture').setInputFiles(file)
  const rotated = syntheticPdf('rotated', makeTestPdf())
  await pick(rotated)
  const result = await page.evaluate(async (path) => {
    const { openPdf } = await import(new URL(path, location.href).href)
    const field = document.getElementById('reader-fixture')
    const pdf = await openPdf(field.files[0])
    field.value = ''
    const canvas = document.createElement('canvas')
    const thumbnail = document.createElement('canvas')
    try {
      const { width, height, textItems } = await pdf.getPageData(1)
      const cancel = new AbortController()
      const nativeWidth = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width')
      Object.defineProperty(canvas, 'width', {
        configurable: true,
        get: () => nativeWidth.get.call(canvas),
        set(value) {
          nativeWidth.set.call(canvas, value)
          queueMicrotask(() => cancel.abort())
        },
      })
      const cancelled = await pdf
        .renderPage(1, canvas, { width: 800, pixelRatio: 2, signal: cancel.signal })
        .then(
          () => false,
          () => cancel.signal.aborted,
        )
      delete canvas.width
      await Promise.all([
        pdf.renderPage(1, canvas, { width: 96, pixelRatio: 1 }),
        pdf.renderPage(0, thumbnail, { width: 96, pixelRatio: 1 }),
      ])
      return {
        width,
        height,
        finite: textItems.every((item) => Object.values(item.bbox).every(Number.isFinite)),
        cancelled,
        rerender: [canvas.width, canvas.height],
        thumbnail: [thumbnail.width, thumbnail.height],
      }
    } finally {
      canvas.width = 0
      canvas.height = 0
      thumbnail.width = 0
      thumbnail.height = 0
      await pdf.close()
    }
  }, first.pdf)
  assert.deepEqual(result, {
    width: 160,
    height: 300,
    finite: true,
    cancelled: true,
    rerender: [96, 180],
    thumbnail: [96, 48],
  })

  await pick(syntheticPdf('large-page', makeLargeTestPdf(4)))
  const large = await page.evaluate(async (path) => {
    const { openPdf } = await import(new URL(path, location.href).href)
    const field = document.getElementById('reader-fixture')
    const pdf = await openPdf(field.files[0])
    field.value = ''
    const canvas = document.createElement('canvas')
    try {
      await pdf.renderPage(0, canvas, { width: 7500, pixelRatio: 3 })
      const dimensions = await pdf.getPageDimensions(0)
      return {
        dimensions,
        width: canvas.width,
        height: canvas.height,
        cssWidth: canvas.style.width,
      }
    } finally {
      canvas.width = 0
      canvas.height = 0
      await pdf.close()
    }
  }, first.pdf)
  assert.deepEqual(large.dimensions, { pageIndex: 0, width: 15000, height: 8000 })
  assert.equal(large.cssWidth, '7500px')
  assert.ok(
    large.width <= 4096 && large.height <= 4096 && large.width * large.height <= 8 * 1024 * 1024,
  )
}

async function resilience(context, name) {
  online = true
  const network = []
  context.on('request', (request) => {
    if (!/^https?:/.test(request.url())) return
    network.push({
      url: request.url(),
      method: request.method(),
      body: request.postDataBuffer()?.length ?? 0,
    })
  })
  const page = await context.newPage()
  await load(page, 'one')
  const data = await readFile(input('couleur.pdf'))
  const privateFile = { name: `${prefix}.pdf`, mimeType: 'application/pdf', buffer: data }
  const held = { ...privateFile, name: `${prefix}-held.pdf` }
  await page.evaluate((name) => {
    const arrayBuffer = File.prototype.arrayBuffer
    File.prototype.arrayBuffer = async function () {
      if (this.name === name) {
        await new Promise((release) => {
          window.releaseHeld = release
        })
      }
      return arrayBuffer.call(this)
    }
  }, held.name)
  await page.locator('input[type=file]').setInputFiles(held)
  await page.waitForFunction(() => !!window.releaseHeld)
  await importPdf(page, privateFile, privateFile.name)
  await page.evaluate(() => window.releaseHeld())
  await analyze(page)
  assert.equal(await page.getByRole('heading', { name: privateFile.name }).count(), 1)
  assert.equal(await page.getByRole('heading', { name: held.name }).count(), 0)
  await page.getByTestId('correction-mask').first().waitFor()
  await importPdf(page, input('qcm-cases.pdf'), 'qcm-cases.pdf')
  await analyze(page)
  assert.equal(
    await page.getByRole('status').filter({ hasText: '2 blocs de corrigé détectés' }).count(),
    1,
  )
  const mask = page.getByTestId('correction-mask').first()
  const canonicalPosition = await mask.getAttribute('style')
  await page.getByRole('button', { name: 'Zoom avant' }).click()
  await page.getByText('125 %', { exact: true }).waitFor()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: /Passer au thème/ }).click()
  assert.equal(await mask.getAttribute('style'), canonicalPosition)
  const privacy = await verifyPrivacy(page, network)
  online = false
  const invalid = {
    name: `${prefix}-invalid.pdf`,
    mimeType: 'application/pdf',
    buffer: Buffer.from('invalid fixture'),
  }
  for (const [file, message] of [
    [invalid, 'Impossible d’ouvrir ce PDF.'],
    [encrypted, 'Ce PDF est protégé par un mot de passe.'],
  ]) {
    await page.locator('input[type=file]').setInputFiles(file)
    await page.getByRole('alert').filter({ hasText: message }).waitFor()
    assert.equal(await page.locator('.reader canvas').count(), 0)
    await importPdf(page, privateFile, privateFile.name)
  }
  await page.reload()
  const graphics = syntheticPdf('graphics-only', makeGraphicsOnlyTestPdf())
  await importPdf(page, graphics, graphics.name)
  await analyze(page)
  const slider = page.getByRole('slider')
  await slider.waitFor()
  await slider.press('PageDown')
  assert.ok(Number(await slider.getAttribute('aria-valuenow')) > 0)
  await slider.press('Home')
  assert.equal(await slider.getAttribute('aria-valuenow'), '0')
  assert.ok((await page.getByTestId('progressive-mask').count()) > 1)
  await exerciseReader(page)
  await verifyPrivacy(page, network)
  console.log(
    JSON.stringify({ engine: name, privacy, errorRecovery: true, latestFile: true, offline: true }),
  )
}

async function update(context) {
  online = true
  deployment = first
  missing.length = 0
  assert.notEqual(first.pdf, second.pdf)
  const page = await context.newPage()
  await leaveDemoOffscreen(page)
  await load(page, 'one')
  assert.equal(await page.evaluate(() => globalThis.__pdfTestBuild), undefined)
  await page.evaluate(() => {
    window.firstController = navigator.serviceWorker.controller
  })
  deployment = second
  const state = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration()
    const checked = new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Timed out waiting for service worker update')),
        20000,
      )
      const inspect = () => {
        const stillControlledByFirst = navigator.serviceWorker.controller === window.firstController
        const waiting = registration.waiting?.state === 'installed'
        if (!waiting && (stillControlledByFirst || registration.active?.state !== 'activated'))
          return
        clearTimeout(timeout)
        resolve({ stillControlledByFirst, waiting })
      }
      registration.addEventListener('updatefound', () =>
        registration.installing?.addEventListener('statechange', inspect),
      )
      navigator.serviceWorker.addEventListener('controllerchange', inspect)
    })
    await registration.update()
    return checked
  })
  await page.locator('input[type=file]').setInputFiles(input('couleur.pdf'))
  const outcome = await Promise.race([
    page
      .getByRole('alert')
      .waitFor()
      .then(() => 'error'),
    page
      .getByRole('heading', { name: 'couleur.pdf' })
      .waitFor()
      .then(() => 'reading'),
  ])
  console.log(
    JSON.stringify({ oldTab: outcome, state, oldPdf: first.pdf, newPdf: second.pdf, missing }),
  )
  if (outcome !== 'reading')
    throw new Error('An open page could not import a valid PDF after deployment')
  assert.equal(await page.evaluate(() => globalThis.__pdfTestBuild), 'one')
  const blank = await context.newPage()
  await blank.goto(`${origin}/release-monitor`)
  const activation = blank.evaluate(async (scope) => {
    const registration = await navigator.serviceWorker.getRegistration(scope)
    const waiting = registration.waiting
    if (!waiting) return
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('The waiting worker did not activate')),
        15000,
      )
      waiting.addEventListener('statechange', () => {
        if (waiting.state !== 'activated') return
        clearTimeout(timeout)
        resolve()
      })
    })
  }, url)
  await page.close()
  await activation
  await load(blank, 'two')
  await importPdf(blank, input('couleur.pdf'), 'couleur.pdf')
  assert.equal(await blank.evaluate(() => globalThis.__pdfTestBuild), 'two')
  assert.equal(
    await blank.evaluate(
      (file) => caches.match(new URL(file, location.href)).then(Boolean),
      first.pdf,
    ),
    false,
  )
  online = false
  await blank.reload()
  await importPdf(blank, input('couleur.pdf'), 'couleur.pdf')
  assert.equal(await blank.evaluate(() => globalThis.__pdfTestBuild), 'two')
  console.log('New version reopened and loaded offline')
}

async function performance(context, files) {
  assert.ok(files.length, 'Pass PDF paths to benchmark, repeating paths for successive cycles')
  const page = await context.newPage()
  await leaveDemoOffscreen(page)
  await load(page, 'one')
  online = false
  await page.reload()
  await page.evaluate(
    async ({ pdf, detection }) => {
      window.bench = {
        ...(await import(new URL(pdf, location.href).href)),
        ...(await import(new URL(detection, location.href).href)),
      }
      const picker = document.createElement('input')
      picker.id = 'benchmark-file'
      picker.type = 'file'
      picker.hidden = true
      document.body.append(picker)
    },
    { pdf: first.pdf, detection: first.detection },
  )
  const session = await context.newCDPSession(page)
  const native =
    process.platform === 'win32' && process.env.UNSPOIL_NATIVE_MEMORY === '1'
      ? await context.browser().newBrowserCDPSession()
      : null
  const memory = async () => {
    await session.send('HeapProfiler.collectGarbage')
    const { usedSize } = await session.send('Runtime.getHeapUsage')
    return { jsBytes: usedSize, ...(native ? await getNativeMemory(native) : {}) }
  }
  const workers = () =>
    page.workers().filter((worker) => worker.url().includes('/pdf.worker')).length
  assert.equal(workers(), 0)
  console.log(
    JSON.stringify({ initialHeap: await memory(), browser: context.browser()?.version() }),
  )
  for (const file of files) {
    await page.locator('#benchmark-file').setInputFiles(resolve(file))
    const metrics = await page.evaluate(async () => {
      const { openPdf, detectCorrections } = window.bench
      const picker = document.getElementById('benchmark-file')
      const source = picker.files[0]
      picker.value = ''
      let start = globalThis.performance.now()
      const pdf = await openPdf(source)
      const openMs = globalThis.performance.now() - start
      start = globalThis.performance.now()
      const pages = []
      for (let index = 0; index < pdf.pageCount; index++) pages.push(await pdf.getPageData(index))
      const extractMs = globalThis.performance.now() - start
      const canvas = document.createElement('canvas')
      start = globalThis.performance.now()
      for (const index of [0, Math.floor(pdf.pageCount / 2), pdf.pageCount - 1]) {
        await pdf.renderPage(index, canvas, { width: 780, pixelRatio: 2 })
      }
      const renderMs = globalThis.performance.now() - start
      start = globalThis.performance.now()
      let rasterPages = 0
      const { kind } = await detectCorrections({
        pages,
        getRaster(index) {
          rasterPages++
          return pdf.getRaster(index)
        },
      })
      const detectMs = globalThis.performance.now() - start
      window.activeBenchmark = { pdf, canvas, pages }
      return {
        pages: pages.length,
        openMs,
        extractMs,
        renderMs,
        detectMs,
        rasterPages,
        kind,
        bitmapBytes: canvas.width * canvas.height * 4,
      }
    })
    const activeHeap = await memory()
    await page.evaluate(async () => {
      const { pdf, canvas } = window.activeBenchmark
      canvas.width = 0
      canvas.height = 0
      await pdf.close()
      delete window.activeBenchmark
    })
    const stop = Date.now() + 4000
    while (workers() && Date.now() < stop) await new Promise((resolve) => setTimeout(resolve, 25))
    assert.equal(workers(), 0)
    console.log(
      JSON.stringify({
        file,
        bytes: (await stat(file)).size,
        ...metrics,
        activeHeap,
        closedHeap: await memory(),
        workersAfterClose: workers(),
      }),
    )
  }
}

async function getNativeMemory(session) {
  const { processInfo } = await session.send('SystemInfo.getProcessInfo')
  const pids = processInfo.map(({ id }) => Number(id)).filter(Number.isSafeInteger)
  const { stdout } = await promisify(execFile)('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    `Get-Process -Id ${pids.join(',')} -ErrorAction SilentlyContinue | Select-Object Id,PrivateMemorySize64 | ConvertTo-Json -Compress`,
  ])
  const processes = [].concat(JSON.parse(stdout))
  const byType = {}
  let privateBytes = 0
  for (const process of processes) {
    const type = processInfo.find(({ id }) => Number(id) === process.Id)?.type ?? 'unknown'
    byType[type] = (byType[type] ?? 0) + process.PrivateMemorySize64
    privateBytes += process.PrivateMemorySize64
  }
  return { privateBytes, byType }
}

try {
  const engines =
    scenario === 'performance'
      ? [[chromium, 'Chromium', chromiumOptions]]
      : [
          [chromium, 'Chromium', chromiumOptions],
          [firefox, 'Firefox', {}],
          [webkit, 'WebKit', {}],
        ]
  for (const [engine, name, options] of engines) {
    if (scenario === 'performance') {
      const browser = await engine.launch(options)
      try {
        await performance(await browser.newContext(), process.argv.slice(3))
      } finally {
        await browser.close()
      }
      continue
    }
    const context = await engine.launchPersistentContext('', options)
    try {
      if (scenario === 'update') await update(context)
      else await resilience(context, name)
    } finally {
      await context.close()
    }
  }
} finally {
  server.close()
}
