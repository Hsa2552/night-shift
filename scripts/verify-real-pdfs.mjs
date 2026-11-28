import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { basename, isAbsolute, relative, resolve } from 'node:path'
import { chromium } from 'playwright-core'

const [url, expectedSha, ...files] = process.argv.slice(2)
assert.ok(
  url && /^[a-f0-9]{40}$/.test(expectedSha ?? '') && files.length,
  'Usage: node scripts/verify-real-pdfs.mjs <URL locale> <SHA Git complet> <PDF>...',
)
const origin = new URL(url)
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname))

const saveTo = process.env.UNSPOIL_RECETTE_SORTIE
if (saveTo) {
  const path = relative(process.cwd(), resolve(saveTo))
  assert.ok(isAbsolute(path) || path.startsWith('..'), 'Écris le rapport privé hors du dépôt.')
}

const browser = await chromium.launch({ channel: process.env.UNSPOIL_CHANNEL || 'msedge' })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await context.route('**/*', (route) =>
  new URL(route.request().url()).origin === origin.origin ? route.continue() : route.abort(),
)
const results = []
const readSha = (page) => page.locator('meta[name=unspoil-build]').getAttribute('content')

async function openCovered(page, file) {
  await page.locator('input[type=file]').setInputFiles(file)
  await page.getByRole('heading', { name: basename(file), exact: true }).waitFor()
  const pages = await page.locator('[data-reader-page]').count()
  await page.getByTestId('page-cover').first().waitFor()
  assert.equal(await page.getByTestId('page-cover').count(), pages)
  const hidden = await page
    .locator('.pdf-viewer canvas')
    .evaluateAll((canvases) =>
      canvases.every((canvas) => getComputedStyle(canvas).visibility === 'hidden'),
    )
  assert.ok(hidden)
  return pages
}

const masksOf = (page) =>
  page.getByTestId('correction-mask').evaluateAll((masks) =>
    masks.map((mask) => {
      const parent = mask.parentElement
      const [w, h] = parent.style.aspectRatio.split('/').map(Number)
      const style = getComputedStyle(mask)
      return {
        pageIndex: Number(parent.closest('[data-reader-page]').dataset.readerPage),
        bbox: {
          x: (parseFloat(mask.style.left) * w) / 100,
          y: (parseFloat(mask.style.top) * h) / 100,
          width: (parseFloat(mask.style.width) * w) / 100,
          height: (parseFloat(mask.style.height) * h) / 100,
        },
        opaque: style.backgroundColor === 'rgb(255, 255, 255)' && style.opacity === '1',
      }
    }),
  )

try {
  for (const file of files) {
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    // The shortest function around the unique ID prefix is analyzeColorPage in the bundle.
    const cdp = await context.newCDPSession(page)
    await cdp.send('Debugger.enable')
    await cdp.send('Profiler.enable')
    await cdp.send('Profiler.startPreciseCoverage', { callCount: true, detailed: true })
    await page.goto(origin.href)
    assert.equal(await readSha(page), expectedSha)
    const pages = await openCovered(page, file)
    const start = performance.now()
    await page.getByRole('button', { name: 'Masquer les corrigés', exact: true }).click()
    await page.waitForFunction(() =>
      document.querySelector('.reader-modes [aria-pressed=true], [role=alert]'),
    )
    const durationMs = Math.round(performance.now() - start)
    const warning = await page.getByRole('alert').count()
    assert.equal(warning, 0)
    const fallback = (await page.getByTestId('progressive-mask').count()) === pages
    const masks = await masksOf(page)
    assert.ok(masks.every(({ opaque }) => opaque))
    let colorCalls = null
    const { result: coverage } = await cdp.send('Profiler.takePreciseCoverage')
    for (const script of coverage.filter(
      ({ url }) => url.startsWith(origin.href) && url.endsWith('.js'),
    )) {
      const { scriptSource } = await cdp.send('Debugger.getScriptSource', {
        scriptId: script.scriptId,
      })
      const marker = scriptSource.indexOf('visual-color-')
      if (marker < 0) continue
      const surrounding = script.functions
        .map(({ ranges }) => ranges[0])
        .filter(({ startOffset, endOffset }) => startOffset < marker && marker < endOffset)
        .sort((a, b) => a.endOffset - a.startOffset - (b.endOffset - b.startOffset))
      colorCalls = surrounding[0]?.count ?? 0
    }

    const blocks = []
    const actions = await page
      .locator('[data-block-action]')
      .evaluateAll((buttons) => buttons.map((b) => b.dataset.blockAction))
    for (const id of new Set(actions)) {
      const button = page.locator('[data-block-action=' + JSON.stringify(id) + ']')
      await button.evaluate((el) => el.click())
      await page
        .locator('[data-revealed][data-block-action=' + JSON.stringify(id) + ']')
        .waitFor({ state: 'attached' })
      const remaining = (await masksOf(page)).map((mask) => JSON.stringify(mask))
      const regions = masks.filter((mask) => {
        const index = remaining.indexOf(JSON.stringify(mask))
        if (index === -1) return true
        remaining.splice(index, 1)
        return false
      })
      assert.ok(regions.length > 0)
      await button.evaluate((el) => el.click())
      await page.waitForFunction(
        (n) => document.querySelectorAll('[data-testid=correction-mask]').length === n,
        masks.length,
      )
      blocks.push({ id, regions })
    }

    if (!fallback) {
      if (masks.length) {
        await page.getByRole('button', { name: 'Zoom avant' }).click()
        const error = await page.getByTestId('correction-mask').evaluateAll((elements) =>
          Math.max(
            ...elements.map((el) => {
              const p = el.parentElement.getBoundingClientRect()
              const b = el.getBoundingClientRect()
              return Math.max(
                Math.abs(b.left - p.left - (p.width * parseFloat(el.style.left)) / 100),
                Math.abs(b.top - p.top - (p.height * parseFloat(el.style.top)) / 100),
                Math.abs(b.width - (p.width * parseFloat(el.style.width)) / 100),
                Math.abs(b.height - (p.height * parseFloat(el.style.height)) / 100),
              )
            }),
          ),
        )
        assert.ok(error < 1.1)
      }
      const lastPage = page.locator('[data-reader-page]').last()
      await lastPage.scrollIntoViewIfNeeded()
      await lastPage.locator('canvas').waitFor({ state: 'visible' })
      await page.waitForFunction(
        () => document.querySelector('[data-reader-page]:last-child canvas')?.width > 0,
      )
      await page.getByRole('button', { name: 'Révélation progressive', exact: true }).click()
    }
    assert.equal(await page.getByTestId('progressive-mask').count(), pages)
    await page.getByRole('slider').press('ArrowDown')
    const borders = await page
      .getByTestId('progressive-mask')
      .evaluateAll((elements) => elements.map((el) => parseFloat(el.style.top)))
    assert.ok(borders[0] > 0 && borders.slice(1).every((top) => top === 0))
    assert.deepEqual(errors, [])
    const serviceWorker = await page.evaluate(
      async () => (await navigator.serviceWorker.getRegistration())?.scope,
    )
    results.push({
      file: basename(file),
      sha: expectedSha,
      pages,
      durationMs,
      fallback,
      colorCalls,
      blocks,
      serviceWorker,
    })
    console.log(
      JSON.stringify({
        file: basename(file),
        sha: expectedSha,
        pages,
        durationMs,
        fallback,
        colorCalls,
        blocks: blocks.length,
        masks: masks.length,
        serviceWorker,
      }),
    )
    await page.close()
  }
  const cachePage = await context.newPage()
  await cachePage.goto(origin.href)
  await cachePage.waitForFunction(() => navigator.serviceWorker.controller)
  await context.setOffline(true)
  await cachePage.reload()
  assert.equal(await readSha(cachePage), expectedSha)
  await openCovered(cachePage, files[0])
  console.log(JSON.stringify({ sha: expectedSha, offlineReloadAndImport: true }))
  if (saveTo) await writeFile(saveTo, JSON.stringify(results))
} finally {
  await browser.close()
}
